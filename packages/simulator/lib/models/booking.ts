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
  turordningsnr?: number
  passenger?: TPassenger
  type?: string
  recyclingType?: string
  pickup?: Place
  destination?: Place
  postalcode?: string

  originalTurid?: string
  originalKundnr?: number
  originalHsnr?: number
  originalTjnr?: number
  originalAvftyp?: string
  originalTjtyp?: string
  originalFrekvens?: string
  originalDatum?: string
  originalBil?: string
  originalSchemalagd?: number
  originalDec?: string

  originalRouteRecord?: any
  standardBookingId?: string
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
  turordningsnr?: number

  originalTurid?: string
  originalKundnr?: number
  originalHsnr?: number
  originalTjnr?: number
  originalAvftyp?: string
  originalTjtyp?: string
  originalFrekvens?: string
  originalDatum?: string
  originalBil?: string
  originalSchemalagd?: number
  originalDec?: string
  originalRouteRecord?: any
  standardBookingId?: string

  // RxJS subjects
  queuedEvents = new ReplaySubject<Booking<TPassenger>>()
  pickedUpEvents = new ReplaySubject<Booking<TPassenger>>()
  assignedEvents = new ReplaySubject<Booking<TPassenger>>()
  deliveredEvents = new ReplaySubject<Booking<TPassenger>>()
  statusEvents: Observable<Booking<TPassenger>>

  constructor(booking: BookingInput<TPassenger>) {
    Object.assign(this, booking)
    this.id = this.generateRichId(booking)

    this.bookingId = booking.bookingId
    this.turordningsnr = booking.turordningsnr
    this.status = 'New'
    this.weight = Math.random() * 10
    this.position = this.pickup?.position

    this.originalTurid = booking.originalTurid
    this.originalKundnr = booking.originalKundnr
    this.originalHsnr = booking.originalHsnr
    this.originalTjnr = booking.originalTjnr
    this.originalAvftyp = booking.originalAvftyp
    this.originalTjtyp = booking.originalTjtyp
    this.originalFrekvens = booking.originalFrekvens
    this.originalDatum = booking.originalDatum
    this.originalBil = booking.originalBil
    this.originalSchemalagd = booking.originalSchemalagd
    this.originalDec = booking.originalDec
    this.originalRouteRecord = booking.originalRouteRecord
    this.standardBookingId = booking.standardBookingId

    this.statusEvents = merge(
      this.queuedEvents,
      this.assignedEvents,
      this.pickedUpEvents,
      this.deliveredEvents
    )
  }

  private generateRichId(booking: BookingInput<TPassenger>): string {
    if (
      booking.originalTurid &&
      booking.originalKundnr &&
      booking.originalHsnr &&
      booking.originalTjnr
    ) {
      const parts = [
        booking.sender ? booking.sender.replace(/&/g, '').toLowerCase() : 'b',
        booking.originalTurid,
        booking.originalKundnr,
        booking.originalHsnr,
        booking.originalTjnr,
        booking.turordningsnr || safeId(),
      ]
      return parts.join('-')
    }

    return [
      booking.sender ? booking.sender.replace(/&/g, '').toLowerCase() : 'b',
      booking.id || 'no-id',
      booking.carId || 'no-carId',
      booking.turordningsnr || safeId(),
    ].join('-')
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
      turordningsnr,
      originalTurid,
      originalKundnr,
      originalHsnr,
      originalTjnr,
      originalAvftyp,
      originalTjtyp,
      originalFrekvens,
      originalDatum,
      originalBil,
      originalSchemalagd,
      originalDec,
      originalRouteRecord,
      standardBookingId,
    } = this as Booking<TPassenger> & {
      sender?: string
      carId?: string
    }

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
      turordningsnr,
      originalTurid,
      originalKundnr,
      originalHsnr,
      originalTjnr,
      originalAvftyp,
      originalTjtyp,
      originalFrekvens,
      originalDatum,
      originalBil,
      originalSchemalagd,
      originalDec,
      originalRouteRecord,
      standardBookingId,
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
