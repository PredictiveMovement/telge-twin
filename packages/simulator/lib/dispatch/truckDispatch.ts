/* Truck-level optimisation with spatial clustering and VROOM */

const { plan, truckToVehicle, bookingToShipment } = require('../vroom')
const { error } = require('../log')
import { CLUSTERING_CONFIG } from '../config'
const { createSpatialChunks, calculateCenter } = require('../clustering')
const Position = require('../models/position')
import Booking from '../models/booking'
const { save, search } = require('../elastic')
import { extractOriginalData } from '../types/originalBookingData'
import { extractCoordinates } from '../utils/coordinates'

export interface Instruction {
  action: string
  arrival: number
  departure: number
  booking: any
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
      // Adjust step IDs to avoid conflicts, and carry id→booking mapping
      const adjustedSteps = subResult.routes[0].steps.map((step: any) => ({
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

      // Update offset for next sub-result
      const maxStepId = Math.max(...adjustedSteps.map((s: any) => s.id), -1)
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
  truckStart: [number, number]
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
      time_window: [0, 24 * 3600],
    },
  ]

  try {
    const tsp = await plan({ jobs, vehicles })
    const orderIds: number[] = tsp.routes[0].steps
      .filter((s: any) => s.type === 'job')
      .map((s: any) => s.job - 1) // 0‑baserat

    return orderIds.map((idx) => chunks[idx])
  } catch (e) {
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
  // Only use pickup instructions, delivery will be handled dynamically by truck
  if (!instructions) {
    instructions = ['pickup']
  }

  try {
    /* -------- 1. Klustra ------------------------------------ */
    const chunks = createSpatialChunks(bookings, experimentId, truck.id)
    if (!chunks.length) return []

    /* -------- 2. Kluster‑sekvens med VROOM‑TSP -------------- */
    const initialStart: [number, number] = [
      truck.position.lon || truck.position.lng,
      truck.position.lat,
    ]
    const orderedChunks = await orderChunksWithVroom(chunks, initialStart)

    /* -------- 3. Optimera varje kluster separat med VROOM --- */
    const chunkResults: any[] = []

    // Maintain a moving start position between clusters for better first‑pickup choice
    let currentStart: [number, number] = initialStart

    for (const chunk of orderedChunks) {
      try {
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
          const result = await plan({ shipments, vehicles }, 0)

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
            try {
              const { result, idToBooking } = await planBookings(subChunk)
              subResults.push({ ...result, idToBooking })
            } catch (err) {
              // Fallback for failed sub-chunk
              const fallbackSteps = subChunk.map((_b: any, i: number) => ({
                id: i * 2,
                type: 'pickup',
                arrival: 0,
                departure: 0,
              }))
              const idToBooking: Record<number, any> = {}
              subChunk.forEach((_b: any, i: number) => {
                idToBooking[i * 2] = subChunk[i]
                idToBooking[i * 2 + 1] = subChunk[i]
              })
              subResults.push({
                routes: [{ steps: fallbackSteps }],
                unassigned: [],
                idToBooking,
              })
            }
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
      } catch (err) {
        // Fallback for any errors
        const steps = chunk.bookings.map((_b: any, i: number) => ({
          id: i * 2,
          type: 'pickup',
          arrival: 0,
          departure: 0,
        }))
        const idToBooking: Record<number, any> = {}
        chunk.bookings.forEach((_b: any, i: number) => {
          idToBooking[i * 2] = chunk.bookings[i]
          idToBooking[i * 2 + 1] = chunk.bookings[i]
        })
        chunkResults.push({
          result: { routes: [{ steps }], unassigned: [], idToBooking },
          chunk,
        })
        // Update currentStart to last pickup of fallback
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
  } catch (e) {
    error(`findBestRouteToPickupBookings failed for truck ${truck.id}:`, e)
  }
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
) {
  if (!createReplay) return
  try {
    const planId = `${experimentId}-${truckId}-complete-${Date.now()}`
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

    await save(
      {
        planId,
        experiment: experimentId,
        truckId,
        fleet: fleetName,
        completePlan: cleanPlan,
        bookingMetadata,
        planType: 'complete',
        timestamp: new Date().toISOString(),
      },
      planId,
      'vroom-truck-plans'
    )
  } catch (e) {
    error(`Error saving complete plan: ${e}`)
  }
}

export async function useReplayRoute(truck: any, bookings: any[]) {
  try {
    const res = await search({
      index: 'vroom-truck-plans',
      body: {
        size: 1,
        query: {
          bool: {
            must: [
              { match: { experiment: truck.fleet.settings.replayExperiment } },
              { match: { truckId: truck.id } },
              { match: { planType: 'complete' } },
            ],
          },
        },
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

/* ----------------------------------------------------------- */
module.exports = {
  findBestRouteToPickupBookings,
  mergeVroomChunkResults,
  saveCompletePlanForReplay,
  useReplayRoute,
  createBookingFromInstructionData,
  // expose utils for unit testing
  simpleGeographicSplit,
  combineSubResults,
}
