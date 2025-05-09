import fs from 'fs'
import path from 'path'
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

/**
 * Build a Booking stream for Telge recycling pickups.
 */
export default function createBookingStream(): Observable<Booking> {
  const parameters = readConfig()
  const dataFile = parameters.selectedDataFile || 'ruttdata_2024-09-03.json'

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
    const uploadsPath = path.join(__dirname, '../../uploads', dataFile)
    const defaultPath = path.join(__dirname, '../../data/telge', dataFile)
    const fallbackPath = path.join(
      __dirname,
      '../../data/telge',
      'ruttdata_2024-09-03.json'
    )

    const dataFilePath = fs.existsSync(uploadsPath) ? uploadsPath : defaultPath

    try {
      info(`Loading data from ${dataFilePath}`)
      const jsonData: RawTelgeRecord[] = JSON.parse(
        fs.readFileSync(dataFilePath, 'utf8')
      )
      return processData(
        from(jsonData).pipe(
          tap(() =>
            info(
              `Processing data from ${dataFile}. This might take a few minutes...`
            )
          )
        )
      )
    } catch (err: unknown) {
      error(`Failed to load data file ${dataFile}`, err as Error)

      try {
        info(`Falling back to default data file at ${fallbackPath}`)
        const fallbackData: RawTelgeRecord[] = JSON.parse(
          fs.readFileSync(fallbackPath, 'utf8')
        )
        return processData(
          from(fallbackData).pipe(
            tap(() =>
              info(
                'Processing fallback data file. This might take a few minutes...'
              )
            )
          )
        )
      } catch (fallbackErr) {
        error(`Failed to load fallback data file`, fallbackErr as Error)
        return from([] as PreparedRow[])
      }
    }
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
