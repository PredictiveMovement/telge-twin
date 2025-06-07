import fetch, { Response } from 'node-fetch'
import moment from 'moment'
import { error, info } from './log'
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
  if (jobs?.length > 200) throw new Error('Too many jobs to plan')
  if (shipments?.length > 200) throw new Error('Too many shipments to plan')
  if (vehicles.length > 200) throw new Error('Too many vehicles to plan')

  const cached = await getFromCache({ jobs, shipments, vehicles })
  if (cached) {
    return cached
  }

  const before = Date.now()
  const interval = setInterval(() => {
    info(`VROOM still planning... ${Math.round((Date.now() - before) / 1000)}s`)
  }, 5000)

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
          const errorText = await res.text()
          error(`VROOM HTTP ${res.status} error:`, errorText)
          throw new Error(`Vroom HTTP ${res.status}: ${errorText}`)
        }
        return res.json()
      })
    )

    const json = await Promise.race([vroomPromise, timeoutPromise])

    clearInterval(interval)

    return updateCache({ jobs, shipments, vehicles }, json)
  } catch (vroomError) {
    clearInterval(interval)
    error('Vroom error', vroomError)

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
  const pickupLon = pickup.position.lon || pickup.position.lng
  const pickupLat = pickup.position.lat
  const deliveryLon = destination.position.lon || destination.position.lng
  const deliveryLat = destination.position.lat

  if (!pickupLon || !pickupLat || isNaN(pickupLon) || isNaN(pickupLat)) {
    error(`Invalid pickup coordinates for booking ${id}:`, {
      pickupLon,
      pickupLat,
      pickup,
    })
  }
  if (
    !deliveryLon ||
    !deliveryLat ||
    isNaN(deliveryLon) ||
    isNaN(deliveryLat)
  ) {
    error(`Invalid delivery coordinates for booking ${id}:`, {
      deliveryLon,
      deliveryLat,
      destination,
    })
  }

  const now = moment()
  const pickupStart = now.clone().add(30, 'minutes')
  const pickupEnd = pickupStart.clone().add(30, 'minutes')
  const deliveryStart = now.clone().add(2, 'hours')
  const deliveryEnd = deliveryStart.clone().add(30, 'minutes')

  return {
    id: i,
    amount: [groupedBookings?.length || 1],
    pickup: {
      id: i * 2,
      time_windows: [[pickupStart.unix(), pickupEnd.unix()]],
      location: [pickupLon, pickupLat],
    },
    delivery: {
      id: i * 2 + 1,
      location: [deliveryLon, deliveryLat],
      time_windows: [[deliveryStart.unix(), deliveryEnd.unix()]],
    },
    service: 30,
  }
}

function bookingToJob({ pickup, groupedBookings }: any, i: number): Job {
  return {
    id: i,
    location: [pickup.position.lon || pickup.position.lng, pickup.position.lat],
    pickup: [groupedBookings?.length || 1],
  }
}

function truckToVehicle(
  { position, parcelCapacity, destination, cargo }: any,
  i: number
): Vehicle {
  const now = moment()
  const workStart = now.clone()
  const workEnd = now.clone().add(8, 'hours')

  return {
    id: i,
    time_window: [workStart.unix(), workEnd.unix()],
    capacity: [parcelCapacity - cargo.length],
    start: [position.lon || position.lng, position.lat],
    end: destination
      ? [destination.lon || destination.lng, destination.lat]
      : [position.lon || position.lng, position.lat],
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
