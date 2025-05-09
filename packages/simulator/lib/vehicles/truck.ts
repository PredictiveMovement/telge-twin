import Vehicle, { VehicleOptions } from './vehicle'

export default class Truck extends Vehicle {
  constructor(args: VehicleOptions) {
    super(args)
    this.vehicleType = 'truck'
    this.isPrivateCar = false
    this.co2PerKmKg = 0.000065
    this.parcelCapacity = args.parcelCapacity ?? 250
    this.plan = []
  }

  async handleStandardBooking(
    booking: Parameters<Vehicle['handleBooking']>[0]
  ) {
    return this.handleBooking(booking)
  }
}

// CJS fallback
// @ts-ignore
if (typeof module !== 'undefined') module.exports = Truck
