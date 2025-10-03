import { CLUSTERING_CONFIG } from './config'

export interface LoadEstimate {
  volumeLiters: number
  weightKg: number | null
}

const FALLBACK_VOLUME_LITERS = 140
const FALLBACK_FILL_PERCENT = 100

function resolveServiceType(booking: any): string | null {
  return (
    booking?.originalData?.originalTjtyp ||
    booking?.originalRecord?.Tjtyp ||
    null
  )
}

export function estimateBookingLoad(
  booking: any,
  settings: any
): LoadEstimate {
  const tjIndex: Record<string, { VOLYM?: number; FYLLNADSGRAD?: number }> =
    Object.fromEntries((settings?.tjtyper || []).map((t: any) => [t.ID, t]))
  const avfIndex: Record<string, { VOLYMVIKT?: number }> = Object.fromEntries(
    (settings?.avftyper || []).map((a: any) => [a.ID, a])
  )

  const tjid = resolveServiceType(booking)
  const tj = tjid ? tjIndex[tjid] : undefined

  const baseVolume =
    typeof tj?.VOLYM === 'number' && tj.VOLYM > 0
      ? tj.VOLYM
      : FALLBACK_VOLUME_LITERS
  const fillPercent =
    typeof tj?.FYLLNADSGRAD === 'number' && tj.FYLLNADSGRAD > 0
      ? tj.FYLLNADSGRAD
      : FALLBACK_FILL_PERCENT

  const volumeLiters = Math.max(
    1,
    Math.round((baseVolume * fillPercent) / 100)
  )

  const density = avfIndex[booking?.recyclingType || '']?.VOLYMVIKT
  const weightKg =
    typeof density === 'number' && density > 0
      ? (volumeLiters / 1000) * density
      : null

  return { volumeLiters, weightKg }
}

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

