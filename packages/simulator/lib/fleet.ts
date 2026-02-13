const { from, of, ReplaySubject } = require('rxjs')
const {
  shareReplay,
  mergeMap,
  catchError,
  toArray,
  bufferTime,
  withLatestFrom,
  map,
  filter,
} = require('rxjs/operators')
const Truck = require('./vehicles/truck')
const Position = require('./models/position')
const { error, info } = require('./log')
const { addMeters } = require('./distance')
import { CLUSTERING_CONFIG } from './config'
import { logVehicleCapacity } from './capacity'

/**
 * Fleet represents a group of trucks that share the same hub and recycling-type capabilities.
 *
 * Each Fleet instance acts as an event hub:
 *   • `unhandledBookings`  – RxJS subject where new bookings are pushed in.
 *   • `dispatchedBookings` – stream of bookings that have been assigned to a vehicle.
 *
 * Dispatch strategies
 * ───────────────────
 * There are three mutually exclusive dispatcher flows. Only one should be started.
 *   1. `startVroomDispatcher()`    – Batch + round-robin assign → per-truck VROOM optimisation.
 *   2. `startStandardDispatcher()` – Simple round-robin without clustering / VROOM.
 *   3. `startReplayDispatcher()`   – Replays a previous experiment’s saved VROOM plans.
 *
 * The clustering steps referred to in the docs happen *inside* the truck logic (see `truck.ts`) once
 * the fleet has decided which bookings belong to which truck.  Fleet itself only deals with the
 * inter-truck distribution of bookings.
 */
class Fleet {
  public id: any
  public experimentId: any
  public name: any
  public type: any
  public hub: any
  public municipality: any
  public recyclingTypes: any
  public vehiclesCount: number
  public settings: any
  public cars: any
  public unhandledBookings: any
  public dispatchedBookings: any
  public virtualTime: any

  constructor({
    id,
    experimentId,
    name,
    hub,
    type,
    municipality,
    vehicles,
    recyclingTypes,
    settings,
    preAssignedBookings,
    experimentType,
    virtualTime,
  }: any) {
    info(`Fleet created: ${name}`, {
      vehicles: vehicles ? vehicles.length : 0,
      recyclingTypes,
    })

    this.id = id
    this.experimentId = experimentId
    this.name = name
    this.type = type
    this.hub = { position: new Position(hub) }
    this.municipality = municipality
    this.recyclingTypes = recyclingTypes
    this.vehiclesCount = 0
    this.settings = settings
    this.virtualTime = virtualTime
    ;(this as any).vehicleSpecs = vehicles || []
    ;(this as any).preAssignedBookings = preAssignedBookings || {}
    ;(this as any).experimentType = experimentType || 'vroom'

    this.cars = this.createCarsFromSpecs(vehicles || [])
    this.unhandledBookings = new ReplaySubject()
    this.dispatchedBookings = new ReplaySubject()
  }

  /**
   * Instantiate Vehicle objects for every spec in the experiment definition.
   *
   * The method returns an RxJS *cold* observable (`from(vehicles)`), so no actual subscription
   * – and thus no side-effects – happen until somebody subscribes.  The vehicles are also cached
   * with `shareReplay()` so late subscribers receive the same instances.
   */
  createCarsFromSpecs(vehicleSpecs: any[]) {
    const vehicles = vehicleSpecs.map((spec, i) => {
      const Vehicle = Truck

      this.vehiclesCount++

      const offsetPosition = addMeters(this.hub.position, {
        x: 10 + 5 * this.id,
        y: -10 + 3 * i,
      })

      // Fix: Ignore suspiciously low parcelCapacity values from dataset
      // parcelCapacity should be queue capacity (number of bookings), not cargo capacity
      // Values < 10 are likely configuration errors - use sensible default instead
      const effectiveParcelCapacity =
        spec.parcelCapacity && spec.parcelCapacity >= 10
          ? spec.parcelCapacity
          : 250

      const enhancedConfig = {
        weight: spec.weight || 10000,
        parcelCapacity: effectiveParcelCapacity,
        fackDetails: spec.fackDetails || [],
        realDescription: spec.description || `Vehicle ${spec.originalId}`,
        class: Truck,
      }

      return new Vehicle({
        ...enhancedConfig,
        id: spec.originalId,
        fleet: this,
        position: new Position(offsetPosition),
        startPosition: new Position(offsetPosition),
        destination: this.hub.position,
        recyclingTypes: this.recyclingTypes,
        vehicleType: spec.type,
        virtualTime: this.virtualTime,
      })
    })

    try {
      const preAssigned: Record<string, any[]> =
        (this as any).preAssignedBookings || {}
      
      let vehiclesWithFacks = 0
      let vehiclesWithoutFacks = 0
      let vehiclesWithDefaultParcelCapacity = 0
      const recyclingTypeCoverage: Record<string, number> = {}
      
      if (Array.isArray(this.recyclingTypes)) {
        this.recyclingTypes.forEach((type) => {
          recyclingTypeCoverage[type] = 0
        })
      }
      
      vehicleSpecs.forEach((spec: any) => {
        const obs = preAssigned?.[spec.originalId] || []
        const hasFacks = Array.isArray(spec.fackDetails) && spec.fackDetails.length > 0
        
        if (hasFacks) {
          vehiclesWithFacks++
          spec.fackDetails.forEach((fack: any) => {
            const types = (fack.avfallstyper || []).map((w: any) => w.avftyp).filter(Boolean)
            types.forEach((typeId: string) => {
              if (
                Object.prototype.hasOwnProperty.call(
                  recyclingTypeCoverage,
                  typeId
                )
              ) {
                recyclingTypeCoverage[typeId]++
              }
            })
          })
        } else {
          vehiclesWithoutFacks++
        }
        
        if (spec.parcelCapacity === 250 || !spec.parcelCapacity || spec.parcelCapacity < 10) {
          vehiclesWithDefaultParcelCapacity++
        }
        
        logVehicleCapacity(
          this.name,
          this.experimentId,
          spec,
          this.settings,
          obs
        )
      })
      
      const totalVehicles = vehicleSpecs.length
      const fleetWarnings: string[] = []
      
      if (vehiclesWithoutFacks === totalVehicles) {
        fleetWarnings.push('No vehicles have fack details - all using fallback capacity')
      } else if (vehiclesWithoutFacks > 0) {
        fleetWarnings.push(`${vehiclesWithoutFacks}/${totalVehicles} vehicles missing fack details`)
      }
      
      if (vehiclesWithDefaultParcelCapacity === totalVehicles) {
        fleetWarnings.push('All vehicles using default parcelCapacity (250)')
      } else if (vehiclesWithDefaultParcelCapacity > 0) {
        fleetWarnings.push(`${vehiclesWithDefaultParcelCapacity}/${totalVehicles} vehicles using default parcelCapacity`)
      }
      
      const uncoveredTypes: string[] = []
      Object.entries(recyclingTypeCoverage).forEach(([typeId, count]) => {
        if (count === 0) {
          uncoveredTypes.push(typeId)
        }
      })
      
      if (uncoveredTypes.length > 0) {
        fleetWarnings.push(`Recycling types with no vehicle coverage: ${uncoveredTypes.join(', ')}`)
      }
      
      info(`Fleet capacity summary: ${this.name}`, {
        experimentId: this.experimentId,
        totalVehicles,
        vehiclesWithFacks,
        vehiclesWithoutFacks,
        vehiclesWithDefaultParcelCapacity,
        recyclingTypeCoverage,
        warnings: fleetWarnings.length > 0 ? fleetWarnings : undefined,
      })
      
    } catch (e) {
      error('Error logging vehicle capacities:', e)
    }

    return from(vehicles).pipe(shareReplay())
  }

  /**
   * Quick predicate used by upstream code to filter bookings belonging to this fleet based on
   * the supported recycling types.
   */
  canHandleBooking(booking: any) {
    return this.recyclingTypes.includes(booking.recyclingType)
  }

  /**
   * Push a single booking into the `unhandledBookings` subject.  Down-stream dispatcher (one of
   * the `start*Dispatcher` methods) will eventually pick it up.
   * Returns the same booking for convenience so callers can use it inline.
   */
  handleBooking(booking: any) {
    booking.fleet = this
    this.unhandledBookings.next(booking)
    return booking
  }

  /**
   * VROOM dispatcher – the *default* strategy.
   *
   * 1. Bookings are buffered for a short period (see `FLEET_BUFFER_TIME_MS`) to allow small bursts
   *    to be processed together – this significantly improves cluster quality.
   * 2. Unassigned bookings are distributed round-robin across the truck stream (`cars`).
   * 3. Each truck then calls `truck.handleBooking()` which performs per-truck clustering followed
   *    by a VROOM optimisation inside the cluster partitions (see docs/clustering.md).
   *
   * The resulting observable emits each booking after it has been assigned and queued on its truck.
   */
  startVroomDispatcher() {
    info(
      `Fleet ${this.name}: Starting VROOM dispatcher with round-robin dispatch`
    )
    this.dispatchedBookings = this.unhandledBookings.pipe(
      bufferTime(CLUSTERING_CONFIG.FLEET_BUFFER_TIME_MS),
      filter((bookings: any[]) => bookings.length > 0),
      withLatestFrom(this.cars.pipe(toArray())),

      mergeMap(([bookings, cars]: any) => {
        const unassignedBookings = bookings.filter(
          (booking: any) => !booking.assigned
        )

        info(
          `Fleet ${this.name}: Dispatching ${unassignedBookings.length} bookings using round-robin`
        )
        return this.handleBookingBatch(unassignedBookings, cars)
      }),
      catchError((err: any) => {
        error(`Error handling bookings for ${this.name}:`, err)
        return of(null)
      })
    )
    return this.dispatchedBookings
  }

  /**
   * Standard dispatcher – baseline algorithm used when the experiment type is *not* VROOM.
   * Exactly the same buffering + round-robin logic, but skips all clustering and optimisation; the
   * truck simply handles the booking in the order received.
   */
  startStandardDispatcher() {
    info(
      `Fleet ${this.name}: Starting standard dispatcher (round-robin, no clustering)`
    )
    this.dispatchedBookings = this.unhandledBookings.pipe(
      bufferTime(CLUSTERING_CONFIG.FLEET_BUFFER_TIME_MS),
      filter((bookings: any[]) => bookings.length > 0),
      withLatestFrom(this.cars.pipe(toArray())),

      mergeMap(([bookings, cars]: any) => {
        const unassignedBookings = bookings.filter(
          (booking: any) => !booking.assigned
        )

        info(
          `Fleet ${this.name}: Standard dispatch for ${unassignedBookings.length} bookings (no clustering)`
        )

        return from(unassignedBookings).pipe(
          map((booking: any) => {
            if (booking.vehicleId || booking.originalVehicleId) {
              const targetVehicleId =
                booking.vehicleId || booking.originalVehicleId
              const car = cars.find((c: any) => c.id === targetVehicleId)

              if (!car) {
                error(
                  `Vehicle ${targetVehicleId} not found for booking ${booking.id}`
                )
                const fallbackCar = cars.shift()
                cars.push(fallbackCar)
                return { car: fallbackCar, booking }
              }

              return { car, booking }
            } else {
              const car = cars.shift()
              cars.push(car)
              return { car, booking }
            }
          }),
          mergeMap(({ car, booking }: any) => {
            // Always use standard booking for non-VROOM experiments
            return car.handleStandardBooking(booking)
          })
        )
      }),
      catchError((err: any) => {
        error(`Error in standard dispatcher for ${this.name}:`, err)
        return of(null)
      })
    )
    return this.dispatchedBookings
  }

  /**
   * Internal helper used by the VROOM dispatcher to distribute a batch of bookings across trucks.
   *
   * Trucks are cycled round-robin, but vehicle-pinned bookings (`booking.vehicleId`) are honoured
   * if possible.  Basic statistics are logged for debugging.
   */
  private handleBookingBatch(unassignedBookings: any[], cars: any[]) {
    info(`📦 Fleet ${this.name}: Handling booking batch`)
    info(`   - Total unassigned bookings: ${unassignedBookings.length}`)
    info(`   - Available trucks: ${cars.length}`)

    // Track distribution
    const truckDistribution: Record<string, number> = {}
    cars.forEach((car) => (truckDistribution[car.id] = 0))

    return from(unassignedBookings).pipe(
      map((booking: any, index: number) => {
        if (booking.vehicleId || booking.originalVehicleId) {
          const targetVehicleId = booking.vehicleId || booking.originalVehicleId
          const car = cars.find((c: any) => c.id === targetVehicleId)

          if (!car) {
            error(
              `Vehicle ${targetVehicleId} not found for booking ${booking.id}`
            )
            const fallbackCar = cars.shift()
            cars.push(fallbackCar)
            truckDistribution[fallbackCar.id]++
            return { car: fallbackCar, booking }
          }

          truckDistribution[car.id]++
          return { car, booking }
        } else {
          const car = cars.shift()
          cars.push(car)
          truckDistribution[car.id]++
          return { car, booking }
        }
      }),
      toArray(),
      map((assignments: any[]) => {
        // Log final distribution
        info(`📊 Final distribution for ${this.name}:`)
        Object.entries(truckDistribution).forEach(([truckId, count]) => {
          info(`   - Truck ${truckId}: ${count} bookings`)
        })
        return assignments
      }),
      mergeMap((assignments: any[]) => from(assignments)),
      mergeMap(({ car, booking }: any) => {
        // VROOM dispatcher always uses handleBooking (VROOM optimization)
        return car.handleBooking(this.experimentId, booking)
      })
    )
  }

  /**
   * Replay dispatcher – loads saved per-truck VROOM plans from Elasticsearch and re-enacts them.
   *
   * Each truck is given its historical plan via `truck.setReplayPlan()` and bookings are pushed
   * directly onto the truck queue without further optimisation.
   */
  startReplayDispatcher(replayExperimentId: string) {
    const vroomPlanIds = this.settings?.vroomTruckPlanIds || []
    info(`Starting replay dispatcher for fleet ${this.name}, experimentId=${replayExperimentId}, vroomTruckPlanIds=${JSON.stringify(vroomPlanIds)}`)

    this.dispatchedBookings = this.unhandledBookings.pipe(
      bufferTime(1000),
      filter((bookings: any[]) => bookings.length > 0),
      withLatestFrom(this.cars.pipe(toArray())),
      mergeMap(([bookings, cars]: any) => {
        const assignedBookings: any[] = []

        from(bookings)
          .pipe(
            filter((booking: any) => !booking.assigned),
            map((booking: any) => {
              if (booking.vehicleId || booking.originalVehicleId) {
                const targetVehicleId =
                  booking.vehicleId || booking.originalVehicleId
                const car = cars.find((c: any) => c.id === targetVehicleId)

                if (!car) {
                  error(
                    `Vehicle ${targetVehicleId} not found for booking ${booking.id}`
                  )
                  const fallbackCar = cars.shift()
                  cars.push(fallbackCar)
                  return { car: fallbackCar, booking }
                }

                return { car, booking }
              } else {
                const car = cars.shift()
                cars.push(car)
                return { car, booking }
              }
            }),
            mergeMap(({ car, booking }: any) => {
              car.queue.push(booking)
              if (booking.assign) booking.assign(car)
              if (booking.queued) booking.queued(car)
              assignedBookings.push(booking)
              return of(booking)
            })
          )
          .subscribe()

        //Get the vehicle saved plans with vroom data from elasticsearch
        // Use vroomTruckPlanIds from settings if available for direct lookup
        const vroomTruckPlanIds: string[] = this.settings?.vroomTruckPlanIds || []

        return from(cars).pipe(
          mergeMap((truck: any) => {
            return from(
              (async () => {
                try {
                  // First, try to find a matching planId from vroomTruckPlanIds
                  // PlanIds are formatted as: {experimentId}-{truckId}
                  const matchingPlanId = vroomTruckPlanIds.find(
                    (planId: string) => planId.endsWith(`-${truck.id}`)
                  )

                  let searchQuery: any
                  if (matchingPlanId) {
                    // Direct lookup by planId (works for copied experiments)
                    searchQuery = {
                      index: 'truck-plans',
                      body: {
                        query: { term: { _id: matchingPlanId } },
                        size: 1,
                      },
                    }
                  } else {
                    // Fallback: search by experimentId and truckId
                    searchQuery = {
                      index: 'truck-plans',
                      body: {
                        query: {
                          bool: {
                            must: [
                              { term: { experimentId: replayExperimentId } },
                              { term: { truckId: String(truck.id) } },
                              { term: { planType: 'complete' } },
                            ],
                          },
                        },
                        sort: [{ timestamp: { order: 'desc' } }],
                        size: 1,
                      },
                    }
                  }

                  const planResult = await require('./elastic').search(
                    searchQuery
                  )

                  if (planResult?.body?.hits?.hits?.length > 0) {
                    const planData = planResult.body.hits.hits[0]._source
                    const plan = planData.completePlan || planData.plan

                    truck.setReplayPlan(plan)

                    const truckBookings = assignedBookings.filter(
                      (booking: any) => booking.car?.id === truck.id
                    )

                    if (truckBookings.length > 0) {
                      return from(truckBookings)
                    } else {
                      return from(truck.queue || [])
                    }
                  } else {
                    error(`No replay plan found for truck ${truck.id}`)
                    const truckBookings = assignedBookings.filter(
                      (booking: any) => booking.car?.id === truck.id
                    )
                    return from(truckBookings)
                  }
                } catch (err) {
                  error(
                    `Failed to load replay plan for truck ${truck.id}:`,
                    err
                  )
                  const truckBookings = assignedBookings.filter(
                    (booking: any) => booking.car?.id === truck.id
                  )
                  return from(truckBookings)
                }
              })()
            ).pipe(mergeMap((result: any) => result))
          })
        )
      }),
      catchError((err: any) => {
        error(`Error in replay dispatcher for ${this.name}:`, err)
        return of(null)
      }),
      filter((booking: any) => booking !== null)
    )

    return this.dispatchedBookings
  }
}

export = Fleet
if (typeof module !== 'undefined') module.exports = Fleet
