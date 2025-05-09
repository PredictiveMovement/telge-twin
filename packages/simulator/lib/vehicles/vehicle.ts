/* Ported from vehicle.js */
import { ReplaySubject, Subscription } from 'rxjs'
import { scan } from 'rxjs/operators'
import moment from 'moment'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const osrm = require('../osrm')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { haversine, bearing } = require('../distance')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const interpolate = require('../interpolate')
import Booking, { Place } from '../models/booking'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { safeId } = require('../id')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { error } = require('../log')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { virtualTime } = require('../virtualTime')
import Position from '../models/position'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface RoutePoint {
  meters: number
  duration: number
  lon: number
  lat: number
}

export interface VehicleOptions {
  id?: string
  position: Position
  status?: string
  parcelCapacity?: number
  passengerCapacity?: number
  weight?: number
  fleet?: unknown
  co2PerKmKg?: number
}

export default class Vehicle {
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
  fleet: any // will be typed later
  created: Promise<number>
  co2PerKmKg: number
  vehicleType: string
  recyclingTypes?: string[]

  // dynamic during route
  destination?: Position
  route?: any // TODO: type OSRM Route
  booking?: Booking
  speed?: number
  bearing?: number
  ema?: number
  eta?: number

  // other optional flags
  isPrivateCar?: boolean
  plan?: unknown[]

  // Event subjects
  movedEvents: ReplaySubject<Vehicle>
  cargoEvents: ReplaySubject<Vehicle>
  statusEvents: ReplaySubject<Vehicle>

  private _disposed: boolean
  private movementSubscription?: Subscription

  constructor({
    id = 'v-' + safeId(),
    position,
    status = 'ready',
    parcelCapacity,
    passengerCapacity,
    weight = 10000,
    fleet,
    co2PerKmKg = 0.013 / 1000,
  }: VehicleOptions) {
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

    // Initialize optional internals
    this._disposed = false
    this._lastUpdateTime = undefined
    this.movementSubscription = undefined
  }

  private _lastUpdateTime?: number

  dispose(): void {
    this.simulate(false)
    this._disposed = true
  }

  time(): Promise<number> {
    return virtualTime.getTimeInMillisecondsAsPromise()
  }

  simulate(route: { started: number } | false): void {
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
        scan((prev: RoutePoint[], currentTimeInMs: number) => {
          if (!prev.length) {
            this.stopped()
            return []
          }
          const res =
            interpolate.route(route.started, currentTimeInMs, prev) ??
            this.destination
          const { skippedPoints, remainingPoints, ...position } = res as any
          const newPosition = new Position(position)
          if (route.started > currentTimeInMs) return []
          this.updatePosition(newPosition, skippedPoints, currentTimeInMs)
          return remainingPoints
        }, interpolate.points(route))
      )
      .subscribe(() => null)
  }

  navigateTo(destination: Position): Promise<Position> {
    this.destination = destination
    if (this.position.distanceTo(destination) < 5) {
      this.stopped()
      return Promise.resolve(destination)
    }
    return osrm
      .route(this.position, this.destination)
      .then(async (route: any) => {
        route.started = await this.time()
        this.route = route
        if (!route.legs) throw new Error('Route not found')
        this.simulate(this.route)
        return this.destination
      })
      .catch(
        (err: any) =>
          error('Route error, retrying...', err) ||
          wait(1000).then(() => this.navigateTo(destination))
      )
  }

  async handleBooking(booking: Booking): Promise<Booking> {
    if (!this.booking) {
      this.booking = booking
      booking.assign(this)
      this.status = 'toPickup'
      this.statusEvents.next(this)
      if (booking.pickup?.position) {
        await this.navigateTo(booking.pickup.position)
      }
    } else {
      this.queue.push(booking)
      booking.assign(this)
      booking.queued(this)
    }
    return booking
  }

  async waitAtPickup(): Promise<void> {
    if (!this.booking?.pickup?.departureTime) return

    const departure = moment(
      this.booking.pickup!.departureTime!,
      'hh:mm:ss'
    ).valueOf()
    const waitingtime =
      departure - (await virtualTime.getTimeInMillisecondsAsPromise())
    if (waitingtime > 0) {
      this.simulate(false)
      await virtualTime.waitUntil(departure)
    }
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
      recyclingTypes: this.recyclingTypes,
      delivered: this.delivered.length,
    }
  }

  /**
   * Update the current position of the vehicle.
   *
   * There are two main call-sites for this function:
   *  1. When virtualTime.timeMultiplier === Infinity (i.e. we want to fast-forward). In this
   *     scenario `posOrRoute` will actually be the calculated OSRM route and we simply move the
   *     vehicle to its final destination immediately.
   *  2. When the simulation is running in "real" (virtual) time. In this scenario `posOrRoute`
   *     will be the next interpolated Position generated in `simulate()`.
   */
  updatePosition(
    posOrRoute: any,
    skippedPoints: any[] = [],
    currentTimeInMs?: number
  ) {
    // Guard against dispose
    if (this._disposed) return

    // Keep track of previous position & timestamp so we can calculate deltas
    const previousPosition: Position = this.position
    const previousTimestamp: number | undefined = this._lastUpdateTime

    let newPosition: Position

    // Case 1 – posOrRoute is an OSRM route (when we fast-forward the simulation)
    if (posOrRoute && posOrRoute.geometry && posOrRoute.geometry.coordinates) {
      const coords = posOrRoute.geometry.coordinates
      const last = coords[coords.length - 1]
      newPosition = new Position({
        lon: last.lon ?? last[0],
        lat: last.lat ?? last[1],
      })
    } else {
      // Case 2 – Already a Position instance or plain object with lon/lat
      newPosition =
        posOrRoute instanceof Position ? posOrRoute : new Position(posOrRoute)
    }

    // If for some reason the position is invalid – skip this update
    if (!newPosition.isValid()) return

    // Calculate distance moved since previous update
    const metersMoved = previousPosition
      ? haversine(previousPosition, newPosition)
      : 0

    // Calculate bearing (direction)
    this.bearing = previousPosition
      ? bearing(previousPosition, newPosition)
      : this.bearing

    // Calculate speed if we have a timestamp difference
    if (currentTimeInMs && previousTimestamp) {
      const diffSeconds = (currentTimeInMs - previousTimestamp) / 1000
      this.speed =
        diffSeconds > 0 ? Math.round((metersMoved / diffSeconds) * 3.6) : 0 // km/h
    }

    // Update vehicle aggregates
    this.distance += metersMoved
    const co2Delta = (metersMoved / 1000) * (this.co2PerKmKg || 0)
    this.co2 += co2Delta

    // Move vehicle
    this.position = newPosition

    // Inform listeners that the vehicle moved
    this.movedEvents.next(this)

    // Update bookings currently onboard (cargo)
    if (Array.isArray(this.cargo)) {
      const costDelta = this.costPerHour
        ? ((currentTimeInMs && previousTimestamp
            ? currentTimeInMs - previousTimestamp
            : 0) /
            3600000) *
          this.costPerHour
        : 0
      this.cargo.forEach((booking: any) => {
        if (typeof booking.moved === 'function') {
          booking.moved(newPosition, metersMoved, co2Delta, costDelta)
        }
      })
    }

    // When we are close to destination we consider ourselves stopped
    if (this.destination && this.position.distanceTo(this.destination) < 5) {
      this.stopped()
    }

    // Save timestamp for next iteration
    this._lastUpdateTime = currentTimeInMs ?? Date.now()
  }

  /**
   * Called once a vehicle has reached its destination (pickup or drop-off).
   */
  stopped() {
    // Reset speed when stationary
    this.speed = 0

    if (this.status === 'toPickup' && this.booking) {
      // We have arrived at pickup point
      this.status = 'pickup'
      this.statusEvents.next(this)
      this.pickup()
      return
    }

    if (this.status === 'toDestination' && this.booking) {
      // Arrived at destination
      this.status = 'dropOff'
      this.statusEvents.next(this)
      this.dropOff()
      return
    }

    // Generic idle state
    this.status = 'idle'
    this.statusEvents.next(this)
  }

  /**
   * Handles picking up the current assigned booking.
   */
  async pickup() {
    if (!this.booking) return

    await this.waitAtPickup()

    // Move booking into cargo
    this.cargo.push(this.booking)
    await this.booking.pickedUp(this.position)

    // Navigate to destination
    this.status = 'toDestination'
    this.statusEvents.next(this)
    if (this.booking.destination?.position) {
      await this.navigateTo(this.booking.destination.position)
    }
  }

  /**
   * Handles dropping off the current booking.
   */
  async dropOff() {
    if (!this.booking) return

    await this.booking.delivered(this.position)

    // Remove booking from cargo and move to delivered list
    const idx = this.cargo.indexOf(this.booking)
    if (idx !== -1) this.cargo.splice(idx, 1)
    this.delivered.push(this.booking)

    // Clear active booking
    this.booking = undefined

    // Handle queued bookings
    if (this.queue.length) {
      const next: Booking | undefined = this.queue.shift()
      if (next) {
        // Skip re-assignment if already assigned earlier
        if (!next.assigned) await next.assign(this)
        this.booking = next
        this.status = 'toPickup'
        this.statusEvents.next(this)
        if (next.pickup?.position) {
          await this.navigateTo(next.pickup.position)
        }
        return
      }
    } else {
      // No more work – ready for new assignments
      this.status = 'ready'
      this.statusEvents.next(this)
    }
  }
}

// CommonJS fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = Vehicle

// export interface
export { Vehicle as BaseVehicle } // for importing if needed
