// eslint-disable-next-line @typescript-eslint/no-var-requires
const { plan, truckToVehicle, bookingToShipment } = require('../vroom')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { error, info } = require('../log')
const { save, search } = require('../elastic')

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
    const shipments = bookings.map(bookingToShipment)
    const result: any = await plan({ shipments, vehicles }, 0)

    if (result.unassigned?.length > 0) {
      error(`Unassigned bookings: ${result.unassigned}`)
    }

    return result.routes[0]?.steps
      .filter(({ type }: { type: string }) =>
        instructions.includes(type as any)
      )
      .map(({ id, type, arrival, departure }: any) => {
        const booking = bookings[id]
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
  allBookings: any[]
): Promise<void> {
  try {
    const planId = `${experimentId}-${truckId}-complete-${Date.now()}`

    const bookingOrder = completePlan
      .filter((instruction) => instruction.booking)
      .map((instruction, index) => ({
        index,
        bookingId: instruction.booking.bookingId,
        id: instruction.booking.id,
      }))

    info(
      `📄 SAVING plan for ${truckId} with ${bookingOrder.length} bookings in order:`,
      bookingOrder
        .map((b: any) => `${b.index}:${b.bookingId || b.id}`)
        .join(' → ')
    )

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
    info(
      `Saved complete truck plan for replay with planId: ${planId}, experiment: ${experimentId}, truckId: ${truckId}`
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
    if (result) {
      info(
        `Loaded complete plan from Elasticsearch for experiment: ${experimentId}, truckId: ${truckId}`
      )
      return result
    } else {
      info(
        `No complete plan found for experiment: ${experimentId}, truckId: ${truckId}`
      )
    }
    return null
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
    info(`Using complete plan for replay: ${truck.id}`)

    const savedBookingOrder = completePlanData.completePlan
      .filter((instruction: any) => instruction.booking)
      .map((instruction: any, index: number) => ({
        index,
        bookingId: instruction.booking.bookingId,
        id: instruction.booking.id,
      }))

    info(
      `📖 LOADING plan for ${truck.id} with ${savedBookingOrder.length} bookings in order:`,
      savedBookingOrder
        .map((b: any) => `${b.index}:${b.bookingId || b.id}`)
        .join(' → ')
    )

    const currentBookingOrder = bookings.map((booking: any, index: number) => ({
      index,
      bookingId: booking.bookingId,
      id: booking.id,
    }))

    info(
      `🔄 CURRENT queue for ${truck.id} with ${currentBookingOrder.length} bookings in order:`,
      currentBookingOrder
        .map((b: any) => `${b.index}:${b.bookingId || b.id}`)
        .join(' → ')
    )

    const reconstructedPlan = completePlanData.completePlan.map(
      (instruction: any) => ({
        action: instruction.action,
        arrival: instruction.arrival,
        departure: instruction.departure,
        booking: instruction.booking
          ? bookings.find(
              (b: any) =>
                b.bookingId === instruction.booking.bookingId ||
                b.id === instruction.booking.id
            ) || instruction.booking
          : null,
      })
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

export default {
  findBestRouteToPickupBookings,
  useReplayRoute,
  saveCompletePlanForReplay,
}

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = {
    findBestRouteToPickupBookings,
    useReplayRoute,
    saveCompletePlanForReplay,
  }
}
