export interface Compartment {
  fackNumber: number
  allowedWasteTypes: string[]
  capacityLiters: number | null
  capacityKg: number | null
  fillLiters: number
  fillKg: number
}

export interface LoadEstimate {
  volumeLiters: number
  weightKg: number | null
}

const ALLOW_ALL = '*'

export function createCompartments(
  fackDetails?: any[] | null
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
        ? detail.volym * 1000
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

export function isAnyCompartmentFull(
  compartments: Compartment[]
): boolean {
  return compartments.some(isCompartmentFull)
}

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

export function applyLoadToCompartment(
  compartment: Compartment,
  load: LoadEstimate
) {
  compartment.fillLiters += load.volumeLiters
  if (load.weightKg != null) {
    compartment.fillKg += load.weightKg
  }
}

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
