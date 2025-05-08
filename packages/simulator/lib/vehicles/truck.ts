import Vehicle from './vehicle'

export default class Truck extends Vehicle {
  constructor(args: Record<string, any> = {}) {
    super(args)
    this.vehicleType = 'truck'
    this.isPrivateCar = false
    this.co2PerKmKg = 0.000065
    this.parcelCapacity = args.parcelCapacity || 250
    this.plan = []
  }

  async handleStandardBooking(booking: any) {
    return this.handleBooking(booking)
  }
}

// CJS fallback
// @ts-ignore
if (typeof module !== 'undefined') module.exports = Truck
