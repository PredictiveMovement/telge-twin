const {
  from,
  shareReplay,
  Subject,
  mergeMap,
  catchError,
  toArray,
  ReplaySubject,
  map,
} = require('rxjs')
import Fleet from './fleet'
import Booking from './models/booking'
import Position from './models/position'
import { extractOriginalData } from './types/originalBookingData'
const { error } = require('./log')
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
  public virtualTime: any

  constructor({
    geometry,
    name,
    center,
    bookings = from([]),
    privateCars,
    citizens,
    fleetsConfig,
    settings,
    experimentId,
    virtualTime,
  }: any) {
    // Removed verbose creation log

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
    this.virtualTime = virtualTime

    const fleetExperimentId = this.experimentId || this.id

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
            experimentType: this.settings?.experimentType || 'vroom',
            virtualTime: this.virtualTime,
          })
        }
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
        return this.handlePreAssignedBookings(fleets)
      }),
      catchError((err: any) => {
        error('dispatchedBookings:', err)
        throw err
      })
    )
  }

  handlePreAssignedBookings(fleets: any[]) {
    const allCreatedBookings: any[] = []

    return from(fleets).pipe(
      mergeMap((fleet: any) => {
        const preAssignedBookings = fleet.preAssignedBookings || {}
        const vehicleIds = Object.keys(preAssignedBookings)

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
              error(`Invalid coordinates for booking ${standardizedBooking.id}`)
              return
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
              turordningsnr:
                standardizedBooking.originalData?.originalTurordningsnr ||
                standardizedBooking.originalTurordningsnr ||
                standardizedBooking.Turordningsnr,
              originalData: extractOriginalData(standardizedBooking),
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

        let dispatcherStream
        if (this.settings?.experimentType === 'replay') {
          dispatcherStream = fleet.startReplayDispatcher(
            this.settings.replayExperiment
          )
        } else if (this.settings?.experimentType === 'vroom') {
          dispatcherStream = fleet.startVroomDispatcher()
        } else {
          dispatcherStream = fleet.startStandardDispatcher()
        }

        return dispatcherStream
      })
    )
  }
}

export = Municipality
if (typeof module !== 'undefined') module.exports = Municipality
