import fetch, { Response } from 'node-fetch'
import { startOfDay } from 'date-fns'
import { error } from './log'
import { getFromCache, updateCache } from './cache'
import queue from './queueSubject'
import { virtualTime } from './virtualTime'
import { CLUSTERING_CONFIG } from './config'

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

async function plan(
  { jobs = [], shipments = [], vehicles }: PlanInput,
  retryCount = 0
): Promise<any> {
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
          error(`VROOM HTTP ${res.status} error:`, errorText)
          throw new Error(`Vroom HTTP ${res.status}: ${errorText}`)
        }
        return res.json()
      })
    )

    const json = await Promise.race([vroomPromise, timeoutPromise])

    return updateCache(normalizedInput, json)
  } catch (vroomError) {
    error('Vroom error', vroomError)

    if (retryCount < 3) {
      const backoffDelay = Math.pow(2, retryCount + 1) * 1000
      await delay(backoffDelay)
      return plan({ jobs, shipments, vehicles }, retryCount + 1)
    } else {
      error('Max VROOM retries reached, giving up', vroomError)
      throw vroomError
    }
  }
}

function bookingToShipment(
  { id, pickup, destination, groupedBookings, fleet }: any,
  i: number
): Shipment {
  const pickupLon = pickup.position.lon || pickup.position.lng
  const pickupLat = pickup.position.lat
  const deliveryLon = destination.position.lon || destination.position.lng
  const deliveryLat = destination.position.lat

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

  const amount = groupedBookings ? groupedBookings.length : 1

  return {
    id: i,
    amount: [amount],
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

function truckToVehicle(
  { position, parcelCapacity, destination, cargo, fleet, virtualTime: vt }: any,
  i: number
): Vehicle {
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

  const effectiveCapacity = parcelCapacity - cargo.length

  const rawBreaks = Array.isArray(fleet?.settings?.breaks)
    ? fleet.settings.breaks
    : []
  const breaks = rawBreaks
    .map((br: any, index: number) => {
      if (
        typeof br?.startMinutes !== 'number' ||
        typeof br?.durationMinutes !== 'number'
      ) {
        return null
      }
      const startMs = dayStartMs + br.startMinutes * 60 * 1000
      const durationSeconds = Math.max(0, br.durationMinutes * 60)
      if (durationSeconds <= 0) return null
      const startSeconds = Math.max(
        0,
        Math.floor((startMs - nowMs) / 1000)
      )
      const endSeconds = startSeconds + durationSeconds
      return {
        id: br?.id || `break-${index}`,
        time_windows: [[startSeconds, endSeconds]],
        duration: durationSeconds,
      }
    })
    .filter(Boolean)

  return {
    id: i,
    time_window: [workStart, workEnd],
    capacity: [effectiveCapacity],
    start: [position.lon || position.lng, position.lat],
    end: destination
      ? [destination.lon || destination.lng, destination.lat]
      : [position.lon || position.lng, position.lat],
    ...(breaks.length ? { breaks } : {}),
  }
}

export default {
  bookingToShipment,
  truckToVehicle,
  plan,
}

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = {
    bookingToShipment,
    truckToVehicle,
    plan,
  }
}
