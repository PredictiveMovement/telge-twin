import { from, Observable, ObservableInput } from 'rxjs'
import {
  map,
  mergeMap,
  catchError,
  filter,
  shareReplay,
  tap,
} from 'rxjs/operators'
import Position from '../../lib/models/position'
import Booking, { BookingInput, Place } from '../../lib/models/booking'
import { error, info } from '../../lib/log'
import Pelias = require('../../lib/pelias')
import { read as readConfig } from '../../config'
import { Client } from '@elastic/elasticsearch'

// -----------------------------------------------------------------------------
// Constants & Types
// -----------------------------------------------------------------------------

const LERHAGA_POSITION = new Position({ lat: 59.135449, lon: 17.571239 })

interface RawTelgeRecord {
  Turid: string
  Datum: string
  Tjtyp: string
  Lat: number
  Lng: number
  Bil: string
  Turordningsnr: string
  Avftyp: string
}

type BaseRow = Omit<BookingInput, 'pickup' | 'destination'>

type PreparedRow = BaseRow & {
  id: string
  pickup: Place
  destination: Place
  serviceType: string
  carId: string
  order: string
  recyclingType: string
}

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
})

async function loadRouteData(parameters: any): Promise<any[]> {
  try {
    if (
      parameters.routeDataSource === 'elasticsearch' &&
      parameters.sourceDatasetId
    ) {
      const response = await client.get({
        index: 'route-datasets',
        id: parameters.sourceDatasetId,
      })

      return response.body._source.routeData || []
    }

    console.warn('No route data found, using empty array')
    return []
  } catch (error) {
    console.error('Error loading route data:', error)
    return []
  }
}

/**
 * Build a Booking stream for Telge recycling pickups.
 */
export default function createBookingStream(
  experimentParameters?: any
): Observable<Booking> {
  const parameters = experimentParameters || readConfig()

  const processData = (
    source$: ObservableInput<RawTelgeRecord>
  ): Observable<PreparedRow> => {
    return (source$ as Observable<RawTelgeRecord>).pipe(
      map(
        ({
          Turid: id,
          Datum: pickupDate,
          Tjtyp: serviceType,
          Lat: lat,
          Lng: lon,
          Bil: carId,
          Turordningsnr: order,
          Avftyp: recyclingType,
        }) =>
          ({
            id,
            pickup: {
              name: serviceType,
              date: pickupDate,
              position: new Position({ lat, lon }),
            },
            weight: 10,
            sender: 'TELGE',
            serviceType,
            carId: carId.trim(),
            order,
            recyclingType,
            destination: {
              name: 'LERHAGA 50, 151 66 Södertälje',
              position: LERHAGA_POSITION,
            },
          } as PreparedRow)
      ),
      filter((row) => row.pickup.position.isValid()),
      mergeMap(async (row: PreparedRow): Promise<PreparedRow> => {
        try {
          const pickupLocation = await Pelias.nearest(
            row.pickup.position,
            'address'
          )
          return {
            ...row,
            pickup: {
              ...row.pickup,
              postalcode: pickupLocation?.postalcode ?? '',
            },
          }
        } catch (err) {
          error(
            `Error fetching nearest address for row ${row.id}:`,
            err as Error
          )
          return row
        }
      })
    )
  }

  const loadData = (): Observable<PreparedRow> => {
    return new Observable<PreparedRow>((subscriber) => {
      loadRouteData(parameters)
        .then((routeData: RawTelgeRecord[]) => {
          if (!routeData || routeData.length === 0) {
            info('No route data found, using empty dataset')
            subscriber.complete()
            return
          }

          info(`Processing ${routeData.length} route records`)

          from(routeData)
            .pipe(
              tap(() =>
                info('Processing route data. This might take a few minutes...')
              ),
              mergeMap((record) => processData(from([record])))
            )
            .subscribe({
              next: (row) => subscriber.next(row),
              error: (err) => subscriber.error(err),
              complete: () => subscriber.complete(),
            })
        })
        .catch((err) => {
          error('Failed to load route data', err as Error)
          subscriber.complete()
        })
    })
  }

  return loadData().pipe(
    map(
      (row, i) => new Booking({ type: 'recycle', ...row, bookingId: String(i) })
    ),
    shareReplay(),
    catchError((err) => {
      error('TELGE -> Error processing data', err as Error)
      return from([] as Booking[])
    })
  )
}
