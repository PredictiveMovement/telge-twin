const { from, of, ReplaySubject } = require('rxjs')
const {
  shareReplay,
  mergeMap,
  catchError,
  toArray,
  bufferTime,
  withLatestFrom,
  mergeAll,
  map,
  filter,
  tap,
} = require('rxjs/operators')
const Truck = require('./vehicles/truck')
const Position = require('./models/position')
const { error, debug, info } = require('./log')
const {
  clusterByPostalCode,
  convertToVroomCompatibleFormat,
  planWithVroom,
  convertBackToBookings,
} = require('./clustering')
const { addMeters } = require('./distance')

const vehicleClasses = {
  truck: { weight: 10000, parcelCapacity: 200, class: Truck },
  baklastare: { weight: 12000, parcelCapacity: 150, class: Truck },
  fyrfack: { weight: 14000, parcelCapacity: 300, class: Truck },
  '2-fack': { weight: 12000, parcelCapacity: 250, class: Truck },
  matbil: { weight: 8000, parcelCapacity: 100, class: Truck },
  frontlastare: { weight: 15000, parcelCapacity: 400, class: Truck },
  skåpbil: { weight: 3500, parcelCapacity: 50, class: Truck },
  kranbil: { weight: 16000, parcelCapacity: 300, class: Truck },
  lastväxlare: { weight: 18000, parcelCapacity: 500, class: Truck },
}

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

  constructor({
    id,
    experimentId,
    name,
    hub,
    type,
    municipality,
    vehicleTypes,
    recyclingTypes,
    settings,
  }: any) {
    this.id = id
    this.experimentId = experimentId
    this.name = name
    this.type = type
    this.hub = { position: new Position(hub) }
    this.municipality = municipality
    this.recyclingTypes = recyclingTypes
    this.vehiclesCount = 0
    this.settings = settings

    this.cars = this.createCars(vehicleTypes)
    this.unhandledBookings = new ReplaySubject()
    this.dispatchedBookings = new ReplaySubject()
  }

  createCars(vehicleTypes: any) {
    info(`🚛 Creating vehicles for fleet ${this.name}:`, vehicleTypes)

    return from(Object.entries(vehicleTypes)).pipe(
      map(([type, vehiclesCount]: any) => {
        const vehicleConfig =
          (vehicleClasses as any)[type] || vehicleClasses.truck

        if (!(vehicleClasses as any)[type]) {
          info(
            `⚠️ Unknown vehicle type '${type}', using default truck configuration`
          )
        }

        const Vehicle = vehicleConfig.class
        this.vehiclesCount += vehiclesCount as number

        info(
          `🔧 Creating ${vehiclesCount}x ${type} vehicles (weight: ${vehicleConfig.weight}kg, capacity: ${vehicleConfig.parcelCapacity})`
        )

        return Array.from({ length: vehiclesCount as number }).map((_, i) => {
          const offsetPosition = addMeters(this.hub.position, {
            x: 10 + 5 * this.id,
            y: -10 + 3 * i,
          })

          const vehicleId = `${this.name}-${type}-${i}`

          return new Vehicle({
            ...vehicleConfig,
            id: vehicleId,
            fleet: this,
            position: new Position(offsetPosition),
            recyclingTypes: this.recyclingTypes,
            vehicleType: type,
          })
        })
      }),
      mergeAll(),
      shareReplay()
    )
  }

  canHandleBooking(booking: any) {
    debug(
      `Checking if ${this.name} can handle booking ${booking.recyclingType}`
    )
    return this.recyclingTypes.includes(booking.recyclingType)
  }

  handleBooking(booking: any) {
    debug(`Fleet ${this.name} received booking ${booking.bookingId}`)
    booking.fleet = this
    this.unhandledBookings.next(booking)
    return booking
  }

  startStandardDispatcher() {
    this.dispatchedBookings = this.unhandledBookings.pipe(
      bufferTime(1000),
      filter((bookings: any[]) => bookings.length > 0),
      withLatestFrom(this.cars.pipe(toArray())),
      tap(([bookings, cars]: any) => {
        info(
          `Fleet ${this.name} received ${bookings.length} bookings and ${cars.length} cars`
        )
      }),
      mergeMap(([bookings, cars]: any) => {
        return from(bookings).pipe(
          filter((booking: any) => !booking.assigned),
          map((booking: any) => {
            const car = cars.shift()
            cars.push(car)
            return { car, booking }
          }),
          mergeMap(({ car, booking }: any) =>
            car.handleStandardBooking(booking)
          )
        )
      }),
      catchError((err: any) => {
        error(`Error handling bookings for ${this.name}:`, err)
        return of(null)
      })
    )
    return this.dispatchedBookings
  }

  startVroomDispatcher() {
    this.dispatchedBookings = this.unhandledBookings.pipe(
      bufferTime(1000),
      filter((bookings: any[]) => bookings.length > 0),
      clusterByPostalCode(800, 5),
      withLatestFrom(this.cars.pipe(toArray())),
      tap(([bookings, cars]: any) => {
        info(
          `Fleet ${this.name} received ${bookings.length} bookings and ${cars.length} cars`
        )
      }),
      convertToVroomCompatibleFormat(),
      planWithVroom(this.experimentId, this.name, false),
      convertBackToBookings(),
      filter(({ booking }: any) => !booking.assigned),
      mergeMap(({ car, booking }: any) =>
        car.handleBooking(this.experimentId, booking)
      ),
      catchError((err: any) => {
        error(`Fel vid hantering av bokningar för ${this.name}:`, err)
        return of(null)
      })
    )
    return this.dispatchedBookings
  }

  startReplayDispatcher(replayId: string) {
    this.dispatchedBookings = this.unhandledBookings.pipe(
      bufferTime(1000),
      filter((bs: any[]) => bs.length > 0),
      withLatestFrom(this.cars.pipe(toArray())),
      tap(([bookings, cars]: any) => {
        info(
          `Fleet ${this.name} received ${bookings.length} bookings and ${cars.length} cars for replay`
        )
      }),
      mergeMap(([bookings, cars]: any) => {
        return from(bookings).pipe(
          filter((booking: any) => !booking.assigned),
          map((booking: any) => {
            const car = cars.shift()
            cars.push(car)
            return { car, booking }
          }),
          mergeMap(({ car, booking }: any) =>
            car.handleBooking(replayId, booking)
          )
        )
      }),
      catchError((err: any) => {
        error(`Replay error for ${this.name}:`, err)
        return of(null)
      })
    )
    return this.dispatchedBookings
  }
}

export = Fleet
if (typeof module !== 'undefined') module.exports = Fleet
