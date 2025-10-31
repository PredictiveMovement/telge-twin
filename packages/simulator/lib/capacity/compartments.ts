import { Compartment, LoadEstimate, FackDetail } from './types'

const ALLOW_ALL = '*'

/**
 * Creates compartments from vehicle fack details.
 * 
 * If no fack details are provided, creates a single default compartment
 * that accepts all waste types with no capacity limits.
 * 
 * @param fackDetails - Array of FackDetail objects from vehicle spec
 * @returns Array of Compartment objects with initial fill levels at 0
 */
export function createCompartments(
  fackDetails?: FackDetail[] | null
): Compartment[] {
  const details = Array.isArray(fackDetails) ? fackDetails : []

  if (!details.length) {
    return [
      {
        fackNumber: 1,
        allowedWasteTypes: [ALLOW_ALL],
        capacityLiters: null,
        capacityKg: null,
        fillLiters: 0,
        fillKg: 0,
      },
    ]
  }

  return details.map((detail, index) => {
    const allowedWasteTypes = Array.isArray(detail?.avfallstyper)
      ? detail.avfallstyper
          .map((item: any) => item?.avftyp)
          .filter(Boolean)
      : []
    const capacityLiters =
      typeof detail?.volym === 'number' && detail.volym > 0
        ? detail.volym * 1000 // Convert m³ to liters
        : null
    const capacityKg =
      typeof detail?.vikt === 'number' && detail.vikt > 0
        ? detail.vikt
        : null

    return {
      fackNumber:
        typeof detail?.fackNumber === 'number'
          ? detail.fackNumber
          : index + 1,
      allowedWasteTypes: allowedWasteTypes.length
        ? allowedWasteTypes
        : [ALLOW_ALL],
      capacityLiters,
      capacityKg,
      fillLiters: 0,
      fillKg: 0,
    }
  })
}

/**
 * Selects the best compartment for a given waste type and load.
 * 
 * Selection criteria:
 * 1. Compartment must allow the waste type (or allow all types)
 * 2. Choose compartment with best remaining capacity ratio
 * 
 * The score is calculated as: min(remainingVolume/loadVolume, remainingWeight/loadWeight)
 * This ensures we don't overload on either dimension.
 * 
 * @param compartments - Array of available compartments
 * @param typeId - Waste type ID (Avftyp)
 * @param load - Load estimate with volume and weight
 * @returns Best matching compartment or null if none can accommodate
 */
export function selectBestCompartment(
  compartments: Compartment[],
  typeId: string | undefined,
  load: LoadEstimate
): Compartment | null {
  if (!compartments.length) return null

  const candidates = compartments.filter(
    (compartment) =>
      compartment.allowedWasteTypes.includes(ALLOW_ALL) ||
      (typeId != null &&
        compartment.allowedWasteTypes.includes(typeId))
  )

  if (!candidates.length) return null

  let best: Compartment | null = null
  let bestScore = -Infinity

  for (const compartment of candidates) {
    const remainingLiters =
      compartment.capacityLiters != null
        ? compartment.capacityLiters - compartment.fillLiters
        : Number.POSITIVE_INFINITY
    const remainingKg =
      compartment.capacityKg != null && load.weightKg != null
        ? compartment.capacityKg - compartment.fillKg
        : Number.POSITIVE_INFINITY

    const litersDenominator = load.volumeLiters || 1
    const kgDenominator =
      load.weightKg == null || load.weightKg === 0
        ? 1
        : load.weightKg

    const score = Math.min(
      remainingLiters / litersDenominator,
      remainingKg / kgDenominator
    )

    if (score > bestScore) {
      bestScore = score
      best = compartment
    }
  }

  return best
}

/**
 * Checks if any compartment is full (reached capacity limit).
 * 
 * @param compartments - Array of compartments to check
 * @returns true if at least one compartment is full
 */
export function isAnyCompartmentFull(
  compartments: Compartment[]
): boolean {
  return compartments.some(isCompartmentFull)
}

/**
 * Checks if a single compartment is full.
 * 
 * A compartment is considered full if either:
 * - Volume capacity is reached (fillLiters >= capacityLiters)
 * - Weight capacity is reached (fillKg >= capacityKg)
 * 
 * @param compartment - The compartment to check
 * @returns true if compartment is full on either dimension
 */
export function isCompartmentFull(compartment: Compartment): boolean {
  const litersFull =
    typeof compartment.capacityLiters === 'number' &&
    compartment.capacityLiters > 0
      ? compartment.fillLiters >= compartment.capacityLiters
      : false

  const kgFull =
    typeof compartment.capacityKg === 'number' &&
    compartment.capacityKg > 0
      ? compartment.fillKg >= compartment.capacityKg
      : false

  return litersFull || kgFull
}

/**
 * Applies a load to a compartment, updating its fill levels.
 * 
 * This mutates the compartment object by adding the load volume and weight
 * to the current fill levels.
 * 
 * @param compartment - The compartment to add load to (mutated)
 * @param load - The load to add
 */
export function applyLoadToCompartment(
  compartment: Compartment,
  load: LoadEstimate
) {
  compartment.fillLiters += load.volumeLiters
  if (load.weightKg != null) {
    compartment.fillKg += load.weightKg
  }
}

/**
 * Releases a load from a compartment, reducing its fill levels.
 * 
 * This mutates the compartment object by subtracting the load volume and weight
 * from the current fill levels. Fill levels are clamped to 0 minimum.
 * 
 * Used when a vehicle delivers/unloads its cargo.
 * 
 * @param compartment - The compartment to release load from (mutated)
 * @param load - The load to release
 */
export function releaseLoadFromCompartment(
  compartment: Compartment,
  load: LoadEstimate
) {
  compartment.fillLiters = Math.max(
    0,
    compartment.fillLiters - (load.volumeLiters || 0)
  )
  if (load.weightKg != null) {
    compartment.fillKg = Math.max(
      0,
      compartment.fillKg - load.weightKg
    )
  }
}

