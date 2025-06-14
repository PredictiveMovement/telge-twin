# VROOM Vehicle Routing System

## Overview

VROOM (Vehicle Routing Open-source Optimization Machine) is used within the system to optimize the routing of vehicles for pickup and delivery operations. The system employs VROOM at the truck level to efficiently plan optimal routes for assigned bookings.

## Integration Points

VROOM planning is performed at the truck level in the system:

1. **Individual Vehicle Routing** - Trucks use VROOM to plan optimal routes for assigned bookings
2. **Booking Clustering** - VROOM optimizes routes for clustered bookings within individual trucks
3. **Cluster Ordering** - VROOM solves TSP problems to determine optimal order between clusters

## VROOM Planning Process

### Fleet Dispatcher (Simple Assignment)

When bookings come into the system, the `Fleet` class collects them for a short period (1 second), then assigns them to trucks using round-robin dispatch:

```javascript
// From fleet.ts - startVroomDispatcher()
startVroomDispatcher() {
  this.dispatchedBookings = this.unhandledBookings.pipe(
    bufferTime(CLUSTERING_CONFIG.FLEET_BUFFER_TIME_MS),
    filter((bookings) => bookings.length > 0),
    withLatestFrom(this.cars.pipe(toArray())),

    mergeMap(([bookings, cars]) => {
      const unassignedBookings = bookings.filter(booking => !booking.assigned)
      return this.handleBookingBatch(unassignedBookings, cars) // Round-robin dispatch
    })
  )
  return this.dispatchedBookings
}
```

This dispatcher uses simple round-robin assignment to distribute bookings to trucks.

### Truck-Level Routing (Detailed VROOM Planning)

Once bookings are assigned to trucks, each truck plans its route using a sophisticated multi-level VROOM approach:

```javascript
// From truckDispatch.ts
export async function findBestRouteToPickupBookings(
  experimentId: string,
  truck: any,
  bookings: any[]
): Promise<Instruction[] | undefined> {
  try {
    // 1. Create spatial clusters from truck's bookings
    const chunks = createSpatialChunks(
      bookings,
      CLUSTERING_CONFIG.MAX_CLUSTER_SIZE,
      experimentId
    )

    // 2. Determine optimal order between clusters using VROOM TSP
    const orderedChunks = await orderChunksWithVroom(chunks, truckStart)

    // 3. Optimize each cluster separately with VROOM
    const chunkResults = []
    for (const chunk of orderedChunks) {
      const vehicles = [truckToVehicle(truck, 0)]
      const shipments = chunk.bookings.map(bookingToShipment)
      const result = await plan({ shipments, vehicles }) // VROOM planning
      chunkResults.push({ result, chunk })
    }

    return mergeVroomChunkResults(chunkResults, instructions)
  } catch (e) {
    error(`findBestRouteToPickupBookings failed for truck ${truck.id}:`, e)
  }
}
```

The `findBestRouteToPickupBookings` function uses VROOM in two phases:

1. **Cluster Ordering (TSP)**: Determines optimal order to visit clusters
2. **Intra-Cluster Optimization**: Optimizes route within each cluster

## Clustering and Vehicle Integration

The system integrates clustering with vehicle routing at the truck level to optimize performance and route quality:

### Truck-Level Clustering

Each truck with assigned bookings applies spatial clustering:

```javascript
// 1. Spatial clustering of truck's bookings
const chunks = createSpatialChunks(
  bookings,
  CLUSTERING_CONFIG.MAX_CLUSTER_SIZE,
  experimentId
)
```

**How it works:**

1. **Spatial Clustering**: Bookings are grouped using DBSCAN algorithm by geographical proximity
2. **Size Management**: Large clusters are recursively split using K-means to stay within VROOM limits
3. **Cluster Ordering**: VROOM TSP determines optimal order to visit cluster centroids
4. **Intra-Cluster Routing**: Each cluster is individually optimized using VROOM

### Cluster Ordering (TSP Solution)

The `orderChunksWithVroom` function solves a TSP problem to determine optimal cluster order:

```javascript
async function orderChunksWithVroom(chunks, truckStart) {
  if (chunks.length <= 1) return chunks

  // Create TSP problem where each cluster centroid is a job
  const jobs = chunks.map((c, i) => ({
    id: i + 1,
    location: [
      calculateCenter(c.bookings).lng,
      calculateCenter(c.bookings).lat,
    ],
    service: 0,
  }))

  const vehicles = [
    {
      id: 0,
      start: truckStart,
      end: truckStart,
      capacity: [9999],
      time_window: [0, 24 * 3600],
    },
  ]

  try {
    const tsp = await plan({ jobs, vehicles })
    const orderIds = tsp.routes[0].steps
      .filter((s) => s.type === "job")
      .map((s) => s.job - 1) // 0-based

    return orderIds.map((idx) => chunks[idx])
  } catch (e) {
    return chunks
  }
}
```

**How this works:**

1. **TSP Problem Creation**: Each cluster centroid becomes a job location
2. **VROOM TSP Solution**: VROOM determines optimal order to visit all cluster centroids
3. **Cluster Reordering**: Clusters are reordered according to the TSP solution
4. **Route Assembly**: The truck visits clusters in the optimal order

This two-level clustering approach means:

1. **Spatial clustering** groups nearby bookings to reduce problem complexity
2. **TSP optimization** determines the best order to visit cluster groups
3. **Intra-cluster optimization** finds the best route within each cluster

## Data Conversion for VROOM

The system converts internal data structures to VROOM-compatible formats:

1. **Bookings to Shipments (for intra-cluster optimization):**

   ```javascript
   bookingToShipment({ id, pickup, destination, groupedBookings }, i) {
     return {
       id: i,
       amount: [groupedBookings?.length || 1],
       pickup: {
         id: i * 2,
         time_windows: [[pickupStart, pickupEnd]],
         location: [pickup.position.lon, pickup.position.lat],
       },
       delivery: {
         id: i * 2 + 1,
         location: [destination.position.lon, destination.position.lat],
         time_windows: [[deliveryStart, deliveryEnd]],
       },
       service: 30,
     }
   }
   ```

2. **Cluster Centroids to Jobs (for TSP ordering):**

   ```javascript
   // Created inline in orderChunksWithVroom
   const jobs = chunks.map((c, i) => ({
     id: i + 1,
     location: [
       calculateCenter(c.bookings).lng,
       calculateCenter(c.bookings).lat,
     ],
     service: 0,
   }))
   ```

3. **Trucks to VROOM Vehicles:**
   ```javascript
   truckToVehicle({ position, parcelCapacity, destination, cargo }, i) {
     return {
       id: i,
       time_window: [workStart, workEnd],
       capacity: [parcelCapacity - cargo.length],
       start: [position.lon, position.lat],
       end: destination
         ? [destination.lon, destination.lat]
         : [position.lon, position.lat],
     }
   }
   ```

## Complete Workflow: From Bookings to Vehicle Routes

The complete workflow integrates clustering and vehicle routing as follows:

1. **Booking Collection & Assignment**:

   - Bookings arrive in the system and are collected for 1 second intervals
   - Fleet uses round-robin dispatch to assign bookings to trucks

2. **Truck-Level Route Planning**:

   - Each truck receives its assigned bookings
   - Truck applies spatial clustering to group nearby bookings
   - VROOM TSP determines optimal order between clusters
   - VROOM optimizes route within each cluster separately
   - Results are merged into a complete route plan

3. **Execution**:
   - Trucks follow their optimized instruction sequence
   - Route includes optimal order of clusters and optimal paths within clusters

This approach balances computational efficiency with routing quality:

- **Spatial clustering** quickly groups bookings by geographical area
- **TSP optimization** ensures optimal order between geographical areas
- **Intra-cluster optimization** ensures best possible route through each area
- **Independent truck processing** allows parallel optimization

## VROOM API Integration

The system interacts with VROOM through a RESTful API:

```javascript
async function plan({ jobs = [], shipments = [], vehicles }, retryCount = 0) {
  // Validation
  if (jobs?.length > CLUSTERING_CONFIG.MAX_VROOM_JOBS)
    throw new Error(`Too many jobs to plan: ${jobs.length}`)
  if (shipments?.length > CLUSTERING_CONFIG.MAX_VROOM_SHIPMENTS)
    throw new Error(`Too many shipments to plan: ${shipments.length}`)
  if (vehicles.length > CLUSTERING_CONFIG.MAX_VROOM_VEHICLES)
    throw new Error(`Too many vehicles to plan: ${vehicles.length}`)

  // Cache lookup
  const cached = await getFromCache(normalizedInput)
  if (cached) return cached

  // VROOM API call
  const vroomPromise = queue(() =>
    fetch(vroomUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobs,
        shipments,
        vehicles,
        options: { plan: true },
      }),
    }).then((res) => res.json())
  )

  const json = await Promise.race([vroomPromise, timeoutPromise])
  return updateCache(normalizedInput, json)
}
```

## Multi-Level VROOM Planning Summary

In summary, VROOM planning happens in two distinct phases at the truck level:

1. **Cluster Ordering (TSP)**:

   - Spatial clusters are created from truck's bookings
   - Cluster centroids are converted to VROOM jobs
   - VROOM solves TSP to determine optimal cluster visiting order

2. **Intra-Cluster Route Optimization**:

   - Each cluster is processed separately
   - Bookings within cluster are converted to VROOM shipments
   - VROOM optimizes pickup/delivery route within the cluster

3. **Result Integration**:
   - Multiple cluster routes are merged into a single truck route
   - Final route visits clusters in optimal order with optimal paths within each cluster

This multi-level approach ensures efficient routing at the individual truck level, with appropriate optimizations for different scales of operations within each truck's assignment.
