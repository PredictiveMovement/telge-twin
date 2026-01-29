import * as turf from '@turf/turf'
import clustersDbscan from '@turf/clusters-dbscan'
import { error, info } from './log'
import { update as esUpdate } from './elastic'
import { CLUSTERING_CONFIG } from './config'
import { extractCoordinates } from './utils/coordinates'

// Using Turf's distance function for consistency
const haversineDistance = (
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number => {
  const from = turf.point([aLon, aLat])
  const to = turf.point([bLon, bLat])
  return turf.distance(from, to, { units: 'meters' })
}

export const calculateCenter = (bookings: any[]) => {
  const { lat, lon } = bookings.reduce(
    (acc: any, b: any) => {
      const coords = extractCoordinates(b)
      return {
        lat: acc.lat + coords.lat,
        lon: acc.lon + coords.lng,
      }
    },
    { lat: 0, lon: 0 }
  )
  const n = bookings.length || 1
  return { lat: lat / n, lng: lon / n }
}

export const calculateBoundingBox = (bookings: any[]) => {
  const bounds = { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 }

  bookings.forEach((b) => {
    const { lat, lng } = extractCoordinates(b)
    bounds.minLat = Math.min(bounds.minLat, lat)
    bounds.maxLat = Math.max(bounds.maxLat, lat)
    bounds.minLng = Math.min(bounds.minLng, lng)
    bounds.maxLng = Math.max(bounds.maxLng, lng)
  })

  return bounds
}

// Helper function to create polygon from bookings
const createPolygonFromBookings = (bookings: any[]) => {
  const points = bookings.map((b) => {
    const { lat, lng } = extractCoordinates(b)
    return turf.point([lng, lat])
  })

  const hull = turf.convex(turf.featureCollection(points))

  if (hull?.geometry?.coordinates?.length) {
    return hull.geometry.coordinates[0] as number[][]
  }

  // Fallback to bounding box if convex hull fails
  const bb = calculateBoundingBox(bookings)
  return [
    [bb.minLng, bb.minLat],
    [bb.maxLng, bb.minLat],
    [bb.maxLng, bb.maxLat],
    [bb.minLng, bb.maxLat],
    [bb.minLng, bb.minLat],
  ]
}

function metersToKilometers(meters: number): number {
  return meters / 1000
}

function logDbscanResults(
  totalBookings: number,
  clusters: Record<number, any[]>,
  noiseCount: number,
  epsMeters: number
) {
  const clusterCount = Object.keys(clusters).length

  info(
    `📊 DBSCAN clustering: ${clusterCount} clusters from ${totalBookings} bookings`
  )

  if (clusterCount > 0) {
    const clusterSizes = Object.values(clusters)
      .map((arr) => arr.length)
      .sort((a, b) => b - a)

    info(`   - Sizes: ${clusterSizes.join(', ')} (eps: ${epsMeters}m)`)

    // Check for oversized clusters
    const oversized = clusterSizes.filter(
      (size) => size > CLUSTERING_CONFIG.MAX_CLUSTER_SIZE
    )
    if (oversized.length > 0) {
      info(
        `   ⚠️ Oversized clusters: ${oversized.join(', ')} (max: ${
          CLUSTERING_CONFIG.MAX_CLUSTER_SIZE
        })`
      )
    }
  }

  // Warn about high noise ratio
  const noiseRatio = noiseCount / totalBookings
  if (noiseRatio > 0.3) {
    info(`   ⚠️ High noise ratio: ${(noiseRatio * 100).toFixed(1)}%`)
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

// Helper function to validate and filter bookings
const validateBookings = (bookings: any[]) => {
  return bookings.filter((b) => {
    const { lat, lng } = extractCoordinates(b)
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      error(
        `Invalid coordinates for booking ${b.id || b.bookingId}`,
        new Error('Invalid coordinates')
      )
      return false
    }
    return true
  })
}

// Helper function to perform DBSCAN clustering
const performDbscanClustering = (validBookings: any[], epsMeters: number) => {
  const epsKm = metersToKilometers(epsMeters)

  const points = turf.featureCollection(
    validBookings.map((b) => {
      const { lat, lng } = extractCoordinates(b)
      return turf.point([lng, lat], { bid: b.id })
    })
  )

  const clustered = clustersDbscan(points, epsKm, {
    units: 'kilometers',
    minPoints: CLUSTERING_CONFIG.DBSCAN_MIN_SAMPLES,
  })

  const bucket: Record<number, any[]> = {}
  const noiseBookings: any[] = []

  clustered.features.forEach((f) => {
    const cid = (f.properties?.cluster ?? -1) as number
    const booking = validBookings.find((bb: any) => bb.id === f.properties?.bid)

    if (!booking) return

    booking.__originalCluster = cid

    if (cid === -1) {
      noiseBookings.push(booking)
    } else {
      ;(bucket[cid] ||= []).push(booking)
    }
  })

  return { bucket, noiseBookings }
}

// Helper function to assign noise bookings to nearest clusters
const assignNoiseToNearestClusters = (
  noiseBookings: any[],
  bucket: Record<number, any[]>
): number => {
  if (
    !CLUSTERING_CONFIG.ENABLE_NOISE_ASSIGNMENT ||
    !noiseBookings.length ||
    !Object.keys(bucket).length
  ) {
    return noiseBookings.length
  }

  const maxDistanceMeters =
    CLUSTERING_CONFIG.MAX_NOISE_ASSIGNMENT_DISTANCE_METERS
  let assignedCount = 0

  noiseBookings.forEach((noiseBooking) => {
    const { lat: noiseLat, lng: noiseLng } = extractCoordinates(noiseBooking)

    let nearestClusterId = -1
    let nearestDistance = Infinity

    Object.entries(bucket).forEach(([clusterId, clusterBookings]) => {
      const center = calculateCenter(clusterBookings)
      const distance = haversineDistance(
        noiseLat,
        noiseLng,
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

  return noiseBookings.length - assignedCount
}

// Helper function to create area partitions from clusters
const createAreaPartitions = (
  bucket: Record<number, any[]>,
  truckId?: string
): AreaPartition[] => {
  let seq = 0

  return Object.values(bucket).map((group) => {
    const partitionId = truckId
      ? `truck-${truckId}-area-${++seq}`
      : `area-${++seq}`

    return {
      id: partitionId,
      bookings: group,
      center: calculateCenter(group),
      boundingBox: calculateBoundingBox(group),
      recyclingTypes: Array.from(
        new Set(
          group.map((b: any) => b.recyclingType || b.Avftyp).filter(Boolean)
        )
      ),
      polygon: createPolygonFromBookings(group),
      count: group.length,
    }
  })
}

// Helper function to order partitions by proximity
const orderPartitionsByProximity = (partitions: AreaPartition[]) => {
  if (partitions.length <= 1) return

  const ordered: AreaPartition[] = []
  let cursor = partitions[0].center
  const pool = [...partitions]

  while (pool.length) {
    pool.sort(
      (a, b) =>
        haversineDistance(cursor.lat, cursor.lng, a.center.lat, a.center.lng) -
        haversineDistance(cursor.lat, cursor.lng, b.center.lat, b.center.lng)
    )
    const next = pool.shift()!
    ordered.push(next)
    cursor = next.center
  }

  partitions.splice(0, partitions.length, ...ordered)
}

export function createSpatialChunks(
  bookings: any[],
  experimentId?: string,
  truckId?: string
): AreaPartition[] {
  const valid = validateBookings(bookings)
  if (!valid.length) return []

  const epsMeters = CLUSTERING_CONFIG.TRUCK_DBSCAN_EPS_METERS
  const { bucket, noiseBookings } = performDbscanClustering(valid, epsMeters)
  const noiseCount = assignNoiseToNearestClusters(noiseBookings, bucket)

  logDbscanResults(valid.length, bucket, noiseCount, epsMeters)

  // Create partitions from final clusters
  const partitions = createAreaPartitions(bucket, truckId)

  // Handle partition merging if enabled
  if (CLUSTERING_CONFIG.ENABLE_PARTITION_MERGING) {
    const smallCount = partitions.filter(
      (p) => p.count < CLUSTERING_CONFIG.MIN_PARTITION_SIZE
    ).length

    if (smallCount > 0) {
      info(
        `🔧 Merging ${smallCount} small partitions (min: ${CLUSTERING_CONFIG.MIN_PARTITION_SIZE})`
      )
      smartMergeSmallPartitions(partitions, metersToKilometers(epsMeters))

      const finalSizes = partitions.map((p) => p.count).sort((a, b) => b - a)
      info(`✅ Final partition sizes: ${finalSizes.join(', ')}`)
    }
  }

  orderPartitionsByProximity(partitions)

  // Save to Elasticsearch if experiment ID is provided
  if (experimentId) {
    saveAreaPartitionsToElastic(experimentId, partitions).catch((err) =>
      error('Failed to save area partitions', err)
    )
  }

  return partitions
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
  let totalMerges = 0

  while (changed && mergeRound < CLUSTERING_CONFIG.MAX_MERGE_ROUNDS) {
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
        totalMerges++
        break
      }
    }
  }

  const finalSmallCount = partitions.filter((p) => p.count < minSize).length
  if (totalMerges > 0) {
    info(`   - Performed ${totalMerges} merges in ${mergeRound} rounds`)
  }
  if (finalSmallCount > 0) {
    info(`   - ${finalSmallCount} small partitions remaining`)
  }
}

function findBestMergeCandidate(
  small: AreaPartition,
  partitions: AreaPartition[],
  maxMergeDistance: number
) {
  const minSize = CLUSTERING_CONFIG.MIN_PARTITION_SIZE

  // Helper to create candidate with distance calculation
  const createCandidate = (
    p: AreaPartition,
    priority: 'large' | 'small' | 'any'
  ) => ({
    partition: p,
    distance: haversineDistance(
      small.center.lat,
      small.center.lng,
      p.center.lat,
      p.center.lng
    ),
    priority,
  })

  // Helper to filter candidates
  const filterCandidates = (candidates: ReturnType<typeof createCandidate>[]) =>
    candidates
      .filter((c) => c.distance <= maxMergeDistance)
      .filter((c) => isGeographicallyReasonable(c.partition, small))

  const isEligible = (p: AreaPartition) =>
    p.id !== small.id &&
    (!CLUSTERING_CONFIG.RESPECT_ORIGINAL_CLUSTERS ||
      hasSameOriginalCluster(p, small))

  // Priority 1: Large clusters that can accept merges
  const largeCandidates = filterCandidates(
    partitions
      .filter((p) => isEligible(p) && p.count >= minSize)
      .map((p) => createCandidate(p, 'large'))
  )

  // Priority 2: Slightly larger small clusters
  const smallCandidates = filterCandidates(
    partitions
      .filter(
        (p) => isEligible(p) && p.count < minSize && p.count > small.count
      )
      .map((p) => createCandidate(p, 'small'))
  )

  // Priority 3: Any other small clusters
  const anySmallCandidates = filterCandidates(
    partitions
      .filter(
        (p) => isEligible(p) && p.count < minSize && p.count <= small.count
      )
      .map((p) => createCandidate(p, 'any'))
  )

  // Combine and sort by priority, then distance
  const allCandidates = [
    ...largeCandidates,
    ...smallCandidates,
    ...anySmallCandidates,
  ].sort((a, b) => {
    const priorityOrder = { large: 0, small: 1, any: 2 }
    return (
      priorityOrder[a.priority] - priorityOrder[b.priority] ||
      a.distance - b.distance
    )
  })

  return allCandidates[0] || null
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

  if (!clusters.length) return -1

  const counts: Record<number, number> = {}
  clusters.forEach((c) => (counts[c] = (counts[c] || 0) + 1))

  const entries = Object.entries(counts).map(
    ([cluster, count]): [string, number] => [cluster, count]
  )
  const [maxCluster] = entries.reduce(
    (max, current) => (current[1] > max[1] ? current : max),
    ['-1', 0]
  )

  return Number(maxCluster)
}

function isGeographicallyReasonable(
  p1: AreaPartition,
  p2: AreaPartition
): boolean {
  const combinedBounds = calculateBoundingBox([...p1.bookings, ...p2.bookings])
  const diagonalDistance =
    haversineDistance(
      combinedBounds.minLat,
      combinedBounds.minLng,
      combinedBounds.maxLat,
      combinedBounds.maxLng
    ) / 1000

  return diagonalDistance <= CLUSTERING_CONFIG.MAX_MERGED_AREA_DIAGONAL_KM
}

function mergePartitions(target: AreaPartition, source: AreaPartition) {
  target.bookings.push(...source.bookings)
  target.count = target.bookings.length
  target.center = calculateCenter(target.bookings)
  target.boundingBox = calculateBoundingBox(target.bookings)
  target.recyclingTypes = Array.from(
    new Set([...target.recyclingTypes, ...source.recyclingTypes])
  )
  target.polygon = createPolygonFromBookings(target.bookings)
}

// Helper function to extract truck ID from partition ID
const extractTruckId = (partitionId: string): string | null => {
  const match = partitionId.match(/truck-(\d+)-/)
  return match ? match[1] : null
}

// Helper function to create document from partition
const createPartitionDocument = (p: AreaPartition) => {
  const truckId = extractTruckId(p.id)
  if (!truckId) {
    error(
      `Invalid partition ID format: ${p.id}`,
      new Error('Invalid partition ID')
    )
  }

  return {
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
    polygon: { type: 'Polygon', coordinates: [p.polygon] },
    truckId,
    timestamp: new Date().toISOString(),
  }
}

async function saveAreaPartitionsToElastic(
  experimentId: string,
  parts: AreaPartition[]
) {
  info(`💾 Saving area partitions (atomic update):`)
  info(`   - Experiment: ${experimentId}`)
  info(`   - New partitions: ${parts.length}`)

  const docs = parts.map(createPartitionDocument)

  const savingTruckIds = Array.from(
    new Set(docs.map((d: any) => d.truckId).filter(Boolean))
  )
  info(`   - Saving partitions for trucks: ${savingTruckIds.join(', ')}`)

  const updateScript = {
    script: {
      lang: 'painless',
      source:
        'def newParts = params.newPartitions; ' +
        'ctx._source.areaPartitions = newParts; ' +
        'ctx._source.areaPartitionsTimestamp = params.ts;',
      params: {
        currentTruckIds: savingTruckIds,
        newPartitions: docs,
        ts: new Date().toISOString(),
      },
    },
  }

  try {
    await esUpdate('experiments', experimentId, updateScript, 5)
    info(
      `   ✅ Successfully merged ${
        docs.length
      } partitions for trucks [${savingTruckIds.join(', ')}]`
    )
  } catch (e: any) {
    // Check if experiment was deleted (e.g., cancelled by user)
    if (e?.meta?.body?.error?.type === 'document_missing_exception') {
      info(`   ⚠️ Experiment ${experimentId} was deleted (optimization cancelled)`)
      return
    }
    error('Unexpected error saving area partitions (atomic update):', e)
  }
}
