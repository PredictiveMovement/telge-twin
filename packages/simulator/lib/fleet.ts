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
const { error, debug, info } = require('./log')
const { addMeters } = require('./distance')
const { CLUSTERING_CONFIG } = require('./config')

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

  createCarsFromSpecs(vehicleSpecs: any[]) {
    const vehicles = vehicleSpecs.map((spec, i) => {
      const Vehicle = Truck

      this.vehiclesCount++

      const offsetPosition = addMeters(this.hub.position, {
        x: 10 + 5 * this.id,
        y: -10 + 3 * i,
      })

      const enhancedConfig = {
        weight: spec.weight || 10000,
        parcelCapacity: spec.parcelCapacity || 100,
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

    return from(vehicles).pipe(shareReplay())
  }

  canHandleBooking(booking: any) {
    return this.recyclingTypes.includes(booking.recyclingType)
  }

  handleBooking(booking: any) {
    booking.fleet = this
    this.unhandledBookings.next(booking)
    return booking
  }

  // VROOM Dispatcher: Round-robin dispatch with truck VROOM optimization
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

  // Standard Dispatcher: Simple round-robin, truck sequential planning (no VROOM)
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

  // Handle bookings with round-robin dispatch
  private handleBookingBatch(unassignedBookings: any[], cars: any[]) {
    return from(unassignedBookings).pipe(
      map((booking: any) => {
        if (booking.vehicleId || booking.originalVehicleId) {
          const targetVehicleId = booking.vehicleId || booking.originalVehicleId
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
        // VROOM dispatcher always uses handleBooking (VROOM optimization)
        return car.handleBooking(this.experimentId, booking)
      })
    )
  }

  // Replay Dispatcher: Load and replay saved VROOM plans from previous experiments
  startReplayDispatcher(replayExperimentId: string) {
    info(`Starting replay dispatcher for fleet ${this.name}`)

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

        return from(cars).pipe(
          mergeMap((truck: any) => {
            return from(
              (async () => {
                try {
                  const searchQuery = {
                    index: 'vroom-truck-plans',
                    body: {
                      query: {
                        bool: {
                          must: [
                            {
                              term: {
                                'experiment.keyword': replayExperimentId,
                              },
                            },
                            { term: { truckId: truck.id } },
                          ],
                        },
                      },
                      sort: [{ timestamp: { order: 'desc' } }],
                      size: 1,
                    },
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
