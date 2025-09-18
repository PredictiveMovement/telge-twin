const {
  findBestRouteToPickupBookings,
  useReplayRoute,
  saveCompletePlanForReplay,
} = require('../dispatch/truckDispatch')
const { warn } = require('../log')
import { CLUSTERING_CONFIG } from '../config'
const Vehicle = require('./vehicle').default
const { createSpatialChunks } = require('../clustering')

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
  compartments: Array<{
    fackNumber: number
    allowedWasteTypes: string[]
    capacityLiters: number | null
    capacityKg: number | null
    fillLiters: number
    fillKg: number
  }>

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

    // Build compartments (fack) from fackDetails (if any); fallback to single general fack
    this.compartments = this.buildCompartments()
  }

  /** Return true if any compartment with a finite capacity is at or above capacity (by liters or kg). */
  private isAnyCompartmentFull(): boolean {
    return (this.compartments || []).some((c) => {
      const litersFull =
        typeof c.capacityLiters === 'number' && c.capacityLiters > 0
          ? c.fillLiters >= c.capacityLiters
          : false
      const kgFull =
        typeof c.capacityKg === 'number' && c.capacityKg > 0
          ? c.fillKg >= c.capacityKg
          : false
      return litersFull || kgFull
    })
  }

  /** Return true if there is any load onboard or any compartment has non-zero fill. */
  private hasAnyLoad(): boolean {
    const hasCargo = Array.isArray(this.cargo) && this.cargo.length > 0
    const anyFill = (this.compartments || []).some(
      (c) => (c.fillLiters || 0) > 0 || (c.fillKg || 0) > 0
    )
    return hasCargo || anyFill
  }

  /** Build internal compartments from provided fackDetails or fallback to a single general compartment. */
  private buildCompartments() {
    const fackDetails = (this as any).fackDetails || []
    const list: Array<{
      fackNumber: number
      allowedWasteTypes: string[]
      capacityLiters: number | null
      capacityKg: number | null
      fillLiters: number
      fillKg: number
    }> = []

    if (Array.isArray(fackDetails) && fackDetails.length) {
      for (const f of fackDetails) {
        const types = Array.isArray(f?.avfallstyper)
          ? f.avfallstyper.map((t: any) => t?.avftyp).filter(Boolean)
          : []
        const vol = typeof f?.volym === 'number' && f.volym > 0 ? f.volym * 1000 : null // assume m³ → L
        const kg = typeof f?.vikt === 'number' && f.vikt > 0 ? f.vikt : null
        list.push({
          fackNumber: f.fackNumber,
          allowedWasteTypes: types.length ? types : ['*'],
          capacityLiters: vol,
          capacityKg: kg,
          fillLiters: 0,
          fillKg: 0,
        })
      }
    }

    if (!list.length) {
      // Fallback: one general compartment that accepts all and has no explicit caps
      list.push({
        fackNumber: 1,
        allowedWasteTypes: ['*'],
        capacityLiters: null,
        capacityKg: null,
        fillLiters: 0,
        fillKg: 0,
      })
    }
    return list
  }

  /** Compute expected pickup volume (liters) and weight (kg) for a booking using dataset settings. */
  private computeBookingLoad(booking: any): { volumeLiters: number; weightKg: number | null } {
    const settings = this.fleet?.settings || {}
    const tjIndex: Record<string, { VOLYM?: number; FYLLNADSGRAD?: number }> = Object.fromEntries(
      (settings?.tjtyper || []).map((t: any) => [t.ID, t])
    )
    const avfIndex: Record<string, { VOLYMVIKT?: number }> = Object.fromEntries(
      (settings?.avftyper || []).map((a: any) => [a.ID, a])
    )
    const tjid = booking?.originalData?.originalTjtyp || booking?.originalRecord?.Tjtyp || ''
    const tj = tjid ? tjIndex[tjid] : undefined
    const baseVol = typeof tj?.VOLYM === 'number' ? tj!.VOLYM : 140
    const fill = typeof tj?.FYLLNADSGRAD === 'number' ? tj!.FYLLNADSGRAD : 100
    const volumeLiters = Math.max(1, Math.round((baseVol * fill) / 100))
    const density = avfIndex[booking?.recyclingType || '']?.VOLYMVIKT
    const weightKg = typeof density === 'number' ? (volumeLiters / 1000) * density : null
    return { volumeLiters, weightKg }
  }

  /** Pick an eligible compartment for a given waste type and load, preferring most remaining capacity. */
  private selectCompartment(
    typeId: string,
    load: { volumeLiters: number; weightKg: number | null }
  ) {
    const candidates = this.compartments.filter((c) =>
      c.allowedWasteTypes.includes('*') || c.allowedWasteTypes.includes(typeId)
    )
    if (!candidates.length) return null
    // Score by remaining liters then kg; if no explicit caps, treat as Infinity
    let best: any = null
    let bestScore = -Infinity
    for (const c of candidates) {
      const volRem = c.capacityLiters != null ? c.capacityLiters - c.fillLiters : Number.POSITIVE_INFINITY
      const kgRem =
        c.capacityKg != null && load.weightKg != null
          ? c.capacityKg - c.fillKg
          : Number.POSITIVE_INFINITY
      const score = Math.min(volRem / (load.volumeLiters || 1), kgRem / (load.weightKg || 1))
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    return best
  }

  /**
   * Picks the next instruction from the plan.
   * @returns A promise that resolves when the next instruction is picked.
   */

  async pickNextInstructionFromPlan(): Promise<any> {
    this.instruction = this.plan.shift()

    // If instruction is a pickup but booking already in cargo, skip to next
    if (
      this.instruction?.action === 'pickup' &&
      this.instruction?.booking &&
      this.cargo?.some(
        (c: any) =>
          c === this.instruction.booking ||
          c.id === this.instruction.booking.id ||
          (c.bookingId &&
            this.instruction.booking.bookingId &&
            c.bookingId === this.instruction.booking.bookingId)
      )
    ) {
      return this.pickNextInstructionFromPlan()
    }

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

  /**
   * Handles the truck's stopped state.
   * @returns A promise that resolves when the truck is stopped.
   */

  stopped() {
    super.stopped()

    // Handle delivery status even when booking is null
    if (this.status === 'delivery') {
      return this.dropOff()
    }

    if (this.plan.length === 0) {
      if (
        this.status === 'end' &&
        this.position &&
        this.startPosition && // guard position and startPosition
        this.position.distanceTo(this.startPosition) < 100
      ) {
        // Ensure unloading occurs before parking
        if (this.hasAnyLoad()) {
          // Drop off all cargo/compartment fills first, then parked on next stop
          this.dropOff()
          return
        }

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

  /**
   * Handles the truck's pickup state.
   * @returns A promise that resolves when the booking is picked up.
   */

  async pickup() {
    if (!this.booking) return warn('No booking to pickup', this.id)
    if (this.cargo.indexOf(this.booking) > -1)
      return warn('Already picked up', this.id, this.booking.id)

    // Assign booking to a compartment (fack) and update fill levels
    const typeId = this.booking?.recyclingType
    const load = this.computeBookingLoad(this.booking)
    const comp = this.selectCompartment(typeId, load)

    if (comp) {
      comp.fillLiters += load.volumeLiters
      if (load.weightKg != null) comp.fillKg += load.weightKg
      ;(this.booking as any).assignedFack = comp.fackNumber
      ;(this.booking as any).loadEstimate = load
    } else {
      // Debug: No matching compartment for this recycling type
      try {
        const overview = (this.compartments || []).map((c) => ({
          fack: c.fackNumber,
          allowed: Array.isArray(c.allowedWasteTypes)
            ? c.allowedWasteTypes
            : [],
          capacityL: c.capacityLiters,
        }))
        warn(
          `No matching compartment for type "${typeId}" on truck ${this.id}. ` +
            `Load ~${load.volumeLiters}L${
              load.weightKg != null ? `/${Math.round(load.weightKg)}kg` : ''
            }. Compartments: ${JSON.stringify(overview)}`
        )
      } catch {}
    }

    this.cargo.push(this.booking)
    if (this.cargoEvents) this.cargoEvents.next(this)
    if (this.booking.pickedUp) this.booking.pickedUp(this.position)

    // Prevent base Vehicle.stopped() from re-triggering pickup on next stop
    this.booking = null

    // Check if we need to deliver based on cargo count
    const deliveryConfig = CLUSTERING_CONFIG.DELIVERY_STRATEGIES
    const pickupsBeforeDelivery =
      this.fleet?.settings?.pickupsBeforeDelivery ||
      deliveryConfig.PICKUPS_BEFORE_DELIVERY

    // Trigger delivery if capacity reached OR fallback to pickup-count strategy
    if (this.isAnyCompartmentFull() || this.cargo.length >= pickupsBeforeDelivery) {
      // Only add delivery instruction if the next instruction isn't already a delivery
      const nextInstruction = this.plan[0]

      if (!nextInstruction || nextInstruction.action !== 'delivery') {
        this.plan.unshift({
          action: 'delivery',
          arrival: 0,
          departure: 0,
          booking: null,
        })
      }
    }
  }

  /**
   * Drops off the booking.
   * @returns A promise that resolves when the booking is dropped off.
   */

  async dropOff() {
    // If this is a delivery action (booking is null), deliver all cargo
    if (!this.booking) {
      // Deliver all items in cargo
      const deliveredNow = [...this.cargo]
      deliveredNow.forEach((item: any) => {
        if (item.delivered) item.delivered(this.position)
        // Decrement fills per assigned fack
        const assigned = (item as any).assignedFack
        const load = (item as any).loadEstimate as
          | { volumeLiters: number; weightKg: number | null }
          | undefined
        if (assigned && load) {
          const c = this.compartments.find((x) => x.fackNumber === assigned)
          if (c) {
            c.fillLiters = Math.max(0, c.fillLiters - (load.volumeLiters || 0))
            if (load.weightKg != null)
              c.fillKg = Math.max(0, c.fillKg - load.weightKg)
          }
        }
      })
      this.cargo = []
      if (this.cargoEvents) this.cargoEvents.next(this)

      // Continue with next instruction after delivery
      if (this.plan.length > 0) {
        return this.pickNextInstructionFromPlan()
      } else {
        this.status = 'end'
        if (this.statusEvents) this.statusEvents.next(this)
        return this.navigateTo(this.startPosition)
      }
    }

    // Otherwise, deliver specific booking (legacy behavior)
    // Decrement fill for the specific booking
    const assigned = (this.booking as any).assignedFack
    const load = (this.booking as any).loadEstimate as
      | { volumeLiters: number; weightKg: number | null }
      | undefined
    if (assigned && load) {
      const c = this.compartments.find((x) => x.fackNumber === assigned)
      if (c) {
        c.fillLiters = Math.max(0, c.fillLiters - (load.volumeLiters || 0))
        if (load.weightKg != null) c.fillKg = Math.max(0, c.fillKg - load.weightKg)
      }
    }
    this.cargo = this.cargo.filter((p: any) => p !== this.booking)
    if (this.cargoEvents) this.cargoEvents.next(this)
    if (this.booking.delivered) this.booking.delivered(this.position)
  }

  /**
   * Checks if the truck can handle a booking.
   * @param booking - The booking to check.
   * @returns True if the truck can handle the booking, false otherwise.
   */

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

  /**
   * Handles a booking.
   * @param experimentId - The ID of the experiment.
   * @param booking - The booking to handle.
   * @returns A promise that resolves when the booking is handled.
   */

  async handleBooking(experimentId: string, booking: any) {
    if (this.queue.indexOf(booking) > -1) throw new Error('Already queued')
    this.queue.push(booking)
    if (booking.assign) booking.assign(this)
    if (booking.queued) booking.queued(this)

    clearTimeout(this._timeout)
    const randomDelay =
      CLUSTERING_CONFIG.TRUCK_PLANNING_TIMEOUT_MS +
      Math.random() * CLUSTERING_CONFIG.TRUCK_PLANNING_RANDOM_DELAY_MS
    this._timeout = setTimeout(async () => {
      if (this.fleet.settings.replayExperiment) {
        this.plan = await useReplayRoute(this, this.queue)
        // Ensure area partitions are saved for this truck in replay as well
        try {
          createSpatialChunks(this.queue, experimentId, this.id)
        } catch (e) {
          // non-fatal
        }
      } else {
        try {
          const vroomPromise = findBestRouteToPickupBookings(
            experimentId,
            this,
            this.queue
          )

          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(
                new Error(
                  `VROOM planning timeout after ${CLUSTERING_CONFIG.VROOM_TIMEOUT_MS}ms`
                )
              )
            }, CLUSTERING_CONFIG.VROOM_TIMEOUT_MS)
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
            // Ensure area partitions are saved for this truck as well
            try {
              createSpatialChunks(this.queue, experimentId, this.id)
            } catch (e) {
              // non-fatal
            }
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
          // Ensure area partitions are saved even when falling back
          try {
            createSpatialChunks(this.queue, experimentId, this.id)
          } catch (e) {
            // non-fatal
          }
        }
      }
      if (!this.instruction) await this.pickNextInstructionFromPlan()
    }, randomDelay)

    return booking
  }

  /**
   * Waits at the pickup location.
   * @returns A promise that resolves when the truck is waiting at the pickup location.
   */

  async waitAtPickup() {
    return // Trucks don't wait
  }

  /**
   * Sets the replay plan.
   * @param replayPlan - The replay plan to set.
   */

  setReplayPlan(replayPlan: any[]) {
    this.plan = replayPlan || []

    if (!this.instruction && this.plan.length > 0) {
      this.pickNextInstructionFromPlan()
    }
  }
}

export = Truck
