export type HemsortFraction = {
  fack: number
  volumeLiters: number
  label?: string
}

/**
 * Defines how a HEMSORT stop (by service type) should be split across truck fack.
 * Volumes are pre-compaction and will be scaled by VOLUME_COMPRESSION_FACTOR at load time.
 */
const HEMSORT_COMPARTMENT_DISTRIBUTION: Record<string, HemsortFraction[]> = {
  // Kärl 1
  K240L1: [
    { fack: 1, volumeLiters: 90, label: 'Rest/Mat' },
    { fack: 2, volumeLiters: 90, label: 'Pappersförp.' },
    { fack: 3, volumeLiters: 30, label: 'Färgat glas' },
    { fack: 4, volumeLiters: 30, label: 'Hårdplast' },
  ],
  K370L1: [
    { fack: 1, volumeLiters: 140, label: 'Rest/Mat' },
    { fack: 2, volumeLiters: 140, label: 'Pappersförp.' },
    { fack: 3, volumeLiters: 45, label: 'Färgat glas' },
    { fack: 4, volumeLiters: 45, label: 'Hårdplast' },
  ],

  // Kärl 2
  K240L2: [
    { fack: 1, volumeLiters: 90, label: 'Tidningar' },
    { fack: 2, volumeLiters: 90, label: 'Mjukplast' },
    { fack: 3, volumeLiters: 30, label: 'Ofärgat glas' },
    { fack: 4, volumeLiters: 30, label: 'Metall' },
  ],
  K370L2: [
    { fack: 1, volumeLiters: 140, label: 'Tidningar' },
    { fack: 2, volumeLiters: 140, label: 'Mjukplast' },
    { fack: 3, volumeLiters: 45, label: 'Ofärgat glas' },
    { fack: 4, volumeLiters: 45, label: 'Metall' },
  ],
}

export function getHemsortDistribution(
  serviceType: string | null | undefined
): HemsortFraction[] | null {
  if (!serviceType) return null
  return HEMSORT_COMPARTMENT_DISTRIBUTION[serviceType] || null
}
