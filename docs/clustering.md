# Clustering (truck-level) — how it works today

This document describes the actual implementation in `packages/simulator` and how visual clusters (area partitions) are used in `packages/visualisation`.

## Where in the code

- Clustering happens in the truck dispatch logic: `packages/simulator/lib/dispatch/truckDispatch.ts`
- Coordinate/geometry helpers live in `packages/simulator/lib/utils/coordinates.ts`, etc.
- VROOM calls are handled in `packages/simulator/lib/vroom.ts`

## Overview

1. Bookings are assigned to vehicles (simple round‑robin in the fleet dispatcher)
2. Each vehicle clusters its assigned bookings geographically
3. Partitions are ordered using a nearest‑neighbor heuristic based on cluster centers
4. Truck planning can then use VROOM for ordering/optimization (see the VROOM doc)
5. Results are merged into an executable instruction flow

## Clustering steps

- Algorithm: DBSCAN with configured epsilon and minimum sample size
- Noise/singleton points can be assigned to the nearest cluster up to a max distance (if enabled)

Konfigurationerna finns samlade i `packages/simulator/lib/config.ts` (t.ex. epsilon, minsta punkter, max klusterstorlek, tidsgränser för VROOM etc.).

## Cluster centers and ordering

- Each cluster gets a geometric center (average of lat/lon)
- The clustering module orders clusters with a nearest‑neighbor heuristic (always pick the next cluster closest to the current cursor)
- VROOM‑based ordering can occur later in the truck planning step (see VROOM doc) and is not part of `clustering.ts`

### The nearest‑neighbor heuristic in `clustering.ts`

The `orderPartitionsByProximity` function iteratively picks the next cluster with the shortest Haversine distance from the current cursor. It’s fast and provides a stable base ordering before any further optimization.

## VROOM within partitions

- Bookings inside the partition are converted to VROOM “shipments”
- The current truck is converted to a VROOM “vehicle”
- Results are merged into a complete route for the truck

## Visualizing area partitions

- The backend may persist area partitions (bounds/polygon) on the experiment document in Elasticsearch (`experiments.areaPartitions`)
- The frontend passes these into the `Map` component via the `areaPartitions` prop:
  - Comparison view: `ExperimentDetailPage` → `SimulationView` → `Map`
  - Live map: `MapPage` fetches the `experiment` (via `getExperiment`) using `experimentId` and forwards `areaPartitions` to `Map`
- `Map` renders partitions with a `PolygonLayer`; if a polygon is missing, it falls back to a rectangle built from `bounds`

## Merging small partitions

- Controlled by `ENABLE_PARTITION_MERGING` (true/false)
- Partitions with fewer than `MIN_PARTITION_SIZE` bookings are candidates for merging into larger neighbors within a maximum distance
- Max distance is derived from DBSCAN’s `eps` via `MERGE_DISTANCE_MULTIPLIER` (approximately `eps * multiplier`, in meters)
- Guarded by `MAX_MERGED_AREA_DIAGONAL_KM` to avoid unreasonably large merged areas
- If `RESPECT_ORIGINAL_CLUSTERS` is true, merges are limited to partitions stemming from the same original cluster

## Handling noise points

- If `ENABLE_NOISE_ASSIGNMENT` is enabled, noise bookings are assigned to the nearest cluster
- The distance cap is `MAX_NOISE_ASSIGNMENT_DISTANCE_METERS`

## Performance

- The fleet batches incoming bookings briefly (configurable) before assignment
- Truck planning and VROOM calls are time‑bounded (see `VROOM_TIMEOUT_MS`) and can be performed per partition in later steps

## Summary

Clustering reduces the problem size per vehicle, provides a two‑stage approach (between partitions and within partitions via VROOM), and enables effective visualization via the area partition map layer.
