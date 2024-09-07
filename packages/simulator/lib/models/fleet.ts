import { Subject, range, from, merge, of, firstValueFrom } from 'rxjs'
import { shareReplay, mergeMap, share, catchError, first } from 'rxjs/operators'
import { dispatch } from '../dispatch/dispatchCentral'
import RecycleTruck from '../vehicles/RecycleTruck'
import Taxi from '../vehicles/taxi'
import Position from './position'
import { error, debug, info } from '../log'

const vehicleTypes = {
  recycleTruck: {
    weight: 10 * 1000,
    parcelCapacity: 500,
    class: RecycleTruck,
  },
  taxi: {
    weight: 1000,
    parcelCapacity: 0,
    passengerCapacity: 4,
    class: Taxi,
  },
}

class Fleet {
  constructor({
    name,
    marketshare,
    percentageHomeDelivery,
    vehicles,
    hub,
    type,
    municipality,
  }) {
    this.name = name
    this.type = type
    this.marketshare = marketshare
    this.hub = { position: new Position(hub) }

    this.percentageHomeDelivery = (percentageHomeDelivery || 0) / 100 || 0.15 // based on guestimates from workshop with transport actors in oct 2021
    this.percentageReturnDelivery = 0.1
    this.municipality = municipality
    this.cars = from(Object.entries(vehicles)).pipe(
      mergeMap(([type, count]) =>
        range(0, count).pipe(
          mergeMap(() => {
            const Vehicle = vehicleTypes[type].class

            return of(
              new Vehicle({
                ...vehicleTypes[type],
                fleet: this,
                position: this.hub.position,
              })
            )
          }),
          catchError((err) => {
            error(
              `Error creating vehicle for fleet ${name}: ${err}\n\n${
                new Error().stack
              }\n\n`
            )
          })
        )
      ),
      shareReplay()
    )
    this.unhandledBookings = new Subject()
    this.manualDispatchedBookings = new Subject()
    this.dispatchedBookings = merge(
      this.manualDispatchedBookings,
      dispatch(this.cars, this.unhandledBookings)
    ).pipe(share())
  }

  async canHandleBooking(booking) {
    debug(`🚗 Fleet ${this.name} checking booking ${booking.id}`)
    return firstValueFrom(
      this.cars.pipe(
        first((car) => car.canHandleBooking(booking), false /* defaultValue */)
        // TODO: handle case when all cars are busy or full?
      )
    )
  }

  async handleBooking(booking, car) {
    booking.fleet = this
    if (car) {
      debug(`📦 Dispatching ${booking.id} to ${this.name} (manual)`)
      this.manualDispatchedBookings.next(booking)
      return await car.handleBooking(booking)
    } else {
      debug(`📦 Dispatching ${booking.id} to ${this.name}`)
      this.unhandledBookings.next(booking)
    }
    return booking
  }
}

export default Fleet
