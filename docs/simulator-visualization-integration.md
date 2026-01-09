# Simulator and Visualization Integration

This document describes how `packages/simulator` and `packages/visualisation` communicate, what events flow in each direction, and how experiments, sessions and data rendering work in the current codebase.

## Overview

- Real-time over Socket.IO
- Backend: `packages/simulator/web/index.ts` (Express + Socket.IO); routes and socket handlers in `packages/simulator/web/routes.ts`
- Frontend: `packages/visualisation` (React/Vite) connects via a Socket.IO client in hooks under `src/hooks`

```
Simulator (server)  ⇄  Visualization (client)
```

## Two modes: Global simulation vs Session replay

- Global simulation ("live")

  - Started via socket `startSimulation` from the UI (e.g., from Saved Datasets)
  - Persists an experiment document in Elasticsearch (index `experiments`) with id and metadata
  - Visualisation listens via `joinMap` and receives global events

- Session replay / sequential session (comparison)
  - Started via `startSessionReplay` (VROOM replay) or `startSequentialSession` (original data replay)
  - Does NOT persist a new experiment document. Sequential sessions are also marked `isReplay: true` to skip metadata writes
  - Events are scoped to a session room with `sessionId` and payload wrapper

## Server-side (key files)

- `packages/simulator/web/index.ts`

  - REST API for experiments/datasets and helper endpoints (e.g., `prepare-replay`, `prepare-sequential`)
  - GET `/api/experiments` returns only optimized experiments: either explicitly `experimentType === 'vroom'` or those with VROOM truck plans (via `vehicleCount > 0`)
  - GET `/api/experiments/:experimentId` returns one experiment by id

- `packages/simulator/web/routes.ts`

  - Socket handlers
  - `startSimulation`: creates a new global experiment and emits `simulationStarted`
  - `startSessionReplay`: creates a non-persistent session experiment and emits `sessionStarted`
  - `startSequentialSession`: creates a non-persistent session experiment and emits `sessionStarted`

- `packages/simulator/web/controllers/ExperimentController.ts`

  - `createGlobalExperiment(...)`: creates and persists experiment metadata
  - `createSessionExperiment(...)`: creates a session-scoped experiment; used by replay and sequential
  - We set `isReplay: true` for sequential sessions to avoid saving a new ES experiment document

- `packages/simulator/index.ts`
  - Engine that wires regions, streams and statistics
  - If `isReplay` is true, experiment metadata is not saved to Elasticsearch

## Events and payloads

- Global (no session):

  - `simulationStatus`, `simulationStarted`, `simulationStopped`
  - `cars`, `bookings`, `parameters`, `time`
  - Payloads are raw objects/arrays

- Session (replay/sequential):
  - `sessionStarted`, `sessionStopped`, `sessionError`
  - `cars`, `bookings`, `virtualTime` are sent as `{ sessionId, payload }`
  - Frontend components (e.g., `SimulationView`) unwrap and filter by `sessionId`

## Client-side (key files)

- `packages/visualisation/src/hooks/useMapSocket.ts`

  - Socket connection for the map and helpers to emit control events

- `packages/visualisation/src/pages/MapPage.tsx`

  - Subscribes to global events; shows the live map when a global experiment is running
  - Fetches `experiment` by `experimentId` and passes `areaPartitions` to `Map`

- `packages/visualisation/src/components/common/SimulationView.tsx`

  - Starts session replay/sequential via REST prepare endpoints and then socket start events
  - Listens to session-scoped events with `{ sessionId, payload }`

- `packages/visualisation/src/components/Map.tsx`
  - Renders vehicles, bookings, destinations, optional arcs and polygons
  - Supports toggling layers via `SettingsMenu`
  - Renders area partitions as polygons when `areaPartitions` prop is provided

## Area partitions

- Backend may store area partitions on the experiment document (`experiments.areaPartitions`)
- Frontend passes `experiment.areaPartitions` to `Map`:
  - Experiment comparison view passes directly via `SimulationView`
  - Live map (`MapPage`) fetches the current experiment and forwards partitions to `Map`
  - Layer toggle "Area partitioner (kluster)" controls visibility

## Control flow (client → server)

- Global:

  - `startSimulation` (dataset-based global run)
  - `stopSimulation`
  - `joinMap` / `leaveMap`

- Session:
  - Prepare via REST: `/api/simulation/prepare-replay` or `/api/simulation/prepare-sequential`
  - Start via socket: `startSessionReplay` or `startSequentialSession`
  - Time controls: `sessionPlay` / `sessionPause` / `sessionSpeed` / `sessionReset`

## Performance

- RxJS on the server: streams per entity type (cars, bookings, time)
- Throttling and buffering (e.g., volatile emits, throttleTime) to reduce network load
- Client merges/upserts incoming lists by id

## Configuration

- Simulator: `PORT`, `ELASTICSEARCH_URL`
- Visualization: `VITE_SIMULATOR_URL`, `VITE_MAPBOX_ACCESS_TOKEN`

## Experiments listing

- Server returns only optimized experiments to the UI (VROOM runs)
- Sequential/session replays do not create new experiment documents

This reflects the current code paths and event shapes in the repository.

## Cluster transitions (last→first) and debug layers

This section explains how the system computes and renders transitions from the last pickup in one cluster (area partition) to the first pickup in the next cluster, and how to use the debug layers in the map to inspect them.

### Backend responsibilities

- Clustering and persistence

  - File: `packages/simulator/lib/clustering.ts`
  - Produces area partitions per `truckId` and persists them to the `experiments` document in Elasticsearch under `areaPartitions`.
  - Merge behavior: when saving, the code now removes existing partitions only for the `truckId`s being written, then appends the new ones, so partitions from other trucks remain intact.

- VROOM planning across clusters

  - File: `packages/simulator/lib/dispatch/truckDispatch.ts`
  - Each cluster is optimized with VROOM. The start for cluster N+1 is dynamically set to the last pickup location of cluster N (`currentStart`).
  - When large clusters are subdivided, an explicit `idToBooking` mapping is carried through and used when merging results to reliably map VROOM steps back to bookings.

- Partition save trigger per truck
  - File: `packages/simulator/lib/vehicles/truck.ts`
  - After a truck obtains its plan (VROOM or replay), it calls `createSpatialChunks(...)` to persist that truck’s partitions, ensuring all vehicles’ partitions are saved.

### Data available to the frontend

- `experiments._doc[experimentId].areaPartitions`: polygons, centroids, names, and `truckId`s for all clusters.
- `vroomPlan.routes`: per-vehicle routes with ordered `steps` (including `type: 'pickup'`). The frontend uses these steps to determine actual last/first points inside partitions.

### Frontend rendering of transitions

- File: `packages/visualisation/src/components/Map.tsx`
- The map exposes debug toggles through `SettingsMenu` (see `packages/visualisation/src/components/SettingsMenu/*`):

  - Enable Debug mode
  - Show cluster centroids
  - Show cluster order
  - Show transitions (last→first)

- When "Show transitions (last→first)" is enabled:

  1. For each route in `vroomPlan.routes`, the code filters steps to `type: 'pickup'`.
  2. Each pickup coordinate is mapped to a partition using point-in-polygon (with bounding-box fallback).
  3. For every visited partition in the route, the first and last pickup coordinates are captured.
  4. For each consecutive pair of visited partitions `(Pi, Pi+1)`, a segment is drawn from `last(Pi)` to `first(Pi+1)`.
  5. Endpoint markers are rendered: red for the end of the current partition and green for the start of the next.

- Additional debug layers:
  - Centroids and labels (`K#order • count • types`) with zoom-aware sizing and dark backgrounds for readability.
  - Cluster order path per vehicle for a quick macro overview (greedy nearest-neighbor through centroids; for analysis only, not the exact VROOM path).
  - Area partitions are drawn with reduced opacity in debug mode to improve contrast with overlays.

### Usage tips

- Start a VROOM-optimized simulation or open an experiment so that both `areaPartitions` and `vroomPlan.routes` are available.
- In the Layers menu, enable Debug mode and toggle on "Show transitions (last→first)". Optionally enable centroids and cluster order for additional context.
- Transitions are computed for all vehicles, not just the active one.

### Troubleshooting

- Missing transitions: ensure `vroomPlan.routes` is fetched on the frontend (see `packages/visualisation/src/pages/MapPage.tsx`) and that pickup steps exist.
- Partitions missing: verify the `experiments` document contains `areaPartitions` for all trucks. Because the backend merges by `truckId`, both vehicles need to trigger `createSpatialChunks(...)` after planning to persist their partitions.
