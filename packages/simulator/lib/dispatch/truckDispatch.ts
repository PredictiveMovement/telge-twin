/*  src/dispatch/truckDispatch.ts
 *  ↳ TRUCK-LEVEL optimering med spatial clustering + VROOM
 *  ↳ Används när trucks får bokningar från Fleet via round-robin dispatch
 *  ↳ Steg: 1) Klustra truck's bokningar, 2) TSP för kluster-ordning, 3) VROOM per kluster
 */

const { plan, truckToVehicle, bookingToShipment } = require('../vroom')
const { error, info } = require('../log')
const { CLUSTERING_CONFIG } = require('../config')
const {
  createSpatialChunks,
  calculateCenter,
  calculateBoundingBox,
} = require('../clustering')
const Position = require('../models/position')
const Booking = require('../models/booking')
const { save, search } = require('../elastic')

export interface Instruction {
  action: string
  arrival: number
  departure: number
  booking: any
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
    const chunks = createSpatialChunks(
      bookings,
      CLUSTERING_CONFIG.MAX_CLUSTER_SIZE,
      experimentId
    )
    if (!chunks.length) return []

    /* -------- 2. Kluster‑sekvens med VROOM‑TSP -------------- */
    const truckStart: [number, number] = [
      truck.position.lon || truck.position.lng,
      truck.position.lat,
    ]
    const orderedChunks = await orderChunksWithVroom(chunks, truckStart)

    /* -------- 3. Optimera varje kluster separat med VROOM --- */
    const chunkResults: any[] = []

    for (const chunk of orderedChunks) {
      try {
        const vehicles = [truckToVehicle(truck, 0)]
        const shipments = chunk.bookings.map((b: any, i: number) =>
          bookingToShipment(b, i)
        )
        const result = await plan({ shipments, vehicles }, 0)
        chunkResults.push({ result, chunk })
      } catch (err) {
        chunkResults.push({
          result: {
            routes: [
              {
                steps: chunk.bookings.map((_b: any, i: number) => ({
                  id: i * 2,
                  type: 'pickup',
                  arrival: 0,
                  departure: 0,
                })),
              },
            ],
            unassigned: [],
          },
          chunk,
        })
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

    /* 1. planerade steg */
    steps
      .filter((s: any) => instructions.includes(s.type))
      .forEach((s: any) => {
        let booking = null
        if (s.type === 'pickup') booking = chunk.bookings[Math.floor(s.id / 2)]
        else if (s.type === 'delivery')
          booking = chunk.bookings[Math.floor((s.id - 1) / 2)]

        merged.push({
          action: s.type,
          arrival: s.arrival ?? 0,
          departure: s.departure ?? 0,
          booking,
        })
      })

    /* 2. unassigned hantering                            */
    if (result?.unassigned?.length) {
      const ids = result.unassigned
        .filter((u: any) => u.type === 'pickup')
        .map((u: any) => Math.floor(u.id / 2))
      ids.forEach((idx: number) => {
        const b = chunk.bookings[idx]
        if (b)
          merged.push({
            action: 'pickup',
            arrival: 0,
            departure: 0,
            booking: b,
          })
      })
    }
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
      originalTurid: b.originalTurid,
      originalKundnr: b.originalKundnr,
      originalHsnr: b.originalHsnr,
      originalTjnr: b.originalTjnr,
      originalAvftyp: b.originalAvftyp,
      originalTjtyp: b.originalTjtyp,
      originalFrekvens: b.originalFrekvens,
      originalDatum: b.originalDatum,
      originalBil: b.originalBil,
      originalSchemalagd: b.originalSchemalagd,
      originalDec: b.originalDec,
      originalTurordningsnr: b.turordningsnr,
      standardBookingId: b.standardBookingId,
      originalRouteRecord: b.originalRouteRecord,
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
            originalTurid: i.booking.originalTurid,
            originalKundnr: i.booking.originalKundnr,
            originalHsnr: i.booking.originalHsnr,
            originalTjnr: i.booking.originalTjnr,
            originalAvftyp: i.booking.originalAvftyp,
            originalTjtyp: i.booking.originalTjtyp,
            originalFrekvens: i.booking.originalFrekvens,
            originalDatum: i.booking.originalDatum,
            originalBil: i.booking.originalBil,
            originalSchemalagd: i.booking.originalSchemalagd,
            originalDec: i.booking.originalDec,
            originalTurordningsnr: i.booking.turordningsnr,
            standardBookingId: i.booking.standardBookingId,
            originalRouteRecord: i.booking.originalRouteRecord,
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

async function loadCompletePlanForExperiment(
  experimentId: string,
  truckId: string
) {
  try {
    const res = await search({
      index: 'vroom-truck-plans',
      body: {
        size: 1,
        query: {
          bool: {
            must: [
              { match: { experiment: experimentId } },
              { match: { truckId } },
              { match: { planType: 'complete' } },
            ],
          },
        },
        sort: [{ timestamp: { order: 'desc' } }],
      },
    })
    return res?.body?.hits?.hits?.[0]?._source || null
  } catch (e) {
    error(`Error loading complete plan: ${e}`)
    return null
  }
}

export async function useReplayRoute(truck: any, bookings: any[]) {
  const data = await loadCompletePlanForExperiment(
    truck.fleet.settings.replayExperiment,
    truck.id
  )
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
  })
}

/* ----------------------------------------------------------- */
module.exports = {
  findBestRouteToPickupBookings,
  mergeVroomChunkResults,
  saveCompletePlanForReplay,
  useReplayRoute,
  createBookingFromInstructionData,
}
