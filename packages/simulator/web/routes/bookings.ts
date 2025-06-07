import { pipe, map, bufferTime, filter } from 'rxjs'
import type { Socket } from 'socket.io'

const cleanBookings = () =>
  pipe(
    map((booking: any) => {
      const {
        pickup,
        destination,
        assigned,
        id,
        status,
        isCommercial,
        co2,
        cost,
        deliveryTime,
        pickupDateTime,
        car,
        type,
        recyclingType,
      } = booking as Record<string, any>

      const result = {
        id,
        pickup: pickup?.position,
        assigned,
        destination: destination?.position,
        status,
        isCommercial,
        deliveryTime,
        pickupDateTime,
        co2,
        cost,
        carId: car?.id,
        type,
        recyclingType,
      }

      return result
    })
  )

export function register(experiment: any, socket: Socket) {
  return [
    experiment.dispatchedBookings
      .pipe(
        cleanBookings(),
        bufferTime(100),
        filter((e: unknown[]) => e.length > 0)
      )
      .subscribe((bookings: unknown[]) => {
        socket.emit('bookings', bookings)
      }),

    experiment.bookingUpdates
      .pipe(
        cleanBookings(),
        bufferTime(100),
        filter((e: unknown[]) => e.length > 0)
      )
      .subscribe((bookings: unknown[]) => {
        socket.emit('bookings', bookings)
      }),
  ]
}

export default { register }

// CJS fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = { register }
