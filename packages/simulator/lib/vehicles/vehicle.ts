export {}

const { ReplaySubject } = require('rxjs')
const { scan } = require('rxjs/operators')
const moment = require('moment')
const { assert: consoleAssert } = require('console')

const osrm = require('../osrm')
const { haversine, bearing } = require('../distance')
const interpolate = require('../interpolate')
const Booking = require('../models/booking')
const { safeId } = require('../id')
const { error } = require('../log')
const { virtualTime } = require('../virtualTime')
const Position = require('../models/position')

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface VehicleConstructorArgs {
  id?: string
  position: any // Position type
  status?: string
  parcelCapacity?: number
  passengerCapacity?: number
  weight?: number // Will be non-optional on class
  fleet?: any
  co2PerKmKg?: number // Will be non-optional on class
  recyclingTypes?: any[]
}

class Vehicle {
  id: string
  position: any // Position type
  origin: any // Should be Position instance
  queue: any[] // Array of Bookings
  cargo: any[] // Array of Bookings
  delivered: any[] // Array of Bookings
  parcelCapacity?: number
  passengerCapacity?: number
  weight: number // Changed to non-optional
  costPerHour: number
  co2: number
  distance: number
  status: string
  fleet?: any // Type for fleet?
  created: Promise<number>
  co2PerKmKg: number // Changed to non-optional
  vehicleType: string
  recyclingTypes?: any[] // Added

  movedEvents: any // ReplaySubject
  cargoEvents: any // ReplaySubject
  statusEvents: any // ReplaySubject

  _disposed?: boolean
  movementSubscription?: any // RxJS Subscription
  destination?: any // Should be Position
  route?: any // OSRM route object
  booking?: any // Should be Booking instance
  lastPositionUpdate: number // Changed: will be initialized
  pointsPassedSinceLastUpdate?: any[]
  speed?: number
  ema?: number // Estimated moving average?
  bearing?: number
  eta?: number // TODO: No declaration or assignment found for eta, but used in toObject. Added here for completeness.
  passengers?: any[] // Used in updatePosition

  constructor(
    {
      id = 'v-' + safeId(),
      position,
      status = 'ready',
      parcelCapacity,
      passengerCapacity,
      weight = 10000,
      fleet,
      co2PerKmKg = 0.013 / 1000,
      recyclingTypes, // Added
    }: VehicleConstructorArgs = {} as VehicleConstructorArgs
  ) {
    this.id = id
    this.position = position
    this.origin = position
    this.queue = []
    this.cargo = []
    this.delivered = []
    this.parcelCapacity = parcelCapacity
    this.passengerCapacity = passengerCapacity
    this.weight = weight // Always assigned
    this.costPerHour = 3000 / 12 // ?
    this.co2 = 0
    this.distance = 0
    this.status = status
    this.fleet = fleet
    this.created = this.time()
    this.co2PerKmKg = co2PerKmKg // Always assigned
    this.vehicleType = 'default'
    this.recyclingTypes = recyclingTypes // Added
    this.lastPositionUpdate = 0 // Initialize, or use this.time() if appropriate at construction

    this.movedEvents = new ReplaySubject()
    this.cargoEvents = new ReplaySubject()
    this.statusEvents = new ReplaySubject()
  }

  dispose() {
    this.simulate(false)
    this._disposed = true
  }

  time(): Promise<number> {
    return virtualTime.getTimeInMillisecondsAsPromise()
  }

  async simulate(route: any) {
    if (this.movementSubscription) {
      this.movementSubscription.unsubscribe()
    }
    if (!route) return

    if (virtualTime.timeMultiplier === Infinity) {
      return this.updatePosition(route, [], await this.time())
    }

    this.movementSubscription = virtualTime
      .getTimeInMilliseconds()
      .pipe(
        scan((prevRemainingPointsInRoute: any, currentTimeInMs: any) => {
          if (!prevRemainingPointsInRoute.length) {
            this.stopped()
            return []
          }

          const { skippedPoints, remainingPoints, ...position } =
            interpolate.route(
              route.started,
              currentTimeInMs,
              prevRemainingPointsInRoute
            ) ?? this.destination
          const newPosition = new Position(position)
          if (route.started > currentTimeInMs) {
            return []
          }
          this.updatePosition(newPosition, skippedPoints, currentTimeInMs)
          return remainingPoints
        }, interpolate.points(route))
      )
      .subscribe(() => null)
  }

  navigateTo(destination: any /* Position */) {
    this.destination = destination

    if (this.position.distanceTo(destination) < 5) {
      // Do not route if we are close enough.

      this.stopped()
      return destination
    }

    return osrm
      .route(this.position, this.destination)
      .then(async (route: any) => {
        route.started = await this.time()
        this.route = route
        if (!route.legs)
          throw new Error(
            `Route not found from: ${JSON.stringify(
              this.position
            )} to: ${JSON.stringify(this.destination)} from: ${JSON.stringify(
              this.position
            )}`
          )
        this.simulate(this.route)
        return this.destination
      })
      .catch(
        (err: any) =>
          error('Route error, retrying in 1s...', err) ||
          wait(1000).then(() => this.navigateTo(destination))
      )
  }

  async handleBooking(booking: any /* Booking */) {
    consoleAssert(
      booking instanceof Booking, // This check will be more meaningful with proper types
      'Booking needs to be of type Booking'
    )

    if (!this.booking) {
      this.booking = booking
      booking.assign(this)
      this.status = 'toPickup'
      this.statusEvents.next(this)

      this.navigateTo(booking.pickup.position)
    } else {
      // TODO: switch places with current booking if it makes more sense to pick this package up before picking up current
      this.queue.push(booking)
      // TODO: use vroom to optimize the queue
      booking.assign(this)

      booking.queued(this)
    }
    return booking
  }

  async waitAtPickup() {
    if (!this.booking || !this.booking.pickup) return // Guard added
    const departure = moment(
      this.booking.pickup.departureTime, // Potential type issue if booking.pickup.departureTime is not string
      'hh:mm:ss'
    ).valueOf()
    const waitingtime = moment(departure).diff(
      moment(await virtualTime.getTimeInMillisecondsAsPromise())
    )

    if (waitingtime > 0) {
      this.simulate(false) // pause interpolation while we wait
      await virtualTime.waitUntil(departure)
    }
  }
  async pickup() {
    if (this._disposed) return

    await this.waitAtPickup()

    setImmediate(() => {
      if (this.booking && this.booking.pickedUp) {
        this.booking.pickedUp(this.position)
      }
      if (this.booking) {
        this.cargo.push(this.booking)
      }

      this.queue
        .filter(
          (b: any /* Booking */) =>
            b.pickup &&
            b.pickup.position &&
            this.position.distanceTo(b.pickup.position) < 200
        )
        .forEach((booking: any /* Booking */) => {
          this.cargo.push(booking)
          if (booking.pickedUp) booking.pickedUp(this.position)
          this.cargoEvents.next(this)
        })

      if (
        this.booking &&
        this.booking.destination &&
        this.booking.destination.position
      ) {
        if (this.booking.pickedUp) this.booking.pickedUp(this.position)
        this.status = 'toDelivery'
        this.statusEvents.next(this)

        if (
          this.queue.length > 0 &&
          this.queue[0].pickup &&
          this.queue[0].pickup.position &&
          haversine(this.queue[0].pickup.position, this.position) <
            haversine(this.booking.destination.position, this.position)
        ) {
          this.navigateTo(this.queue[0].pickup.position)
        } else {
          this.navigateTo(this.booking.destination.position)
        }
      }
    })
  }

  dropOff() {
    if (this.booking) {
      this.booking.delivered(this.position)
      this.delivered.push(this.booking)
      this.booking = null
    }
    this.statusEvents.next(this)

    this.pickNextFromCargo()
  }

  pickNextFromCargo() {
    this.cargo.sort((a: any /* Booking */, b: any /* Booking */) => {
      if (
        a.destination &&
        a.destination.position &&
        b.destination &&
        b.destination.position
      ) {
        return (
          haversine(this.position, a.destination.position) -
          haversine(this.position, b.destination.position)
        )
      }
      return 0
    })
    const booking = this.cargo.shift()
    this.cargoEvents.next(this)

    if (booking && booking.destination && booking.destination.position) {
      this.navigateTo(booking.destination.position)
    } else {
      if (this.queue.length > 0) {
        this.queue.sort((a: any, b: any) => {
          if (
            a.destination &&
            a.destination.position &&
            b.destination &&
            b.destination.position
          ) {
            return (
              haversine(this.position, a.destination.position) -
              haversine(this.position, b.destination.position)
            )
          }
          return 0
        })
        const nextBooking = this.queue.shift()
        if (nextBooking) {
          this.handleBooking(nextBooking)
        } else {
          this.status = 'ready'
          this.navigateTo(this.origin)
        }
      } else {
        this.status = 'ready'
        this.navigateTo(this.origin)
      }
    }
    return booking
  }

  cargoWeight() {
    return this.cargo.reduce(
      (total, booking: any /* Booking */) => total + booking.weight,
      0
    )
  }

  async updatePosition(
    position: any /* Position */,
    pointsPassedSinceLastUpdate: any[],
    time: number
  ) {
    //console.count(`updatePosition${this.id}`)
    const lastPosition = this.position || position
    const timeDiff = time - this.lastPositionUpdate

    const metersMoved =
      pointsPassedSinceLastUpdate.reduce(
        (acc, { meters }) => acc + meters,
        0
      ) || haversine(lastPosition, position)

    const seconds = pointsPassedSinceLastUpdate.reduce(
      (acc, { duration }) => acc + duration,
      0
    )

    const [km, h] = [metersMoved / 1000, seconds / 60 / 60]

    const co2 = this.updateCarbonDioxide(km)

    // TODO: Find which municipality the vehicle is moving in now and add the co2 for this position change to that municipality

    this.distance += km
    this.pointsPassedSinceLastUpdate = pointsPassedSinceLastUpdate
    this.speed = Math.round(km / h || 0)
    this.position = position
    this.lastPositionUpdate = time
    this.ema = haversine(this.destination, this.position)
    if (metersMoved > 0) {
      this.bearing = bearing(lastPosition, position) || 0
      this.movedEvents.next(this)
      // NOTE: cargo is passengers or packages.
      // eslint-disable-next-line no-unexpected-multiline
      const cargoAndPassengers = [...this.cargo, ...(this.passengers || [])]
      cargoAndPassengers.map((booking: any /* Booking */) => {
        booking.moved(
          this.position,
          metersMoved,
          co2 / (this.cargo.length + 1), // TODO: Why do we do +1 here? Because we have one active booking + cargo
          (h * this.costPerHour) / (this.cargo.length + 1),
          timeDiff
        )
      })
    }
  }

  // start -> toPickup -> pickup -> toDelivery -> delivery -> start

  stopped() {
    this.speed = 0
    this.statusEvents.next(this)
    if (this.booking) {
      this.simulate(false)
      if (this.status === 'toPickup') return this.pickup()
      if (this.status === 'toDelivery') return this.dropOff()
    }
  }

  /**
   * Add carbon dioxide emissions to this vehicle according to the distance traveled.
   * @param {number} Distance The distance traveled in km
   * @returns {number} The amount of carbon dioxide emitted
   */
  updateCarbonDioxide(distance: number): number {
    let co2: number

    switch (this.vehicleType) {
      case 'car':
        co2 = distance * this.co2PerKmKg
        break
      default:
        co2 = (this.weight + this.cargoWeight()) * distance * this.co2PerKmKg
    }

    this.co2 += co2
    return co2
  }

  toObject() {
    return {
      id: this.id,
      position: this.position,
      destination: this.destination,
      speed: this.speed,
      bearing: this.bearing,
      status: this.status,
      fleet: this.fleet?.name || 'Private',
      co2: this.co2,
      distance: this.distance,
      ema: this.ema,
      eta: this.eta,
      cargo: this.cargo.length,
      queue: this.queue.length,
      parcelCapacity: this.parcelCapacity,
      vehicleType: this.vehicleType,
      recyclingTypes: this.recyclingTypes, // Added to class, now this should be fine
      delivered: this.delivered.length,
    }
  }
}

export default Vehicle
