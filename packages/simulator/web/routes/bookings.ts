import { merge, pipe, map, bufferTime, filter } from 'rxjs'
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

function deduplicateById(bookings: any[]): any[] {
  const byId = new Map<string, any>()
  let fallbackIndex = 0

  for (const booking of bookings) {
    const key =
      booking?.id != null ? String(booking.id) : `missing-id-${fallbackIndex++}`
    byId.set(key, booking)
  }

  return Array.from(byId.values())
}

export function register(experiment: any, socket: Socket) {
  return [
    merge(experiment.dispatchedBookings, experiment.bookingUpdates)
      .pipe(
        cleanBookings(),
        bufferTime(100),
        filter((e: unknown[]) => e.length > 0),
        map(deduplicateById)
      )
      .subscribe((bookings: unknown[]) => {
        socket.emit('bookings', bookings)
      }),
  ]
}
