import { info } from './log'

type FackWasteType = { avftyp: string; volymvikt?: number | null; fyllnadsgrad?: number | null }
type FackDetail = {
  fackNumber: number
  avfallstyper: FackWasteType[]
  volym?: number | null // presumed volume capacity of the compartment
  vikt?: number | null // presumed weight limit of the compartment
}

type VehicleSpec = {
  originalId: string
  type: string
  description?: string
  fackDetails?: FackDetail[]
  parcelCapacity?: number
}

type BookingLike = {
  recyclingType?: string
  originalRecord?: any
  originalData?: any
}

/**
 * computeVehicleCapacityEstimate
 *
 * Purpose
 * - Estimate how many pickups a vehicle can perform before a likely unload is needed.
 * - Uses per-compartment (fack) declared volume/weight limits and allowed waste types,
 *   plus service-type volumes and waste densities from dataset settings.
 * - This is a heuristic for logging/observability only; it does not affect simulation.
 *
 * Inputs
 * - vehicle: VehicleSpec that may include fackDetails (compartment list):
 *   each fack has optional volume (volym), weight (vikt) and a set of allowed waste types.
 * - settings: dataset `settings` object containing:
 *   • avftyper: [{ ID, VOLYMVIKT }] – density (kg/m³) per waste type
 *   • tjtyper: [{ ID, VOLYM, FYLLNADSGRAD }] – nominal service volume and fill factor
 * - observedBookings: (optional) bookings pre-assigned to this vehicle; used to infer
 *   the dominant service type (Tjtyp) when multiple are present.
 *
 * Method
 * - Determine an expected pickup volume (liters) using observed dominant Tjtyp if available,
 *   otherwise fallback to a reasonable default (e.g. 140 L) and 100% fill.
 * - For each waste type allowed by any compartment:
 *   • Sum total fack volume and total fack weight limit across compartments that allow it.
 *   • Convert expected pickup volume (liters) to weight via density (if known):
 *       expectedWeightPerPickup = (expectedVolumeLiters / 1000) * densityKgPerM3
 *   • Compute two limits (when inputs are present):
 *       volumeLimitedPickups = totalFackVolume / expectedVolumeLiters
 *       weightLimitedPickups = totalFackWeightLimit / expectedWeightPerPickup
 *   • Estimated pickups = min of the two positive limits; otherwise whichever is available.
 * - Returns a structured object suitable for logging.
 */
export function computeVehicleCapacityEstimate(
  vehicle: VehicleSpec,
  settings: any,
  observedBookings: BookingLike[] = []
) {
  const avfIndex: Record<string, { ID: string; VOLYMVIKT?: number }> = Object.fromEntries(
    (settings?.avftyper || []).map((a: any) => [a.ID, a])
  )
  const tjIndex: Record<string, { ID: string; VOLYM?: number; FYLLNADSGRAD?: number }> = Object.fromEntries(
    (settings?.tjtyper || []).map((t: any) => [t.ID, t])
  )

  // Determine expected pickup volume (liters) using observed dominant Tjtyp if possible
  let pickupVolumeLiters = 140 // fallback typical bin size
  let pickupVolumeSource: 'observed' | 'tjtyper' | 'fallback' = 'fallback'
  let pickupFillFactor = 100

  const observedTj = observedBookings
    .map((b) => b?.originalRecord?.Tjtyp || b?.originalData?.originalTjtyp)
    .filter(Boolean)
  if (observedTj.length) {
    const counts = new Map<string, number>()
    for (const id of observedTj) counts.set(id, (counts.get(id) || 0) + 1)
    let best = observedTj[0]
    let max = 0
    counts.forEach((c, k) => {
      if (c > max) {
        max = c
        best = k
      }
    })
    const tj = tjIndex[best]
    if (tj) {
      const vol = typeof tj.VOLYM === 'number' ? tj.VOLYM : pickupVolumeLiters
      const fill = typeof tj.FYLLNADSGRAD === 'number' ? tj.FYLLNADSGRAD : 100
      pickupVolumeLiters = Math.max(1, Math.round((vol * fill) / 100))
      pickupVolumeSource = 'observed'
      pickupFillFactor = fill
    }
  } else {
    // As a secondary attempt, if a “typical” Tjtyp ID were configured, it could be used.
    // Keeping it simple: remain on fallback if not observed.
  }

  const facks: FackDetail[] = Array.isArray(vehicle.fackDetails)
    ? (vehicle.fackDetails as FackDetail[])
    : []

  // Per-fack estimates for each allowed waste type
  const perFack: Array<{ fack: number; typeId: string; estimatedPickups: number | null }> = []

  for (const f of facks) {
    const volLiters = typeof f.volym === 'number' && f.volym > 0 ? f.volym * 1000 : null
    const weightLimit = typeof f.vikt === 'number' && f.vikt > 0 ? f.vikt : null
    const types = (f.avfallstyper || []).map((w) => w.avftyp).filter(Boolean)
    if (!types.length) continue

    for (const typeId of types) {
      const density = avfIndex[typeId]?.VOLYMVIKT // kg per m³
      const expectedWeightPerPickup =
        typeof density === 'number' && density > 0
          ? (pickupVolumeLiters / 1000) * density
          : null

      const volumeLimitedPickups = volLiters && pickupVolumeLiters > 0 ? volLiters / pickupVolumeLiters : null
      const weightLimitedPickups = weightLimit && expectedWeightPerPickup && expectedWeightPerPickup > 0
        ? weightLimit / expectedWeightPerPickup
        : null

      let estimatedPickups: number | null = null
      const candidates = [volumeLimitedPickups, weightLimitedPickups].filter(
        (v) => typeof v === 'number' && isFinite(v as number) && (v as number) > 0
      ) as number[]
      if (candidates.length) estimatedPickups = Math.floor(Math.min(...candidates))

      perFack.push({ fack: f.fackNumber, typeId, estimatedPickups })
    }
  }

  // Fallback if no fack/types present at all: use parcelCapacity if available
  if (!perFack.length && typeof vehicle.parcelCapacity === 'number') {
    perFack.push({ fack: 0, typeId: 'ALL', estimatedPickups: Math.floor(vehicle.parcelCapacity) })
  }

  return { perFack }
}

/**
 * Log a single structured line for a vehicle capacity estimate.
 */
export function logVehicleCapacity(
  fleetName: string,
  experimentId: string | undefined,
  vehicle: VehicleSpec,
  settings: any,
  observedBookings: BookingLike[] = []
) {
  const estimate = computeVehicleCapacityEstimate(vehicle, settings, observedBookings)
  const simple = {
    experimentId,
    fleet: fleetName,
    vehicleId: vehicle.originalId,
    estimates: estimate.perFack
      .map((x) => ({ fack: x.fack, typeId: x.typeId, estimatedPickups: x.estimatedPickups }))
      .sort((a, b) => (a.fack - b.fack) || String(a.typeId).localeCompare(String(b.typeId))),
  }
  info('Vehicle capacity estimate', simple)
}
