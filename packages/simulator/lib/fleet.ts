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
  recycleTruck: {
    weight: 10 * 1000,
    parcelCapacity: 200,
    class: Truck,
  },
  baklastare: {
    weight: 10 * 1000,
    parcelCapacity: 200,
    class: Truck,
  },
  fyrfack: {
    weight: 10 * 1000,
    parcelCapacity: 200,
    class: Truck,
  },
  matbil: {
    weight: 10 * 1000,
    parcelCapacity: 200,
    class: Truck,
  },
  skåpbil: {
    weight: 10 * 1000,
    parcelCapacity: 200,
    class: Truck,
  },
  ['2-fack']: {
    weight: 10 * 1000,
    parcelCapacity: 200,
    class: Truck,
  },
  latrin: {
    weight: 10 * 1000,
    parcelCapacity: 200,
    class: Truck,
  },
  lastväxlare: {
    weight: 10 * 1000,
    parcelCapacity: 200,
    class: Truck,
  },
  kranbil: {
    weight: 10 * 1000,
    parcelCapacity: 200,
    class: Truck,
  },
}

class Fleet {
  public id: any
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
    name,
    hub,
    type,
    municipality,
    vehicleTypes,
    recyclingTypes,
    settings,
  }: any) {
    this.id = id
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
    return from(Object.entries(vehicleTypes)).pipe(
      map(([type, vehiclesCount]: any) => {
        const Vehicle = (vehicleClasses as any)[type]?.class
        if (!Vehicle) {
          error(`No class found for vehicle type ${type}`)
          return []
        }
        this.vehiclesCount += vehiclesCount as number
        return Array.from({ length: vehiclesCount as number }).map((_, i) => {
          const offsetPosition = addMeters(this.hub.position, {
            x: 10 + 5 * this.id,
            y: -10 + 3 * i,
          })
          return new Vehicle({
            ...(vehicleTypes as any)[type],
            id: this.name + '-' + i,
            fleet: this,
            position: new Position(offsetPosition),
            recyclingTypes: this.recyclingTypes,
          })
        })
      }),
      mergeAll(), // platta ut arrayen
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
    this.unhandledBookings.next(booking) // add to queue
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

  // Handle all unhandled bookings via Vroom
  startDispatcher() {
    this.dispatchedBookings = this.unhandledBookings.pipe(
      bufferTime(1000),
      filter((bookings: any[]) => bookings.length > 0),
      clusterByPostalCode(200, 5), // cluster bookings if we have more than what Vroom can handle for this fleet
      withLatestFrom(this.cars.pipe(toArray())),
      tap(([bookings, cars]: any) => {
        info(
          `Fleet ${this.name} received ${bookings.length} bookings and ${cars.length} cars`
        )
      }),
      convertToVroomCompatibleFormat(),
      planWithVroom(this.municipality?.name, this.name),
      convertBackToBookings(),
      filter(({ booking }: any) => !booking.assigned),
      mergeMap(({ car, booking }: any) => {
        return car.handleBooking(booking)
      }),
      catchError((err: any) => {
        error(`Fel vid hantering av bokningar för ${this.name}:`, err)
        return of(null)
      })
    )
    return this.dispatchedBookings
  }
}

// Export as TS module
export = Fleet

// CommonJS fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = Fleet
