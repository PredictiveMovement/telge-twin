import Booking from './models/booking'
import Position from './models/position'
import osrm from './osrm'
import { buildBreakSchedule, ScheduledBreak } from './vehicles/breaks'
import { CLUSTERING_CONFIG } from './config'
import {
  createCompartments,
  estimateBookingLoad,
  applyLoadToCompartment,
  isAnyCompartmentFull,
  selectBestCompartment,
} from './capacity'
import { getHemsortDistribution } from './config/hemsort'
import {
  extractOriginalData,
  OriginalBookingData,
} from './types/originalBookingData'
import {
  buildBreakSettings,
  buildWorkdaySettings,
  BreakInput,
  BreakSetting,
  WorkdaySettings,
  WorkingHoursInput,
} from './optimizationSettings'

const DEFAULT_DEPOT_COORDINATE = CLUSTERING_CONFIG.DEPOT_COORDINATE
const DEFAULT_PICKUPS_BEFORE_DELIVERY =
  CLUSTERING_CONFIG.DELIVERY_STRATEGIES.PICKUPS_BEFORE_DELIVERY
const DEFAULT_DELIVERY_STRATEGY =
  CLUSTERING_CONFIG.DELIVERY_STRATEGIES.DEFAULT_DELIVERY_STRATEGY

type OptimizationSettingsInput = {
  workingHours?: WorkingHoursInput
  breaks?: BreakInput[]
  extraBreaks?: BreakInput[]
}

type StandardizedBooking = {
  id: string
  recyclingType: string
  sender?: string
  serviceType?: string
  weight?: number
  pickup?: {
    lat: number
    lng: number
    name?: string
    departureTime?: string
  }
  position?: {
    lat: number
    lng: number
  }
  destination?: {
    lat: number
    lng: number
    name?: string
  }
  originalRecord?: Record<string, unknown>
  originalData?: OriginalBookingData
  originalTurordningsnr?: number
  Turordningsnr?: number
}

type FleetVehicleSpec = {
  originalId: string
  parcelCapacity?: number
  fackDetails?: unknown[]
}

type FleetConfiguration = {
  name?: string
  vehicles?: FleetVehicleSpec[]
  preAssignedBookings?: Record<string, StandardizedBooking[]>
}

export interface OptimizationEstimateRequest {
  routeData?: Record<string, unknown>[]
  fleetConfiguration?: FleetConfiguration[]
  originalSettings?: Record<string, unknown> | null
  optimizationSettings?: OptimizationSettingsInput | null
  startDate?: string
}

export interface RouteEstimate {
  vehicleId: string
  durationSeconds: number
  distanceMeters: number
  stopCount: number
  unreachableStopCount: number
}

type EstimateVirtualTime = {
  now: () => number
  getWorkdayBounds: () => { startMs: number; endMs: number }
}

type EstimateTruck = {
  id: string
  position: Position
  startPosition: Position
  destination: Position
  parcelCapacity: number
  compartments: ReturnType<typeof createCompartments>
  fleet: {
    name: string
    settings: Record<string, unknown>
  }
  virtualTime: EstimateVirtualTime
}

type RuntimeResult = {
  durationSeconds: number
  distanceMeters: number
  unreachableStopCount: number
}

type RouteLegSummary = {
  durationSeconds: number
  distanceMeters: number
}

function toPosition(input?: {
  lat?: number
  lng?: number
  lon?: number
} | null): Position {
  const lat = input?.lat ?? DEFAULT_DEPOT_COORDINATE.lat
  const lng = input?.lng ?? input?.lon ?? DEFAULT_DEPOT_COORDINATE.lng
  return new Position({ lat, lng })
}

function resolveDepotPosition(
  fleet: FleetConfiguration
): Position {
  const firstBooking = Object.values(fleet.preAssignedBookings || {})
    .find((items) => Array.isArray(items) && items.length > 0)
    ?.at(0)

  if (firstBooking?.destination) {
    return toPosition(firstBooking.destination)
  }

  return toPosition(DEFAULT_DEPOT_COORDINATE)
}

function resolveStartDateMs(
  startDate: string | undefined,
  workdaySettings: WorkdaySettings | null
): number {
  const parsed = startDate ? new Date(startDate) : new Date()
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getTime()
  }

  const now = new Date()
  const startMinutes =
    typeof workdaySettings?.startMinutes === 'number'
      ? workdaySettings.startMinutes
      : now.getHours() * 60 + now.getMinutes()

  now.setHours(0, 0, 0, 0)
  return now.getTime() + startMinutes * 60 * 1000
}

function resolveWorkdayBounds(
  startDateMs: number,
  workdaySettings: WorkdaySettings | null
) {
  const dayStart = new Date(startDateMs)
  dayStart.setHours(0, 0, 0, 0)
  const dayStartMs = dayStart.getTime()

  const startMinutes =
    typeof workdaySettings?.startMinutes === 'number'
      ? workdaySettings.startMinutes
      : new Date(startDateMs).getHours() * 60 + new Date(startDateMs).getMinutes()
  const endMinutes =
    typeof workdaySettings?.endMinutes === 'number'
      ? workdaySettings.endMinutes
      : startMinutes + 8 * 60

  const startMs = dayStartMs + startMinutes * 60 * 1000
  const effectiveStartMs = Math.max(startDateMs, startMs)
  let endMs = dayStartMs + endMinutes * 60 * 1000
  if (endMs <= effectiveStartMs) {
    endMs += 24 * 60 * 60 * 1000
  }

  return {
    startMs: effectiveStartMs,
    endMs,
  }
}

function createEstimateVirtualTime(
  startDateMs: number,
  workdaySettings: WorkdaySettings | null
): EstimateVirtualTime {
  const bounds = resolveWorkdayBounds(startDateMs, workdaySettings)
  return {
    now: () => startDateMs,
    getWorkdayBounds: () => bounds,
  }
}

function createBookingFromStandardized(
  standardizedBooking: StandardizedBooking,
  vehicleId: string
): Booking {
  const pickupPosition = toPosition(
    standardizedBooking.pickup || standardizedBooking.position
  )
  const destinationPosition = toPosition(standardizedBooking.destination)

  const booking = new Booking({
    id: standardizedBooking.id,
    bookingId: standardizedBooking.id,
    recyclingType: standardizedBooking.recyclingType,
    type: standardizedBooking.recyclingType,
    sender: standardizedBooking.sender || 'TELGE',
    pickup: {
      position: pickupPosition,
      name:
        standardizedBooking.pickup?.name ||
        `Pickup for ${standardizedBooking.recyclingType}`,
      departureTime:
        standardizedBooking.pickup?.departureTime || '08:00:00',
    },
    destination: {
      position: destinationPosition,
      name:
        standardizedBooking.destination?.name ||
        'LERHAGA 50, 151 66 Södertälje',
      arrivalTime: '17:00:00',
    },
    carId: vehicleId,
    turordningsnr:
      standardizedBooking.originalData?.originalTurordningsnr ??
      standardizedBooking.originalTurordningsnr ??
      standardizedBooking.Turordningsnr,
    originalData: extractOriginalData(standardizedBooking),
  })

  booking.weight = standardizedBooking.weight || 10
  booking.origin = standardizedBooking.sender || 'TELGE'
  ;(booking as any).originalRecord = standardizedBooking.originalRecord
  ;(booking as any).vehicleId = vehicleId
  ;(booking as any).originalVehicleId = vehicleId
  ;(booking as any).serviceType =
    standardizedBooking.serviceType || 'standard'

  return booking
}

function createEstimateTruck(
  vehicle: FleetVehicleSpec,
  fleet: FleetConfiguration,
  depot: Position,
  virtualTime: EstimateVirtualTime,
  fleetSettings: Record<string, unknown>
): EstimateTruck {
  const depotPosition = toPosition(depot)

  return {
    id: vehicle.originalId,
    position: depotPosition,
    startPosition: depotPosition,
    destination: depotPosition,
    parcelCapacity: vehicle.parcelCapacity || 250,
    compartments: createCompartments(vehicle.fackDetails as any),
    fleet: {
      name: fleet.name || 'Optimeringsestimat',
      settings: fleetSettings,
    },
    virtualTime,
  }
}

function resolveServiceType(booking: Booking): string | null {
  return (
    booking?.originalData?.originalTjtyp ||
    booking?.originalData?.originalRouteRecord?.Tjtyp ||
    (booking as any)?.originalRecord?.Tjtyp ||
    (booking as any)?.Tjtyp ||
    null
  )
}

function resetCompartments(
  compartments: ReturnType<typeof createCompartments>
) {
  compartments.forEach((compartment) => {
    compartment.fillLiters = 0
    compartment.fillKg = 0
  })
}

function applyBookingLoadToCompartments(
  booking: Booking,
  compartments: ReturnType<typeof createCompartments>,
  settings: Record<string, unknown>
) {
  if ((booking as any).recyclingType !== 'HEMSORT') {
    const load = estimateBookingLoad(booking, settings)
    const compartment = selectBestCompartment(
      compartments,
      booking.recyclingType,
      load
    )

    if (compartment) {
      applyLoadToCompartment(compartment, load)
    }
    return
  }

  const serviceType = resolveServiceType(booking)
  const distribution = getHemsortDistribution(serviceType)
  if (!distribution?.length) {
    const load = estimateBookingLoad(booking, settings)
    const compartment = selectBestCompartment(
      compartments,
      booking.recyclingType,
      load
    )
    if (compartment) {
      applyLoadToCompartment(compartment, load)
    }
    return
  }

  const baseLoad = estimateBookingLoad(booking, settings)
  const weightPerLiter =
    baseLoad.volumeLiters > 0 && baseLoad.weightKg != null
      ? baseLoad.weightKg / baseLoad.volumeLiters
      : null
  const compression =
    CLUSTERING_CONFIG.CAPACITY.VOLUME_COMPRESSION_FACTOR ?? 1

  distribution.forEach((fraction) => {
    const compartment = compartments.find(
      (candidate) => candidate.fackNumber === fraction.fack
    )
    if (!compartment) return

    const volumeLiters = Math.max(
      1,
      Math.round(fraction.volumeLiters * compression)
    )
    const weightKg =
      weightPerLiter != null ? weightPerLiter * volumeLiters : null

    applyLoadToCompartment(compartment, { volumeLiters, weightKg })
  })
}

async function routeWaypointLegs(
  positions: Position[]
): Promise<RouteLegSummary[]> {
  if (positions.length < 2) {
    return []
  }

  const legs = await Promise.all(
    positions.slice(1).map(async (to, index) => {
      const from = positions[index]
      if (from.distanceTo(to) < 5) {
        return { durationSeconds: 0, distanceMeters: 0 }
      }
      const route = await osrm.route(from, to)
      return {
        durationSeconds: Math.round(route?.duration || 0),
        distanceMeters: Math.round(route?.distance || 0),
      }
    })
  )

  return legs
}

function cloneCompartments(
  compartments: ReturnType<typeof createCompartments>
): ReturnType<typeof createCompartments> {
  return compartments.map((compartment) => ({ ...compartment }))
}

function buildPickupTours(
  bookings: Booking[],
  compartments: ReturnType<typeof createCompartments>,
  settings: Record<string, unknown>
): Booking[][] {
  const deliveryStrategy =
    (settings.deliveryStrategy as string) || DEFAULT_DELIVERY_STRATEGY
  const pickupsBeforeDelivery =
    Number(settings.pickupsBeforeDelivery) ||
    DEFAULT_PICKUPS_BEFORE_DELIVERY

  if (deliveryStrategy !== 'capacity_based') {
    return bookings.length ? [bookings] : []
  }

  const tours: Booking[][] = []
  const plannedCompartments = cloneCompartments(compartments)
  let currentTour: Booking[] = []
  let pickupCount = 0

  bookings.forEach((booking) => {
    currentTour.push(booking)
    pickupCount += 1
    applyBookingLoadToCompartments(booking, plannedCompartments, settings)

    const shouldDeliver =
      isAnyCompartmentFull(plannedCompartments) ||
      pickupCount >= pickupsBeforeDelivery

    if (shouldDeliver) {
      tours.push(currentTour)
      currentTour = []
      pickupCount = 0
      resetCompartments(plannedCompartments)
    }
  })

  if (currentTour.length) {
    tours.push(currentTour)
  }

  return tours
}

function consumeDueBreaks(
  currentTimeMs: number,
  breaks: ScheduledBreak[],
  breakIndex: number
) {
  let nextTimeMs = currentTimeMs
  let nextBreakIndex = breakIndex

  while (
    nextBreakIndex < breaks.length &&
    breaks[nextBreakIndex] &&
    nextTimeMs >= breaks[nextBreakIndex].startMs
  ) {
    nextTimeMs += breaks[nextBreakIndex].durationMs
    nextBreakIndex += 1
  }

  return {
    currentTimeMs: nextTimeMs,
    breakIndex: nextBreakIndex,
  }
}

function markBookingsUnreachable(bookings: Booking[]) {
  bookings.forEach((booking) => {
    if (booking.status !== 'Picked up' && booking.status !== 'Delivered') {
      booking.status = 'Unreachable'
      ;(booking as any).unreachableReason = 'workday-limit'
    }
  })
}

export async function estimateTruckRuntime(
  truck: EstimateTruck,
  plan: Array<{ booking?: Booking | null }>,
  breaks: ScheduledBreak[],
  workdayEndMs: number,
  settings: Record<string, unknown>
): Promise<RuntimeResult> {
  const workdayStartMs = truck.virtualTime.getWorkdayBounds().startMs
  let currentTimeMs = workdayStartMs
  let currentPosition = toPosition(truck.startPosition)
  let breakIndex = 0
  let distanceMeters = 0

  const activePlan = plan
    .map((instruction) => instruction.booking)
    .filter((booking): booking is Booking => Boolean(booking))
    .filter((booking) => booking.status !== 'Unreachable')

  const pickupTours = buildPickupTours(
    activePlan,
    truck.compartments,
    truck.fleet.settings
  )

  const consumeBreaks = () => {
    const result = consumeDueBreaks(currentTimeMs, breaks, breakIndex)
    breakIndex = result.breakIndex
    currentTimeMs = result.currentTimeMs
  }

  const returnToDepot = async () => {
    const [leg] = await routeWaypointLegs([currentPosition, toPosition(truck.startPosition)])
    if (leg) {
      currentTimeMs += leg.durationSeconds * 1000
      distanceMeters += leg.distanceMeters
    }
    currentPosition = toPosition(truck.startPosition)
    resetCompartments(truck.compartments)
  }

  let processedBookings = 0
  let routeEndedEarly = false

  for (let tourIndex = 0; tourIndex < pickupTours.length; tourIndex += 1) {
    const tour = pickupTours[tourIndex]

    const positions = [
      currentPosition,
      ...tour.map((booking) =>
        booking.pickup?.position
          ? toPosition(booking.pickup.position)
          : toPosition(DEFAULT_DEPOT_COORDINATE)
      ),
      toPosition(truck.startPosition),
    ]
    const legs = await routeWaypointLegs(positions)

    for (let index = 0; index < tour.length; index += 1) {
      const booking = tour[index]

      consumeBreaks()

      if (currentTimeMs >= workdayEndMs) {
        markBookingsUnreachable(activePlan.slice(processedBookings + index))
        await returnToDepot()
        routeEndedEarly = true
        break
      }

      const pickupPosition = booking.pickup?.position
        ? toPosition(booking.pickup.position)
        : toPosition(DEFAULT_DEPOT_COORDINATE)
      const pickupLeg = legs[index] || { durationSeconds: 0, distanceMeters: 0 }
      currentTimeMs += pickupLeg.durationSeconds * 1000
      distanceMeters += pickupLeg.distanceMeters
      currentPosition = pickupPosition

      if (currentTimeMs >= workdayEndMs) {
        booking.status = 'Unreachable'
        ;(booking as any).unreachableReason = 'workday-limit'
        markBookingsUnreachable(activePlan.slice(processedBookings + index + 1))
        await returnToDepot()
        routeEndedEarly = true
        break
      }

      const serviceMs = CLUSTERING_CONFIG.SERVICE_TIME_PER_STOP_SECONDS * 1000
      currentTimeMs += serviceMs
      booking.status = 'Picked up'
      applyBookingLoadToCompartments(booking, truck.compartments, settings)

      if (currentTimeMs >= workdayEndMs) {
        markBookingsUnreachable(activePlan.slice(processedBookings + index + 1))
        await returnToDepot()
        routeEndedEarly = true
        break
      }
    }

    processedBookings += tour.length

    if (routeEndedEarly) {
      break
    }

    consumeBreaks()

    const returnLeg =
      legs[tour.length] || { durationSeconds: 0, distanceMeters: 0 }
    currentTimeMs += returnLeg.durationSeconds * 1000
    distanceMeters += returnLeg.distanceMeters
    currentPosition = toPosition(truck.startPosition)
    resetCompartments(truck.compartments)
  }

  consumeBreaks()

  if (currentPosition.distanceTo(truck.startPosition) >= 5) {
    const [leg] = await routeWaypointLegs([currentPosition, toPosition(truck.startPosition)])
    if (leg) {
      currentTimeMs += leg.durationSeconds * 1000
      distanceMeters += leg.distanceMeters
    }
  }

  const totalUnreachable = activePlan.filter(
    (booking) => booking.status === 'Unreachable'
  ).length

  const totalDurationMs = currentTimeMs - workdayStartMs

  return {
    durationSeconds: Math.ceil(totalDurationMs / 1000),
    distanceMeters,
    unreachableStopCount: totalUnreachable,
  }
}

function buildFleetSettings(
  originalSettings: Record<string, unknown>,
  optimizationSettings: OptimizationSettingsInput | null | undefined,
  workdaySettings: WorkdaySettings | null,
  breakSettings: BreakSetting[]
) {
  return {
    ...originalSettings,
    experimentType: 'vroom',
    workday: workdaySettings || undefined,
    breaks: breakSettings || undefined,
    optimizationSettings: optimizationSettings || undefined,
    deliveryStrategy:
      originalSettings.deliveryStrategy || DEFAULT_DELIVERY_STRATEGY,
    pickupsBeforeDelivery:
      originalSettings.pickupsBeforeDelivery || DEFAULT_PICKUPS_BEFORE_DELIVERY,
    tjtyper: originalSettings.tjtyper || undefined,
    avftyper: originalSettings.avftyper || undefined,
  }
}

export async function estimateOptimizationFeasibility(
  request: OptimizationEstimateRequest
): Promise<{ estimates: RouteEstimate[] }> {
  const optimizationSettings = request.optimizationSettings || null
  const workdaySettings = buildWorkdaySettings(
    optimizationSettings?.workingHours
  )
  const breakSettings = buildBreakSettings(
    optimizationSettings?.breaks,
    optimizationSettings?.extraBreaks
  )
  const originalSettings =
    (request.originalSettings as Record<string, unknown>) || {}
  const startDateMs = resolveStartDateMs(request.startDate, workdaySettings)
  const virtualTime = createEstimateVirtualTime(startDateMs, workdaySettings)
  const workdayBounds = virtualTime.getWorkdayBounds()

  const estimates = await Promise.all(
    (request.fleetConfiguration || []).map(async (fleet) => {
      const depot = resolveDepotPosition(fleet)
      const fleetSettings = buildFleetSettings(
        originalSettings,
        optimizationSettings,
        workdaySettings,
        breakSettings
      )
      const schedule = buildBreakSchedule({
        virtualTime,
        breaks: breakSettings,
        workdaySettings,
        optimizationSettings: optimizationSettings || undefined,
      })

      return Promise.all(
        (fleet.vehicles || []).map(async (vehicle) => {
          const standardizedBookings =
            fleet.preAssignedBookings?.[vehicle.originalId] || []
          const bookings = standardizedBookings.map((booking) =>
            createBookingFromStandardized(booking, vehicle.originalId)
          )
          const truck = createEstimateTruck(
            vehicle,
            fleet,
            depot,
            virtualTime,
            fleetSettings
          )

          const plan = bookings.map((booking) => ({ booking }))

          const runtime = await estimateTruckRuntime(
            truck,
            plan || [],
            schedule.map((entry) => ({ ...entry })),
            workdayBounds.endMs,
            fleetSettings
          )

          return {
            vehicleId: vehicle.originalId,
            durationSeconds: runtime.durationSeconds,
            distanceMeters: runtime.distanceMeters,
            stopCount: bookings.length,
            unreachableStopCount: runtime.unreachableStopCount,
          }
        })
      )
    })
  )

  return {
    estimates: estimates.flat(),
  }
}
