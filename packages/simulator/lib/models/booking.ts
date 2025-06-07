import { ReplaySubject, merge, Observable } from 'rxjs'
import { virtualTime } from '../virtualTime'
import { safeId } from '../id'
import Position from './position'
import Vehicle from '../vehicles/vehicle'

export type BookingStatus =
  | 'New'
  | 'Queued'
  | 'Assigned'
  | 'Picked up'
  | 'Delivered'

// A location used for pickup or delivery
export interface Place {
  position: Position
  departureTime?: string
  arrivalTime?: string
  postalcode?: string
  name?: string
}

export interface BookingInput<TPassenger = unknown> {
  id?: string
  sender?: string
  carId?: string
  bookingId?: string
  order?: string
  passenger?: TPassenger
  type?: string
  recyclingType?: string
  pickup?: Place
  destination?: Place
  postalcode?: string
}

export class Booking<TPassenger = unknown> {
  id: string
  bookingId?: string
  status: BookingStatus
  co2 = 0
  passenger?: TPassenger
  type?: string
  recyclingType?: string
  cost = 0
  distance = 0
  weight: number
  position?: Position
  postalcode?: string
  sender?: string
  queuedDateTime?: number
  assigned?: number
  pickedUpDateTime?: number
  deliveredDateTime?: number
  deliveryTime?: number
  pickupDateTime?: number
  pickupPosition?: Position
  deliveredPosition?: Position
  car?: Vehicle
  pickup?: Place
  destination?: Place
  finalDestination?: Place
  origin?: string
  carId?: string

  // RxJS subjects
  queuedEvents = new ReplaySubject<Booking<TPassenger>>()
  pickedUpEvents = new ReplaySubject<Booking<TPassenger>>()
  assignedEvents = new ReplaySubject<Booking<TPassenger>>()
  deliveredEvents = new ReplaySubject<Booking<TPassenger>>()
  statusEvents: Observable<Booking<TPassenger>>

  constructor(booking: BookingInput<TPassenger>) {
    Object.assign(this, booking)
    this.id = [
      booking.sender ? booking.sender.replace(/&/g, '').toLowerCase() : 'b',
      booking.id || 'no-id',
      booking.carId || 'no-carId',
      booking.order || safeId(),
    ].join('-')
    this.bookingId = booking.bookingId
    this.status = 'New'
    this.weight = Math.random() * 10
    this.position = this.pickup?.position

    // Merge status-oriented streams
    this.statusEvents = merge(
      this.queuedEvents,
      this.assignedEvents,
      this.pickedUpEvents,
      this.deliveredEvents
    )
  }

  async queued(car: Vehicle): Promise<void> {
    this.queuedDateTime = await virtualTime.getTimeInMillisecondsAsPromise()
    this.status = 'Queued'
    this.car = car
    this.queuedEvents.next(this)
  }

  async assign(car: Vehicle): Promise<void> {
    if (this.assigned) throw new Error('Booking already assigned')
    this.assigned = await virtualTime.getTimeInMillisecondsAsPromise()
    this.car = car
    this.status = 'Assigned'
    this.assignedEvents.next(this)
  }

  async moved(
    position: Position,
    metersMoved: number,
    co2: number,
    cost: number,
    timeDiff?: number
  ): Promise<void> {
    this.position = position
    this.distance += metersMoved
    this.cost += cost
    this.co2 += co2
  }

  async pickedUp(
    position: Position,
    date = virtualTime.getTimeInMillisecondsAsPromise()
  ): Promise<void> {
    this.pickupDateTime = await date
    this.pickupPosition = position
    this.status = 'Picked up'
    this.pickedUpEvents.next(this)
  }

  async delivered(
    position: Position,
    date = virtualTime.getTimeInMillisecondsAsPromise()
  ): Promise<void> {
    this.deliveredDateTime = await date
    this.deliveredPosition = position
    this.deliveryTime =
      (this.deliveredDateTime - (this.assigned || this.queuedDateTime || 0)) /
      1000
    this.status = 'Delivered'
    this.deliveredEvents.next(this)
  }

  toObject(): Record<string, unknown> {
    const {
      id,
      status,
      type,
      co2,
      cost,
      distance,
      weight,
      sender,
      position,
      postalcode,
      pickup,
      destination,
      pickupPosition,
      deliveredPosition,
      pickupDateTime,
      deliveredDateTime,
      deliveryTime,
      queuedDateTime,
      assigned,
      carId,
      finalDestination,
      origin,
    } = this as Booking<TPassenger> & { sender?: string; carId?: string }

    return {
      id,
      status,
      type,
      co2,
      cost,
      distance,
      weight,
      sender,
      position,
      postalcode,
      pickup,
      destination,
      pickupPosition,
      deliveredPosition,
      pickupDateTime,
      deliveredDateTime,
      deliveryTime,
      queued: queuedDateTime,
      assigned,
      carId: carId || this.car?.id,
      finalDestination,
      origin,
    }
  }
}

export default Booking

// CommonJS fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = Booking
}
