import {
  findBestRouteToPickupBookings,
  useReplayRoute,
  saveCompletePlanForReplay,
  reportDispatchError,
} = require('../dispatch/truckDispatch')
const { isVroomPlanningCancelledError } = require('../vroom')
const { warn, error: logError } = require('../log')
import { CLUSTERING_CONFIG } from '../config'
import { getHemsortDistribution } from '../config/hemsort'
import {
  estimateBookingLoad,
  applyLoadToCompartment,
  createCompartments,
  isAnyCompartmentFull,
  releaseLoadFromCompartment,
  selectBestCompartment,
} from '../capacity'
import type { Compartment, LoadEstimate } from '../capacity'
import Vehicle from './vehicle'
import { Position } from '../models/position'
import { createSpatialChunks } from '../clustering'
import type { Instruction } from '../dispatch/truckDispatch'
import { buildBreakSchedule, ScheduledBreak } from './breaks'

interface TruckConstructorArgs {
  id?: string
  position: any
  destination?: any
  startPosition?: any
  parcelCapacity?: number
  recyclingTypes?: string[]
  weight?: number
  fackDetails?: any[]
  virtualTime?: any
  fleet?: any
  vehicleType?: string
  realDescription?: string
  class?: new (...args: any[]) => any
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
  compartments: Compartment[]
  private shiftEndedForDay = false
  private breakSchedule: ScheduledBreak[] = []
  private breakActive: ScheduledBreak | null = null
  private breakNavigatingToLocation = false
  private breakPreviousStatus: string | null = null
  private finishingWorkday = false
  private skipQueueUnreachableMarking = false

  private isSequentialExperiment(): boolean {
    const fleetExperimentType =
      this.fleet?.settings?.experimentType ||
      (this.fleet as any)?.experimentType
    return fleetExperimentType === 'sequential'
  }

  private getDeliveryStrategy(): 'capacity_based' | 'end_of_route' {
    const fleetStrategy = this.fleet?.settings?.deliveryStrategy
    if (fleetStrategy === 'capacity_based' || fleetStrategy === 'end_of_route') {
      return fleetStrategy
    }
    return CLUSTERING_CONFIG.DELIVERY_STRATEGIES.DEFAULT_DELIVERY_STRATEGY || 'capacity_based'
  }

  private createInstruction(
    action: Instruction['action'],
    booking: Instruction['booking'] = null,
    overrides: Partial<Omit<Instruction, 'action' | 'booking'>> = {}
  ): Instruction {
    return {
      action,
      booking,
      arrival: overrides.arrival ?? 0,
      departure: overrides.departure ?? 0,
      ...overrides,
    }
  }

  private buildSequentialPlanFromQueue(): Instruction[] {
    const remaining = this.queue.filter(
      (booking: any) => booking && booking.status !== 'Unreachable'
    )

    if (!remaining.length && !this.cargo.length) {
      return []
    }

    const plan: Instruction[] = []

    plan.push(this.createInstruction('start'))

    remaining.forEach((booking: any) => {
      plan.push(this.createInstruction('pickup', booking))
    })

    plan.push(this.createInstruction('delivery'))
    plan.push(this.createInstruction('end'))

    return plan
  }

  private getInstructionTarget(instruction: Instruction): any {
    switch (instruction.action) {
      case 'start':
      case 'delivery':
      case 'end':
        return this.startPosition
      case 'pickup': {
        if (instruction.booking?.pickup?.position) {
          return instruction.booking.pickup.position
        }
        if (instruction.booking?.pickup) {
          return new Position({
            lat: instruction.booking.pickup.lat,
            lng: instruction.booking.pickup.lon,
          })
        }
        return null
      }
      default:
        return this.startPosition
    }
  }

  /**
   * Pre-compute OSRM routes for all legs in the plan.
   * After this, each instruction.route holds the full OSRM response
   * so navigateTo() can skip network calls during simulation.
   */
  async precomputeRoutes(): Promise<void> {
    if (!this.plan || this.plan.length === 0) return

    const osrm = require('../osrm')

    let prevPosition = this.position
    const jobs = this.plan.map((instruction: Instruction) => {
      const target = this.getInstructionTarget(instruction)
      if (!target) return null
      const from = prevPosition
      prevPosition = target
      return { instruction, from, to: target }
    }).filter(Boolean)

    let successCount = 0
    let emptyCount = 0
    let failCount = 0

    await Promise.all(
      jobs.map(async (job: any) => {
        try {
          const route = await osrm.route(job.from, job.to)
          if (route?.legs) {
            job.instruction.route = route
            successCount++
          } else {
            emptyCount++
            logError(`[precomputeRoutes] OSRM returned empty route for truck ${this.id}:`, {
              action: job.instruction.action,
              from: { lat: job.from.lat, lon: job.from.lon },
              to: { lat: job.to.lat, lon: job.to.lon },
              routeKeys: route ? Object.keys(route) : [],
            })
          }
        } catch (err: any) {
          failCount++
          logError(`[precomputeRoutes] OSRM failed for truck ${this.id}:`, err?.message || err)
        }
      })
    )

    const totalDrivingSec = jobs.reduce((sum: number, job: any) => {
      const dur = job?.instruction?.route?.duration || 0
      return sum + dur
    }, 0)
    info(`[precomputeRoutes] Truck ${this.id}: ${successCount} routes, ${emptyCount} empty, ${failCount} failed (of ${jobs.length} jobs). Total driving: ${Math.round(totalDrivingSec / 60)} min`)
  }

  /**
   * Navigate back to depot with a fresh OSRM route.
   * Used for end-of-workday returns where the route isn't in the plan.
   */
  private async navigateToDepot(): Promise<any> {
    const osrm = require('../osrm')
    const depotRoute = await this.runWithoutAdvancing(() =>
      osrm.route(this.position, this.startPosition)
    )
    this.instruction = this.createInstruction('end', null, { route: depotRoute })
    return this.navigateTo(this.startPosition)
  }

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
    this.compartments = createCompartments((this as any).fackDetails)

    this.initializeBreakSchedule()
  }

  private setStatus(status: string) {
    this.status = status
    this.emitStatus()
  }

  private emitStatus() {
    if (this.statusEvents) this.statusEvents.next(this)
  }

  private emitMoved() {
    if (this.movedEvents) this.movedEvents.next(this)
  }

  private emitCargo() {
    if (this.cargoEvents) this.cargoEvents.next(this)
  }

  /** Return true if there is any load onboard or any compartment has non-zero fill. */
  private hasAnyLoad(): boolean {
    const hasCargo = Array.isArray(this.cargo) && this.cargo.length > 0
    const anyFill = (this.compartments || []).some(
      (c) => (c.fillLiters || 0) > 0 || (c.fillKg || 0) > 0
    )
    return hasCargo || anyFill
  }

  /** Mark all non-unreachable, non-cargo queue items as unreachable. */
  private async markRemainingAsUnreachable(): Promise<void> {
    const cargoSet = new Set(this.cargo || [])
    const pending = this.queue.filter(
      (b: any) => b && b.status !== 'Unreachable' && !cargoSet.has(b)
    )
    await Promise.all(
      pending.map(async (b: any) => {
        if (typeof b.markUnreachable === 'function') {
          await b.markUnreachable('plan-complete')
        } else {
          b.status = 'Unreachable'
        }
      })
    )
  }

  private initializeBreakSchedule() {
    const explicitBreaks = Array.isArray(this.fleet?.settings?.breaks)
      ? this.fleet.settings.breaks
      : []
    const explicitExtraBreaks = Array.isArray(
      (this.fleet?.settings as any)?.extraBreaks
    )
      ? (this.fleet?.settings as any).extraBreaks
      : []

    const optimizationBreaks = Array.isArray(
      this.fleet?.settings?.optimizationSettings?.breaks
    )
      ? this.fleet?.settings?.optimizationSettings?.breaks
      : []
    const optimizationExtraBreaks = Array.isArray(
      this.fleet?.settings?.optimizationSettings?.extraBreaks
    )
      ? this.fleet?.settings?.optimizationSettings?.extraBreaks
      : []

    const breakCandidates = [
      ...explicitBreaks,
      ...explicitExtraBreaks,
      ...(explicitBreaks.length || explicitExtraBreaks.length
        ? []
        : [...optimizationBreaks, ...optimizationExtraBreaks]),
    ]

    this.breakSchedule = buildBreakSchedule({
      virtualTime: this.virtualTime,
      breaks: breakCandidates,
      workdaySettings: this.fleet?.settings?.workday,
      optimizationSettings: this.fleet?.settings?.optimizationSettings,
    })
  }

  private hasReachedEndOfWorkday(): boolean {
    const bounds = this.virtualTime?.getWorkdayBounds?.()
    if (!bounds) return false
    return this.virtualTime.now() >= bounds.endMs
  }

  private async concludeWorkday(): Promise<void> {
    if (this.shiftEndedForDay) return
    this.shiftEndedForDay = true
    this.finishingWorkday = true

    // Exclude bookings already picked up (in cargo) — they will be
    // delivered at the depot by finalizeEndOfWorkday → dischargeAllCargo
    const cargoSet = new Set(this.cargo || [])

    const pendingBookings = new Set<any>()
    ;(this.plan || []).forEach((instruction: Instruction) => {
      if (
        instruction?.booking &&
        instruction.action === 'pickup' &&
        instruction.booking.status !== 'Unreachable' &&
        !cargoSet.has(instruction.booking)
      ) {
        pendingBookings.add(instruction.booking)
      }
    })
    this.queue.forEach((booking: any) => {
      if (booking?.status !== 'Unreachable' && !cargoSet.has(booking)) {
        pendingBookings.add(booking)
      }
    })

    await Promise.all(
      Array.from(pendingBookings).map(async (booking: any) => {
        if (typeof booking?.markUnreachable === 'function') {
          await booking.markUnreachable('workday-limit')
        } else if (booking) {
          booking.status = 'Unreachable'
        }
      })
    )

    this.queue = []
    this.plan = []
    this.instruction = undefined
    this.booking = null
    this.breakSchedule.forEach((b) => {
      b.taken = true
    })
    this.breakActive = null
    this.breakNavigatingToLocation = false
    this.breakPreviousStatus = null

    this.setStatus('returning')

    await this.navigateToDepot()
  }

  private async maybeTakeBreak(): Promise<boolean> {
    if (this.breakActive) {
      return false
    }
    if (!this.breakSchedule.length) {
      return false
    }

    const now = this.virtualTime.now()
    const upcoming = this.breakSchedule.find(
      (entry) => !entry.taken && now >= entry.startMs
    )

    if (!upcoming) {
      return false
    }

    this.breakActive = upcoming
    this.breakPreviousStatus = this.status

    // If break has a location, navigate there first
    if (upcoming.locationCoordinates) {
      const breakPosition = new Position({
        lat: upcoming.locationCoordinates.lat,
        lng: upcoming.locationCoordinates.lng,
      })

      const distToBreak = this.position?.distanceTo?.(breakPosition) ?? 0
      if (distToBreak > 50) {
        this.breakNavigatingToLocation = true
        this.setStatus('toBreak')
        this.emitMoved()

        const osrm = require('../osrm')
        const breakRoute = await this.runWithoutAdvancing(() =>
          osrm.route(this.position, breakPosition)
        )
        this.instruction = this.createInstruction('break', null, { route: breakRoute })
        this.navigateTo(breakPosition)
        // Truck is now driving to break location.
        // When it arrives, stopped() → handlePostStop() → takeActiveBreak() will complete the break.
        return true
      }
    }

    // No location or already at location — take break immediately
    await this.takeActiveBreak()
    return true
  }

  private async takeActiveBreak(): Promise<void> {
    const active = this.breakActive
    if (!active) return

    this.breakNavigatingToLocation = false
    this.speed = 0
    this.setStatus('break')
    this.emitMoved()

    await this.virtualTime.wait(active.durationMs)

    active.taken = true
    this.breakActive = null

    // Recompute route for next plan instruction since the truck
    // may now be at a break location, not where it was before
    if (active.locationCoordinates) {
      const nextInstruction = this.plan[0]
      if (nextInstruction) {
        const nextTarget = this.getInstructionTarget(nextInstruction)
        if (nextTarget) {
          const osrm = require('../osrm')
          const newRoute = await this.runWithoutAdvancing(() =>
            osrm.route(this.position, nextTarget)
          )
          nextInstruction.route = newRoute
        }
      }
    }

    const restoredStatus = this.breakPreviousStatus || 'ready'
    this.breakPreviousStatus = null
    this.setStatus(restoredStatus)
    this.emitMoved()
  }

  get breakLocations(): { lat: number; lng: number }[] {
    return this.breakSchedule
      .filter((b) => b.locationCoordinates)
      .map((b) => b.locationCoordinates!)
  }

  /** Compute expected pickup volume (liters) and weight (kg) for a booking using dataset settings. */
  private computeBookingLoad(booking: any): LoadEstimate {
    const settings = this.fleet?.settings || {}
    return estimateBookingLoad(booking, settings)
  }

  /** Resolve service type from booking with fallbacks to original data/route record. */
  private resolveServiceType(booking: any): string | null {
    if (!booking) return null
    return (
      booking?.originalData?.originalTjtyp ||
      booking?.originalData?.originalRouteRecord?.Tjtyp ||
      booking?.originalRecord?.Tjtyp ||
      booking?.Tjtyp ||
      null
    )
  }

  /**
   * Compute per-fack loads for HEMSORT so all four fack get filled in one stop.
   * Applies volume compression factor and distributes weight proportionally.
   */
  private computeHemsortLoads(
    booking: any
  ): Array<{ fackNumber: number; load: LoadEstimate }> | null {
    if (!booking || booking.recyclingType !== 'HEMSORT') {
      return null
    }

    const serviceType = this.resolveServiceType(booking)
    const distribution = getHemsortDistribution(serviceType)
    if (!distribution || !distribution.length) {
      return null
    }

    const baseLoad = this.computeBookingLoad(booking)
    const weightPerLiter =
      baseLoad.volumeLiters > 0 && baseLoad.weightKg != null
        ? baseLoad.weightKg / baseLoad.volumeLiters
        : null

    const compression =
      CLUSTERING_CONFIG?.CAPACITY?.VOLUME_COMPRESSION_FACTOR ?? 1

    const appliedLoads: Array<{ fackNumber: number; load: LoadEstimate }> = []

    distribution.forEach((fraction) => {
      const target = this.compartments.find(
        (c) => c.fackNumber === fraction.fack
      )

      if (!target) {
        warn(
          `Missing compartment ${fraction.fack} on truck ${this.id} for HEMSORT ${serviceType}`
        )
        return
      }

      const volumeLiters = Math.max(
        1,
        Math.round(fraction.volumeLiters * compression)
      )
      const weightKg =
        weightPerLiter != null ? weightPerLiter * volumeLiters : null

      const load: LoadEstimate = { volumeLiters, weightKg }
      applyLoadToCompartment(target, load)
      appliedLoads.push({ fackNumber: target.fackNumber, load })
    })

    return appliedLoads.length ? appliedLoads : null
  }

  /** Pick an eligible compartment for a given waste type and load, preferring most remaining capacity. */
  /**
   * Picks the next instruction from the plan.
   * @returns A promise that resolves when the next instruction is picked.
   */

  async pickNextInstructionFromPlan(): Promise<any> {
    if (this.hasReachedEndOfWorkday()) {
      return this.concludeWorkday()
    }

    if (this.breakActive) {
      if (this.breakNavigatingToLocation) {
        // Navigating to break location — arrival handled by handlePostStop
        return
      }
      this.speed = 0
      this.setStatus('break')
      return
    }

    if (await this.maybeTakeBreak()) {
      // If navigating to break location, don't recurse — arrival will continue the flow
      if (this.breakNavigatingToLocation) return
      return this.pickNextInstructionFromPlan()
    }

    let nextInstruction: Instruction | undefined

    while (this.plan.length > 0 && !nextInstruction) {
      const candidate = this.plan.shift()
      const candidateBooking: any = candidate?.booking
      if (candidateBooking?.status === 'Unreachable') {
        continue
      }
      nextInstruction = candidate
    }

    this.instruction = nextInstruction

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

    const action = this.instruction?.action || 'returning'
    switch (action) {
      case 'start':
        return Promise.resolve(this.navigateTo(this.startPosition)).then((result: any) => {
          this.setStatus('start')
          return result
        })
      case 'pickup': {
        let pickupPosition = null
        if (this.booking?.pickup?.position) {
          pickupPosition = this.booking.pickup.position
        } else if (this.instruction?.booking?.pickup) {
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

        return Promise.resolve(this.navigateTo(pickupPosition)).then((result: any) => {
          this.setStatus('toPickup')
          return result
        })
      }
      case 'delivery':
        return Promise.resolve(this.navigateTo(this.startPosition)).then((result: any) => {
          this.setStatus('delivery')
          return result
        })
      default: {
        const finalStatus = !this.plan.length ? 'returning' : action
        return Promise.resolve(this.navigateTo(this.startPosition)).then((result: any) => {
          this.setStatus(finalStatus)
          return result
        })
      }
    }
  }

  /**
   * Handles the truck's stopped state.
   * @returns A promise that resolves when the truck is stopped.
   */

  stopped() {
    try {
      const maybePromise = super.stopped()
      if (maybePromise && typeof maybePromise.then === 'function') {
        return maybePromise
          .then(() => this.handlePostStop())
          .catch((err: any) => {
            logError(
              `[truck ${this.id}] stopped chain error (after pickup/dropoff):`,
              err?.message || err
            )
            // Recover: try to continue with the next instruction
            return this.handlePostStop()
          })
      }
      const postStopResult = this.handlePostStop()
      if (postStopResult && typeof postStopResult.then === 'function') {
        return postStopResult.catch((err: any) => {
          logError(
            `[truck ${this.id}] handlePostStop error:`,
            err?.message || err
          )
          // Don't try to recover from handlePostStop errors to avoid loops
        })
      }
      return postStopResult
    } catch (err: any) {
      logError(
        `[truck ${this.id}] stopped() sync error:`,
        err?.message || err
      )
    }
  }

  private async handlePostStop(): Promise<void> {
    // Guard: Already parked, don't re-process
    if (this.status === 'parked') {
      return
    }

    if (this.shiftEndedForDay) {
      if (this.finishingWorkday) {
        await this.finalizeEndOfWorkday()
      }
      return
    }

    if (this.breakActive) {
      if (this.breakNavigatingToLocation) {
        // Arrived at break location — now take the actual break
        await this.takeActiveBreak()
        return this.handlePostStop()
      }
      // Break is in progress (virtualTime.wait) — do nothing
      this.speed = 0
      this.setStatus('break')
      return
    }

    if (await this.maybeTakeBreak()) {
      // If navigating to break location, don't recurse — arrival will re-enter handlePostStop
      if (this.breakNavigatingToLocation) return
      return this.handlePostStop()
    }

    if (this.status === 'delivery') {
      await this.dropOff()
      return
    }

    if (this.plan.length === 0) {
      // If we still have cargo, insert a delivery stop and continue
      if (this.cargo.length > 0) {
        this.plan.unshift(this.createInstruction('delivery'))
        return this.pickNextInstructionFromPlan()
      }

      // Planning errors should not rewrite booking status to unreachable.
      if (this.skipQueueUnreachableMarking) {
        this.skipQueueUnreachableMarking = false
        this.queue = []
      } else {
        // No cargo, no plan — mark remaining queue items as unreachable
        await this.markRemainingAsUnreachable()
      }
      this.instruction = undefined
      this.booking = null

      const canMeasureDistance =
        this.position &&
        this.startPosition &&
        typeof this.position.distanceTo === 'function'
      const atDepot = canMeasureDistance && this.position.distanceTo(this.startPosition) < 100

      if (!atDepot) {
        this.setStatus('returning')
        await this.navigateTo(this.startPosition)
        return
      }

      this.position = this.startPosition
      this.setStatus('parked')
      this.emitMoved()
      return
    } else {
      await this.pickNextInstructionFromPlan()
      return
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

    if (this.hasReachedEndOfWorkday()) {
      if (typeof this.booking.markUnreachable === 'function') {
        await this.booking.markUnreachable('workday-limit')
      } else {
        this.booking.status = 'Unreachable'
      }
      this.queue = this.queue.filter((b: any) => b !== this.booking)
      return this.concludeWorkday()
    }

    const activeBooking = this.booking

    // Assign booking to compartments (fack) and update fill levels
    const hemlLoads = this.computeHemsortLoads(activeBooking)
    if (hemlLoads && hemlLoads.length) {
      ;(activeBooking as any).appliedLoads = hemlLoads
    } else {
      const typeId = activeBooking?.recyclingType
      const load = this.computeBookingLoad(activeBooking)
      const comp = selectBestCompartment(this.compartments, typeId, load)

      if (comp) {
        applyLoadToCompartment(comp, load)
        ;(activeBooking as any).appliedLoads = [
          { fackNumber: comp.fackNumber, load },
        ]
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
        } catch (error) {
          warn(`Failed to log compartment overview for truck ${this.id}`, error)
        }
      }
    }

    try {
      await this.virtualTime.wait(20 * 1000)
    } catch (err: any) {
      logError(`[truck ${this.id}] pickup wait error, continuing:`, err?.message || err)
    }

    if (this.hasReachedEndOfWorkday()) {
      return this.concludeWorkday()
    }

    if (!activeBooking) return

    this.cargo.push(activeBooking)
    this.emitCargo()
    if (activeBooking.pickedUp) activeBooking.pickedUp(this.position)

    // Prevent base Vehicle.stopped() from re-triggering pickup on next stop
    this.booking = null

    // Check if we need to deliver based on delivery strategy (capacity_based only)
    // end_of_route is handled in handlePostStop() - truck waits until all bookings are picked up
    if (this.getDeliveryStrategy() === 'capacity_based') {
      const deliveryConfig = CLUSTERING_CONFIG.DELIVERY_STRATEGIES
      const pickupsBeforeDelivery =
        this.fleet?.settings?.pickupsBeforeDelivery ||
        deliveryConfig.PICKUPS_BEFORE_DELIVERY

      const shouldTriggerDelivery =
        isAnyCompartmentFull(this.compartments) ||
        this.cargo.length >= pickupsBeforeDelivery

      if (shouldTriggerDelivery) {
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
  }

  /**
   * Drops off the booking.
   * @returns A promise that resolves when the booking is dropped off.
   */

  /** Release compartment fills for a delivered booking, supporting multi-fack loads. */
  private releaseLoadsForBooking(booking: any): void {
    if (!booking) return

    const appliedLoads = (booking as any)?.appliedLoads
    if (!Array.isArray(appliedLoads) || !appliedLoads.length) return

    appliedLoads.forEach(({ fackNumber, load }) => {
      const compartment = this.compartments.find(
        (x) => x.fackNumber === fackNumber
      )
      if (compartment && load) {
        releaseLoadFromCompartment(compartment, load)
      }
    })
  }

  async dropOff() {
    // If this is a delivery action (booking is null), deliver all cargo
    if (!this.booking) {
      const deliveredNow = [...this.cargo]
      deliveredNow.forEach((item: any) => {
        if (item.delivered) item.delivered(this.position)
        this.releaseLoadsForBooking(item)
      })
      const deliveredSet = new Set(deliveredNow)
      this.queue = this.queue.filter(
        (queued: any) => !deliveredSet.has(queued)
      )
      this.cargo = []
      this.emitCargo()

      // Continue with next instruction after delivery
      if (this.plan.length > 0) {
        return this.pickNextInstructionFromPlan()
      } else {
        if (this.isSequentialExperiment() && this.queue.length > 0) {
          this.plan = this.buildSequentialPlanFromQueue()
          if (this.plan.length > 0) {
            await this.runWithoutAdvancing(() => this.precomputeRoutes())
            return this.pickNextInstructionFromPlan()
          }
        }

        // Mark any remaining queue items (e.g. VROOM-excluded bookings) as unreachable
        await this.markRemainingAsUnreachable()

        const distToStart = this.position?.distanceTo?.(this.startPosition) ?? Infinity

        // If already at depot, park directly instead of navigating (avoids race condition)
        if (distToStart < 100) {
          this.position = this.startPosition
          this.instruction = undefined
          this.setStatus('parked')
          this.emitMoved()
          return
        }

        this.setStatus('end')
        return this.navigateToDepot()
      }
    }

    // Otherwise, deliver specific booking (legacy behavior)
    // Decrement fill for the specific booking
    this.releaseLoadsForBooking(this.booking)
    this.cargo = this.cargo.filter((p: any) => p !== this.booking)
    this.emitCargo()
    if (this.isSequentialExperiment() && this.booking) {
      this.queue = this.queue.filter((queued: any) => queued !== this.booking)
      if (this.plan.length === 0 && this.queue.length > 0) {
        this.plan = this.buildSequentialPlanFromQueue()
        if (this.plan.length > 0) {
          await this.pickNextInstructionFromPlan()
          return
        }
      }
    }
    if (this.booking.delivered) this.booking.delivered(this.position)
  }

  /** Drop all cargo at the depot without triggering further navigation. */
  private dischargeAllCargo(): void {
    if (!Array.isArray(this.cargo) || !this.cargo.length) {
      return
    }

    const deliveredNow = [...this.cargo]
    deliveredNow.forEach((item: any) => {
      if (item.delivered) item.delivered(this.position)
      this.releaseLoadsForBooking(item)
    })

    const deliveredSet = new Set(deliveredNow)
    this.queue = this.queue.filter((queued: any) => !deliveredSet.has(queued))

    this.cargo = []
    this.emitCargo()
  }

  private async finalizeEndOfWorkday(): Promise<void> {
    const canMeasureDistance =
      this.position &&
      this.startPosition &&
      typeof this.position.distanceTo === 'function'
    const distToStart = canMeasureDistance ? this.position.distanceTo(this.startPosition) : -1
    const atStart = canMeasureDistance && distToStart < 100

    if (!atStart) {
      this.setStatus('returning')
      await this.navigateToDepot()
      return
    }

    this.speed = 0
    this.position = this.startPosition
    this.instruction = undefined
    this.booking = null
    this.dischargeAllCargo()
    this.setStatus('end')
    this.setStatus('parked')
    this.emitMoved()
    this.finishingWorkday = false
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

    if (!this.isSequentialExperiment()) {
      this.plan = this.queue.map((b: any) =>
        this.createInstruction('pickup', b)
      )
      await this.runWithoutAdvancing(() => this.precomputeRoutes())
      if (!this.instruction) await this.pickNextInstructionFromPlan()
      return booking
    }

    // For sequential experiments: Use delayed planning to collect all bookings first
    // This prevents starting with just 1 booking when more are being dispatched
    clearTimeout(this._timeout)

    const seqMultiplier = this.virtualTime.getTimeMultiplier() || 1
    const seqDelay = Math.max(1500 / seqMultiplier, 50)
    this._timeout = setTimeout(async () => {
      this.plan = this.buildSequentialPlanFromQueue()
      await this.runWithoutAdvancing(() => this.precomputeRoutes())
      if (!this.instruction) {
        await this.pickNextInstructionFromPlan()
      }
    }, seqDelay)

    return booking
  }

  /**
   * Handles a booking.
   * @param experimentId - The ID of the experiment.
   * @param booking - The booking to handle.
   * @returns A promise that resolves when the booking is handled.
   */

  // @ts-expect-error Truck extends the base signature with experimentId
  async handleBooking(experimentId: string, booking: any) {
    if (this.isSequentialExperiment()) {
      return this.handleStandardBooking(booking)
    }

    if (this.queue.indexOf(booking) > -1) throw new Error('Already queued')
    this.queue.push(booking)
    if (booking.assign) booking.assign(this)
    if (booking.queued) booking.queued(this)

    clearTimeout(this._timeout)
    const baseDelay =
      CLUSTERING_CONFIG.TRUCK_PLANNING_TIMEOUT_MS +
      Math.random() * CLUSTERING_CONFIG.TRUCK_PLANNING_RANDOM_DELAY_MS
    const multiplier = this.virtualTime.getTimeMultiplier() || 1
    const randomDelay = Math.max(baseDelay / multiplier, 50)
    this._timeout = setTimeout(async () => {
      this.setStatus('planning')
      this.skipQueueUnreachableMarking = false

      await this.runWithoutAdvancing(async () => {
        if (this.fleet.settings.replayExperiment) {
          this.plan = await useReplayRoute(this, this.queue)

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

          // Remove any bookings that could not be scheduled within the shift
          this.queue = this.queue.filter(
            (queued: any) => queued?.status !== 'Unreachable'
          )

          if (this.plan) {
            // Use planGroupId from fleet settings, fallback to experimentId
            const planGroupId = this.fleet?.settings?.planGroupId || experimentId
            await saveCompletePlanForReplay(
              planGroupId,
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
          const failedBookingCount = this.queue.length
          this.plan = []
          this.skipQueueUnreachableMarking = true
          this.queue = []
          if (!isVroomPlanningCancelledError(error)) {
            logError(`VROOM planning failed for truck ${this.id}`, {
              experimentId,
              truckId: this.id,
              error: error.message,
              bookingCount: failedBookingCount,
            })

            await reportDispatchError(
              experimentId,
              this.id,
              this.fleet?.name || this.id,
              error.message || 'VROOM planning failed'
            )
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

            this.plan = (await Promise.race([
              vroomPromise,
              timeoutPromise,
            ])) as any[]

            // Remove any bookings that could not be scheduled within the shift
            this.queue = this.queue.filter(
              (queued: any) => queued?.status !== 'Unreachable'
            )

            if (this.plan) {
              // Pre-compute all OSRM routes before simulation starts
              await this.precomputeRoutes()

              // Use planGroupId from fleet settings, fallback to experimentId
              const planGroupId =
                this.fleet?.settings?.planGroupId || experimentId
              await saveCompletePlanForReplay(
                planGroupId,
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
            const failedBookingCount = this.queue.length
            this.plan = []
            this.skipQueueUnreachableMarking = true
            this.queue = []
            if (!isVroomPlanningCancelledError(error)) {
              logError(`VROOM planning failed for truck ${this.id}`, {
                experimentId,
                truckId: this.id,
                error: error.message,
                bookingCount: failedBookingCount,
              })

              await reportDispatchError(
                experimentId,
                this.id,
                this.fleet?.name || this.id,
                error.message || 'VROOM planning failed'
              )
            }
          }
        }
      })
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
