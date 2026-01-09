import { from, of, Observable } from 'rxjs'
import { mergeMap, catchError } from 'rxjs/operators'
// Using require to avoid circular/es compatibility issues until full migration
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { error } = require('../log')

export function dispatch<TFleet, TBooking>(
  fleets: TFleet[],
  bookings: TBooking[]
): Observable<TBooking | null> {
  return from(bookings).pipe(
    mergeMap((booking) => of(booking)),
    catchError((err) => {
      error(`Fel vid tilldelning av bokning:`, err)
      return of(null)
    })
  )
}

export default { dispatch }

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = { dispatch }
}
