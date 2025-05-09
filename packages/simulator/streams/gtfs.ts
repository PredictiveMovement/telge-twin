import fs from 'fs'
import path from 'path'
import { info, error, debug } from '../lib/log'
import AdmZip from 'adm-zip'
import fetch from 'node-fetch'
import { shareReplay, Observable } from 'rxjs'
import { map, toArray, groupBy, mergeMap, filter } from 'rxjs/operators'
import csv from 'csv-stream'
import Position from '../lib/models/position'

const key: string =
  process.env.TRAFIKLAB_KEY || '62262314de784de6847954de884334f1'

const MONTH = 1000 * 60 * 60 * 24 * 30

// -----------------------------------------------------------------------------
// Types representing the various GTFS rows we care about
// -----------------------------------------------------------------------------

interface StopRow {
  stop_id: string
  stop_name: string
  stop_lat: string
  stop_lon: string
  parent_station: string
  platform_code: string
}

interface TripRow {
  trip_id: string
  service_id: string
  trip_headsign: string
  route_id: string
}

interface RouteRow {
  route_id: string
  route_short_name: string
  route_desc: string
}

interface CalendarDateRow {
  service_id: string
  date: string
  exception_type: string
}

interface StopTimeRow {
  stop_id: string
  stop_headsign: string
  trip_id: string
  arrival_time: string
  departure_time: string
}

// -----------------------------------------------------------------------------
// Utility helpers
// -----------------------------------------------------------------------------

const downloadIfNotExists = (operator: string): Promise<string> => {
  const zipFile = path.join(__dirname, `../data/${operator}.zip`)
  return new Promise((resolve, reject) => {
    const url = `https://opendata.samtrafiken.se/gtfs/${operator}/${operator}.zip?key=${key}`
    const zipFileAge = fs.existsSync(zipFile)
      ? Date.now() - fs.statSync(zipFile).mtimeMs
      : undefined
    const zipFileSize = fs.existsSync(zipFile)
      ? fs.statSync(zipFile).size
      : undefined
    if (
      !fs.existsSync(zipFile) ||
      (zipFileSize ?? 0) < 5000 ||
      (zipFileAge ?? 0) > MONTH
    ) {
      const stream = fs.createWriteStream(zipFile)
      info('Downloading GTFS', url)
      fetch(url)
        .then((res: unknown) =>
          (res as { body: NodeJS.ReadableStream | null }).body
            ?.pipe(stream)
            .on('finish', () => {
              info('Downloaded GTFS')
              resolve(zipFile)
            })
            .on('error', (err: unknown) => {
              error('Error downloading GTFS', err as Error)
              reject(err)
            })
        )
        .catch(
          (err: unknown) => (
            error('Error fetching GTFS', err as Error), reject(err)
          )
        )
    } else {
      resolve(zipFile)
    }
  })
}

const downloadAndExtractIfNotExists = async (
  operator: string
): Promise<string | undefined> => {
  try {
    const zipFile = await downloadIfNotExists(operator)
    const outPath = path.join(__dirname, `../.cache/${operator}`)
    const zip = new AdmZip(zipFile)
    if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true })
    zip.extractAllTo(outPath, true)
    return zipFile
  } catch (err: unknown) {
    error('Error when unpacking GTFS file', err as Error)
    return undefined
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function gtfs(operator: string) {
  const download = downloadAndExtractIfNotExists(operator)

  const gtfsStream = <TRow>(file: string): Observable<TRow> => {
    return new Observable<TRow>((observer) => {
      download.then(() => {
        const csvStream = fs
          .createReadStream(
            path.join(__dirname, `../.cache/${operator}/${file}.txt`)
          )
          .pipe(csv.createStream({ enclosedChar: '"' }))
        csvStream.on('data', (data: TRow) => observer.next(data))
        csvStream.on('end', () => observer.complete())
        csvStream.on('finish', () => {
          info(`FINISH ${file}`)
          observer.complete()
        })
      })
    })
  }

  const stops = gtfsStream<StopRow>('stops').pipe(
    map(
      ({
        stop_id,
        stop_name,
        stop_lat,
        stop_lon,
        parent_station,
        platform_code,
      }) => ({
        id: stop_id,
        name: stop_name,
        position: new Position({ lat: +stop_lat, lon: +stop_lon }),
        station: parent_station,
        platform: platform_code,
      })
    ),
    shareReplay()
  )

  const trips = gtfsStream<TripRow>('trips').pipe(
    map(({ trip_id, service_id, trip_headsign, route_id }) => ({
      id: trip_id,
      serviceId: service_id,
      headsign: trip_headsign,
      routeId: route_id,
    })),
    shareReplay()
  )

  const routeNames = gtfsStream<RouteRow>('routes').pipe(
    map(({ route_id, route_short_name }) => ({
      id: route_id,
      lineNumber: route_short_name,
    })),
    shareReplay()
  )

  const excludedLineNumbers = gtfsStream<RouteRow>('routes').pipe(
    map(({ route_id, route_short_name, route_desc }) => ({
      id: route_id,
      lineNumber: route_short_name,
      description: route_desc,
    })),
    filter((route) => {
      switch (route.description) {
        case 'ForSea':
        case 'Krösatåg':
        case 'Närtrafik':
        case 'Plusresor':
        case 'Pågatåg':
        case 'PågatågExpress':
        case 'Spårvagn':
        case 'TEB planerad':
        case 'VEN trafiken':
        case 'Öresundståg':
          debug(
            `Excluding route ${route.lineNumber} (${route.id}). Reason: ${route.description}`
          )
          return true
        default:
          return false
      }
    }),
    map((route) => route.lineNumber),
    shareReplay()
  )

  const serviceDates = gtfsStream<CalendarDateRow>('calendar_dates').pipe(
    map(({ service_id, date, exception_type }) => ({
      serviceId: service_id,
      date,
      exceptionType: exception_type,
    })),
    groupBy((x) => x.date),
    map((group) => ({ date: group.key, services: group })),
    mergeMap((group) =>
      group.services.pipe(
        toArray(),
        map((services) => ({
          date: group.date,
          services: services.map((x) => x.serviceId),
        }))
      )
    ),
    shareReplay()
  )

  const correctTime = (time: string): Date => {
    const now = new Date()
    const [hour, minute, second] = time.split(':').map(Number)
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      second
    )
  }

  const busStops = gtfsStream<StopTimeRow>('stop_times').pipe(
    map(
      ({ stop_id, stop_headsign, trip_id, arrival_time, departure_time }) => ({
        stopId: stop_id,
        tripId: trip_id,
        arrivalTime: correctTime(arrival_time),
        departureTime: correctTime(departure_time),
        finalStop: stop_headsign,
      })
    ),
    shareReplay()
  )

  return {
    busStops,
    stops,
    trips,
    serviceDates,
    routeNames,
    excludedLineNumbers,
  }
}

export default gtfs
