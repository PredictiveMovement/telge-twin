import {
  Observable,
  tap,
  mergeMap,
  catchError,
  toArray,
  map,
  filter,
} from 'rxjs'
import { info, error, warn, debug } from '../log'
import Vehicle from '../../models/vehicles/Vehicle'
import Booking from '../../models/Booking'

const manualDispatch = (
  cars: Observable<Vehicle>,
  bookings: Observable<Booking>
): Observable<Booking> =>
  cars.pipe(
    toArray<Vehicle>(),
    tap((cars) => info(`🚚 Dispatch ${cars.length} vehicles`)),
    tap((cars) => {
      if (!cars.length) {
        warn('Fleet has no cars, dispatch is not possible.')
      }
    }),
    tap((cars) => {
      const fleet = cars[0].fleet?.name || 'unknown fleet'
      info(`🚚 Manual dispatch ${cars.length} vehicles in ${fleet}`)
    }),
    mergeMap((cars) =>
      bookings.pipe(
        map((booking) => {
          const car = cars.find((car) => car.id === booking.metadata.vehicleId)
          return car?.handleBooking(booking)
        })
      )
    ),
    catchError((err: any, caught) => {
      error('dispatchCentral -> dispatch', err)
      return caught
    }),
    filter((booking) => booking instanceof Booking)
  )

export { manualDispatch }
