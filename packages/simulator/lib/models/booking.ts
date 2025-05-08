import { ReplaySubject, merge } from 'rxjs'
import { virtualTime } from '../virtualTime'
import { safeId } from '../id'

export type BookingStatus =
  | 'New'
  | 'Queued'
  | 'Assigned'
  | 'Picked up'
  | 'Delivered'

export interface BookingInput {
  id?: string
  sender?: string
  carId?: string
  bookingId?: string
  order?: string
  passenger?: any
  type?: string
  recyclingType?: string
  pickup?: any
  destination?: any
  postalcode?: string
}

export class Booking {
  id: string
  bookingId?: string
  status: BookingStatus
  co2 = 0
  passenger: any
  type?: string
  recyclingType?: string
  cost = 0
  distance = 0
  weight: number
  position: any
  queuedDateTime?: number
  assigned?: number
  pickedUpDateTime?: number
  deliveredDateTime?: number
  deliveryTime?: number
  pickupDateTime?: number
  pickupPosition?: any
  deliveredPosition?: any
  car?: any
  pickup?: any
  destination?: any
  finalDestination?: any
  origin?: string

  // RxJS subjects
  queuedEvents = new ReplaySubject<Booking>()
  pickedUpEvents = new ReplaySubject<Booking>()
  assignedEvents = new ReplaySubject<Booking>()
  deliveredEvents = new ReplaySubject<Booking>()
  statusEvents = merge(
    this.queuedEvents,
    this.assignedEvents,
    this.pickedUpEvents,
    this.deliveredEvents
  )

  constructor(booking: BookingInput) {
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
  }

  async queued(car: any): Promise<void> {
    this.queuedDateTime = await virtualTime.getTimeInMillisecondsAsPromise()
    this.status = 'Queued'
    this.car = car
    this.queuedEvents.next(this)
  }

  async assign(car: any): Promise<void> {
    if (this.assigned) throw new Error('Booking already assigned')
    this.assigned = await virtualTime.getTimeInMillisecondsAsPromise()
    this.car = car
    this.status = 'Assigned'
    this.assignedEvents.next(this)
  }

  async moved(
    position: any,
    metersMoved: number,
    co2: number,
    cost: number
  ): Promise<void> {
    this.position = position
    this.distance += metersMoved
    this.cost += cost
    this.co2 += co2
  }

  async pickedUp(
    position: any,
    date = virtualTime.getTimeInMillisecondsAsPromise()
  ): Promise<void> {
    this.pickupDateTime = await date
    this.pickupPosition = position
    this.status = 'Picked up'
    this.pickedUpEvents.next(this)
  }

  async delivered(
    position: any,
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

  toObject() {
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
    } = this as any

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
