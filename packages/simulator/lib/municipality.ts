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
  public experimentId: any

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
    experimentId,
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
    this.experimentId = experimentId
    const fleetExperimentId = this.experimentId || this.id

    this.fleets = from(this.fleetsConfig).pipe(
      map(
        ({ name, recyclingTypes, vehicles, hubAddress }: any, i: number) =>
          new Fleet({
            id: i,
            experimentId: fleetExperimentId,
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

      toArray(),
      mergeMap((bookings: any) => {
        info('All bookings are now added to queue:', bookings.length)
        return this.fleets.pipe(
          mergeMap((fleet: any) => {
            return this.settings?.replayExperiment
              ? fleet.startReplayDispatcher(this.settings.replayExperiment)
              : this.settings?.optimizedRoutes
              ? fleet.startVroomDispatcher()
              : fleet.startStandardDispatcher()
          })
        )
      }),
      catchError((err: any) => {
        error('dispatchedBookings:', err)
        throw err
      })
    )
  }
}

export = Municipality
if (typeof module !== 'undefined') module.exports = Municipality
