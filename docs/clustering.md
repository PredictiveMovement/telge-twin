# Clustering System Documentation

## Overview

The clustering system is used to optimize the processing of bookings by grouping them based on geographical proximity at the truck level. This helps reduce computational complexity when planning routes, especially when dealing with a large number of bookings assigned to individual trucks.

## Key Components

### Truck-Level Spatial Clustering

The `createSpatialChunks` function groups bookings assigned to a truck based on geographical proximity. This creates spatial clusters of bookings that are close to each other.

```javascript
createSpatialChunks(bookings, maxChunkSize, experimentId)
```

**Parameters:**

- `bookings`: Array of bookings assigned to the truck
- `maxChunkSize`: Maximum number of bookings per spatial chunk (default: 150)
- `experimentId`: Experiment identifier for logging

**Behavior:**

- Uses DBSCAN clustering algorithm to group geographically close bookings
- Groups bookings by municipality first, then applies spatial clustering within each municipality
- For clusters exceeding maxChunkSize, recursively splits using K-means
- Each cluster becomes a spatial chunk for route optimization

### Calculating Cluster Centers

The `calculateCenter` function calculates the geographical center of each cluster:

```javascript
calculateCenter(bookings)
```

**Behavior:**

- Takes an array of bookings within a cluster
- Calculates the average latitude and longitude coordinates
- Returns center coordinates used for cluster ordering

### VROOM Integration

The clustering system integrates with VROOM (Vehicle Routing Open-source Optimization Machine) for route optimization at the truck level:

1. **Spatial Clustering** - Groups bookings into geographical clusters
2. **Cluster Ordering** - Uses VROOM TSP to determine optimal order between clusters
3. **Intra-Cluster Optimization** - Uses VROOM to optimize routes within each cluster

## Workflow

1. Fleet dispatches bookings to trucks using round-robin assignment
2. Each truck applies spatial clustering to its assigned bookings
3. Truck determines optimal order between clusters using VROOM TSP
4. Truck optimizes route within each cluster using VROOM
5. Results are merged into a complete optimized route plan

## Real-World Implementation

The clustering system is implemented in the truck dispatch system (`truckDispatch.ts`):

```javascript
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
    const chunkResults: any[] = []
    for (const chunk of orderedChunks) {
      const vehicles = [truckToVehicle(truck, 0)]
      const shipments = chunk.bookings.map(bookingToShipment)
      const result = await plan({ shipments, vehicles })
      chunkResults.push({ result, chunk })
    }

    return mergeVroomChunkResults(chunkResults, instructions)
  } catch (e) {
    error(`findBestRouteToPickupBookings failed for truck ${truck.id}:`, e)
  }
}
```

Key aspects of this implementation:

1. **Truck-Level Processing:** Each truck independently clusters its assigned bookings
2. **Spatial Clustering:** Uses `createSpatialChunks()` to group geographically close bookings
3. **Multi-Level VROOM Optimization:**
   - First VROOM call: TSP to order clusters optimally
   - Second VROOM call: Optimize route within each cluster
4. **Result Merging:** Combines multiple cluster routes into a single optimized plan

## Algorithm Details

### Spatial Clustering Process

1. **Municipality Grouping:** Bookings are first grouped by municipality
2. **DBSCAN Clustering:** Within each municipality, DBSCAN algorithm groups nearby bookings
3. **Size Management:** Large clusters are recursively split using K-means to stay within size limits
4. **Partition Creation:** Each final cluster becomes an `AreaPartition` for route planning

### Cluster Ordering (TSP)

The `orderChunksWithVroom` function determines the optimal order to visit clusters:

```javascript
async function orderChunksWithVroom(chunks, truckStart) {
  // Create TSP jobs from cluster centroids
  const jobs = chunks.map((c, i) => ({
    id: i + 1,
    location: [
      calculateCenter(c.bookings).lng,
      calculateCenter(c.bookings).lat,
    ],
    service: 0,
  }))

  // Solve TSP using VROOM
  const tsp = await plan({ jobs, vehicles: [truckVehicle] })
  const orderIds = tsp.routes[0].steps
    .filter((s) => s.type === "job")
    .map((s) => s.job - 1)

  return orderIds.map((idx) => chunks[idx])
}
```

This two-level approach ensures:

- **Geographical Efficiency:** Nearby bookings are grouped together
- **Optimal Routing:** Best order between clusters and within clusters
- **Scalability:** Large numbers of bookings are manageable through clustering

## Usage Example

```javascript
const {
  findBestRouteToPickupBookings,
  createSpatialChunks,
  orderChunksWithVroom,
} = require("./dispatch/truckDispatch")

// Truck receives bookings from fleet dispatcher
const optimizedPlan = await findBestRouteToPickupBookings(
  experimentId,
  truck,
  assignedBookings
)

// Plan contains optimized sequence of pickup instructions
optimizedPlan.forEach((instruction) => {
  console.log(`${instruction.action}: ${instruction.booking?.id}`)
})
```

This clustering system efficiently handles large numbers of bookings by grouping them geographically before planning, which significantly reduces computational complexity while maintaining routing quality at the individual truck level.
