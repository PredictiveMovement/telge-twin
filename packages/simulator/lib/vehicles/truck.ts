const {
  findBestRouteToPickupBookings,
  useReplayRoute,
  saveCompletePlanForReplay,
} = require('../dispatch/truckDispatch')
const { warn, info } = require('../log')
const Vehicle = require('./vehicle').default

interface TruckConstructorArgs {
  id?: string
  position: any // Position type
  destination?: any
  startPosition?: any // Position type
  parcelCapacity?: number
  recyclingTypes?: string[]
  weight?: number
  fackDetails?: any[]
  virtualTime?: any
}

class Truck extends Vehicle {
  vehicleType: string
  isPrivateCar: boolean
  co2PerKmKg: number
  parcelCapacity: number
  plan: any[] // Array of plan instructions
  startPosition: any // Position type
  recyclingTypes?: string[]
  instruction?: any // Plan instruction type
  // booking is inherited from Vehicle, should be Booking type
  _timeout?: NodeJS.Timeout // For setTimeout

  constructor(args: TruckConstructorArgs) {
    super({
      ...args,
      virtualTime: args.virtualTime,
    })
    this.vehicleType = 'truck'
    this.isPrivateCar = false
    this.co2PerKmKg = 0.000065
    this.parcelCapacity = args.parcelCapacity || 250
    this.plan = []

    this.startPosition = args.startPosition || args.position
    this.recyclingTypes = args.recyclingTypes
  }

  async pickNextInstructionFromPlan() {
    this.instruction = this.plan.shift()

    if (this.instruction?.booking) {
      const realBooking = this.queue.find(
        (b: any) =>
          b.id === this.instruction.booking.id ||
          b.bookingId === this.instruction.booking.bookingId
      )
      this.booking = realBooking || this.instruction.booking

      if (!realBooking) {
        warn(`Booking object not found for ${this.instruction.booking.id}`)
      }
    } else {
      this.booking = null
    }

    this.status = this.instruction?.action || 'returning'
    if (this.statusEvents) this.statusEvents.next(this)
    switch (this.status) {
      case 'start':
        return this.navigateTo(this.startPosition)
      case 'pickup': {
        this.status = 'toPickup'

        let pickupPosition = null
        if (this.booking?.pickup?.position) {
          pickupPosition = this.booking.pickup.position
        } else if (this.instruction?.booking?.pickup) {
          const Position = require('../models/position')
          pickupPosition = new Position({
            lat: this.instruction.booking.pickup.lat,
            lng: this.instruction.booking.pickup.lon,
          })
        }

        if (!pickupPosition) {
          throw new Error(
            `Pickup position missing for booking ${this.booking?.id} in both booking object and replay instruction`
          )
        }

        return this.navigateTo(pickupPosition)
      }
      case 'delivery':
        return this.navigateTo(this.startPosition)
      default:
        if (!this.plan.length) this.status = 'returning'
        return this.navigateTo(this.startPosition)
    }
  }

  stopped() {
    super.stopped()
    if (this.plan.length === 0) {
      if (
        this.status === 'end' &&
        this.position &&
        this.startPosition && // guard position and startPosition
        this.position.distanceTo(this.startPosition) < 100
      ) {
        this.position = this.startPosition
        this.status = 'parked'
        if (this.statusEvents) this.statusEvents.next(this)
        if (this.movedEvents) this.movedEvents.next(this)
        return
      }

      this.status = 'end'
      if (this.statusEvents) this.statusEvents.next(this)
      return this.navigateTo(this.startPosition)
    } else {
      this.pickNextInstructionFromPlan()
    }
  }

  async pickup() {
    if (!this.booking) return warn('No booking to pickup', this.id)
    if (this.cargo.indexOf(this.booking) > -1)
      return warn('Already picked up', this.id, this.booking.id)

    this.cargo.push(this.booking)
    if (this.cargoEvents) this.cargoEvents.next(this)
    if (this.booking.pickedUp) this.booking.pickedUp(this.position)
  }

  async dropOff() {
    if (!this.booking) return
    this.cargo = this.cargo.filter((p: any) => p !== this.booking)
    if (this.cargoEvents) this.cargoEvents.next(this)
    if (this.booking.delivered) this.booking.delivered(this.position)
  }

  canHandleBooking(booking: any): boolean {
    return booking && this.queue.length < this.parcelCapacity
  }

  async handleStandardBooking(booking: any) {
    if (this.queue.indexOf(booking) > -1) throw new Error('Already queued')
    this.queue.push(booking)
    if (booking.assign) booking.assign(this)
    if (booking.queued) booking.queued(this)

    this.plan = this.queue.map((b: any) => ({
      action: 'pickup',
      booking: b,
    }))

    if (!this.instruction) await this.pickNextInstructionFromPlan()

    return booking
  }

  async handleBooking(experimentId: string, booking: any) {
    if (this.queue.indexOf(booking) > -1) throw new Error('Already queued')
    this.queue.push(booking)
    if (booking.assign) booking.assign(this)
    if (booking.queued) booking.queued(this)

    clearTimeout(this._timeout)
    const randomDelay = 2000 + Math.random() * 2000
    this._timeout = setTimeout(async () => {
      if (this.fleet.settings.replayExperiment) {
        this.plan = await useReplayRoute(this, this.queue)
      } else {
        try {
          const vroomPromise = findBestRouteToPickupBookings(
            experimentId,
            this,
            this.queue
          )

          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error(`VROOM planning timeout after 30000ms`))
            }, 30000)
          })

          this.plan = await Promise.race([vroomPromise, timeoutPromise])

          if (this.plan) {
            await saveCompletePlanForReplay(
              experimentId,
              this.id,
              this.fleet?.name || this.id,
              this.plan,
              this.queue,
              this.fleet?.settings?.createReplay ?? true
            )
          } else {
            throw new Error('VROOM returned null plan')
          }
        } catch (error: any) {
          this.plan = [
            { action: 'start' },
            ...this.queue.map((b: any) => ({
              action: 'pickup',
              booking: b,
            })),
            { action: 'delivery' },
            { action: 'end' },
          ]

          await saveCompletePlanForReplay(
            experimentId,
            this.id,
            this.fleet?.name || this.id,
            this.plan,
            this.queue,
            this.fleet?.settings?.createReplay ?? true
          )
        }
      }
      if (!this.instruction) await this.pickNextInstructionFromPlan()
    }, randomDelay)

    return booking
  }

  async waitAtPickup() {
    return // Trucks don't wait
  }

  setReplayPlan(replayPlan: any[]) {
    this.plan = replayPlan || []

    if (!this.instruction && this.plan.length > 0) {
      this.pickNextInstructionFromPlan()
    }
  }
}

export = Truck
