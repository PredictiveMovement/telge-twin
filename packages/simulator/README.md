# Booking engine proof of concept

## Goals

1. Test how much work that is needed to create a state of the art routing engine
2. Verify OSRM as an alternative to Google Maps
3. How many bookings per second can be handled with a custom built engine?
4. Find new unknowns

## Clustering System

The simulator includes a sophisticated spatial clustering system for optimizing waste collection routes. The clustering module (`lib/clustering.ts`) groups bookings based on geographical proximity using the DBSCAN algorithm.

### Key Features

- **DBSCAN Clustering**: Groups bookings within configurable distance (default 500m)
- **Noise Point Assignment**: Outlier bookings are assigned to nearest clusters
- **Partition Merging**: Small clusters can be merged with nearby ones for efficiency
- **Configurable Parameters**: All clustering behavior can be configured via `lib/config.ts`
- **Turf.js Integration**: Uses Turf.js for accurate geographical calculations

### Configuration

Key clustering parameters in `CLUSTERING_CONFIG`:

- `TRUCK_DBSCAN_EPS_METERS`: Maximum distance between cluster points (default: 500m)
- `DBSCAN_MIN_SAMPLES`: Minimum bookings to form a cluster (default: 5)
- `MIN_PARTITION_SIZE`: Minimum cluster size before merging (default: 50)
- `ENABLE_NOISE_ASSIGNMENT`: Assign outliers to nearest clusters (default: true)

## Setup

This PoC uses a routing engine based on Open Street Database. https://github.com/Project-OSRM/osrm-backend/wiki/Server-api

To start the engine, just run:

    docker-compose up

IMPORTANT! It will take about five minutes the first time to download the latest maps and calculate the in-memory model. The server is very bad at giving progress report so please give it some time before aborting the progress.

## Tests

### Running Tests

The simulator includes various unit tests. To run them:

**All tests (from simulator package):**

```bash
npm test
```

**Watch mode:**

```bash
npm run watch
```

**Specific test file:**

```bash
npm test -- --testPathPattern=clustering.test.ts
```

### What the tests cover

- Clustering utils (`__tests__/unit/clustering.test.ts`)
- Truck-dispatch utilities for chunk split/merge (`__tests__/unit/truckDispatch.utils.test.ts`)
- Truck-dispatch ordering via mocked TSP (`__tests__/unit/truckDispatch.orderChunks.test.ts`)
- Vehicle/Car basic behaviors without OSRM network dependency (`__tests__/unit/car.ts`)
- Fleet buffering/dispatcher smoke (`__tests__/unit/fleet.buffering.test.ts`)
- Fleet and Municipality stream wiring (`__tests__/unit/fleet.ts`, `__tests__/unit/municipality.ts`)
- VROOM cache normalization behavior (`__tests__/unit/vroom.cache-and-validate.test.ts`)
- VROOM mapping from booking/truck to API payload (`__tests__/unit/vroom.mapping.test.ts`)
- Queue concurrency & delay semantics (`__tests__/unit/queueSubject.concurrency.test.ts`)
- Virtual time progression and pause/play (`__tests__/unit/virtualTime.ts`)

Notes:

- Tester undviker externa beroenden (OSRM/VROOM) genom mockar eller begränsade asserts.
- Turf ESM-problem kringgås via Jest-mockar konfigurerade i `jest.config.js` och `__mocks__/turf.js`.
- Central dispatch (lib/dispatch/dispatchCentral.ts) har för närvarande pass‑through-beteende; testet `dispatch.ts` återspeglar detta.

### Unit test suite overview

- `__tests__/unit/clustering.test.ts`: center, bounds och chunking (mockad Turf)
- `__tests__/unit/truckDispatch.utils.test.ts`: `simpleGeographicSplit`, `combineSubResults`
- `__tests__/unit/truckDispatch.orderChunks.test.ts`: mockar `vroom.plan` och klustring för att verifiera ordning mellan chunk
- `__tests__/unit/car.ts`: kö- och planlogik utan nätverk (mockad navigation)
- `__tests__/unit/fleet.buffering.test.ts`: buffering/dispatcher init (fake timers)
- `__tests__/unit/fleet.ts`: min-konfiguration och stream‑wiring
- `__tests__/unit/municipality.ts`: fleet‑stream och municipality‑wiring enligt nuvarande konstruktor
- `__tests__/unit/vroom.cache-and-validate.test.ts`: tidsfönster normaliseras i cache‑nyckel
- `__tests__/unit/vroom.mapping.test.ts`: mapping för shipments/vehicles från bookings/trucks
- `__tests__/unit/queueSubject.concurrency.test.ts`: sekventiell completion och delay vid kökörning
- `__tests__/unit/virtualTime.ts`: `now()`, pause/play och tidsprogression (via subscription)

### Clustering Tests

The clustering module is tested with comprehensive unit tests in `__tests__/unit/clustering.test.ts`. These tests verify:

- **calculateCenter**: Calculates the geographical center of bookings
- **calculateBoundingBox**: Finds the min/max coordinates for a set of bookings
- **createSpatialChunks**: Groups bookings into spatial clusters using DBSCAN algorithm

**Run clustering tests:**

```bash
npm test -- --testPathPattern=clustering.test.ts
```

The tests use mocked implementations to avoid ESM module issues with dependencies like `@turf/turf`.

### Tips för snabbare lokala körningar

- Kör en specifik testsuite vid utveckling:
  ```bash
  npm test -- --testPathPattern=truckDispatch.utils.test.ts
  ```
- Kör i watch-läge:
  ```bash
  npm run watch
  ```

### Felhantering

- Om Jest inte avslutar direkt efter körning: testa `--detectOpenHandles` för att hitta öppna timers/streams.
  ```bash
  npx jest --detectOpenHandles
  ```

### Test Configuration

Tests are configured in `jest.config.js`:

- Both TypeScript and JavaScript test files are supported
- Uses `ts-jest` for TypeScript compilation
- Tests run in Node environment
- Test files should be placed in `__tests__/` directory

### Building Before Testing

Make sure the TypeScript code is compiled before running tests:

```bash
npm run build
npm test
```

## Generate citizens

To have repeatable experiments we need to have a fixed amount of citizens with predictable needs. To achieve this we store our citizens in a file
`data/citizens.json`. If we want more or less we need to modify and re-run this script which will create more or less citizens by overwriting the
`citizens` data-file.

A bit about the nomeclature: We call a person a citizen when it is not in a vehicle or have any travel intentions. When the citizen has travel plans
or is traveling we call him/her a passenger.

    node scripts/generateCitizens.js

Run:

    node citizenGenerator.js

## Concepts

The idea uses two streams of events to simulate a real world scenario:

1. Cars. 1650 simulated taxis driving in Stockholm. They move in random direction two times every second.
2. Bookings. Two new bookings on random addresses every second.

## Flow

The idea is to create an engine and dispatch mechanism that can:

1. Handle all bookings and pre-bookings in realtime
2. Find the x closest cars
3. Set up a virtual perimiter of x driving minutes to the booking position
4. Select the best suitable car of those wihin that perimiter
5. Suitable car should be both from the drivers perspective* and the customer*
6. The suitable cars should be offered the booking with the option to reject the booking
7. Within seconds the average booking should be assigned a car and an estimated time of arrival

## Suitable cars

To select a suitable car, these rules should be evaluated:

1. Never let a passenger wait longer than neccessary so...

If we can choose, select a car that:

2a. Have an unused prio-pass
2b. Have waited longest since its last drive
2c. Haven't rejected a booking recently

If we still can choose, select a car that:

3a. Have premium status to our VIP customers
3b. Have gold/silver/bronze status to our loyal customers

## Prio-pass and "bad bookings"

If a driver gets a "bad booking" they can be assigned a prio-pass- which means they will be sorted top in the next sorting. A "bad booking" is a very short booking or a booking in the wrong direction.

## Logging

All choices should be able to backtrace- why did we choose in a certain way when we did.
