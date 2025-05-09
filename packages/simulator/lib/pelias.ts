// @ts-nocheck
const fetch = require('node-fetch')
const { info, error, write, warn } = require('./log')
const Position = require('./models/position')
const peliasUrl = process.env.PELIAS_URL || 'https://pelias.telge.iteam.pub'
const queue = require('./queueSubject')
const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')

info('Pelias URL', peliasUrl)

const CACHE_DIR = path.join(__dirname, '../.cache/pelias')

// Ensure cache directory exists
fs.mkdir(CACHE_DIR, { recursive: true }).catch(console.error)

function generateCacheKey(method: string, params: any) {
  const hash = crypto.createHash('md5')
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
  if (data === undefined || data === null) return // don't cache empty results to avoid fs errors
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
  fetchFunc: () => Promise<any>,
  forceFetch = false
) {
  const cacheKey = generateCacheKey(method, params)

  if (!forceFetch) {
    const cachedData = await getFromCache(cacheKey)
    if (cachedData) {
      return cachedData
    }
  }
  const data = await fetchFunc()
  await saveToCache(cacheKey, data)
  return data
}

const nearest = (position: any, layers = 'address,venue') => {
  const { lon, lat } = position

  const url = `${peliasUrl}/v1/reverse?point.lat=${lat}&point.lon=${lon}&size=1&layers=${layers}`
  return cachedFetch('nearest', { position, layers }, () =>
    queue(() => fetch(url))
      .then((response: any) => {
        if (!response.ok) throw 'pelias error: ' + response.statusText
        return response.json()
      })
      .then((p: any) =>
        p.features[0]?.geometry?.coordinates?.length
          ? p
          : Promise.reject('No coordinates found' + position.toString())
      )
      .then(
        ({
          features: [
            {
              geometry,
              properties: {
                name,
                street,
                houseNumber,
                localadmin,
                label,
                postalcode,
              },
            } = {},
          ] = [],
        }: any) => ({
          name,
          street,
          houseNumber,
          label,
          localadmin,
          position: new Position({
            lon: geometry.coordinates[0],
            lat: geometry.coordinates[1],
          }),
          postalcode,
        })
      )
      .catch((e: any) => {
        const err = new Error().stack
        warn(`Pelias nearest failed\n${e}`)
        return null // propagate graceful failure so callers can filter it
      })
  )
}

const search = (
  name: string,
  near: any = null,
  layers = 'address,venue',
  size = 1000
) => {
  const encodedName = encodeURIComponent(name)
  const focus = near
    ? `&focus.point.lat=${near.lat}&focus.point.lon=${near.lon}&layers=${layers}`
    : ''
  const url = `${peliasUrl}/v1/search?text=${encodedName}${focus}&size=${size}`
  write('p')
  return cachedFetch('search', { name, near, layers, size }, () =>
    queue(() => fetch(url))
      .then((response: any) => {
        if (!response.ok) throw 'pelias error: ' + response.statusText
        return response.json()
      })
      .then((results: any) =>
        results.features
          .map(({ geometry, properties }: any = {}) => ({
            ...properties,
            position: new Position({
              lon: geometry.coordinates[0],
              lat: geometry.coordinates[1],
            }),
          }))
          .filter((p: any) => p.position.isValid())
      )
      .catch((e: any) => {
        const peliasError = new Error().stack
        error(`Error in pelias search\n${url}\n${peliasError}\n${e}\n\n`)
        return Promise.reject(new Error('Error in pelias', peliasError))
      })
  )
}

const memoryCache = new Map()

const searchOne = async (
  name: string,
  near: any = null,
  layers = 'address,venue'
) => {
  const cacheKey = !near && name + layers
  if (cacheKey && memoryCache.has(cacheKey)) return memoryCache.get(cacheKey)
  const results = await search(name, near, layers, 1)
  if (cacheKey) memoryCache.set(cacheKey, results[0])
  return results[0]
}

const Pelias = {
  nearest,
  search,
  searchOne,
}

// Export for TypeScript modules
export = Pelias

// CommonJS fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = Pelias
