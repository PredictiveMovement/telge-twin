import { ReplaySubject, merge, Observable } from 'rxjs'
import { virtualTime } from '../virtualTime'
import { safeId } from '../id'
import Position from './position'
import Vehicle from '../vehicles/vehicle'
import {
  OriginalBookingData,
  extractOriginalData,
} from '../types/originalBookingData'

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

  originalData?: OriginalBookingData
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

  originalData?: OriginalBookingData

  // RxJS subjects
  queuedEvents = new ReplaySubject<Booking<TPassenger>>()
  pickedUpEvents = new ReplaySubject<Booking<TPassenger>>()
  assignedEvents = new ReplaySubject<Booking<TPassenger>>()
  deliveredEvents = new ReplaySubject<Booking<TPassenger>>()
  statusEvents: Observable<Booking<TPassenger>>

  constructor(booking: BookingInput<TPassenger>) {
    Object.assign(this, booking)
    // Respect input ID if provided, otherwise generate rich ID
    this.id = booking.id || this.generateRichId(booking)

    this.bookingId = booking.bookingId
    this.turordningsnr = booking.turordningsnr
    this.status = 'New'
    this.weight = Math.random() * 10
    this.position = this.pickup?.position

    // Set original data - use provided originalData or extract from booking properties
    this.originalData = booking.originalData || extractOriginalData(booking)

    this.statusEvents = merge(
      this.queuedEvents,
      this.assignedEvents,
      this.pickedUpEvents,
      this.deliveredEvents
    )
  }

  /**
   * Generates a rich ID for a booking.
   * @param booking - The booking to generate an ID for.
   * @returns A rich ID for the booking.
   */

  private generateRichId(booking: BookingInput<TPassenger>): string {
    const originalData = booking.originalData || extractOriginalData(booking)

    if (
      originalData.originalTurid &&
      originalData.originalKundnr &&
      originalData.originalHsnr &&
      originalData.originalTjnr
    ) {
      const parts = [
        booking.sender ? booking.sender.replace(/&/g, '').toLowerCase() : 'b',
        originalData.originalTurid,
        originalData.originalKundnr,
        originalData.originalHsnr,
        originalData.originalTjnr,
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

  /**
   * Sets the booking to queued.
   * @param car - The vehicle that the booking is queued for.
   * @returns A promise that resolves when the booking is queued.
   */

  async queued(car: Vehicle): Promise<void> {
    this.queuedDateTime = await virtualTime.getTimeInMillisecondsAsPromise()
    this.status = 'Queued'
    this.car = car
    this.queuedEvents.next(this)
  }

  /**
   * Assigns the booking to a vehicle.
   * @param car - The vehicle that the booking is assigned to.
   * @returns A promise that resolves when the booking is assigned.
   */

  async assign(car: Vehicle): Promise<void> {
    if (this.assigned) throw new Error('Booking already assigned')
    this.assigned = await virtualTime.getTimeInMillisecondsAsPromise()
    this.car = car
    this.status = 'Assigned'
    this.assignedEvents.next(this)
  }

  /**
   * Moves the booking to a new position.
   * @param position - The new position of the booking.
   * @param metersMoved - The distance moved in meters.
   * @param co2 - The CO2 emitted by the booking.
   * @param cost - The cost of the booking.
   * @param timeDiff - The time difference between the booking's assigned and queued times.
   * @returns A promise that resolves when the booking is moved.
   */

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

  /**
   * Sets the booking to picked up.
   * @param position - The position of the booking.
   * @param date - The date and time the booking was picked up.
   * @returns A promise that resolves when the booking is picked up.
   */

  async pickedUp(
    position: Position,
    date = virtualTime.getTimeInMillisecondsAsPromise()
  ): Promise<void> {
    this.pickupDateTime = await date
    this.pickupPosition = position
    this.status = 'Picked up'
    this.pickedUpEvents.next(this)
  }

  /**
   * Sets the booking to delivered.
   * @param position - The position of the booking.
   * @param date - The date and time the booking was delivered.
   * @returns A promise that resolves when the booking is delivered.
   */

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

  /**
   * Converts the booking to an object.
   * @returns An object representation of the booking.
   */

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
      originalData,
    } = this as Booking<TPassenger> & {
      sender?: string
      carId?: string
    }

    const serializePlace = (p?: Place) =>
      p
        ? {
            ...p,
            position: p.position ? p.position.toJSON() : undefined,
          }
        : undefined

    return {
      id,
      status,
      type,
      co2,
      cost,
      distance,
      weight,
      sender,
      position: position ? position.toJSON() : undefined,
      postalcode,
      pickup: serializePlace(pickup),
      destination: serializePlace(destination),
      pickupPosition: pickupPosition ? pickupPosition.toJSON() : undefined,
      deliveredPosition: deliveredPosition
        ? deliveredPosition.toJSON()
        : undefined,
      pickupDateTime,
      deliveredDateTime,
      deliveryTime,
      queued: queuedDateTime,
      assigned,
      carId: carId || this.car?.id,
      finalDestination,
      origin,
      turordningsnr,
      originalData,
    }
  }
}

export default Booking
