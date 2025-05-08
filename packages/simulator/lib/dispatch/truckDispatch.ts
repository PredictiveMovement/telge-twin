import { Response } from 'node-fetch'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { plan, truckToVehicle, bookingToShipment } = require('../vroom')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { error } = require('../log')

export interface Instruction {
  action: string
  arrival: number
  departure: number
  booking: any
}

export async function findBestRouteToPickupBookings(
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

export default { findBestRouteToPickupBookings }

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = { findBestRouteToPickupBookings }
}
