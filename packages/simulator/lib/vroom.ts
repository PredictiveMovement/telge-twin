import fetch, { Response } from 'node-fetch'
import { startOfDay } from 'date-fns'
import { error, warn } from './log'
import { getFromCache, updateCache } from './cache'
import queue from './queueSubject'
import { virtualTime } from './virtualTime'
import { CLUSTERING_CONFIG } from './config'
import {
  estimateBookingLoad,
  getCapacityDimensions,
} from './capacity'
import { convertPosition } from './distance'
import { parseTimeToMinutes } from './utils/time'

// eslint-disable-next-line no-undef
const vroomUrl: string =
  process.env.VROOM_URL || 'https://vroom.telge.iteam.pub/'

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Normalize input for cache key generation while preserving original data for VROOM API
 *
 * Time-dependent fields (time_windows, time_window) are replaced with constants
 * because they change based on virtualTime.now() but don't affect route optimization
 * when the relative time relationships remain the same.
 *
 * This enables cache hits for identical geographical problems regardless of
 * when they're solved during the simulation.
 */
function normalizeCacheInput(
  jobs: any[],
  shipments: Shipment[],
  vehicles: Vehicle[]
) {
  const normalizedShipments = shipments.map((s) => ({
    ...s,
    pickup: {
      ...s.pickup,
      time_windows: 'NORMALIZED_TIME_WINDOW',
    },
    delivery: {
      ...s.delivery,
      time_windows: 'NORMALIZED_TIME_WINDOW',
    },
  }))

  const normalizedVehicles = vehicles.map((v) => {
    const { breaks, ...rest } = v as any
    return {
      ...rest,
      time_window: 'NORMALIZED_TIME_WINDOW',
      ...(breaks ? { breaks: 'NORMALIZED_BREAKS' } : {}),
    }
  })

  return {
    jobs,
    shipments: normalizedShipments,
    vehicles: normalizedVehicles,
  }
}

export interface Shipment {
  id: number
  amount: number[]
  pickup: {
    id: number
    time_windows?: [number, number][]
    location: [number, number]
  }
  delivery: {
    id: number
    location: [number, number]
    time_windows?: [number, number][]
  }
  service: number
}

export interface Vehicle {
  id: number
  time_window: [number, number]
  capacity: number[]
  start: [number, number]
  end: [number, number]
  breaks?: Array<{
    id: string | number
    time_windows: [number, number][]
    duration: number
  }>
}

export interface PlanInput {
  jobs?: any[]
  shipments?: Shipment[]
  vehicles: Vehicle[]
  shouldAbort?: () => boolean | Promise<boolean>
}

export const VROOM_PLANNING_CANCELLED_MESSAGE =
  'VROOM planning aborted: experiment cancelled'

export function isVroomPlanningCancelledError(err: any): boolean {
  const message =
    typeof err?.message === 'string'
      ? err.message
      : typeof err === 'string'
        ? err
        : ''
  return message.includes(VROOM_PLANNING_CANCELLED_MESSAGE)
}

async function hasPlanningBeenCancelled(
  shouldAbort?: () => boolean | Promise<boolean>
): Promise<boolean> {
  if (!shouldAbort) return false
  try {
    return Boolean(await shouldAbort())
  } catch {
    return false
  }
}

async function waitWithAbort(
  ms: number,
  shouldAbort?: () => boolean | Promise<boolean>
): Promise<void> {
  const pollIntervalMs = 200
  let remainingMs = Math.max(0, ms)

  while (remainingMs > 0) {
    if (await hasPlanningBeenCancelled(shouldAbort)) {
      throw new Error(VROOM_PLANNING_CANCELLED_MESSAGE)
    }
    const waitMs = Math.min(pollIntervalMs, remainingMs)
    await delay(waitMs)
    remainingMs -= waitMs
  }
}

const DEFAULT_SHIFT_DURATION_MS = 8 * 60 * 60 * 1000
const MIN_TIME_WINDOW_MS = 30 * 60 * 1000

function getVirtualTime(source: any) {
  if (source && typeof source.virtualTime?.now === 'function') {
    return source.virtualTime
  }
  return virtualTime
}

function resolveWorkdayWindow(
  vt: { now: () => number },
  workday:
    | { startMinutes?: number; endMinutes?: number }
    | null
    | undefined
) {
  const nowMs = typeof vt?.now === 'function' ? vt.now() : Date.now()
  const dayStartMs = startOfDay(new Date(nowMs)).getTime()

  const startMinutes =
    typeof workday?.startMinutes === 'number' ? workday.startMinutes : null
  const endMinutes =
    typeof workday?.endMinutes === 'number' ? workday.endMinutes : null

  const startCandidateMs =
    startMinutes != null
      ? dayStartMs + startMinutes * 60 * 1000
      : nowMs
  const startMs = Math.max(nowMs, startCandidateMs)

  let endMs = startMs + DEFAULT_SHIFT_DURATION_MS
  if (endMinutes != null) {
    let rawEndMs = dayStartMs + endMinutes * 60 * 1000
    // Handle overnight spans (end earlier than start)
    if (rawEndMs <= startCandidateMs) {
      rawEndMs += 24 * 60 * 60 * 1000
    }
    endMs = Math.max(rawEndMs, startMs + MIN_TIME_WINDOW_MS)
  }

  const startOffsetSeconds = Math.max(
    0,
    Math.floor((startMs - nowMs) / 1000)
  )
  const endOffsetSeconds = Math.max(
    startOffsetSeconds + MIN_TIME_WINDOW_MS / 1000,
    Math.floor((endMs - nowMs) / 1000)
  )

  return {
    nowMs,
    startMs,
    endMs,
    dayStartMs,
    startOffsetSeconds,
    endOffsetSeconds,
  }
}

export async function plan(
  { jobs = [], shipments = [], vehicles, shouldAbort }: PlanInput,
  retryCount = 0
): Promise<any> {
  if (await hasPlanningBeenCancelled(shouldAbort)) {
    throw new Error(VROOM_PLANNING_CANCELLED_MESSAGE)
  }

  if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
    throw new Error('No vehicles provided for VROOM planning')
  }

  if (jobs?.length > CLUSTERING_CONFIG.MAX_VROOM_JOBS)
    throw new Error(`Too many jobs to plan: ${jobs.length}`)
  if (shipments?.length > CLUSTERING_CONFIG.MAX_VROOM_SHIPMENTS)
    throw new Error(`Too many shipments to plan: ${shipments.length}`)
  if (vehicles.length > CLUSTERING_CONFIG.MAX_VROOM_VEHICLES)
    throw new Error(`Too many vehicles to plan: ${vehicles.length}`)

  // 🔑 CACHE LOOKUP with normalized input
  const normalizedInput = normalizeCacheInput(jobs, shipments, vehicles)
  const cached = await getFromCache(normalizedInput)
  if (cached) {
    return cached
  }

  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `VROOM timeout after ${CLUSTERING_CONFIG.VROOM_TIMEOUT_MS}ms`
            )
          ),
        CLUSTERING_CONFIG.VROOM_TIMEOUT_MS
      )
    })

    const vroomPromise = queue(() =>
      fetch(vroomUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobs,
          shipments,
          vehicles,
          options: { plan: true },
        }),
      }).then(async (res: Response) => {
        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`Vroom HTTP ${res.status}: ${errorText}`)
        }
        return res.json()
      })
    )

    const json = await Promise.race([vroomPromise, timeoutPromise])

    return updateCache(normalizedInput, json)
  } catch (vroomError: any) {
    if (isVroomPlanningCancelledError(vroomError)) {
      throw vroomError
    }

    if (await hasPlanningBeenCancelled(shouldAbort)) {
      throw new Error(VROOM_PLANNING_CANCELLED_MESSAGE)
    }

    if (retryCount < 3) {
      warn(`VROOM retry ${retryCount + 1}/3: ${vroomError.code || vroomError.message}`)
      const backoffDelay = Math.pow(2, retryCount + 1) * 1000
      await waitWithAbort(backoffDelay, shouldAbort)
      if (await hasPlanningBeenCancelled(shouldAbort)) {
        throw new Error(VROOM_PLANNING_CANCELLED_MESSAGE)
      }
      return plan({ jobs, shipments, vehicles, shouldAbort }, retryCount + 1)
    } else {
      throw vroomError
    }
  }
}

export type CapacityKey = 'volumeLiters' | 'weightKg' | 'count'

export function bookingToShipment(
  booking: any,
  i: number,
  options: {
    capacityDimensions?: CapacityKey[]
    fleet?: any
  } = {}
): Shipment {
  const { id, pickup, destination, groupedBookings } = booking
  const fleet = options.fleet || booking.fleet

  const { lon: pickupLon, lat: pickupLat } = convertPosition(pickup.position)
  const { lon: deliveryLon, lat: deliveryLat } = convertPosition(destination.position)

  if (!pickupLon || !pickupLat || isNaN(pickupLon) || isNaN(pickupLat)) {
    error(`Invalid pickup coordinates for booking ${id}:`, {
      pickupLon,
      pickupLat,
      pickup,
    })
  }
  if (
    !deliveryLon ||
    !deliveryLat ||
    isNaN(deliveryLon) ||
    isNaN(deliveryLat)
  ) {
    error(`Invalid delivery coordinates for booking ${id}:`, {
      deliveryLon,
      deliveryLat,
      destination,
    })
  }

  const vt = getVirtualTime(fleet)
  const workday = fleet?.settings?.workday
  const {
    startMs,
    dayStartMs,
    startOffsetSeconds,
    endOffsetSeconds,
  } = resolveWorkdayWindow(vt, workday)
  const pickupStart = startOffsetSeconds
  const pickupEnd = endOffsetSeconds
  const deliveryStart = pickupStart
  const deliveryEnd = pickupEnd

  const groupMultiplier = groupedBookings ? groupedBookings.length : 1
  const settings = fleet?.settings || {}
  const load = estimateBookingLoad(booking, settings)

  const capacityDimensions = options.capacityDimensions || ['count']
  const amount = capacityDimensions.map((dim) => {
    switch (dim) {
      case 'volumeLiters':
        return Math.max(1, Math.round(load.volumeLiters * groupMultiplier))
      case 'weightKg':
        return load.weightKg != null
          ? Math.max(0, Math.round(load.weightKg * groupMultiplier))
          : 0
      case 'count':
      default:
        return Math.max(1, groupMultiplier)
    }
  })

  return {
    id: i,
    amount,
    pickup: {
      id: i * 2,
      location: [pickupLon, pickupLat],
      time_windows: [[pickupStart, pickupEnd]],
    },
    delivery: {
      id: i * 2 + 1,
      location: [deliveryLon, deliveryLat],
      time_windows: [[deliveryStart, deliveryEnd]],
    },
    service: 60,
  }
}

export function truckToVehicle(
  truck: any,
  i: number,
  options: { start?: [number, number] } = {}
): Vehicle {
  const { position, destination, fleet, virtualTime: vt } = truck
  const virtualTimeSource = getVirtualTime({ virtualTime: vt })
  const workday = fleet?.settings?.workday
  const {
    nowMs,
    dayStartMs,
    startOffsetSeconds,
    endOffsetSeconds,
  } = resolveWorkdayWindow(
    virtualTimeSource,
    workday
  )
  const workStart = startOffsetSeconds
  const workEnd = endOffsetSeconds

  const { keys: capacityDimensions, values: capacityValues } =
    getCapacityDimensions(truck)

  const posCoords = convertPosition(position)
  const startCoords: [number, number] = options.start
    ? options.start
    : [posCoords.lon, posCoords.lat]

  const rawBreaks = Array.isArray(fleet?.settings?.breaks)
    ? fleet.settings.breaks
    : []

  const breaks = rawBreaks
    .map((br: any, index: number) => {
      const startMinutes =
        typeof br?.startMinutes === 'number'
          ? br.startMinutes
          : parseTimeToMinutes(br?.desiredTime)

      const durationMinutes =
        typeof br?.durationMinutes === 'number'
          ? br.durationMinutes
          : typeof br?.duration === 'number'
            ? br.duration
            : null

      if (
        startMinutes == null ||
        !Number.isFinite(startMinutes) ||
        durationMinutes == null ||
        !Number.isFinite(durationMinutes)
      ) {
        return null
      }

      const startMs = dayStartMs + startMinutes * 60 * 1000
      const durationSeconds = Math.max(0, durationMinutes * 60)
      if (durationSeconds <= 0) return null
      const startSeconds = Math.max(
        0,
        Math.floor((startMs - nowMs) / 1000)
      )
      const endSeconds = startSeconds + durationSeconds

      return {
        id: index,
        time_windows: [[startSeconds, endSeconds]],
        duration: durationSeconds,
      }
    })
    .filter(Boolean)

  const endCoords = destination ? convertPosition(destination) : posCoords

  const vehicle: Vehicle = {
    id: i,
    time_window: [workStart, workEnd],
    capacity: capacityValues,
    start: startCoords,
    end: [endCoords.lon, endCoords.lat],
    ...(breaks.length ? { breaks } : {}),
  }

  Object.defineProperty(vehicle, '__capacityDimensions', {
    value: capacityDimensions,
    enumerable: false,
    configurable: true,
  })

  return vehicle
}

export default {
  bookingToShipment,
  truckToVehicle,
  plan,
  isVroomPlanningCancelledError,
  VROOM_PLANNING_CANCELLED_MESSAGE,
}

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = {
    bookingToShipment,
    truckToVehicle,
    plan,
    isVroomPlanningCancelledError,
    VROOM_PLANNING_CANCELLED_MESSAGE,
  }
}
