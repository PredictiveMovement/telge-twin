import { merge, pipe, map, bufferTime, filter, tap } from 'rxjs'
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
        turordningsnr,
        originalData,
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
        turordningsnr,
        customerName:
          originalData?.originalAbonnentnr ||
          originalData?.originalRouteRecord?.Abonnentnr,
      }

      return result
    })
  )

/** Keep only the latest entry per booking id within a buffer window. */
function deduplicateById(bookings: any[]): any[] {
  const map = new Map<string, any>()
  for (const b of bookings) {
    if (b.id) map.set(b.id, b)
    else map.set(Math.random().toString(), b)
  }
  return Array.from(map.values())
}

export function register(
  experiment: any,
  socket: Socket,
  sessionId?: string,
  onFirstEmission?: () => void,
) {
  let firstEmitted = false
  return [
    merge(experiment.dispatchedBookings, experiment.bookingUpdates)
      .pipe(
        cleanBookings(),
        bufferTime(100),
        filter((e: unknown[]) => e.length > 0),
        map(deduplicateById),
        tap(() => {
          if (!firstEmitted && onFirstEmission) {
            firstEmitted = true
            onFirstEmission()
          }
        }),
      )
      .subscribe((bookings: unknown[]) => {
        socket.emit('bookings', bookings)
      }),
  ]
}
