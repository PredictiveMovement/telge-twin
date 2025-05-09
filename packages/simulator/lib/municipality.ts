const {
  from,
  shareReplay,
  Subject,
  mergeMap,
  catchError,
  tap,
  toArray,
  find,
  ReplaySubject,
  filter,
  map,
} = require('rxjs')
const Fleet = require('./fleet')
const { error, info } = require('./log')

class Municipality {
  public squares: any
  public geometry: any
  public name: any
  public id: any
  public center: any
  public bookings: any
  public privateCars: any
  public unhandledBookings: any
  public nrOfBookings: number
  public co2: any
  public citizens: any
  public fleetsConfig: any
  public settings: any
  public fleets: any
  public cars: any
  public dispatchedBookings: any

  constructor({
    geometry,
    name,
    id,
    center,
    bookings,
    citizens,
    squares,
    fleetsConfig,
    settings,
  }: any) {
    this.squares = squares
    this.geometry = geometry
    this.name = name
    this.id = id
    this.center = center
    this.bookings = bookings
    this.privateCars = new ReplaySubject()
    this.unhandledBookings = new Subject()
    this.nrOfBookings = 0

    this.co2 = 0
    this.citizens = citizens
    this.fleetsConfig = fleetsConfig
    this.settings = settings
    this.fleets = from(this.fleetsConfig).pipe(
      map(
        ({ name, recyclingTypes, vehicles, hubAddress }: any, i: number) =>
          new Fleet({
            id: i,
            name: name,
            hub: this.center,
            municipality: this,
            hubAddress: hubAddress,
            vehicleTypes: vehicles,
            recyclingTypes: recyclingTypes,
            settings: this.settings,
          })
      ),
      tap((fleet: any) =>
        info(
          `✅ Fleet skapad: ${fleet.name} för att hantera [${fleet.recyclingTypes}] redo att ta emot bokningar`
        )
      ),
      catchError((err: any) => {
        error('Fleet creation error:', err)
        throw err
      }),
      shareReplay()
    )

    this.cars = this.fleets.pipe(mergeMap((fleet: any) => fleet.cars))

    /**
     * Take bookings and dispatch them to the first eligble fleet that can handle the booking
     */
    this.dispatchedBookings = this.bookings.pipe(
      mergeMap((booking: any) =>
        this.fleets.pipe(
          find((fleet: any) => fleet.canHandleBooking(booking) && booking),
          tap((ok: any) => {
            if (!ok) {
              error(
                `No fleet can handle booking ${booking.id} of type ${booking.recyclingType}`
              )
            }
          }),
          filter((ok: any) => ok),
          map((fleet: any) => fleet.handleBooking(booking)),
          tap(() => {
            this.nrOfBookings++
          })
        )
      ),

      toArray(), // this forces all bookings to be done before we continue
      mergeMap((bookings: any) => {
        info('All bookings are now added to queue:', bookings.length)
        return this.fleets.pipe(
          mergeMap((fleet: any) =>
            this.settings.optimizedRoutes
              ? fleet.startDispatcher()
              : fleet.startStandardDispatcher()
          )
        )
      }),
      catchError((err: any) => {
        error('dispatchedBookings:', err)
        throw err
      })
    )
  }
}

// Export as CommonJS and TS module
export = Municipality

// CommonJS fallback for non-TS environments
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = Municipality
