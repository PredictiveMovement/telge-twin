import { CLUSTERING_CONFIG } from '../config'
import {
  LoadEstimate,
  STANDARD_PICKUP_VOLUME_LITERS,
  STANDARD_FILL_PERCENT,
} from './types'
import { buildSettingsIndexes } from './utils'

function resolveServiceType(booking: any): string | null {
  return (
    booking?.originalData?.originalTjtyp ||
    booking?.originalData?.originalRouteRecord?.Tjtyp ||
    booking?.originalRecord?.Tjtyp ||
    booking?.Tjtyp ||
    null
  )
}

/**
 * Estimates the volume and weight of a booking based on service type and waste type.
 * 
 * Uses settings to look up:
 * - Service type (Tjtyp) → VOLYM (liters) and FYLLNADSGRAD (fill %)
 * - Waste type (Avftyp) → VOLYMVIKT (density in kg/m³)
 * 
 * Applies volume compression factor from config to simulate waste compaction.
 * 
 * @param booking - The booking to estimate load for
 * @param settings - Dataset settings containing tjtyper and avftyper
 * @returns LoadEstimate with volumeLiters and weightKg
 */
export function estimateBookingLoad(
  booking: any,
  settings: any
): LoadEstimate {
  const { avfIndex, tjIndex } = buildSettingsIndexes(settings)

  const tjid = resolveServiceType(booking)
  const tj = tjid ? tjIndex[tjid] : undefined

  const baseVolume =
    typeof tj?.VOLYM === 'number' && tj.VOLYM > 0
      ? tj.VOLYM
      : STANDARD_PICKUP_VOLUME_LITERS
  const fillPercent =
    typeof tj?.FYLLNADSGRAD === 'number' && tj.FYLLNADSGRAD > 0
      ? tj.FYLLNADSGRAD
      : STANDARD_FILL_PERCENT

  // Apply compression factor to simulate waste compaction in truck
  const compressionFactor = CLUSTERING_CONFIG.CAPACITY.VOLUME_COMPRESSION_FACTOR
  const volumeLiters = Math.max(
    1,
    Math.round((baseVolume * fillPercent / 100) * compressionFactor)
  )

  const density = avfIndex[booking?.recyclingType || '']?.VOLYMVIKT
  const weightKg =
    typeof density === 'number' && density > 0
      ? (volumeLiters / 1000) * density
      : null

  return { volumeLiters, weightKg }
}

/**
 * Gets the remaining capacity dimensions for a truck based on its compartments.
 * 
 * Returns the capacity dimensions that should be used for VROOM optimization:
 * - volumeLiters: Total remaining volume across all compartments
 * - weightKg: Total remaining weight capacity across all compartments
 * - count: Fallback to parcelCapacity - cargo count if no compartment data
 * 
 * @param truck - The truck to get capacity dimensions for
 * @returns Object with keys (dimension names) and values (remaining capacity)
 */
export function getCapacityDimensions(
  truck: any
): { keys: ('volumeLiters' | 'weightKg' | 'count')[]; values: number[] } {
  const compartments: any[] = Array.isArray(truck?.compartments)
    ? truck.compartments
    : []

  let totalVolume = 0
  let hasFiniteVolume = false
  let totalWeight = 0
  let hasFiniteWeight = false

  compartments.forEach((comp) => {
    const capacityLiters =
      typeof comp?.capacityLiters === 'number' && comp.capacityLiters >= 0
        ? comp.capacityLiters
        : null
    const fillLiters =
      typeof comp?.fillLiters === 'number' && comp.fillLiters > 0
        ? comp.fillLiters
        : 0
    if (capacityLiters != null) {
      hasFiniteVolume = true
      totalVolume += Math.max(0, capacityLiters - fillLiters)
    }

    const capacityKg =
      typeof comp?.capacityKg === 'number' && comp.capacityKg >= 0
        ? comp.capacityKg
        : null
    const fillKg =
      typeof comp?.fillKg === 'number' && comp.fillKg > 0 ? comp.fillKg : 0
    if (capacityKg != null) {
      hasFiniteWeight = true
      totalWeight += Math.max(0, capacityKg - fillKg)
    }
  })

  const keys: ('volumeLiters' | 'weightKg' | 'count')[] = []
  const values: number[] = []

  if (hasFiniteVolume) {
    keys.push('volumeLiters')
    values.push(Math.max(0, Math.floor(totalVolume)))
  }

  if (hasFiniteWeight) {
    keys.push('weightKg')
    values.push(Math.max(0, Math.floor(totalWeight)))
  }

  if (!keys.length) {
    const parcelCapacity =
      typeof truck?.parcelCapacity === 'number' && truck.parcelCapacity >= 0
        ? truck.parcelCapacity
        : CLUSTERING_CONFIG.DELIVERY_STRATEGIES.PICKUPS_BEFORE_DELIVERY || 0
    const cargoCount = Array.isArray(truck?.cargo) ? truck.cargo.length : 0
    const remaining = Math.max(0, Math.floor(parcelCapacity - cargoCount))
    keys.push('count')
    values.push(remaining)
  }

  return { keys, values }
}

