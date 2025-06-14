import * as turf from '@turf/turf'
import clustersDbscan from '@turf/clusters-dbscan'
import haversine from 'haversine-distance'
import { error, info } from './log'
import { save, search } from './elastic'
import { from, pipe, of } from 'rxjs'
import { map, mergeMap, groupBy, toArray } from 'rxjs/operators'
import { CLUSTERING_CONFIG } from './config'

export const haversineDistance = (
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
) => haversine([aLon, aLat], [bLon, bLat])

export const calculateCenter = (bookings: any[]) => {
  const { lat, lon } = bookings.reduce(
    (acc: any, b: any) => {
      acc.lat += b.pickup?.position?.lat || b.Lat
      acc.lon += b.pickup?.position?.lng || b.pickup?.position?.lon || b.Lng
      return acc
    },
    { lat: 0, lon: 0 }
  )
  const n = bookings.length || 1
  return { lat: lat / n, lng: lon / n }
}

export const calculateBoundingBox = (bookings: any[]) => {
  let minLat = 90,
    maxLat = -90,
    minLng = 180,
    maxLng = -180
  bookings.forEach((b) => {
    const la = b.pickup?.position?.lat || b.Lat
    const lo = b.pickup?.position?.lng || b.pickup?.position?.lon || b.Lng
    minLat = Math.min(minLat, la)
    maxLat = Math.max(maxLat, la)
    minLng = Math.min(minLng, lo)
    maxLng = Math.max(maxLng, lo)
  })
  return { minLat, maxLat, minLng, maxLng }
}

export function calculateCenters(groups: any) {
  return from(groups).pipe(
    map(({ postalCode, bookings }: any) => {
      const total = bookings.length
      const { lat, lon } = bookings.reduce(
        (acc: any, b: any) => {
          acc.lat += b.pickup?.position?.lat || 0
          acc.lon += b.pickup?.position?.lon || 0
          return acc
        },
        { lat: 0, lon: 0 }
      )
      const center = { lat: lat / total, lon: lon / total }
      return { postalCode, center, bookings }
    }),
    toArray()
  )
}

export function clusterByPostalCode(
  maxBookings = 100,
  maxUniquePostalCodes = 10
) {
  return pipe(
    groupBy((booking: any) => booking.postalcode),
    map((g: any) => ({ postalCode: g.key, bookings: g })),
    mergeMap((g: any) =>
      g.bookings.pipe(
        toArray(),
        map((b: any[]) => ({ ...g, bookings: b }))
      )
    ),
    toArray(),
    map((groups: any[]) =>
      groups.length <= maxUniquePostalCodes
        ? groups
        : groups
            .sort((a, b) => b.bookings.length - a.bookings.length)
            .slice(0, maxUniquePostalCodes)
    ),
    mergeMap((groups: any[]) => from(groups)),
    mergeMap(({ postalCode, bookings }: any) => {
      if (bookings.length <= maxBookings) return of({ postalCode, bookings })
      const chunks: any[] = []
      for (let i = 0; i < bookings.length; i += maxBookings) {
        chunks.push({
          postalCode: `${postalCode}-chunk-${Math.floor(i / maxBookings)}`,
          bookings: bookings.slice(i, i + maxBookings),
        })
      }
      return from(chunks)
    })
  )
}

const MAX_CLUSTER_SIZE = 150

function metersToKilometers(meters: number): number {
  return meters / 1000
}
function logDbscanResults(
  totalBookings: number,
  clusters: Record<number, any[]>,
  noiseCount: number,
  epsMeters: number
) {
  const clusterIds = Object.keys(clusters)
  const totalClustered = Object.values(clusters).reduce(
    (sum, bookings) => sum + bookings.length,
    0
  )

  info(`📊 DBSCAN clustering results:`)
  info(`   - Input bookings: ${totalBookings}`)
  info(
    `   - DBSCAN eps: ${epsMeters}m (${metersToKilometers(epsMeters).toFixed(
      3
    )}km)`
  )
  info(`   - MinSamples: ${CLUSTERING_CONFIG.DBSCAN_MIN_SAMPLES}`)
  info(`   - Clusters found: ${clusterIds.length}`)
  info(`   - Bookings clustered: ${totalClustered}`)
  info(`   - Noise points (outliers): ${noiseCount}`)
  info(
    `   - Clustering efficiency: ${(
      (totalClustered / totalBookings) *
      100
    ).toFixed(1)}%`
  )

  if (clusterIds.length > 0) {
    const clusterSizes = Object.values(clusters)
      .map((arr) => arr.length)
      .sort((a, b) => b - a)
    info(`   - Cluster sizes: ${clusterSizes.join(', ')}`)
    info(`   - Largest cluster: ${clusterSizes[0]} bookings`)
    info(
      `   - Smallest cluster: ${clusterSizes[clusterSizes.length - 1]} bookings`
    )
    info(
      `   - Average cluster size: ${Math.round(
        totalClustered / clusterIds.length
      )} bookings`
    )
  }

  if (noiseCount > totalBookings * 0.3) {
    info(
      `   ⚠️ Warning: High noise ratio (${(
        (noiseCount / totalBookings) *
        100
      ).toFixed(1)}%) - consider increasing eps parameter`
    )
  }
  if (clusterIds.length === 1 && totalBookings > 50) {
    info(
      `   ⚠️ Warning: Only one cluster found for ${totalBookings} bookings - consider decreasing eps parameter`
    )
  }
}
export interface AreaPartition {
  id: string
  bookings: any[]
  center: { lat: number; lng: number }
  boundingBox: {
    minLat: number
    maxLat: number
    minLng: number
    maxLng: number
  }
  recyclingTypes: string[]
  polygon: number[][]
  count: number
}
export function createSpatialChunks(
  bookings: any[],
  maxChunkSize: number = MAX_CLUSTER_SIZE,
  experimentId?: string
): AreaPartition[] {
  const valid = bookings.filter((b) => {
    const la = b.pickup?.position?.lat || b.Lat
    const lo = b.pickup?.position?.lng || b.pickup?.position?.lon || b.Lng
    if (!la || !lo || isNaN(la) || isNaN(lo)) {
      error(
        `Invalid coordinates for booking ${b.id || b.bookingId}`,
        new Error('Invalid coordinates')
      )
      return false
    }
    return true
  })

  if (!valid.length) return []

  const partitions: AreaPartition[] = []
  let seq = 0

  const epsMeters = CLUSTERING_CONFIG.TRUCK_DBSCAN_EPS_METERS
  const epsKm = metersToKilometers(epsMeters)

  const points = turf.featureCollection(
    valid.map((b) =>
      turf.point(
        [b.pickup?.position?.lng || b.Lng, b.pickup?.position?.lat || b.Lat],
        { bid: b.id }
      )
    )
  )

  const clustered = clustersDbscan(points, epsKm, {
    units: 'kilometers',
    minPoints: CLUSTERING_CONFIG.DBSCAN_MIN_SAMPLES,
  })
  const bucket: Record<number, any[]> = {}
  const noiseBookings: any[] = []
  let noiseCount = 0

  clustered.features.forEach((f) => {
    const cid = (f.properties?.cluster ?? -1) as number
    const booking = valid.find((bb: any) => bb.id === f.properties?.bid)

    if (cid === -1) {
      noiseCount++
      if (booking) {
        booking.__originalCluster = -1
        noiseBookings.push(booking)
      }
      return
    }

    if (booking) {
      booking.__originalCluster = cid
      ;(bucket[cid] ||= []).push(booking)
    }
  })

  if (
    CLUSTERING_CONFIG.ENABLE_NOISE_ASSIGNMENT &&
    noiseBookings.length > 0 &&
    Object.keys(bucket).length > 0
  ) {
    const maxDistanceMeters =
      CLUSTERING_CONFIG.MAX_NOISE_ASSIGNMENT_DISTANCE_METERS
    let assignedCount = 0

    noiseBookings.forEach((noiseBooking) => {
      const noiseLat = noiseBooking.pickup?.position?.lat || noiseBooking.Lat
      const noiseLon =
        noiseBooking.pickup?.position?.lng ||
        noiseBooking.pickup?.position?.lon ||
        noiseBooking.Lng

      let nearestClusterId = -1
      let nearestDistance = Infinity

      Object.entries(bucket).forEach(([clusterId, clusterBookings]) => {
        const center = calculateCenter(clusterBookings)
        const distance = haversineDistance(
          noiseLat,
          noiseLon,
          center.lat,
          center.lng
        )

        if (distance < nearestDistance && distance <= maxDistanceMeters) {
          nearestDistance = distance
          nearestClusterId = Number(clusterId)
        }
      })

      if (nearestClusterId !== -1) {
        noiseBooking.__originalCluster = nearestClusterId
        noiseBooking.__assignedFromNoise = true
        bucket[nearestClusterId].push(noiseBooking)
        assignedCount++
      }
    })

    noiseCount = noiseBookings.length - assignedCount
  }

  logDbscanResults(valid.length, bucket, noiseCount, epsMeters)

  Object.values(bucket).forEach((grp) => {
    const originalClusterId = grp[0]?.__originalCluster ?? -1
    splitOrPush(grp, originalClusterId)
  })

  if (CLUSTERING_CONFIG.ENABLE_PARTITION_MERGING) {
    const smallCount = partitions.filter(
      (p: AreaPartition) => p.count < CLUSTERING_CONFIG.MIN_PARTITION_SIZE
    ).length

    if (smallCount > 0) {
      smartMergeSmallPartitions(partitions, epsKm)
    }
  }

  if (partitions.length > 1) {
    const ordered: AreaPartition[] = []
    let cursor = partitions[0].center
    const pool = [...partitions]
    while (pool.length) {
      pool.sort(
        (a, b) =>
          haversineDistance(
            cursor.lat,
            cursor.lng,
            a.center.lat,
            a.center.lng
          ) -
          haversineDistance(cursor.lat, cursor.lng, b.center.lat, b.center.lng)
      )
      const next = pool.shift()!
      ordered.push(next)
      cursor = next.center
    }
    partitions.splice(0, partitions.length, ...ordered)
  }

  if (experimentId) {
    saveAreaPartitionsToElastic(experimentId, partitions).catch((err) =>
      error('Failed to save area partitions', err)
    )
  }

  return partitions

  function splitOrPush(group: any[], originalClusterId: number = -1) {
    const partition = makePartition(group)
    partitions.push(partition)
  }

  function makePartition(group: any[]): AreaPartition {
    const hull = turf.convex(
      turf.featureCollection(
        group.map((b) =>
          turf.point([
            b.pickup?.position?.lng || b.Lng,
            b.pickup?.position?.lat || b.Lat,
          ])
        )
      )
    )
    let ring: number[][]

    if (hull && hull.geometry && hull.geometry.coordinates.length) {
      ring = hull.geometry.coordinates[0] as number[][]
    } else {
      const bb = calculateBoundingBox(group)
      ring = [
        [bb.minLng, bb.minLat],
        [bb.maxLng, bb.minLat],
        [bb.maxLng, bb.maxLat],
        [bb.minLng, bb.maxLat],
        [bb.minLng, bb.minLat],
      ]
    }

    const bb = calculateBoundingBox(group)
    return {
      id: `area-${++seq}`,
      bookings: group,
      center: calculateCenter(group),
      boundingBox: bb,
      recyclingTypes: Array.from(
        new Set(
          group.map((b: any) => b.recyclingType || b.Avftyp).filter(Boolean)
        )
      ),
      polygon: ring,
      count: group.length,
    }
  }
}

function smartMergeSmallPartitions(
  partitions: AreaPartition[],
  radius: number
) {
  const minSize = CLUSTERING_CONFIG.MIN_PARTITION_SIZE
  const maxMergeDistance =
    radius * CLUSTERING_CONFIG.MERGE_DISTANCE_MULTIPLIER * 1000

  let changed = true
  let mergeRound = 0

  while (changed && mergeRound < 10) {
    changed = false
    mergeRound++

    const smallPartitions = partitions.filter((p) => p.count < minSize)

    if (smallPartitions.length === 0) {
      break
    }

    for (const small of smallPartitions) {
      const bestCandidate = findBestMergeCandidate(
        small,
        partitions,
        maxMergeDistance
      )

      if (bestCandidate) {
        mergePartitions(bestCandidate.partition, small)
        const index = partitions.indexOf(small)
        partitions.splice(index, 1)
        changed = true
        break
      }
    }
  }
}

function findBestMergeCandidate(
  small: AreaPartition,
  partitions: AreaPartition[],
  maxMergeDistance: number
) {
  const minSize = CLUSTERING_CONFIG.MIN_PARTITION_SIZE

  const candidates = partitions
    .filter((p) => p.id !== small.id && p.count >= minSize)
    .filter((p) =>
      CLUSTERING_CONFIG.RESPECT_ORIGINAL_CLUSTERS
        ? hasSameOriginalCluster(p, small)
        : true
    )
    .map((p) => ({
      partition: p,
      distance: haversineDistance(
        small.center.lat,
        small.center.lng,
        p.center.lat,
        p.center.lng
      ),
    }))
    .filter((c) => c.distance <= maxMergeDistance)
    .filter((c) => isGeographicallyReasonable(c.partition, small))
    .sort((a, b) => a.distance - b.distance)

  return candidates.length > 0 ? candidates[0] : null
}

function hasSameOriginalCluster(p1: AreaPartition, p2: AreaPartition): boolean {
  const p1MajorityCluster = getMajorityOriginalCluster(p1)
  const p2MajorityCluster = getMajorityOriginalCluster(p2)

  return p1MajorityCluster === p2MajorityCluster && p1MajorityCluster !== -1
}

function getMajorityOriginalCluster(partition: AreaPartition): number {
  const clusters = partition.bookings
    .map((b) => b.__originalCluster)
    .filter((c) => c !== undefined)
  if (clusters.length === 0) return -1

  const counts: Record<number, number> = {}
  clusters.forEach((c) => (counts[c] = (counts[c] || 0) + 1))

  let maxCount = 0
  let majorityCluster = -1
  Object.entries(counts).forEach(([cluster, count]) => {
    if (count > maxCount) {
      maxCount = count
      majorityCluster = Number(cluster)
    }
  })

  return majorityCluster
}

function isGeographicallyReasonable(
  p1: AreaPartition,
  p2: AreaPartition
): boolean {
  const combinedBookings = [...p1.bookings, ...p2.bookings]
  const combinedBounds = calculateBoundingBox(combinedBookings)

  const maxReasonableDistance = CLUSTERING_CONFIG.MAX_MERGED_AREA_DIAGONAL_KM
  const diagonalDistance =
    haversineDistance(
      combinedBounds.minLat,
      combinedBounds.minLng,
      combinedBounds.maxLat,
      combinedBounds.maxLng
    ) / 1000

  return diagonalDistance <= maxReasonableDistance
}

function mergePartitions(target: AreaPartition, source: AreaPartition) {
  target.bookings.push(...source.bookings)
  target.count = target.bookings.length
  target.center = calculateCenter(target.bookings)
  target.boundingBox = calculateBoundingBox(target.bookings)

  const allTypes = [...target.recyclingTypes, ...source.recyclingTypes]
  target.recyclingTypes = Array.from(new Set(allTypes))

  const hull = turf.convex(
    turf.featureCollection(
      target.bookings.map((b) =>
        turf.point([
          b.pickup?.position?.lng || b.Lng,
          b.pickup?.position?.lat || b.Lat,
        ])
      )
    )
  )

  if (hull && hull.geometry && hull.geometry.coordinates.length) {
    target.polygon = hull.geometry.coordinates[0] as number[][]
  } else {
    const bb = target.boundingBox
    target.polygon = [
      [bb.minLng, bb.minLat],
      [bb.maxLng, bb.minLat],
      [bb.maxLng, bb.maxLat],
      [bb.minLng, bb.maxLat],
      [bb.minLng, bb.minLat],
    ]
  }
}

export function createSimpleAreaPartitions(
  bookings: any[],
  maxChunkSize: number,
  prox = 2000
) {
  return [] as any
}

async function saveAreaPartitionsToElastic(
  experimentId: string,
  parts: AreaPartition[]
) {
  try {
    const docs = parts.map((p) => ({
      id: p.id,
      center: { lat: p.center.lat, lon: p.center.lng },
      bounds: {
        minLat: p.boundingBox.minLat,
        minLng: p.boundingBox.minLng,
        maxLat: p.boundingBox.maxLat,
        maxLng: p.boundingBox.maxLng,
      },
      count: p.bookings.length,
      recyclingTypes: p.recyclingTypes,
      polygon: p.polygon,
    }))

    const res = await search({
      index: 'experiments',
      body: { query: { term: { _id: experimentId } } },
    })

    if (res?.body?.hits?.hits?.length) {
      const oldDoc = res.body.hits.hits[0]._source

      const updatedDoc = {
        ...oldDoc,
        areaPartitions: docs,
        areaPartitionsTimestamp: new Date().toISOString(),
      }

      await save(updatedDoc, experimentId, 'experiments')
    } else {
      error(
        `No existing experiment document found for ${experimentId}`,
        new Error('No existing experiment document found')
      )
    }
  } catch (e) {
    error(`Failed to save area partitions for ${experimentId}:`, e)
  }
}
module.exports = {
  haversineDistance,
  calculateCenter,
  calculateBoundingBox,
  calculateCenters,
  clusterByPostalCode,
  createSpatialChunks,
  createSimpleAreaPartitions,
  saveAreaPartitionsToElastic,
}
