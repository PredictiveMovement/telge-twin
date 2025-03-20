# Clustering System Documentation

## Overview

The clustering system is used to optimize the processing of bookings by grouping them based on geographical proximity. This helps reduce computational complexity when planning routes, especially when dealing with a large number of bookings.

## Key Components

### Clustering by Postal Code

The `clusterByPostalCode` function groups bookings that share the same postal code prefix. This creates geographical clusters of bookings that are likely to be close to each other.

```javascript
clusterByPostalCode((maxClusters = 200), (length = 4))
```

**Parameters:**

- `maxClusters`: Maximum number of clusters to create (default: 200)
- `length`: Number of characters from the postal code to use for clustering (default: 4)

**Behavior:**

- Only performs clustering if the number of bookings exceeds `maxClusters`
- Groups bookings by the first `length` characters of their postal codes
- For clusters with multiple bookings, it returns the first booking with all other bookings attached as `groupedBookings`
- Single-booking clusters return just the booking

### Calculating Cluster Centers

The `calculateCenters` function calculates the geographical center of each cluster:

```javascript
calculateCenters(groups)
```

**Behavior:**

- Takes groups of bookings (organized by postal code)
- For each group, calculates the average latitude and longitude
- Returns an array of objects containing the postal code, center coordinates, and associated bookings

### VROOM Integration

The clustering system integrates with VROOM (Vehicle Routing Open-source Optimization Machine) for route optimization:

1. `convertToVroomCompatibleFormat()` - Converts bookings and vehicles to a format compatible with VROOM
2. `planWithVroom()` - Sends data to the VROOM planner and receives optimized routes
3. `convertBackToBookings()` - Transforms VROOM's response back into booking assignments

## Workflow

1. Bookings are clustered by postal code to reduce complexity
2. Data is converted to VROOM format
3. VROOM plans optimized routes
4. Results are converted back to booking-vehicle assignments

## Real-World Implementation

The clustering system is implemented in the `Fleet` class (`fleet.js`) to optimize booking dispatch:

```javascript
// From fleet.js
startDispatcher() {
  this.dispatchedBookings = this.unhandledBookings.pipe(
    bufferTime(1000),
    filter((bookings) => bookings.length > 0),
    clusterByPostalCode(200, 5), // cluster bookings if we have more than what Vroom can handle
    withLatestFrom(this.cars.pipe(toArray())),
    tap(([bookings, cars]) => {
      info(
        `Fleet ${this.name} received ${bookings.length} bookings and ${cars.length} cars`
      )
    }),
    convertToVroomCompatibleFormat(),
    planWithVroom(),
    convertBackToBookings(),
    filter(({ booking }) => !booking.assigned),
    mergeMap(({ car, booking }) => {
      return car.handleBooking(booking)
    }),
    catchError((err) => {
      error(`Error handling bookings for ${this.name}:`, err)
      return of(null)
    })
  )
  return this.dispatchedBookings
}
```

Key aspects of this implementation:

1. **Buffering Bookings:** The system collects bookings for 1 second using `bufferTime(1000)` before processing them as a batch
2. **Clustering:** Uses `clusterByPostalCode(200, 5)` to group nearby bookings, using 5 characters from postal codes
3. **Pairing with Vehicles:** Combines booking clusters with available vehicles using `withLatestFrom()`
4. **Route Optimization:** Processes bookings through the VROOM pipeline:
   - `convertToVroomCompatibleFormat()`
   - `planWithVroom()`
   - `convertBackToBookings()`
5. **Assignment:** Assigns each booking to its optimal vehicle using `car.handleBooking(booking)`

The dispatcher processes unhandled bookings in an RxJS pipeline, where clustering efficiently reduces the complexity for the VROOM route optimization engine.

## Usage Example

```javascript
const { from } = require("rxjs")
const {
  clusterByPostalCode,
  convertToVroomCompatibleFormat,
  planWithVroom,
  convertBackToBookings,
} = require("./clustering")

// Sample pipeline
from([bookings, cars])
  .pipe(
    clusterByPostalCode(200, 4), // Cluster bookings by postal code
    convertToVroomCompatibleFormat(), // Convert to VROOM format
    planWithVroom(), // Plan routes using VROOM
    convertBackToBookings() // Convert back to booking assignments
  )
  .subscribe((result) => {
    console.log("Optimized booking-vehicle assignments:", result)
  })
```

This clustering system efficiently handles large numbers of bookings by grouping them geographically before planning, which significantly reduces computational complexity while maintaining routing quality.
