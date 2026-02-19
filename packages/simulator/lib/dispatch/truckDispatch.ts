/* Truck-level optimisation with spatial clustering and VROOM */

import {
  plan,
  truckToVehicle,
  bookingToShipment,
  isVroomPlanningCancelledError,
  VROOM_PLANNING_CANCELLED_MESSAGE,
} from '../vroom'
import {
  isExperimentCancelled,
  shouldLogExperimentCancellation,
} from '../cancelledExperiments'
import { error, info } from '../log'
import { CLUSTERING_CONFIG } from '../config'
import { createSpatialChunks, calculateCenter, calculateBoundingBox, AreaPartition } from '../clustering'
import { Position } from '../models/position'
import Booking from '../models/booking'
import { save, search } from '../elastic'
import { elasticsearchService } from '../../web/services/ElasticsearchService'
import { socketController } from '../../web/controllers/SocketController'
import { extractOriginalData } from '../types/originalBookingData'
import { extractCoordinates } from '../utils/coordinates'
import { haversine } from '../distance'

/**
 * Find the chunk whose nearest booking is closest to the given orphan.
 * Uses haversine distance to actual bookings (not chunk center) for
 * better geographic locality — VROOM produces better routes this way.
 */
function findNearestChunk(booking: any, chunks: AreaPartition[]): AreaPartition | null {
  if (!chunks.length) return null
  const { lat, lng } = extractCoordinates(booking)
  if (!lat || !lng) return null

  let nearest: AreaPartition | null = null
  let minDist = Infinity

  for (const chunk of chunks) {
    for (const cb of chunk.bookings) {
      const coords = extractCoordinates(cb)
      if (!coords.lat || !coords.lng) continue
      const dist = haversine({ lat, lng }, { lat: coords.lat, lng: coords.lng })
      if (dist < minDist) {
        minDist = dist
        nearest = chunk
      }
    }
  }

  return nearest
}

export interface Instruction {
  action: string
  arrival: number
  departure: number
  booking: any
}

export interface PlanStatistics {
  totalDistanceKm: number
  totalCo2Kg: number
  bookingCount: number
}

export interface BaselineStatistics {
  totalDistanceKm: number
  totalCo2Kg: number
  bookingCount: number
}

/**
 * Calculate statistics (distance, CO₂, booking count) from a complete VROOM plan.
 * Uses haversine distance between consecutive pickup positions.
 * CO₂ is calculated using the same formula as the vehicle simulation:
 * co2 = (truckWeight + cargoWeight) × distanceKm × co2PerKmKg
 */
export function calculatePlanStatistics(
  completePlan: Instruction[],
  truckWeight: number = 15000, // Default 15 ton empty truck
  co2PerKmKg: number = 0.000013 // Same as vehicle.ts default
): PlanStatistics {
  // Extract pickup positions in order
  const pickupPositions = completePlan
    .filter((step) => step.action === 'pickup' && step.booking?.pickup?.position)
    .map((step) => step.booking.pickup.position)

  // Calculate total distance using haversine between consecutive pickups
  let totalDistanceMeters = 0
  for (let i = 1; i < pickupPositions.length; i++) {
    totalDistanceMeters += haversine(pickupPositions[i - 1], pickupPositions[i])
  }

  const totalDistanceKm = totalDistanceMeters / 1000

  // Estimate CO₂ using average cargo weight (approximately 50% of typical capacity)
  const avgCargoWeight = 5000 // ~5 ton average cargo
  const totalCo2Kg = (truckWeight + avgCargoWeight) * totalDistanceKm * co2PerKmKg

  return {
    totalDistanceKm,
    totalCo2Kg,
    bookingCount: pickupPositions.length,
  }
}

/**
 * Calculate baseline statistics from original route data.
 * Groups by vehicle (Bil) and sorts by original order (Turordningsnr).
 * Uses the same haversine/CO₂ formula as VROOM statistics for fair comparison.
 */
export function calculateBaselineStatistics(
  routeData: Array<{ Bil: string; Turordningsnr: number; Lat: number; Lng: number }>,
  truckWeight: number = 15000,
  co2PerKmKg: number = 0.000013
): BaselineStatistics {
  // Group by vehicle
  const vehicleGroups = new Map<string, typeof routeData>()
  for (const route of routeData) {
    const vehicleId = route.Bil
    if (!vehicleId || route.Lat == null || route.Lng == null) continue
    if (!vehicleGroups.has(vehicleId)) {
      vehicleGroups.set(vehicleId, [])
    }
    vehicleGroups.get(vehicleId)!.push(route)
  }

  let totalDistanceMeters = 0
  let totalBookings = 0

  // Calculate distance per vehicle in original order
  for (const [, routes] of vehicleGroups) {
    // Sort by original order number
    routes.sort((a, b) => a.Turordningsnr - b.Turordningsnr)

    for (let i = 1; i < routes.length; i++) {
      const p1 = { lat: routes[i - 1].Lat, lon: routes[i - 1].Lng }
      const p2 = { lat: routes[i].Lat, lon: routes[i].Lng }
      totalDistanceMeters += haversine(p1, p2)
    }
    totalBookings += routes.length
  }

  const totalDistanceKm = totalDistanceMeters / 1000
  const avgCargoWeight = 5000
  const totalCo2Kg = (truckWeight + avgCargoWeight) * totalDistanceKm * co2PerKmKg

  return {
    totalDistanceKm,
    totalCo2Kg,
    bookingCount: totalBookings,
  }
}

/* ----------------------------------------------------------- */
/*  INTERN SUBDIVISION FÖR STORA KLUSTER                      */

/**
 * Simple geographic split for large clusters (VROOM optimization only)
 * This is used internally during VROOM optimization, not for area partitions
 */
export function simpleGeographicSplit(
  bookings: any[],
  maxSize: number
): any[][] {
  if (bookings.length <= maxSize) {
    return [bookings]
  }

  // Sort by latitude to maintain geographical grouping
  const sorted = [...bookings].sort((a, b) => {
    const coordsA = extractCoordinates(a)
    const coordsB = extractCoordinates(b)
    return coordsA.lat - coordsB.lat
  })

  // Split into two halves and recursively process each half
  const mid = Math.ceil(sorted.length / 2)
  const firstHalf = sorted.slice(0, mid)
  const secondHalf = sorted.slice(mid)

  return [
    ...simpleGeographicSplit(firstHalf, maxSize),
    ...simpleGeographicSplit(secondHalf, maxSize),
  ]
}

/**
 * Combines multiple VROOM sub-results into one unified result
 */
export function combineSubResults(
  subResults: any[],
  originalBookings: any[]
): any {
  const allSteps: any[] = []
  const allUnassigned: any[] = []
  const idToBooking: Record<number, any> = {}
  let stepIdOffset = 0

  subResults.forEach((subResult) => {
    if (subResult?.routes?.[0]?.steps) {
      const originalSteps = subResult.routes[0].steps

      // Adjust step IDs to avoid conflicts, and carry id→booking mapping
      const adjustedSteps = originalSteps.map((step: any) => ({
        ...step,
        id: step.id + stepIdOffset,
      }))
      allSteps.push(...adjustedSteps)

      // Merge mapping if present (expected from our per-sub-chunk planning)
      if (subResult.idToBooking) {
        Object.entries(subResult.idToBooking).forEach(
          ([idStr, booking]: any) => {
            const newId = Number(idStr) + stepIdOffset
            idToBooking[newId] = booking
          }
        )
      }

      // Update offset for next sub-result (filter out undefined/NaN IDs from start/end steps)
      const stepIds = adjustedSteps
        .map((s: any) => s.id)
        .filter((id: any) => typeof id === 'number' && !isNaN(id))
      const maxStepId = stepIds.length > 0 ? Math.max(...stepIds) : -1
      stepIdOffset = maxStepId + 1
    }

    if (subResult?.unassigned) {
      allUnassigned.push(...subResult.unassigned)
    }
  })

  return {
    routes: [
      {
        steps: allSteps,
        cost: allSteps.length * 100, // Simple cost estimation
        duration: allSteps.reduce(
          (sum: number, step: any) => sum + (step.duration || 0),
          0
        ),
      },
    ],
    unassigned: allUnassigned,
    idToBooking,
  }
}

/* ----------------------------------------------------------- */
/*  BESTÄM OPTIMAL ORDNING MELLAN KLUSTER MED VROOM (TSP)      */
async function orderChunksWithVroom(
  chunks: any[],
  truckStart: [number, number],
  shouldAbort?: () => boolean | Promise<boolean>
): Promise<any[]> {
  if (chunks.length <= 1) return chunks

  /* bygg ett TSP‑problem där varje kluster‑centroid är ett jobb */
  const jobs = chunks.map((c, i) => ({
    id: i + 1,
    location: [
      calculateCenter(c.bookings).lng,
      calculateCenter(c.bookings).lat,
    ],
    service: 0,
  }))
  const vehicles = [
    {
      id: 0,
      start: truckStart,
      end: truckStart,
      capacity: [9999],
      time_window: [0, 24 * 3600] as [number, number],
    },
  ]

  try {
    const tsp = await plan({ jobs, vehicles, shouldAbort })
    const orderIds: number[] = tsp.routes[0].steps
      .filter((s: any) => s.type === 'job')
      .map((s: any) => s.job - 1) // 0‑baserat

    return orderIds.map((idx) => chunks[idx])
  } catch (e) {
    if (isVroomPlanningCancelledError(e)) {
      throw e
    }
    return chunks
  }
}

/* ----------------------------------------------------------- */
export async function findBestRouteToPickupBookings(
  experimentId: string,
  truck: any,
  bookings: any[],
  instructions?: ('pickup' | 'delivery' | 'start')[]
): Promise<Instruction[] | undefined> {
  const shouldAbort = async () => {
    if (isExperimentCancelled(experimentId)) {
      return true
    }

    try {
      const existingExperiment = await elasticsearchService.findDocumentById(
        'experiments',
        experimentId
      )
      return !existingExperiment
    } catch {
      return isExperimentCancelled(experimentId)
    }
  }

  const throwIfCancelled = async () => {
    if (await shouldAbort()) {
      if (shouldLogExperimentCancellation(experimentId)) {
        info(`   ⚠️ Experiment ${experimentId} was deleted - optimization cancelled`)
      }
      throw new Error(VROOM_PLANNING_CANCELLED_MESSAGE)
    }
  }

  await throwIfCancelled()

  // Only use pickup instructions, delivery will be handled dynamically by truck
  if (!instructions) {
    instructions = ['pickup']
  }

    /* -------- 1. Klustra ------------------------------------ */
    const chunks = createSpatialChunks(bookings, experimentId, truck.id)

    // Ensure no bookings are lost by clustering — orphans must reach VROOM
    const clusteredSet = new Set<any>()
    chunks.forEach((chunk: AreaPartition) =>
      chunk.bookings.forEach((b: any) => clusteredSet.add(b))
    )
    const orphaned = bookings.filter((b: any) => !clusteredSet.has(b))

    if (orphaned.length > 0) {
      info(
        `🔧 Recovering ${orphaned.length} orphaned bookings dropped by DBSCAN clustering`
      )
      if (chunks.length === 0) {
        // No clusters formed — create a single fallback chunk with all bookings
        chunks.push({
          id: `truck-${truck.id}-area-fallback`,
          bookings: [...bookings],
          center: calculateCenter(bookings),
          boundingBox: calculateBoundingBox(bookings),
          recyclingTypes: Array.from(
            new Set(
              bookings
                .map((b: any) => b.recyclingType || b.Avftyp)
                .filter(Boolean)
            )
          ),
          polygon: [],
          count: bookings.length,
        })
      } else {
        for (const orphan of orphaned) {
          const nearest = findNearestChunk(orphan, chunks)
          if (nearest) {
            nearest.bookings.push(orphan)
            nearest.count = nearest.bookings.length
          }
        }
      }
    }

    if (!chunks.length) return []

    /* -------- 2. Kluster‑sekvens med VROOM‑TSP -------------- */
    const initialStart: [number, number] = [
      truck.position.lon || truck.position.lng,
      truck.position.lat,
    ]
    const orderedChunks = await orderChunksWithVroom(
      chunks,
      initialStart,
      shouldAbort
    )

    /* -------- 3. Optimera varje kluster separat med VROOM --- */
    const chunkResults: any[] = []

    // Maintain a moving start position between clusters for better first‑pickup choice
    let currentStart: [number, number] = initialStart

    for (const chunk of orderedChunks) {
      await throwIfCancelled()

      const maxSize = CLUSTERING_CONFIG.MAX_CLUSTER_SIZE

      // Helper: plan a set of bookings (sub- or full chunk) from currentStart
      const planBookings = async (bkgs: any[]) => {
        const baseVehicle = truckToVehicle(truck, 0, {
          start: [currentStart[0], currentStart[1]],
        })
        const capacityDimensions =
          (baseVehicle as any).__capacityDimensions || ['count']

        const vehicles = [baseVehicle]
        const shipments = bkgs.map((b: any, i: number) =>
          bookingToShipment(b, i, {
            capacityDimensions,
            fleet: truck.fleet,
          })
        )
        const result = await plan({ shipments, vehicles, shouldAbort }, 0)

        const unreachableIndices = new Set<number>()
        if (Array.isArray(result?.unassigned)) {
          for (const unassigned of result.unassigned) {
            if (typeof unassigned?.id === 'number') {
              const idx = Math.floor(unassigned.id / 2)
              unreachableIndices.add(idx)
            } else if (typeof unassigned?.job === 'number') {
              unreachableIndices.add(unassigned.job)
            }
          }
        }

        if (unreachableIndices.size) {
          await Promise.all(
            Array.from(unreachableIndices).map(async (idx) => {
              const booking = bkgs[idx]
              if (booking) {
                if (typeof booking.markUnreachable === 'function') {
                  await booking.markUnreachable('workday-limit')
                } else {
                  booking.status = 'Unreachable'
                }
              }
            })
          )
        }

        // Build id→booking mapping for assigned bookings only
        const idToBooking: Record<number, any> = {}
        bkgs.forEach((_b: any, i: number) => {
          if (!unreachableIndices.has(i)) {
            idToBooking[i * 2] = bkgs[i]
            idToBooking[i * 2 + 1] = bkgs[i]
          }
        })

        return { result, idToBooking }
      }

      if (chunk.bookings.length > maxSize) {
        // Large cluster – subdividing for VROOM optimization

        const subChunks = simpleGeographicSplit(chunk.bookings, maxSize)
        const subResults: any[] = []

        for (const subChunk of subChunks) {
          const { result, idToBooking } = await planBookings(subChunk)
          subResults.push({ ...result, idToBooking })
        }

        const combinedResult = combineSubResults(subResults, chunk.bookings)
        chunk.bookings = chunk.bookings.filter(
          (b: any) => b?.status !== 'Unreachable'
        )
        chunkResults.push({ result: combinedResult, chunk })

        // Update currentStart to last pickup of this combined result (if any)
        const steps = combinedResult?.routes?.[0]?.steps || []
        const lastPickup = [...steps]
          .reverse()
          .find((s: any) => s.type === 'pickup')
        if (
          lastPickup &&
          combinedResult.idToBooking &&
          combinedResult.idToBooking[lastPickup.id]
        ) {
          const b = combinedResult.idToBooking[lastPickup.id]
          const lon = b.pickup?.position?.lon || b.pickup?.position?.lng
          const lat = b.pickup?.position?.lat
          if (lon && lat) currentStart = [lon, lat]
        }
      } else {
        // Normal-sized cluster
        const { result, idToBooking } = await planBookings(chunk.bookings)
        chunk.bookings = chunk.bookings.filter(
          (b: any) => b?.status !== 'Unreachable'
        )
        chunkResults.push({ result: { ...result, idToBooking }, chunk })

        // Update currentStart to last pickup
        const steps = result?.routes?.[0]?.steps || []
        const lastPickup = [...steps]
          .reverse()
          .find((s: any) => s.type === 'pickup')
        if (lastPickup && idToBooking[lastPickup.id]) {
          const b = idToBooking[lastPickup.id]
          const lon = b.pickup?.position?.lon || b.pickup?.position?.lng
          const lat = b.pickup?.position?.lat
          if (lon && lat) currentStart = [lon, lat]
        }
      }
    }

    return mergeVroomChunkResults(chunkResults, instructions)
}

/* ----------------------------------------------------------- */
/*  Slår ihop VROOM‑resultat från flera chunk‑körningar        */
export function mergeVroomChunkResults(
  chunkResults: any[],
  instructions: ('pickup' | 'delivery' | 'start')[]
): Instruction[] {
  const merged: Instruction[] = []

  chunkResults.forEach(({ result, chunk }) => {
    const steps = result?.routes?.[0]?.steps || []
    const idToBooking: Record<number, any> | undefined = result?.idToBooking

    /* 1. planerade steg */
    steps
      .filter((s: any) => instructions.includes(s.type))
      .forEach((s: any) => {
        let booking = null
        if (idToBooking && (s.type === 'pickup' || s.type === 'delivery')) {
          booking = idToBooking[s.id] || null
        } else {
          // Fallback legacy mapping
          if (s.type === 'pickup')
            booking = chunk.bookings[Math.floor(s.id / 2)]
          else if (s.type === 'delivery')
            booking = chunk.bookings[Math.floor((s.id - 1) / 2)]
        }

        merged.push({
          action: s.type,
          arrival: s.arrival ?? 0,
          departure: s.departure ?? 0,
          booking,
        })
      })
  })

  return merged
}

export async function saveCompletePlanForReplay(
  experimentId: string,
  truckId: string,
  fleetName: string,
  completePlan: Instruction[],
  allBookings: any[],
  createReplay = true
): Promise<string | undefined> {
  if (!createReplay) return undefined
  try {
    // Deterministic planId: experimentId-truckId
    // This matches the vroomTruckPlanIds generated when experiment starts
    const planId = `${experimentId}-${truckId}`
    const bookingMetadata = allBookings.map((b: any, i: number) => ({
      originalIndex: i,
      bookingId: b.bookingId,
      id: b.id,
      recyclingType: b.recyclingType,
      pickup: {
        lat: b.pickup?.position?.lat,
        lon: b.pickup?.position?.lon,
        postalcode: b.pickup?.postalcode,
      },
      ...extractOriginalData(b),
      originalTurordningsnr: b.turordningsnr,
    }))

    const cleanPlan = completePlan.map((i) => ({
      action: i.action,
      arrival: i.arrival,
      departure: i.departure,
      booking: i.booking
        ? {
            bookingId: i.booking.bookingId,
            id: i.booking.id,
            recyclingType: i.booking.recyclingType,
            pickup: {
              lat: i.booking.pickup?.position?.lat,
              lon: i.booking.pickup?.position?.lon,
              postalcode: i.booking.pickup?.postalcode,
            },
            destination: {
              lat: i.booking.destination?.position?.lat,
              lon: i.booking.destination?.position?.lon,
            },
            ...extractOriginalData(i.booking),
            originalTurordningsnr: i.booking.turordningsnr,
          }
        : null,
    }))

    // Calculate plan statistics (distance, CO₂, booking count)
    const stats = calculatePlanStatistics(completePlan)

    await save(
      {
        planId,
        experimentId,
        truckId,
        fleet: fleetName,
        completePlan: cleanPlan,
        bookingMetadata,
        planType: 'complete',
        timestamp: new Date().toISOString(),
        totalDistanceKm: stats.totalDistanceKm,
        totalCo2Kg: stats.totalCo2Kg,
        bookingCount: stats.bookingCount,
      },
      planId,
      'truck-plans'
    )

    // Add planId to experiment's vroomTruckPlanIds array
    await elasticsearchService.addPlanIdToExperiment(experimentId, planId)

    // Look up the experiment to get sourceDatasetId for the socket event
    const experiment = await elasticsearchService.getExperiment(experimentId)
    const sourceDatasetId = experiment?.sourceDatasetId

    // Notify connected clients that a plan was saved (for real-time UI updates)
    socketController.emitPlanSaved(experimentId, planId, sourceDatasetId)

    return planId
  } catch (e) {
    error(`Error saving complete plan: ${e}`)
    return undefined
  }
}

export async function useReplayRoute(truck: any, bookings: any[]) {
  try {
    // Get the specific planId to replay, or fall back to experimentId-based lookup
    const replayPlanId = truck.fleet.settings.replayPlanId
    const replayExperimentId = truck.fleet.settings.replayExperimentId || truck.fleet.settings.replayExperiment

    let query: any
    if (replayPlanId) {
      // Direct lookup by planId
      query = { term: { _id: replayPlanId } }
    } else if (replayExperimentId) {
      // Lookup by experimentId and truckId
      query = {
        bool: {
          must: [
            { term: { experimentId: replayExperimentId } },
            { term: { truckId: truck.id } },
            { term: { planType: 'complete' } },
          ],
        },
      }
    } else {
      return []
    }

    const res = await search({
      index: 'truck-plans',
      body: {
        size: 1,
        query,
        sort: [{ timestamp: { order: 'desc' } }],
      },
    })

    const data = res?.body?.hits?.hits?.[0]?._source || null

    if (data?.completePlan) {
      return data.completePlan.map((ins: any) => {
        let matched = null
        if (ins.booking) {
          matched = bookings.find(
            (b: any) => b.bookingId === ins.booking.bookingId
          )
          if (!matched) matched = createBookingFromInstructionData(ins.booking)
        }
        return {
          action: ins.action,
          arrival: ins.arrival,
          departure: ins.departure,
          booking: matched,
        }
      })
    }
    return []
  } catch (e) {
    error(`Error loading complete plan: ${e}`)
    return []
  }
}

export function createBookingFromInstructionData(insBook: any) {
  return new Booking({
    id: insBook.id,
    bookingId: insBook.bookingId,
    recyclingType: insBook.recyclingType,
    type: insBook.recyclingType,
    pickup: insBook.pickup
      ? {
          position: new Position({
            lat: insBook.pickup.lat,
            lng: insBook.pickup.lon,
          }),
          postalcode: insBook.pickup.postalcode,
        }
      : undefined,
    destination: insBook.destination
      ? {
          position: new Position({
            lat: insBook.destination.lat,
            lng: insBook.destination.lon,
          }),
        }
      : undefined,
    originalData: extractOriginalData(insBook),
  })
}

export async function reportDispatchError(
  experimentId: string,
  truckId: string,
  fleetName: string,
  errorMessage: string
): Promise<void> {
  socketController.emitDispatchError(experimentId, truckId, fleetName, errorMessage)
}

/* ----------------------------------------------------------- */
module.exports = {
  findBestRouteToPickupBookings,
  mergeVroomChunkResults,
  saveCompletePlanForReplay,
  useReplayRoute,
  createBookingFromInstructionData,
  calculatePlanStatistics,
  calculateBaselineStatistics,
  simpleGeographicSplit,
  combineSubResults,
  reportDispatchError,
}
