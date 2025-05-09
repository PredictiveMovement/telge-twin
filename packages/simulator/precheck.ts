import { firstValueFrom, mergeMap, map, toArray, pipe } from 'rxjs'
import assert from 'assert'
import { read as readConfig } from './config'

const config = readConfig()
console.log('Checking for preconditions...', config)

const pick = (key: string) =>
  pipe(
    map((obj: any) => obj[key]),
    toArray()
  )

async function precheck() {
  console.log('Checking regions...')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const regions = require('./streams/regions')(config)
  console.log('✅ Regions:', await firstValueFrom(regions.pipe(pick('name'))))

  console.log('Checking municipalities...')
  const municipalities = regions.pipe(
    mergeMap((region: any) => region.municipalities)
  )
  const recievedMuns = (await firstValueFrom(
    municipalities.pipe(pick('name'))
  )) as any[]
  assert(recievedMuns.length > 0, '❌ No municipalities found')
  console.log('✅ Municipalities:', recievedMuns.join(', '))

  console.log('Checking fleets...')
  const fleets = municipalities.pipe(
    mergeMap((municipality: any) => municipality.fleets)
  )
  const recievedFleets = (await firstValueFrom(
    fleets.pipe(pick('name'))
  )) as any[]
  assert(recievedFleets.length > 0, '❌ No fleets found')
  console.log('✅ Fleets:', recievedFleets.join(', '))

  console.log('Checking bookings...')
  const bookings = regions.pipe(
    mergeMap((region: any) => region.dispatchedBookings)
  )
  const recievedBookings = (await firstValueFrom(
    bookings.pipe(pick('id'))
  )) as any[]
  assert(recievedBookings.length > 0, '❌ No bookings found')
  console.log('✅ Bookings:', recievedBookings.length)

  console.log('Checking cars...')
  const cars = regions.pipe(mergeMap((region: any) => region.cars))
  const recievedCars = (await firstValueFrom(cars.pipe(pick('id')))) as any[]
  assert(recievedCars.length > 0, '❌ No cars found')
  console.log('✅ Cars:', recievedCars.length)
}

precheck()
