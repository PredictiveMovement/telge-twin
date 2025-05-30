const {
  findBestRouteToPickupBookings,
  useReplayRoute,
} = require('../dispatch/truckDispatch')
const { warn, debug } = require('../log')
const { clusterPositions } = require('../../lib/kmeans')
const Vehicle = require('./vehicle').default
const { firstValueFrom, from, mergeMap, mergeAll, toArray } = require('rxjs')

interface TruckConstructorArgs {
  id?: string
  position: any // Position type
  startPosition?: any // Position type
  parcelCapacity?: number
  recyclingTypes?: string[]
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
    super(args)
    this.vehicleType = 'truck'
    this.isPrivateCar = false
    this.co2PerKmKg = 0.000065
    this.parcelCapacity = args.parcelCapacity || 250
    this.plan = []

    // position is inherited from Vehicle, assigned in super(args)
    this.startPosition = args.startPosition || args.position
    this.recyclingTypes = args.recyclingTypes
  }

  async pickNextInstructionFromPlan() {
    this.instruction = this.plan.shift()
    this.booking = this.instruction?.booking
    this.status = this.instruction?.action || 'returning'
    if (this.statusEvents) this.statusEvents.next(this)
    switch (this.status) {
      case 'start':
        return this.navigateTo(this.startPosition)
      case 'pickup':
        this.status = 'toPickup'
        if (
          !this.booking ||
          !this.booking.pickup ||
          !this.booking.pickup.position
        )
          throw new Error(
            'Booking, booking pickup, or booking pickup position is missing for pickup action'
          )
        return this.navigateTo(this.booking.pickup.position)
      case 'delivery':
        return this.navigateTo(this.startPosition) // Assuming delivery means returning to start for trucks
      default:
        warn('Unknown status', this.status, this.instruction)
        if (!this.plan.length) this.status = 'returning'
        return this.navigateTo(this.startPosition)
    }
  }

  stopped() {
    super.stopped()
    if (this.status === 'toPickup') {
      // In Vehicle.stopped, for 'toPickup', it calls this.pickup().
      // If Truck needs different logic, it can be here.
      // For now, assume super.stopped() handles calling pickup if necessary.
      // this.delivered.push(this.position); // This was in original truck.ts, but delivered is usually for actual drop-offs
    }
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

    debug('Pickup cargo', this.id, this.booking.id)
    this.cargo.push(this.booking)
    if (this.cargoEvents) this.cargoEvents.next(this)
    if (this.booking.pickedUp) this.booking.pickedUp(this.position)
  }

  async dropOff() {
    // This implies a booking was delivered at a specific point, usually the startPosition for trucks
    if (!this.booking) return // Should have a booking to drop off
    this.cargo = this.cargo.filter((p: any) => p !== this.booking)
    if (this.cargoEvents) this.cargoEvents.next(this)
    if (this.booking.delivered) this.booking.delivered(this.position)
  }

  canHandleBooking(booking: any): boolean {
    return booking && this.queue.length < this.parcelCapacity
  }

  // This method seems to be unused due to handleBooking override. Consider removing or renaming.
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
    this._timeout = setTimeout(async () => {
      if (this.queue.length > 100 && this.position) {
        const clusters = (
          await clusterPositions(this.queue, Math.ceil(this.queue.length / 70))
        ).sort(
          (a: any, b: any) =>
            this.position.distanceTo(a.center) -
            this.position.distanceTo(b.center)
        )

        this.plan = [
          {
            action: 'start',
          },
          ...(await firstValueFrom(
            from(clusters).pipe(
              mergeMap(
                async (cluster: any) =>
                  await findBestRouteToPickupBookings(
                    experimentId,
                    this,
                    cluster.items,
                    ['pickup']
                  ),
                1
              ),
              mergeAll(),
              toArray()
            )
          )),
          {
            action: 'delivery',
          },
          {
            action: 'end',
          },
        ]
      } else if (this.fleet.settings.replayExperiment) {
        this.plan = await useReplayRoute(this, this.queue)
      } else {
        this.plan = await findBestRouteToPickupBookings(
          experimentId,
          this,
          this.queue
        )
      }
      if (!this.instruction) await this.pickNextInstructionFromPlan()
    }, 2000)

    return booking
  }

  async waitAtPickup() {
    return // Trucks don't wait
  }
}

export = Truck
