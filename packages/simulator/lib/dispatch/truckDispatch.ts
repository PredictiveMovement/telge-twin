import { Response } from 'node-fetch'
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

async function loadTruckPlanForExperiment(
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
                term: {
                  planId: experimentId,
                },
              },
              {
                term: {
                  truckId: truckId,
                },
              },
            ],
          },
        },
        sort: [{ timestamp: { order: 'desc' } }],
      },
    })
    return res?.body?.hits?.hits?.[0]?._source?.vroomResponse || null
  } catch (e) {
    error(`Error loading plan: ${e}`)
    return null
  }
}

async function savePlanToElastic(
  planId: string,
  truckId: string,
  fleetName: string,
  vroomResponse: any
): Promise<void> {
  try {
    if (!planId || planId.trim() === '') {
      error(`Invalid planId provided to savePlanToElastic: "${planId}"`)
      return
    }

    if (!truckId || truckId.trim() === '') {
      error(`Invalid truckId provided to savePlanToElastic: "${truckId}"`)
      return
    }

    await save(
      {
        planId: planId,
        truckId: truckId,
        fleet: fleetName,
        vroomResponse: vroomResponse,
        timestamp: new Date().toISOString(),
      },
      `${planId}-${truckId}`,
      'vroom-truck-plans'
    )
    info(
      `Saved truck plan to Elasticsearch with planId: ${planId}, truckId: ${truckId}`
    )
  } catch (err) {
    error(`Error saving plan to Elasticsearch: ${err}`)
  }
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
  const vehicles = [truckToVehicle(truck, 0)]
  const shipments = bookings.map(bookingToShipment)
  const result: any = await plan({ shipments, vehicles })

  await savePlanToElastic(
    experimentId,
    truck.id,
    truck.fleet?.name || truck.id,
    result
  )

  if (result.unassigned?.length > 0) {
    error(`Unassigned bookings: ${result.unassigned}`)
  }

  return result.routes[0]?.steps
    .filter(({ type }: { type: string }) => instructions.includes(type as any))
    .map(({ id, type, arrival, departure }: any) => {
      const booking = bookings[id]
      return {
        action: type,
        arrival,
        departure,
        booking,
      }
    })
}

export async function useReplayRoute(truck: any, bookings: any[]) {
  const plan = await loadTruckPlanForExperiment(
    truck.fleet.settings.replayExperiment,
    truck.id
  )
  if (!plan) {
    error(
      `No plan found for experiment ${truck.fleet.settings.replayExperiment} and truck ${truck.id}`
    )
  }
  return plan
}

export default { findBestRouteToPickupBookings, useReplayRoute }

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = { findBestRouteToPickupBookings, useReplayRoute }
}
