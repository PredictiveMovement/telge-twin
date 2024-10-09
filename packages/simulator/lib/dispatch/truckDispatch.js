const { plan, truckToVehicle, bookingToShipment } = require('../vroom')
const { error } = require('../log')

const findBestRouteToPickupBookings = async (
  truck,
  bookings,
  instructions = ['pickup', 'delivery', 'start']
) => {
  const vehicles = [truckToVehicle(truck, 0)]
  //console.log(`vehicles:`, vehicles)
  const shipments = bookings.map(bookingToShipment)

  const result = await plan({ shipments, vehicles })

  if (result.unassigned?.length > 0) {
    error(`Unassigned bookings: ${result.unassigned}`)
  }

  return result.routes[0]?.steps
    .filter(({ type }) => instructions.includes(type))
    .map(({ id, type, arrival, departure }) => {
      const booking = bookings[id]
      const instruction = {
        action: type,
        arrival,
        departure,
        booking,
      }
      return instruction
    })
}

module.exports = {
  findBestRouteToPickupBookings,
}
