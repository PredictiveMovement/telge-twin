import { info } from '../log'
import {
  FackDetail,
  VehicleSpec,
  BookingLike,
  STANDARD_PICKUP_VOLUME_LITERS,
} from './types'
import { buildSettingsIndexes } from './utils'

/**
 * Finds the dominant (most common) service type from a list of bookings.
 * Returns the service type ID and its details from tjIndex.
 */
function findDominantServiceType(
  observedBookings: BookingLike[],
  tjIndex: Record<string, { ID: string; VOLYM?: number; FYLLNADSGRAD?: number }>
): { tjId: string; volym: number; fill: number } | null {
  const observedTj = observedBookings
    .map((b) => b?.originalRecord?.Tjtyp || b?.originalData?.originalTjtyp)
    .filter(Boolean)
  
  if (!observedTj.length) return null
  
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
  if (!tj) return null
  
  const volym = typeof tj.VOLYM === 'number' ? tj.VOLYM : STANDARD_PICKUP_VOLUME_LITERS
  const fill = typeof tj.FYLLNADSGRAD === 'number' ? tj.FYLLNADSGRAD : 100
  
  return { tjId: best, volym, fill }
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
  const { avfIndex, tjIndex } = buildSettingsIndexes(settings)

  // Determine expected pickup volume (liters) using observed dominant Tjtyp if possible
  let pickupVolumeLiters = STANDARD_PICKUP_VOLUME_LITERS
  let pickupVolumeSource: 'observed' | 'tjtyper' | 'fallback' = 'fallback'
  let pickupFillFactor = 100

  const dominantTj = findDominantServiceType(observedBookings, tjIndex)
  if (dominantTj) {
    pickupVolumeLiters = Math.max(1, Math.round((dominantTj.volym * dominantTj.fill) / 100))
    pickupVolumeSource = 'observed'
    pickupFillFactor = dominantTj.fill
  }

  const facks: FackDetail[] = Array.isArray(vehicle.fackDetails)
    ? (vehicle.fackDetails as FackDetail[])
    : []

  // Per-fack estimates for each allowed waste type
  const perFack: Array<{ fack: number; typeId: string; estimatedPickups: number | null }> = []

  for (let index = 0; index < facks.length; index++) {
    const f = facks[index]
    const fackNumber = typeof f.fackNumber === 'number' ? f.fackNumber : index + 1
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

      perFack.push({ fack: fackNumber, typeId, estimatedPickups })
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
  const { avfIndex, tjIndex } = buildSettingsIndexes(settings)
  
  const facks: FackDetail[] = Array.isArray(vehicle.fackDetails)
    ? (vehicle.fackDetails as FackDetail[])
    : []

  // Detect data quality issues
  const warnings: string[] = []
  const hasFackDetails = facks.length > 0
  const hasParcelCapacity = typeof vehicle.parcelCapacity === 'number' && vehicle.parcelCapacity > 0
  
  if (!hasFackDetails) {
    warnings.push('No fack details - using fallback capacity')
  }
  
  // Check if parcelCapacity looks like a default
  if (hasParcelCapacity && vehicle.parcelCapacity === 250) {
    warnings.push('parcelCapacity is default (250) - may not reflect actual vehicle capacity')
  } else if (typeof vehicle.parcelCapacity === 'number' && vehicle.parcelCapacity > 0 && vehicle.parcelCapacity < 10) {
    warnings.push(`parcelCapacity suspiciously low (${vehicle.parcelCapacity}) - fleet will use 250 as fallback`)
  }

  // Determine assumed pickup volume
  let assumedPickupInfo = `fallback: ${STANDARD_PICKUP_VOLUME_LITERS}L (100% fill)`
  const dominantTj = findDominantServiceType(observedBookings, tjIndex)
  if (dominantTj) {
    const actualVol = Math.max(1, Math.round((dominantTj.volym * dominantTj.fill) / 100))
    assumedPickupInfo = `observed: ${actualVol}L (${dominantTj.tjId}, ${dominantTj.fill}% fill)`
  }

  // Build detailed fack information
  const fackDetails = facks.map((f) => {
    const volM3 = typeof f.volym === 'number' && f.volym > 0 ? f.volym : null
    const volLiters = volM3 ? volM3 * 1000 : null
    const weightKg = typeof f.vikt === 'number' && f.vikt > 0 ? f.vikt : null
    const types = (f.avfallstyper || []).map((w) => w.avftyp).filter(Boolean)
    
    const typeDescriptions = types.map((typeId) => {
      const avfInfo = avfIndex[typeId]
      const desc = avfInfo?.BESKRIVNING || typeId
      return desc
    })
    
    return {
      fackNumber: f.fackNumber,
      volumeM3: volM3,
      volumeLiters: volLiters,
      weightKg: weightKg,
      allowedTypes: types,
      typeDescriptions: typeDescriptions,
      hasVolumeLimit: volM3 !== null,
      hasWeightLimit: weightKg !== null,
    }
  })

  // Group estimates by fack for cleaner output
  const estimatesByFack: Record<number, Array<{ typeId: string; estimatedPickups: number | null }>> = {}
  estimate.perFack.forEach((est) => {
    if (!estimatesByFack[est.fack]) {
      estimatesByFack[est.fack] = []
    }
    estimatesByFack[est.fack].push({ typeId: est.typeId, estimatedPickups: est.estimatedPickups })
  })

  const logData = {
    experimentId,
    fleet: fleetName,
    vehicleId: vehicle.originalId,
    description: vehicle.description || `Vehicle ${vehicle.originalId}`,
    parcelCapacity: vehicle.parcelCapacity || null,
    assumedPickup: assumedPickupInfo,
    warnings: warnings.length > 0 ? warnings : undefined,
    facks: fackDetails.length > 0 ? fackDetails : undefined,
    estimates: estimate.perFack
      .map((x) => {
        const avfInfo = avfIndex[x.typeId]
        return {
          fack: x.fack,
          typeId: x.typeId,
          typeDescription: avfInfo?.BESKRIVNING || x.typeId,
          estimatedPickups: x.estimatedPickups,
        }
      })
      .sort((a, b) => (a.fack - b.fack) || String(a.typeId).localeCompare(String(b.typeId))),
  }

  info(`Vehicle capacity: ${vehicle.originalId} (${vehicle.description || 'no description'})`, logData)
}

