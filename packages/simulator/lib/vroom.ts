import fetch, { Response } from 'node-fetch'
import moment from 'moment'
import { debug, error, info } from './log'
import { getFromCache, updateCache } from './cache'
import queue from './queueSubject'

// eslint-disable-next-line no-undef
const vroomUrl: string =
  process.env.VROOM_URL || 'https://vroom.telge.iteam.pub/'

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export interface Shipment {
  id: number
  amount: number[]
  pickup: {
    id: number
    time_windows?: [number, number][]
    location: [number, number]
  }
  delivery: {
    id: number
    location: [number, number]
    time_windows?: [number, number][]
  }
  service: number
}

export interface Job {
  id: number
  location: [number, number]
  pickup: number[]
}

export interface Vehicle {
  id: number
  time_window: [number, number]
  capacity: number[]
  start: [number, number]
  end: [number, number]
}

export interface PlanInput {
  jobs?: Job[]
  shipments?: Shipment[]
  vehicles: Vehicle[]
}

async function plan(
  { jobs = [], shipments = [], vehicles }: PlanInput,
  retryCount = 0
): Promise<any> {
  info('Vroom plan', jobs?.length, shipments?.length, vehicles?.length)
  if (jobs?.length > 200) throw new Error('Too many jobs to plan')
  if (shipments?.length > 200) throw new Error('Too many shipments to plan')
  if (vehicles.length > 200) throw new Error('Too many vehicles to plan')

  const cached = await getFromCache({ jobs, shipments, vehicles })
  if (cached) {
    debug('Vroom cache hit')
    return cached
  }
  debug('Vroom cache miss')

  const before = Date.now()
  const interval = setInterval(() => {
    info(
      `${
        shipments?.length || 0 + jobs?.length || 0
      }: Vroom still planning... ${Math.round((Date.now() - before) / 1000)}s`
    )
  }, 1000)

  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('VROOM timeout after 30 seconds')),
        30000
      )
    })

    const vroomPromise = queue(() =>
      fetch(vroomUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobs,
          shipments,
          vehicles,
          options: { plan: true },
        }),
      }).then(async (res: Response) => {
        if (!res.ok) {
          throw new Error('Vroom error: ' + (await res.text()))
        }
        return res.json()
      })
    )

    const json = await Promise.race([vroomPromise, timeoutPromise])

    clearInterval(interval)
    info(`${shipments?.length || 0 + jobs?.length || 0}: Vroom done!`)
    if (Date.now() - before > 10_000) {
      return updateCache({ jobs, shipments, vehicles }, json)
    }
    return json
  } catch (vroomError) {
    clearInterval(interval)
    error('Vroom error', vroomError)
    info('Jobs', jobs?.length)
    info('Shipments', shipments?.length)
    info('Vehicles', vehicles?.length)

    if (retryCount < 3) {
      info(`Retrying VROOM (attempt ${retryCount + 1}/3)...`)
      await delay(2000)
      return plan({ jobs, shipments, vehicles }, retryCount + 1)
    } else {
      error('Max VROOM retries reached, giving up', vroomError)
      throw vroomError
    }
  }
}

function bookingToShipment(
  { id, pickup, destination, groupedBookings }: any,
  i: number
): Shipment {
  return {
    id: i,
    amount: [groupedBookings?.length || 1],
    pickup: {
      id: i,
      time_windows: pickup.departureTime?.length
        ? [
            [
              moment(pickup.departureTime, 'hh:mm:ss').unix(),
              moment(pickup.departureTime, 'hh:mm:ss').add(5, 'minutes').unix(),
            ],
          ]
        : undefined,
      location: [pickup.position.lon, pickup.position.lat],
    },
    delivery: {
      id: i,
      location: [destination.position.lon, destination.position.lat],
      time_windows: destination.arrivalTime?.length
        ? [
            [
              moment(destination.arrivalTime, 'hh:mm:ss').unix(),
              moment(destination.arrivalTime, 'hh:mm:ss')
                .add(5, 'minutes')
                .unix(),
            ],
          ]
        : undefined,
    },
    service: 30,
  }
}

function bookingToJob({ pickup, groupedBookings }: any, i: number): Job {
  return {
    id: i,
    location: [pickup.position.lon, pickup.position.lat],
    pickup: [groupedBookings?.length || 1],
  }
}

function truckToVehicle(
  { position, parcelCapacity, destination, cargo }: any,
  i: number
): Vehicle {
  return {
    id: i,
    time_window: [
      moment('08:00:00', 'hh:mm:ss').unix(),
      moment('17:00:00', 'hh:mm:ss').unix(),
    ],
    capacity: [parcelCapacity - cargo.length],
    start: [position.lon, position.lat],
    end: destination
      ? [destination.lon, destination.lat]
      : [position.lon, position.lat],
  }
}

export default {
  bookingToShipment,
  bookingToJob,
  truckToVehicle,
  plan,
}

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = {
    bookingToShipment,
    bookingToJob,
    truckToVehicle,
    plan,
  }
}
