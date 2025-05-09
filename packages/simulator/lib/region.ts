// @ts-nocheck
const { mergeMap, merge, Subject } = require('rxjs')
const { filter, share, catchError } = require('rxjs/operators')
const { error } = require('./log')

class Region {
  constructor({ id, name, geometry, municipalities }: any) {
    this.id = id
    this.geometry = geometry
    this.name = name
    this.municipalities = municipalities

    /**
     * Vehicle streams.
     */

    this.cars = municipalities.pipe(
      mergeMap((municipality: any) => municipality.cars)
    )

    /**
     * Transportable objects streams.
     */

    this.citizens = municipalities.pipe(
      mergeMap((municipality: any) => municipality.citizens)
    )

    this.manualBookings = new Subject()

    this.unhandledBookings = this.citizens.pipe(
      mergeMap((passenger: any) => passenger.bookings),
      filter((booking: any) => !booking.assigned),
      catchError((err: any) => error('unhandledBookings', err)),
      share()
    )

    this.dispatchedBookings = merge(
      this.municipalities.pipe(
        mergeMap((municipality: any) => municipality.dispatchedBookings)
      )
    ).pipe(share())
  }
}

// Export as TS module
export = Region

// CommonJS fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = Region
