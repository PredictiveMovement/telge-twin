import fs from 'fs'
import { Observable, from } from 'rxjs'
import { map, tap, toArray } from 'rxjs/operators'
import Booking, { BookingInput } from '../lib/models/booking'
import Position from '../lib/models/position'
import { dirname as getDirName } from 'path'

// --------------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------------

/**
 * Remove un-serialisable properties from a Booking before it is written to disk
 * so that it can later be restored with `read()`.
 */
const cleanBooking = <TPassenger = unknown>(
  booking: Booking<TPassenger>
): BookingInput<TPassenger> => {
  const { id, origin, destination, type } = booking

  const pickupPosition = booking.pickup?.position
  const finalDestinationPosition = booking.finalDestination?.position

  const destinationPosition =
    destination?.position ?? booking.destination?.position
  const destinationName = destination?.name ?? booking.destination?.name

  return {
    id,
    origin,
    pickup: pickupPosition ? { position: pickupPosition } : undefined,
    finalDestination: finalDestinationPosition
      ? { position: finalDestinationPosition }
      : undefined,
    destination: destinationPosition
      ? { position: destinationPosition, name: destinationName }
      : undefined,
    type,
  } as BookingInput<TPassenger>
}

// --------------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------------

/**
 * Persist a stream of `Booking`s to the specified file.
 *
 * @param filename Absolute path of the file to write to.
 */
export const write =
  (filename: string) =>
  <TPassenger>(
    stream: Observable<Booking<TPassenger>>
  ): Observable<BookingInput<TPassenger>[]> =>
    stream.pipe(
      map(cleanBooking),
      toArray(),
      tap((bookings) => {
        fs.mkdirSync(getDirName(filename), { recursive: true })
        fs.writeFileSync(filename, JSON.stringify(bookings))
      })
    )

/**
 * Read cached bookings from the specified file. If the file does not exist an
 * empty stream is returned.
 *
 * @param filename Absolute path of the cache file.
 */
export const read = <TPassenger = unknown>(
  filename: string
): Observable<Booking<TPassenger>> =>
  fs.existsSync(filename)
    ? from(
        JSON.parse(
          fs.readFileSync(filename, 'utf8')
        ) as BookingInput<TPassenger>[]
      ).pipe(map((b) => new Booking<TPassenger>(b)))
    : from([] as Booking<TPassenger>[])

export default { read, write }
