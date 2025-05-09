// @ts-nocheck
import osrm from '../lib/osrm'
import assert from 'assert'
import Position from '../lib/models/position'
import { addMeters } from '../lib/distance'
import fetch, { Response } from 'node-fetch'
import { error } from '../lib/log'

const streamsUrl =
  process.env.STREAMS_URL || 'https://streams.telge.iteam.pub/addresses'

export function getAddressesInBoundingBox(
  topLeft: { lon: number; lat: number },
  bottomRight: { lon: number; lat: number },
  size = 10,
  layers = 'venue'
): Promise<any[]> {
  const url = `${streamsUrl}/box?tl=${topLeft.lon},${topLeft.lat}&br=${bottomRight.lon},${bottomRight.lat}&size=${size}&layers=${layers}`
  return fetch(url).then((res: Response) =>
    res.ok ? res.json() : Promise.reject(res.text())
  )
}

export function getAddressesInArea(
  position: { lon: number; lat: number },
  area: number,
  population: number
): Promise<any[]> {
  const topLeft = addMeters(position, { x: -area / 2, y: area / 2 })
  const bottomRight = addMeters(position, { x: area / 2, y: -area / 2 })
  return getAddressesInBoundingBox(topLeft, bottomRight, population).catch(
    async (err) => {
      await err
      error('Error fetching addresses', err, position, area, population)
      return []
    }
  )
}

export async function randomize(
  center: { lon: number; lat: number },
  retry = 20,
  radius = 500
): Promise<Position> {
  assert(center, 'Center is required')
  if (retry < 0) throw new Error('Randomize loop error')

  const randomPoint = {
    lon: center.lon + ((Math.random() - 0.5) * radius) / 20000,
    lat: center.lat + ((Math.random() - 0.5) * radius) / 50000,
  }
  const pos = await nearest(randomPoint)
  return pos ? pos : randomize(center, retry - 1, radius)
}

export async function nearest(position: {
  lon: number
  lat: number
}): Promise<Position | null> {
  assert(position.lon, 'Longitude required')
  assert(position.lat, 'Latitude required')
  const data = await osrm.nearest(position)
  if (!data?.waypoints?.length) return null
  const [lon, lat] = data.waypoints[0].location
  return new Position({ lon, lat })
}

export default {
  randomize,
  nearest,
  getAddressesInArea,
}

// CJS fallback
// @ts-ignore
if (typeof module !== 'undefined')
  module.exports = { randomize, nearest, getAddressesInArea }
