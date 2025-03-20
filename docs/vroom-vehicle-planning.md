# VROOM Vehicle Routing System

## Overview

VROOM (Vehicle Routing Open-source Optimization Machine) is used within the system to optimize the routing of vehicles for pickup and delivery operations. The system employs VROOM at multiple levels to efficiently assign bookings to vehicles and determine optimal routes.

## Integration Points

VROOM planning is performed at multiple points in the system:

1. **Fleet-level Routing** - The `Fleet` class uses VROOM to dispatch bookings to vehicles
2. **Individual Vehicle Routing** - Trucks use VROOM to plan optimal routes for assigned bookings
3. **Booking Clustering** - VROOM optimizes routes for clustered bookings

## VROOM Planning Process

### 1. Fleet Dispatcher (High-Level Planning)

When bookings come into the system, the `Fleet` class collects them for a short period (1 second), then processes them in batches:

```javascript
// From fleet.js
startDispatcher() {
  this.dispatchedBookings = this.unhandledBookings.pipe(
    bufferTime(1000),
    filter((bookings) => bookings.length > 0),
    clusterByPostalCode(200, 5), // cluster bookings if we have more than what Vroom can handle
    withLatestFrom(this.cars.pipe(toArray())),
    convertToVroomCompatibleFormat(),
    planWithVroom(),     // First VROOM planning occurs here
    convertBackToBookings(),
    filter(({ booking }) => !booking.assigned),
    mergeMap(({ car, booking }) => {
      return car.handleBooking(booking)
    })
  )
  return this.dispatchedBookings
}
```

This high-level planning assigns bookings to specific vehicles based on optimized routing calculations from VROOM.

### 2. Vehicle-Level Routing (Detailed Planning)

Once bookings are assigned to vehicles, each vehicle (truck) plans its route using VROOM again:

```javascript
// From truck.js
async handleBooking(booking) {
  // Add booking to vehicle's queue
  this.queue.push(booking)
  booking.assign(this)
  booking.queued(this)

  clearTimeout(this._timeout)
  this._timeout = setTimeout(async () => {
    if (this.queue.length > 100) {
      // For large queues, cluster bookings first
      const clusters = (
        await clusterPositions(this.queue, Math.ceil(this.queue.length / 70))
      ).sort(
        (a, b) =>
          this.position.distanceTo(a.center) -
          this.position.distanceTo(b.center)
      )

      this.plan = [
        { action: 'start' },
        ...(await firstValueFrom(
          from(clusters).pipe(
            mergeMap(
              async (cluster) =>
                await findBestRouteToPickupBookings(this, cluster.items, [  // Second VROOM planning
                  'pickup',
                ]),
              1
            ),
            mergeAll(),
            toArray()
          )
        )),
        { action: 'delivery' },
        { action: 'end' },
      ]
    } else {
      // For smaller queues, plan direct route
      this.plan = await findBestRouteToPickupBookings(this, this.queue)  // Second VROOM planning
    }
    if (!this.instruction) await this.pickNextInstructionFromPlan()
  }, 2000)

  return booking
}
```

The `findBestRouteToPickupBookings` function uses VROOM to plan the detailed route:

```javascript
// From truckDispatch.js
const findBestRouteToPickupBookings = async (
  truck,
  bookings,
  instructions = ["pickup", "delivery", "start"]
) => {
  const vehicles = [truckToVehicle(truck, 0)]
  const shipments = bookings.map(bookingToShipment)

  const result = await plan({ shipments, vehicles }) // VROOM planning

  // Process VROOM results
  return result.routes[0]?.steps
    .filter(({ type }) => instructions.includes(type))
    .map(({ id, type, arrival, departure }) => {
      const booking = bookings[id]
      const instruction = {
        action: type,
        arrival,
        departure,
        booking,
      }
      return instruction
    })
}
```

## Clustering and Vehicle Integration

The system integrates clustering with vehicle routing at multiple levels to optimize performance and route quality:

### Fleet-Level Clustering

At the fleet level, postal code clustering is used to reduce the complexity of routing problems before they reach VROOM:

```javascript
clusterByPostalCode(200, 5) // cluster bookings if we have more than 200
```

**How it works with vehicles:**

1. **Pre-Processing**: Before sending data to VROOM, bookings are grouped by postal code prefixes
2. **Representative Bookings**: Each cluster is represented by a single booking with the rest attached as `groupedBookings`
3. **Reduced Problem Size**: Instead of planning routes for all bookings individually, VROOM only plans routes for the representative bookings, keeping the problem size below VROOM's limits
4. **Vehicle Assignment**: VROOM assigns representative bookings to vehicles based on optimal routing
5. **Expansion**: When a vehicle handles a booking with `groupedBookings`, it actually handles all bookings in that cluster

This approach effectively reduces a potentially large routing problem (thousands of bookings) into a manageable size (hundreds of representative bookings).

### Vehicle-Level Clustering

Once bookings are assigned to specific vehicles, a second level of clustering may occur:

```javascript
// For large queues, cluster bookings first
if (this.queue.length > 100) {
  const clusters = await clusterPositions(
    this.queue,
    Math.ceil(this.queue.length / 70)
  )
  // ...
}
```

**How this works:**

1. **K-Means Clustering**: For vehicles with large queues (>100 bookings), the `clusterPositions` function uses K-means clustering to group nearby bookings
2. **Proximity Sorting**: Clusters are sorted by proximity to the vehicle's current position
3. **Incremental Planning**: Each cluster is planned separately using VROOM, creating a sequence of pickup instructions
4. **Route Assembly**: The separate cluster routes are assembled into a complete vehicle route

This two-level clustering approach means:

1. Fleet-level clustering (by postal code) assigns bookings to approximate vehicles
2. Vehicle-level clustering (by K-means) optimizes the exact route each vehicle will take

## Data Conversion for VROOM

The system converts internal data structures to VROOM-compatible formats:

1. **Bookings to Jobs/Shipments:**

   ```javascript
   bookingToJob({ pickup, groupedBookings }, i) {
     return {
       id: i,
       location: [pickup.position.lon, pickup.position.lat],
       pickup: [groupedBookings?.length || 1],
     }
   }

   bookingToShipment({ id, pickup, destination, groupedBookings }, i) {
     return {
       id: i,
       amount: [groupedBookings?.length || 1],
       pickup: {
         id: i,
         time_windows: [...],
         location: [pickup.position.lon, pickup.position.lat],
       },
       delivery: {
         id: i,
         location: [destination.position.lon, destination.position.lat],
         time_windows: [...],
       },
       service: 30,
     }
   }
   ```

2. **Vehicles to VROOM Vehicles:**
   ```javascript
   truckToVehicle({ position, parcelCapacity, destination, cargo }, i) {
     return {
       id: i,
       time_window: [
         moment('05:00:00', 'hh:mm:ss').unix(),
         moment('15:00:00', 'hh:mm:ss').unix(),
       ],
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

1. **Booking Collection**:

   - Bookings arrive in the system and are collected for 1 second intervals
   - Similar bookings are grouped by postal code if total exceeds 200

2. **Fleet-Level Assignment**:

   - Postal code clustering reduces the problem size
   - Bookings (or booking clusters) are converted to VROOM-compatible format
   - VROOM assigns bookings to vehicles based on optimal routing
   - Assignments are converted back to the internal format

3. **Vehicle-Level Routing**:

   - Each vehicle receives its assigned bookings
   - Vehicles with >100 bookings apply K-means clustering
   - VROOM plans the optimal route through booking locations
   - Route is converted to a sequence of pickup/delivery instructions

4. **Execution**:
   - Vehicles follow their instruction sequence
   - When a vehicle reaches a booking with `groupedBookings`, it handles all bookings in the cluster
   - For large clusters, the vehicle may need to make multiple stops within the same general area

This multi-level approach balances computational efficiency with routing quality:

- **Postal code clustering** quickly groups bookings by geographical area
- **Vehicle assignment** determines which vehicle handles which areas
- **K-means clustering** fine-tunes the exact route within each area
- **VROOM optimization** ensures the best possible route through the selected points

## VROOM API Integration

The system interacts with VROOM through a RESTful API:

```javascript
async plan({ jobs, shipments, vehicles }) {
  // Check limitations
  if (jobs?.length > 800) throw new Error('Too many jobs to plan')
  if (shipments?.length > 800) throw new Error('Too many shipments to plan')
  if (vehicles.length > 200) throw new Error('Too many vehicles to plan')

  // Check cache first
  const result = await getFromCache({ jobs, shipments, vehicles })
  if (result) return result

  // Call VROOM API
  return await queue(() =>
    fetch(vroomUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobs,
        shipments,
        vehicles,
        options: { plan: true },
      }),
    })
    .then(res => res.json())
    .then(json => {
      // Cache results if planning took >10s
      if (Date.now() - before > 10_000)
        return updateCache({ jobs, shipments, vehicles }, json)
      else return json
    })
    .catch((vroomError) => {
      // Retry on error
      return delay(2000).then(() =>
        vroom.plan({ jobs, shipments, vehicles })
      )
    })
  )
}
```

## Multi-Level VROOM Planning Summary

In summary, VROOM planning happens in multiple stages:

1. **First Level (Fleet Dispatch)**:

   - Clusters bookings by postal code
   - Uses VROOM to assign bookings to vehicles
   - Provides an initial vehicle-booking assignment

2. **Second Level (Vehicle Route Planning)**:

   - Each vehicle plans its own route with assigned bookings
   - For larger queues (>100 bookings), clustering is applied before VROOM planning
   - For smaller queues, VROOM plans directly

3. **Recursive Planning (When Needed)**:
   - If the VROOM API returns an error, the system retries after a short delay
   - For large numbers of bookings, the system applies clustering to stay within VROOM's limits

This multi-level approach ensures efficient routing at both the fleet and individual vehicle levels, with appropriate optimizations for different scales of operations.
