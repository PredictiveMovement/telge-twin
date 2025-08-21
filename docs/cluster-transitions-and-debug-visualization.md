# Cluster transitions and debug visualization

This document explains how the simulator computes cluster transitions ("last booking in one partition → first booking in the next"), how the results are persisted, and how the frontend renders the corresponding debug visualization.

## Scope and terminology

- **Partition (area partition)**: A cluster of bookings produced by the clustering step (DBSCAN + merging and noise assignment).
- **Transition**: A segment drawn from the last picked booking in partition A to the first picked booking in partition B in the final truck route.
- **Route**: The final, per-vehicle plan produced by VROOM, containing steps (pickup, delivery, start, end, etc.).

## Backend: how transitions become determinable

### 1) Clustering and partitions

- File: `packages/simulator/lib/clustering.ts`
- Produces area partitions (polygons) per `truckId`.
- Persists them into the experiment document in Elasticsearch under `experiments._doc[experimentId].areaPartitions`.
- Important change: when saving partitions, we now merge by `truckId`. We remove existing partitions only for the trucks involved in the current save, then append new ones, preserving other trucks' partitions. This ensures all vehicles' partitions co-exist.

### 2) Per-cluster VROOM planning with dynamic start

- File: `packages/simulator/lib/dispatch/truckDispatch.ts`
- For each truck, clusters are optimized individually. The start location for the next cluster’s VROOM run is set to the last pickup location from the previous cluster.
  - Implementation detail: a `currentStart` variable is updated after each cluster plan is created, and used as the `start` for the next cluster’s `truckToVehicle` input.
- Subdivision of large clusters: when clusters are split into sub-chunks, we preserve a mapping from VROOM internal step IDs to actual bookings via `idToBooking`.
- When merging VROOM chunk results into a single plan, we prefer the `idToBooking` mapping (falling back to previous heuristics only if necessary). This ensures we can reliably identify which booking each `pickup` step corresponds to.

### 3) Triggering partition persistence per truck

- File: `packages/simulator/lib/vehicles/truck.ts`
- After a truck receives its plan (either from VROOM or replay), it calls `createSpatialChunks(queue, experimentId, truckId)`, which saves that truck’s partitions. This guarantees all trucks actually write their partitions for the current run.

## Data persisted in Elasticsearch

- Index: `experiments`
- Document fields relevant here:
  - `areaPartitions`: array of objects `{ id, truckId, name, centroid, polygon, ... }`.
  - `areaPartitionsTimestamp`: ISO timestamp for last write.
  - `vroomPlan` (accessible via backend routes for the running experiment): contains `routes`, one per vehicle, with ordered `steps` (including `type: 'pickup'`).

## Frontend: rendering transitions and debug layers

File: `packages/visualisation/src/components/Map.tsx`

### Debug toggles (Layers menu)

- Implemented in `LayersMenu` and `useLayersMenu` and passed into `Map`:
  - Enable Debug mode
  - Show cluster centroids
  - Show cluster order
  - Show transitions (last→first)

### Layers involved

- Area partitions layer: polygon fill of partitions.
  - In debug mode we slightly reduce fill opacity to increase contrast for debug overlays.
- Centroid point layer: cluster centroids.
- Centroid label layer: labels for centroids, formatted as `K#order • count • types`, with zoom-aware text size and a dark background for legibility.
- Cluster order path layer: shows per-vehicle cluster visit order, starting from the chosen car’s current position and following a greedy nearest-neighbor order through partitions (for quick visual reference of the macro order).
- Transitions layer (the focus of this doc): draws segments representing transitions between clusters using actual pickup points from the final VROOM plan, not centroid-to-centroid.
- Transition endpoints layer: draws markers for the last pickup in cluster A (red) and the first pickup in cluster B (green), with white stroke for contrast.

### How transitions are computed in the UI

1. We consume the server-provided `vroomPlan.routes` array.
2. For each route (vehicle):
   - Filter `steps` for those with `type === 'pickup'`.
   - For each pickup step, compute which partition it belongs to by testing the step’s coordinate against partitions:
     - First try point-in-polygon; if needed, fallback to bounding-box check.
   - Using first appearance of each partition in the route, derive the ordered list of partitions visited by that vehicle: `[P1, P2, P3, ...]`.
   - For each partition, compute:
     - `firstByPartition`: coordinate of the first pickup step that falls in that partition.
     - `lastByPartition`: coordinate of the last pickup step that falls in that partition.
3. For each consecutive pair `(Pi, Pi+1)` in the ordered partition list, draw a transition segment from `lastByPartition[Pi]` to `firstByPartition[Pi+1]`.
4. Add endpoint markers:
   - Start of segment (first in next partition): green `[0, 220, 120, 255]`.
   - End of segment (last in current partition): red `[230, 60, 60, 255]`.
   - Markers include a white border for visibility.

Notes:

- We render transitions for all vehicles, not just the active car.
- Colors per vehicle/route are derived consistently using `getPartitionColor(vehicleId)` where applicable; transition segments themselves are drawn in a cyan-like tone for clarity.

## Why not centroid-to-centroid?

- Using centroids would be misleading for operational analysis. The real-world transition is determined by where the truck actually finishes in cluster A (last pickup) and where it actually begins in cluster B (first pickup). The implemented logic uses those precise coordinates from the VROOM plan.

## Edge cases and fallbacks

- If a partition has only a single pickup in the route, `first` and `last` coincide.
- If a pickup step cannot be mapped by point-in-polygon due to numeric/floating differences, we fallback to a quick bounding-rectangle check.
- If, for any reason, a route has no `pickup` steps mapped to a partition, that partition is skipped in transitions.
- When a cluster is subdivided for VROOM, the mapping `idToBooking` is preserved to correctly resolve which booking a step belongs to.

## How to use in the UI

- Start a simulation (VROOM-optimized) or load an experiment with partitions and plan.
- Open the Layers menu and enable:
  - Debug mode
  - Show transitions (last→first)
  - Optionally enable centroids and cluster order for additional context
- Hover to see tooltips; zoom in for clearer labels. All standard layers remain available.

## Ensuring all partitions appear

- The backend writes partitions per truck. If you see only some partitions, verify the experiment document:
  - Ensure both trucks wrote their partitions (the merge preserves other trucks’ entries).
  - Confirm `areaPartitions` includes all expected entries and that `truckId`s differ between vehicles.

## Relevant files and responsibilities

- Backend
  - `packages/simulator/lib/clustering.ts`: clustering, partition merging and persistence
  - `packages/simulator/lib/dispatch/truckDispatch.ts`: cluster-by-cluster VROOM planning, dynamic starts, id-to-booking mapping, result merging
  - `packages/simulator/lib/vehicles/truck.ts`: triggers partition save after plan is set
- Frontend
  - `packages/visualisation/src/components/Map.tsx`: all map layers and debug overlays
  - `packages/visualisation/src/components/LayersMenu/*`: UI toggles for debug mode
  - `packages/visualisation/src/pages/MapPage.tsx`: fetches `vroomPlan` and passes to `Map`

## Troubleshooting

- Missing transitions on map:
  - Ensure `vroomPlan.routes` is present in the frontend (network tab) for the active experiment.
  - Verify pickups exist in route steps.
  - Check point-in-polygon mapping; if geometries changed, confirm polygons and coordinate precision.
- Only some partitions visible:
  - Inspect the experiment document in Elasticsearch and verify that `areaPartitions` contains entries from all trucks.
  - Confirm both trucks executed `createSpatialChunks` after their plans were set.

This flow provides an analysis-friendly view of inter-cluster movement that matches the actual optimized plan, enabling validation and tuning of clustering and routing strategies.
