const nodeFetch = require('node-fetch')
const polyline = require('polyline')
const fs = require('fs').promises
const path = require('path')
const nodeCrypto = require('crypto')

const osrmUrl = process.env.OSRM_URL || 'https://osrm.telge.iteam.pub'
const { warn, write } = require('./log')
const queue = require('./queueSubject')

const decodePolyline = function (geometry: any) {
  return polyline.decode(geometry).map((point: any) => ({
    lat: point[0],
    lon: point[1],
  }))
}

const encodePolyline = function (geometry: any) {
  return polyline.encode(geometry.map(({ lat, lon }: any) => [lat, lon]))
}

const CACHE_DIR = path.join(__dirname, '../.cache/osrm')

// Ensure cache directory exists
fs.mkdir(CACHE_DIR, { recursive: true }).catch(console.error)

function generateCacheKey(method: string, params: any) {
  const hash = nodeCrypto.createHash('md5')
  hash.update(`${method}:${JSON.stringify(params)}`)
  return hash.digest('hex')
}

async function getFromCache(cacheKey: string) {
  try {
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`)
    const data = await fs.readFile(cacheFile, 'utf8')
    return JSON.parse(data)
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error('Cache read error:', error)
    }
    return null
  }
}

async function saveToCache(cacheKey: string, data: any) {
  try {
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`)
    await fs.writeFile(cacheFile, JSON.stringify(data))
  } catch (error) {
    console.error('Cache write error:', error)
  }
}

async function cachedFetch(
  method: string,
  params: any,
  fetchFunc: () => Promise<any>
) {
  const cacheKey = generateCacheKey(method, params)
  const cachedData = await getFromCache(cacheKey)

  if (cachedData) {
    return cachedData
  }

  const data = await fetchFunc()
  await saveToCache(cacheKey, data)
  return data
}

const osrm = {
  async route(from: any, to: any) {
    const coordinates = [
      [from.lon, from.lat],
      [to.lon, to.lat],
    ].join(';')

    return cachedFetch('route', { from, to }, () =>
      queue(() =>
        nodeFetch(
          `${osrmUrl}/route/v1/driving/${coordinates}?steps=true&alternatives=false&overview=full&annotations=true`
        )
          .then(
            (res: any) =>
              (res.ok && res.json()) ||
              res.text().then((text: any) => Promise.reject(text))
          )
          // fastest route
          .then(
            (result: any) =>
              result.routes &&
              result.routes.sort((a: any, b: any) => a.duration < b.duration)[0]
          )
          .then((route: any) => {
            if (!route) return {}

            route.geometry = { coordinates: decodePolyline(route.geometry) }
            return route
          })
      )
    )
  },

  async nearest(position: any) {
    const coordinates = [position.lon, position.lat].join(',')
    const url = `${osrmUrl}/nearest/v1/driving/${coordinates}`
    write('n')

    return cachedFetch('nearest', { position }, () =>
      nodeFetch(url).then(
        (response: any) => response.json(),
        (err: any) => {
          warn('OSRM fetch err', err.message, url)
          throw err
        }
      )
    )
  },

  async match(positions: any) {
    const coordinates = positions
      .map((pos: any) => [pos.position.lon, pos.position.lat].join(','))
      .join(';')
    const timestamps = positions
      .map((pos: any) => Math.round(+pos.date / 1000))
      .join(';')
    write('m')

    return cachedFetch('match', { positions }, () =>
      nodeFetch(
        `${osrmUrl}/match/v1/driving/${coordinates}?timestamps=${timestamps}&geometries=geojson&annotations=true&overview=full`
      )
        .then((response: any) => response.json())
        .then((route: any) => route)
    )
  },

  /**
   * Route through multiple waypoints and return total duration/distance.
   * Coordinates are [lon, lat] pairs. No geometry decoding — only summary.
   */
  async routeMultiWaypoint(
    coordinates: [number, number][]
  ): Promise<{ duration: number; distance: number }> {
    if (coordinates.length < 2) {
      return { duration: 0, distance: 0 }
    }

    return cachedFetch('routeMulti', { coordinates }, async () => {
      // Split into chunks to avoid 414 Request-URI Too Large.
      // Last coord of each chunk overlaps as first coord of the next
      // to keep the route continuous.
      const MAX_WAYPOINTS = 80
      const chunks: [number, number][][] = []
      for (let i = 0; i < coordinates.length; i += MAX_WAYPOINTS - 1) {
        chunks.push(coordinates.slice(i, i + MAX_WAYPOINTS))
      }

      let totalDuration = 0
      let totalDistance = 0

      for (const chunk of chunks) {
        if (chunk.length < 2) continue

        const coordString = chunk
          .map(([lon, lat]) => `${lon},${lat}`)
          .join(';')

        const result = await queue(() =>
          nodeFetch(
            `${osrmUrl}/route/v1/driving/${coordString}?overview=false&alternatives=false`
          ).then((res: any) =>
            res.ok
              ? res.json()
              : res.text().then((text: any) => Promise.reject(text))
          )
        )

        const route = result?.routes?.[0]
        if (route) {
          totalDuration += route.duration || 0
          totalDistance += route.distance || 0
        }
      }

      return { duration: totalDuration, distance: totalDistance }
    })
  },

  decodePolyline,
  encodePolyline,
}

export = osrm

if (typeof module !== 'undefined') module.exports = osrm
