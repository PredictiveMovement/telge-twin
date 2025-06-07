const {
  from,
  shareReplay,
  Subject,
  mergeMap,
  catchError,
  tap,
  toArray,
  ReplaySubject,
  map,
} = require('rxjs')
import Fleet from './fleet'
import Booking from './models/booking'
import Position from './models/position'
const { error, info } = require('./log')
const { safeId } = require('./id')

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
    center,
    bookings = from([]),
    privateCars,
    citizens,
    fleetsConfig,
    settings,
    preAssignedBookings,
    experimentId,
  }: any) {
    info('📋 Municipality config:', {
      name,
      experimentId,
      fleetsConfigType: typeof fleetsConfig,
      fleetsConfigCount: Array.isArray(fleetsConfig)
        ? fleetsConfig.length
        : 'not array',
      preAssignedBookingsProvided: !!preAssignedBookings,
      settingsProvided: !!settings,
    })

    if (Array.isArray(fleetsConfig)) {
      info(
        '🚛 Fleet configs received:',
        fleetsConfig.map((fleet: any) => ({
          name: fleet.name,
          vehicleCount: fleet.vehicles?.length || 0,
          recyclingTypes: fleet.recyclingTypes,
          bookingCount: fleet.bookingCount,
          preAssignedBookingsKeys: Object.keys(fleet.preAssignedBookings || {}),
          vehicles: fleet.vehicles?.map((v: any) => ({
            originalId: v.originalId,
            type: v.type,
            description: v.description,
          })),
        }))
      )
    }

    this.squares = []
    this.geometry = geometry
    this.name = name
    this.id = safeId(name)
    this.center = center
    this.bookings = bookings
    this.privateCars = privateCars || new ReplaySubject()
    this.unhandledBookings = new Subject()
    this.nrOfBookings = 0
    this.co2 = 0
    this.citizens = citizens
    this.fleetsConfig = fleetsConfig
    this.settings = settings
    this.experimentId = experimentId

    const fleetExperimentId = this.experimentId || this.id

    info('🏭 Creating fleets from config...')
    this.fleets = from(this.fleetsConfig).pipe(
      map(
        (
          { name, recyclingTypes, vehicles, preAssignedBookings }: any,
          i: number
        ) => {
          return new Fleet({
            id: i.toString(),
            experimentId: fleetExperimentId,
            name: name,
            hub: this.center,
            vehicles: vehicles,
            recyclingTypes: recyclingTypes,
            preAssignedBookings: preAssignedBookings,
            settings: this.settings,
          })
        }
      ),
      tap((fleet: any) =>
        info(
          `✅ Fleet skapad: ${fleet.name} med ${fleet.vehiclesCount} fordon för [${fleet.recyclingTypes}]`
        )
      ),
      catchError((err: any) => {
        error('Fleet creation error:', err)
        throw err
      }),
      shareReplay()
    )

    this.cars = this.fleets.pipe(mergeMap((fleet: any) => fleet.cars))

    this.dispatchedBookings = this.fleets.pipe(
      toArray(),
      mergeMap((fleets: any[]) => {
        info('🎯 Använder pre-assigned booking system för alla fleets')
        return this.handlePreAssignedBookings(fleets)
      }),
      catchError((err: any) => {
        error('dispatchedBookings:', err)
        throw err
      })
    )
  }

  handlePreAssignedBookings(fleets: any[]) {
    info('🚀 Startar pre-assigned booking hantering för waste-type fleets')

    const allCreatedBookings: any[] = []

    return from(fleets).pipe(
      mergeMap((fleet: any) => {
        const preAssignedBookings = fleet.preAssignedBookings || {}
        const vehicleIds = Object.keys(preAssignedBookings)

        info(
          `Fleet ${fleet.name}: ${vehicleIds.length} fordon med förförderade bokningar`
        )

        vehicleIds.forEach((vehicleId) => {
          const standardizedBookings = preAssignedBookings[vehicleId]
          standardizedBookings.forEach((standardizedBooking: any) => {
            const pickupLat =
              standardizedBooking.pickup?.lat ||
              standardizedBooking.position?.lat
            const pickupLng =
              standardizedBooking.pickup?.lng ||
              standardizedBooking.position?.lng

            if (
              !pickupLat ||
              !pickupLng ||
              typeof pickupLat !== 'number' ||
              typeof pickupLng !== 'number'
            ) {
              error(
                `❌ Invalid coordinates for booking ${standardizedBooking.id}:`,
                {
                  lat: pickupLat,
                  lng: pickupLng,
                }
              )
              return
            }

            if (
              pickupLat < 55 ||
              pickupLat > 70 ||
              pickupLng < 10 ||
              pickupLng > 25
            ) {
              error(
                `⚠️ Coordinates outside Sweden bounds for booking ${standardizedBooking.id}:`,
                {
                  lat: pickupLat,
                  lng: pickupLng,
                }
              )
            }

            const destinationLat =
              standardizedBooking.destination?.lat || 59.135449
            const destinationLng =
              standardizedBooking.destination?.lng || 17.571239
            const destinationName =
              standardizedBooking.destination?.name ||
              'LERHAGA 50, 151 66 Södertälje'

            const properBooking = new Booking({
              id: standardizedBooking.id,
              bookingId: standardizedBooking.id,
              recyclingType: standardizedBooking.recyclingType,
              type: standardizedBooking.recyclingType,
              sender: standardizedBooking.sender || fleet.name,
              pickup: {
                position: new Position({
                  lat: Number(pickupLat.toFixed(6)),
                  lng: Number(pickupLng.toFixed(6)),
                }),
                name:
                  standardizedBooking.pickup?.name ||
                  `Pickup for ${standardizedBooking.recyclingType}`,
                departureTime:
                  standardizedBooking.pickup?.departureTime || '08:00:00',
              },
              destination: {
                position: new Position({
                  lat: Number(destinationLat.toFixed(6)),
                  lng: Number(destinationLng.toFixed(6)),
                }),
                name: destinationName,
                arrivalTime: '17:00:00',
              },
              carId: vehicleId,
              order: standardizedBooking.order || '0',
            })

            properBooking.weight = standardizedBooking.weight || 10

            properBooking.origin = fleet.name
            ;(properBooking as any).originalRecord =
              standardizedBooking.originalRecord
            ;(properBooking as any).vehicleId = vehicleId
            ;(properBooking as any).originalVehicleId = vehicleId
            ;(properBooking as any).serviceType =
              standardizedBooking.serviceType || 'standard'

            allCreatedBookings.push(properBooking)

            fleet.handleBooking(properBooking)
            this.nrOfBookings++
          })
        })

        const dispatcherStream = this.settings?.replayExperiment
          ? fleet.startReplayDispatcher(this.settings.replayExperiment)
          : fleet.startDispatcher()

        console.log('🏗️ Fleet dispatcher stream created for:', fleet.name)
        return dispatcherStream
      })
    )
  }
}

export = Municipality
if (typeof module !== 'undefined') module.exports = Municipality
