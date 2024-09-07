import { ReplaySubject, Subscription } from 'rxjs'
import { scan } from 'rxjs/operators'
import moment from 'moment'
import { assert } from 'console'

import osrm from '../osrm'
import { haversine, bearing } from '../distance'
import interpolate from '../interpolate'
import Booking from './booking'
import { safeId } from '../id'
import { error } from '../log'
import { virtualTime } from '../virtualTime'
import Position from './position'

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

interface VehicleArgs {
  id?: string
  position: Position
  status?: string
  parcelCapacity?: number
  passengerCapacity?: number
  weight?: number
  fleet?: any
  co2PerKmKg?: number
}

class Vehicle {
  id: string
  position: Position
  origin: Position
  queue: Booking[]
  cargo: Booking[]
  delivered: Booking[]
  parcelCapacity?: number
  passengerCapacity?: number
  weight: number
  costPerHour: number
  co2: number
  distance: number
  status: string
  fleet?: any
  created: Promise<number>
  co2PerKmKg: number
  vehicleType: string
  movedEvents: ReplaySubject<Vehicle>
  cargoEvents: ReplaySubject<Vehicle>
  statusEvents: ReplaySubject<Vehicle>
  movementSubscription?: Subscription
  heading?: Position
  route?: any
  booking?: Booking
  _disposed?: boolean
  lastPositionUpdate?: number
  ema?: number
  speed?: number
  pointsPassedSinceLastUpdate?: any[]
  bearing?: number
  passengers?: any[]

  constructor({
    id = 'v-' + safeId(),
    position,
    status = 'ready',
    parcelCapacity,
    passengerCapacity,
    weight = 10000,
    fleet,
    co2PerKmKg = 0.013 / 1000,
  }: VehicleArgs) {
    this.id = id
    this.position = position
    this.origin = position
    this.queue = []
    this.cargo = []
    this.delivered = []
    this.parcelCapacity = parcelCapacity
    this.passengerCapacity = passengerCapacity
    this.weight = weight
    this.costPerHour = 3000 / 12
    this.co2 = 0
    this.distance = 0
    this.status = status
    this.fleet = fleet
    this.created = this.time()
    this.co2PerKmKg = co2PerKmKg
    this.vehicleType = 'default'

    this.movedEvents = new ReplaySubject<Vehicle>()
    this.cargoEvents = new ReplaySubject<Vehicle>()
    this.statusEvents = new ReplaySubject<Vehicle>()
  }

  dispose() {
    this.simulate(false)
    this._disposed = true
  }

  time(): Promise<number> {
    return virtualTime.getTimeInMillisecondsAsPromise()
  }

  simulate(route: any) {
    if (this.movementSubscription) {
      this.movementSubscription.unsubscribe()
    }
    if (!route) return

    if (virtualTime.timeMultiplier === Infinity) {
      return this.updatePosition(route)
    }

    this.movementSubscription = virtualTime
      .getTimeInMilliseconds()
      .pipe(
        scan((prevRemainingPointsInRoute, currentTimeInMs) => {
          if (!prevRemainingPointsInRoute.length) {
            this.stopped()
            return []
          }

          const { skippedPoints, remainingPoints, ...position } =
            interpolate.route(
              route.started,
              currentTimeInMs,
              prevRemainingPointsInRoute
            ) ?? this.heading
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

  navigateTo(position: Position): Promise<Position> {
    this.heading = position

    if (this.position.distanceTo(position) < 100) {
      this.stopped()
      return Promise.resolve(position)
    }

    return osrm
      .route(this.position, this.heading)
      .then(async (route: any) => {
        route.started = await this.time()
        this.route = route
        if (!route.legs)
          throw new Error(
            `Route not found from: ${JSON.stringify(
              this.position
            )} to: ${JSON.stringify(this.heading)} from: ${JSON.stringify(
              this.position
            )}`
          )
        this.simulate(this.route)
        return this.heading!
      })
      .catch(
        (err: Error) =>
          error('Route error, retrying in 1s...', err) ||
          wait(1000).then(() => this.navigateTo(position))
      )
  }

  async handleBooking(booking: Booking): Promise<Booking> {
    assert(booking instanceof Booking, 'Booking needs to be of type Booking')

    if (!this.booking) {
      this.booking = booking
      booking.assign(this)
      this.status = 'toPickup'
      this.statusEvents.next(this)

      this.navigateTo(booking.pickup.position)
    } else {
      this.queue.push(booking)
      booking.assign(this)

      booking.queued(this)
    }
    return booking
  }

  async waitAtPickup() {
    const departure = moment(
      this.booking!.pickup.departureTime,
      'hh:mm:ss'
    ).valueOf()
    const waitingtime = moment(departure).diff(
      moment(await virtualTime.getTimeInMillisecondsAsPromise())
    )

    if (waitingtime > 0) {
      this.simulate(false)
      await virtualTime.waitUntil(departure)
    }
  }

  async pickup() {
    if (this._disposed) return

    await this.waitAtPickup()

    setImmediate(() => {
      if (this.booking) this.booking.pickedUp(this.position)
      this.cargo.push(this.booking!)
      this.queue
        .filter((b) => this.position.distanceTo(b.pickup.position) < 200)
        .forEach((booking) => {
          this.cargo.push(booking)
          booking.pickedUp(this.position)
          this.cargoEvents.next(this)
        })
      if (this.booking && this.booking.destination) {
        this.booking.pickedUp(this.position)
        this.status = 'toDelivery'
        this.statusEvents.next(this)

        if (
          this.queue.length > 0 &&
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

  pickNextFromCargo(): Booking | undefined {
    this.cargo.sort(
      (a, b) =>
        haversine(this.position, a.destination.position) -
        haversine(this.position, b.destination.position)
    )
    const booking = this.cargo.shift()
    this.cargoEvents.next(this)

    if (booking) {
      this.navigateTo(this.booking!.destination.position)
    } else {
      this.queue.sort(
        (a, b) =>
          haversine(this.position, a.destination.position) -
          haversine(this.position, b.destination.position)
      )

      const nextBooking = this.queue.shift()
      if (nextBooking) {
        this.handleBooking(nextBooking)
      } else {
        this.status = 'ready'
        this.navigateTo(this.origin)
      }
    }
    return booking
  }

  cargoWeight(): number {
    return this.cargo.reduce((total, booking) => total + booking.weight, 0)
  }

  async updatePosition(
    position: Position,
    pointsPassedSinceLastUpdate: any[],
    time: number
  ) {
    const lastPosition = this.position || position
    const timeDiff = time - (this.lastPositionUpdate || 0)

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

    this.distance += km
    this.pointsPassedSinceLastUpdate = pointsPassedSinceLastUpdate
    this.speed = Math.round(km / h || 0)
    this.position = position
    this.lastPositionUpdate = time
    this.ema = haversine(this.heading!, this.position)
    if (metersMoved > 0) {
      this.bearing = bearing(lastPosition, position) || 0
      this.movedEvents.next(this)
      const cargoAndPassengers = [...this.cargo, ...(this.passengers || [])]
      cargoAndPassengers.map((booking) => {
        booking.moved(
          this.position,
          metersMoved,
          co2 / (this.cargo.length + 1),
          (h * this.costPerHour) / (this.cargo.length + 1),
          timeDiff
        )
      })
    }
  }

  stopped() {
    this.speed = 0
    this.statusEvents.next(this)
    if (this.booking) {
      this.simulate(false)
      if (this.status === 'toPickup') return this.pickup()
      if (this.status === 'toDelivery') return this.dropOff()
    }
  }

  updateCarbonDioxide(distance: number): number {
    let co2

    switch (this.vehicleType) {
      case 'bus':
      case 'car':
      case 'taxi':
        co2 = distance * this.co2PerKmKg
        break
      default:
        co2 = (this.weight + this.cargoWeight()) * distance * this.co2PerKmKg
    }

    this.co2 += co2
    return co2
  }
}

export default Vehicle