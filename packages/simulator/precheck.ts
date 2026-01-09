import { firstValueFrom, mergeMap, map, toArray, pipe } from 'rxjs'
import assert from 'assert'
import { read as readConfig } from './config'
import { info } from './lib/log'

const config = readConfig()
info('Checking for preconditions...', config)

const pick = (key: string) =>
  pipe(
    map((obj: any) => obj[key]),
    toArray()
  )

async function precheck() {
  info('Checking regions...')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const regions = require('./streams/regions')(config)
  info('✅ Regions:', await firstValueFrom(regions.pipe(pick('name'))))

  info('Checking municipalities...')
  const municipalities = regions.pipe(
    mergeMap((region: any) => region.municipalities)
  )
  const recievedMuns = (await firstValueFrom(
    municipalities.pipe(pick('name'))
  )) as any[]
  assert(recievedMuns.length > 0, '❌ No municipalities found')
  info('✅ Municipalities:', recievedMuns.join(', '))

  info('Checking fleets...')
  const fleets = municipalities.pipe(
    mergeMap((municipality: any) => municipality.fleets)
  )
  const recievedFleets = (await firstValueFrom(
    fleets.pipe(pick('name'))
  )) as any[]
  assert(recievedFleets.length > 0, '❌ No fleets found')
  info('✅ Fleets:', recievedFleets.join(', '))

  info('Checking bookings...')
  const bookings = regions.pipe(
    mergeMap((region: any) => region.dispatchedBookings)
  )
  const recievedBookings = (await firstValueFrom(
    bookings.pipe(pick('id'))
  )) as any[]
  assert(recievedBookings.length > 0, '❌ No bookings found')
  info('✅ Bookings:', recievedBookings.length)

  info('Checking cars...')
  const cars = regions.pipe(mergeMap((region: any) => region.cars))
  const recievedCars = (await firstValueFrom(cars.pipe(pick('id')))) as any[]
  assert(recievedCars.length > 0, '❌ No cars found')
  info('✅ Cars:', recievedCars.length)
}

precheck()
