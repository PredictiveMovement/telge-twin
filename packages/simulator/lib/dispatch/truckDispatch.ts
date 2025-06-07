// eslint-disable-next-line @typescript-eslint/no-var-requires
const { plan, truckToVehicle, bookingToShipment } = require('../vroom')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { error, info } = require('../log')
const { save, search } = require('../elastic')
const Booking = require('../models/booking')
const Position = require('../models/position')

export interface Instruction {
  action: string
  arrival: number
  departure: number
  booking: any
}

export async function findBestRouteToPickupBookings(
  experimentId: string,
  truck: any,
  bookings: any[],
  instructions: ('pickup' | 'delivery' | 'start')[] = [
    'pickup',
    'delivery',
    'start',
  ]
): Promise<Instruction[] | undefined> {
  try {
    if (bookings.length > 200) {
      error(
        `Too many bookings (${bookings.length}) for single VROOM call. This should be handled by chunking at truck level.`
      )
      return []
    }

    const vehicles = [truckToVehicle(truck, 0)]
    const shipments = bookings.map((booking, index) =>
      bookingToShipment(booking, index)
    )

    const result: any = await plan({ shipments, vehicles }, 0)

    if (result.unassigned?.length > 0) {
      error(`❌ Unassigned bookings for truck ${truck.id}:`, result.unassigned)
    }

    return result.routes[0]?.steps
      .filter(({ type }: { type: string }) =>
        instructions.includes(type as any)
      )
      .map(({ id, type, arrival, departure }: any) => {
        let bookingIndex
        if (type === 'pickup') {
          bookingIndex = Math.floor(id / 2)
        } else if (type === 'delivery') {
          bookingIndex = Math.floor((id - 1) / 2)
        } else {
          bookingIndex = null
        }

        const booking = bookingIndex !== null ? bookings[bookingIndex] : null

        return {
          action: type,
          arrival,
          departure,
          booking,
        }
      })
  } catch (vroomError) {
    error(`Failed to plan route for truck ${truck.id}:`, vroomError)
    return []
  }
}

export async function saveCompletePlanForReplay(
  experimentId: string,
  truckId: string,
  fleetName: string,
  completePlan: Instruction[],
  allBookings: any[],
  createReplay: boolean = true
): Promise<void> {
  if (!createReplay) {
    return
  }

  try {
    const planId = `${experimentId}-${truckId}-complete-${Date.now()}`

    const bookingMetadata = allBookings.map((booking, index) => ({
      originalIndex: index,
      bookingId: booking.bookingId,
      id: booking.id,
      recyclingType: booking.recyclingType,
      pickup: {
        lat: booking.pickup?.position?.lat,
        lon: booking.pickup?.position?.lon,
        postalcode: booking.pickup?.postalcode,
      },
    }))

    const cleanCompletePlan = completePlan.map((instruction) => ({
      action: instruction.action,
      arrival: instruction.arrival,
      departure: instruction.departure,
      booking: instruction.booking
        ? {
            bookingId: instruction.booking.bookingId,
            id: instruction.booking.id,
            recyclingType: instruction.booking.recyclingType,
            pickup: {
              lat: instruction.booking.pickup?.position?.lat,
              lon: instruction.booking.pickup?.position?.lon,
              postalcode: instruction.booking.pickup?.postalcode,
            },
            destination: {
              lat: instruction.booking.destination?.position?.lat,
              lon: instruction.booking.destination?.position?.lon,
            },
          }
        : null,
    }))

    await save(
      {
        planId: planId,
        experiment: experimentId,
        truckId: truckId,
        fleet: fleetName,
        completePlan: cleanCompletePlan,
        bookingMetadata: bookingMetadata,
        planType: 'complete',
        timestamp: new Date().toISOString(),
      },
      planId,
      'vroom-truck-plans'
    )
  } catch (err) {
    error(`Error saving complete plan to Elasticsearch: ${err}`)
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
              {
                match: {
                  experiment: experimentId,
                },
              },
              {
                match: {
                  truckId: truckId,
                },
              },
              {
                match: {
                  planType: 'complete',
                },
              },
            ],
          },
        },
        sort: [{ timestamp: { order: 'desc' } }],
      },
    })

    const result = res?.body?.hits?.hits?.[0]?._source || null
    return result
  } catch (e) {
    error(`Error loading complete plan: ${e}`)
    return null
  }
}

export async function useReplayRoute(truck: any, bookings: any[]) {
  const completePlanData = await loadCompletePlanForExperiment(
    truck.fleet.settings.replayExperiment,
    truck.id
  )

  if (completePlanData?.completePlan) {
    info(
      `🔍 Replay route for truck ${truck.id}: ${bookings.length} bookings available`
    )
    info(
      `📋 Available booking IDs:`,
      bookings.map((b: any) => ({ id: b.id, bookingId: b.bookingId }))
    )

    const reconstructedPlan = completePlanData.completePlan.map(
      (instruction: any) => {
        let matchedBooking = null
        if (instruction.booking) {
          matchedBooking = bookings.find(
            (b: any) => b.bookingId === instruction.booking.bookingId
          )
          if (!matchedBooking) {
            info(
              `⚠️ No booking found for instruction booking ${instruction.booking.bookingId}, creating from instruction data`
            )
            matchedBooking = createBookingFromInstructionData(
              instruction.booking
            )
          } else {
            info(
              `✅ Found matching booking for ${instruction.booking.bookingId}`
            )
          }
        }

        return {
          action: instruction.action,
          arrival: instruction.arrival,
          departure: instruction.departure,
          booking: matchedBooking,
        }
      }
    )

    return reconstructedPlan
  }

  const instructions = ['pickup', 'delivery', 'start']
  return (
    plan.routes[0]?.steps
      ?.filter(({ type }: { type: string }) =>
        instructions.includes(type as any)
      )
      ?.map(({ id, type, arrival, departure }: any) => {
        const booking = bookings[id] || bookings.find((b, idx) => idx === id)
        if (!booking) {
          error(`Could not find booking for id ${id} in replay`)
        }
        return {
          action: type,
          arrival,
          departure,
          booking,
        }
      }) || []
  )
}

function createBookingFromInstructionData(instructionBooking: any): any {
  const bookingInput = {
    id: instructionBooking.id,
    bookingId: instructionBooking.bookingId,
    recyclingType: instructionBooking.recyclingType,
    type: instructionBooking.recyclingType,
    pickup: instructionBooking.pickup
      ? {
          position: new Position({
            lat: instructionBooking.pickup.lat,
            lng: instructionBooking.pickup.lon,
          }),
          postalcode: instructionBooking.pickup.postalcode,
        }
      : undefined,
    destination: instructionBooking.destination
      ? {
          position: new Position({
            lat: instructionBooking.destination.lat,
            lng: instructionBooking.destination.lon,
          }),
        }
      : undefined,
  }

  return new Booking(bookingInput)
}

export default {
  findBestRouteToPickupBookings,
  useReplayRoute,
  saveCompletePlanForReplay,
  createBookingFromInstructionData,
}

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = {
    findBestRouteToPickupBookings,
    useReplayRoute,
    saveCompletePlanForReplay,
    createBookingFromInstructionData,
  }
}
