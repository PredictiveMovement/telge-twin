// utils/fleetGenerator.ts
// Waste-type-baserad generator (ORIGINAL för simulering).
// Dessutom exporterar vi hjälpfunktioner för att bygga "flotta-kort" till UI:t.

import { OriginalBookingData } from '../../../simulator/lib/types/originalBookingData'

export interface VehicleSpec {
  originalId: string
  type: string
  description: string
  weight?: number
  parcelCapacity?: number
  fackDetails?: FackDetail[]
  usageCount: number
}

export interface FackDetail {
  fackNumber: number
  avfallstyper: FackWasteType[]
  volym?: number
  vikt?: number
}

export interface FackWasteType {
  avftyp: string
  volymvikt?: number | null
  fyllnadsgrad?: number | null
  beskrivning?: string | null
}

export interface StandardizedBooking {
  id: string
  vehicleId: string
  recyclingType: string
  position: {
    lat: number
    lng: number
  }
  destination: {
    lat: number
    lng: number
    name: string
  }
  pickup: {
    lat: number
    lng: number
    name: string
    departureTime: string
  }
  serviceType: string
  order: string
  sender: string
  weight: number
  originalRecord: any
  originalData?: OriginalBookingData
}

export interface FleetConfiguration {
  name: string
  hubAddress: string
  recyclingTypes: string[]
  vehicles: VehicleSpec[]
  preAssignedBookings: Record<string, StandardizedBooking[]>
  bookingCount: number
  source: 'waste-type-based'
}

export interface GeneratedFleetData {
  fleets: FleetConfiguration[]
  allBookings: StandardizedBooking[]
}

// ---------------------------------- RouteRecord + Settings
export type RouteRecord = {
  Turid: string
  Avftyp: string
  Bil: string
  Lat: number
  Lng: number
  Tjtyp?: string
  Turordningsnr?: string | number
  Kundnr?: number
  Hsnr?: number
  Tjnr?: number
  Frekvens?: string
  Datum?: string
  Dec?: string
  Schemalagd?: number
  [key: string]: any
}

type BilSpec = {
  ID: string
  BESKRIVNING?: string
  FACK1_VOLYM?: number
  FACK2_VOLYM?: number
  FACK3_VOLYM?: number
  FACK4_VOLYM?: number
  FACK1_VIKT?: number
  FACK2_VIKT?: number
  FACK3_VIKT?: number
  FACK4_VIKT?: number
  FACK?: { FACK: number; AVFTYP: string }[]
  [key: string]: any
}

type AvfSpec = { ID: string; BESKRIVNING?: string; VOLYMVIKT?: number }
type TjSpec = {
  ID: string
  BESKRIVNING?: string
  VOLYM?: number
  FYLLNADSGRAD?: number
}
type FreqSpec = { ID: string; BESKRIVNING?: string }

export type Settings = {
  bilar?: BilSpec[]
  avftyper?: AvfSpec[]
  tjtyper?: TjSpec[]
  frekvenser?: FreqSpec[]
  hubAddress?: string
  [key: string]: any
}

// ---------------------------------- helpers
const byId = <T extends { ID: string }>(arr: T[] = []) =>
  Object.fromEntries(arr.map((x) => [x.ID, x]))

function mapDescriptionToVehicleClass(description: string): string {
  const desc = (description || '').toLowerCase()

  if (desc.includes('matbil') || desc.includes('matavfall')) return 'matbil'
  if (desc.includes('4-fack') || desc.includes('fyrfack')) return 'fyrfack'
  if (desc.includes('2-fack')) return '2-fack'
  if (desc.includes('baklastare')) return 'baklastare'
  if (desc.includes('frontlastare')) return 'frontlastare'
  if (desc.includes('skåpbil') || desc.includes('skapbil')) return 'skåpbil'
  if (desc.includes('kranbil')) return 'kranbil'
  if (desc.includes('lastväxlare') || desc.includes('lastvxl'))
    return 'lastväxlare'
  if (desc.includes('trädgård')) return 'trädgårdsavfall'
  if (desc.includes('spolbil') || desc.includes('avfett')) return 'spolbil'
  if (desc.includes('sortering')) return 'sorteringsteam'
  if (desc.includes('latrin')) return 'latrin'
  if (desc.includes('städ') || desc.includes('åvs')) return 'städ'
  if (desc.includes('personal') || desc.includes('åvc')) return 'personal'
  if (desc.includes('högservice')) return 'högservice'

  if (/^\d+/.test(desc) && desc.length <= 4) return 'truck'
  return 'truck'
}

function extractFackDetails(
  bilSpec: any,
  bookings: StandardizedBooking[],
  settings: any
): FackDetail[] {
  if (!bilSpec?.FACK || !Array.isArray(bilSpec.FACK)) return []

  const fackMap = new Map<number, FackWasteType[]>()

  bilSpec.FACK.forEach((fack: any) => {
    const fackNr = fack.FACK
    const avfallstyp = fack.AVFTYP
    if (!fackNr || !avfallstyp) return

    if (!fackMap.has(fackNr)) fackMap.set(fackNr, [])

    const avftypSpec = settings.avftyper?.find((a: any) => a.ID === avfallstyp)
    const volymvikt = avftypSpec?.VOLYMVIKT || null
    const fyllnadsgrad = getFyllnadsgradForAvftyp(
      avfallstyp,
      bookings,
      settings
    )

    const wasteType: FackWasteType = {
      avftyp: avfallstyp,
      volymvikt,
      fyllnadsgrad,
      beskrivning: avftypSpec?.BESKRIVNING || null,
    }
    fackMap.get(fackNr)!.push(wasteType)
  })

  return Array.from(fackMap.entries())
    .map(([fackNumber, avfallstyper]) => ({
      fackNumber,
      avfallstyper,
      volym: getFackVolym(bilSpec, fackNumber),
      vikt: getFackVikt(bilSpec, fackNumber),
    }))
    .sort((a, b) => a.fackNumber - b.fackNumber)
}

function getFyllnadsgradForAvftyp(
  avftyp: string,
  bookings: StandardizedBooking[],
  settings: any
): number | null {
  const relevantBookings = bookings.filter((b) => b.recyclingType === avftyp)
  if (relevantBookings.length === 0) return null

  const tjtyper = [
    ...new Set(
      relevantBookings
        .map((b) => b.originalData?.originalTjtyp || b.originalRecord?.Tjtyp)
        .filter(Boolean)
    ),
  ]
  if (tjtyper.length === 0) return null

  let total = 0
  let count = 0
  for (const tj of tjtyper) {
    const spec = settings.tjtyper?.find((t: any) => t.ID === tj)
    if (spec?.FYLLNADSGRAD !== undefined) {
      total += spec.FYLLNADSGRAD
      count++
    }
  }
  return count > 0 ? Math.round(total / count) : null
}

function getFackVolym(bilSpec: any, fackNumber: number): number | null {
  return bilSpec[`FACK${fackNumber}_VOLYM`] || null
}
function getFackVikt(bilSpec: any, fackNumber: number): number | null {
  return bilSpec[`FACK${fackNumber}_VIKT`] || null
}

function calculateParcelCapacity(bilSpec: any, vehicleClass: string): number {
  const totalVolume =
    (bilSpec.FACK1_VOLYM || 0) +
    (bilSpec.FACK2_VOLYM || 0) +
    (bilSpec.FACK3_VOLYM || 0) +
    (bilSpec.FACK4_VOLYM || 0)

  if (totalVolume > 0) return Math.floor(totalVolume / 10)

  const defaults: Record<string, number> = {
    truck: 200,
    baklastare: 150,
    fyrfack: 300,
    '2-fack': 250,
    matbil: 100,
    frontlastare: 400,
    skåpbil: 50,
    kranbil: 300,
    lastväxlare: 500,
    trädgårdsavfall: 180,
    spolbil: 200,
    sorteringsteam: 120,
    latrin: 150,
    städ: 80,
    personal: 40,
    högservice: 350,
  }
  return defaults[vehicleClass] || 200
}

// ---------------------------------- huvudgenerator (waste-type based)
export function generateFleetsAndBookings(
  routeData: RouteRecord[],
  settings: any
): GeneratedFleetData {
  const allBookings = transformToStandardizedBookings(routeData)

  const vehicleGroups = groupBookingsByVehicle(allBookings)
  const vehiclePrimaryWasteTypes =
    determineVehiclePrimaryWasteTypes(vehicleGroups)

  const fleets = createFleetsFromVehicleGroups(
    vehicleGroups,
    vehiclePrimaryWasteTypes,
    settings
  )

  return { fleets, allBookings }
}

function transformToStandardizedBookings(
  routeData: RouteRecord[]
): StandardizedBooking[] {
  return (routeData || [])
    .filter((r) => r.Avftyp && r.Bil && r.Lat && r.Lng)
    .map((record) => {
      const originalData = {
        originalTurid: record.Turid,
        originalKundnr: record.Kundnr || 0,
        originalHsnr: record.Hsnr || 0,
        originalTjnr: record.Tjnr || 0,
        originalAvftyp: record.Avftyp,
        originalTjtyp: record.Tjtyp || 'standard',
        originalFrekvens: record.Frekvens || '',
        originalDatum: record.Datum || '',
        originalBil: record.Bil,
        originalSchemalagd: record.Schemalagd || 0,
        originalDec: record.Dec || '',
        originalTurordningsnr:
          typeof record.Turordningsnr === 'number'
            ? record.Turordningsnr
            : parseInt(String(record.Turordningsnr)) || 0,
        originalRouteRecord: record,
      } as OriginalBookingData

      return {
        id: `${record.Turid}-${record.Kundnr || 0}-${record.Hsnr || 0}-${
          record.Tjnr || 0
        }`,
        vehicleId: record.Bil,
        recyclingType: record.Avftyp,
        position: { lat: record.Lat, lng: record.Lng },
        destination: {
          lat: 59.135449,
          lng: 17.571239,
          name: 'LERHAGA 50, 151 66 Södertälje',
        },
        pickup: {
          lat: record.Lat,
          lng: record.Lng,
          name: `Pickup for ${record.Avftyp}`,
          departureTime: '08:00:00',
        },
        serviceType: record.Tjtyp || 'standard',
        order: String(record.Turordningsnr ?? '0'),
        sender: 'TELGE',
        weight: 10,
        originalRecord: record,
        originalData,
      }
    })
}

function groupBookingsByVehicle(
  bookings: StandardizedBooking[]
): Map<string, StandardizedBooking[]> {
  const groups = new Map<string, StandardizedBooking[]>()
  for (const b of bookings) {
    const key = b.vehicleId
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(b)
  }
  return groups
}

function determineVehiclePrimaryWasteTypes(
  vehicleGroups: Map<string, StandardizedBooking[]>
): Map<string, string> {
  const res = new Map<string, string>()
  vehicleGroups.forEach((bookings, vehicleId) => {
    const counts = new Map<string, number>()
    bookings.forEach((b) =>
      counts.set(b.recyclingType, (counts.get(b.recyclingType) || 0) + 1)
    )
    let best = ''
    let max = 0
    counts.forEach((c, k) => {
      if (c > max) {
        max = c
        best = k
      }
    })
    res.set(vehicleId, best)
  })
  return res
}

function createFleetsFromVehicleGroups(
  vehicleGroups: Map<string, StandardizedBooking[]>,
  vehiclePrimaryWasteTypes: Map<string, string>,
  settings: any
): FleetConfiguration[] {
  const wasteTypeVehicles = new Map<string, string[]>()
  vehiclePrimaryWasteTypes.forEach((wasteType, vehicleId) => {
    if (!wasteTypeVehicles.has(wasteType)) wasteTypeVehicles.set(wasteType, [])
    wasteTypeVehicles.get(wasteType)!.push(vehicleId)
  })

  const fleets: FleetConfiguration[] = []

  wasteTypeVehicles.forEach((vehicleIds, primaryWasteType) => {
    const vehicles = vehicleIds
      .map((vehicleId) => {
        const vehicleBookings = vehicleGroups.get(vehicleId) || []
        return createVehicleSpec(vehicleId, vehicleBookings, settings)
      })
      .filter(Boolean) as VehicleSpec[]

    if (vehicles.length === 0) return

    const preAssigned: Record<string, StandardizedBooking[]> = {}
    vehicleIds.forEach((vehicleId) => {
      preAssigned[vehicleId] = vehicleGroups.get(vehicleId) || []
    })

    const totalBookings = vehicleIds.reduce(
      (sum, id) => sum + (vehicleGroups.get(id) || []).length,
      0
    )

    fleets.push({
      name: `${primaryWasteType} Fleet`,
      hubAddress: 'LERHAGA 50, 151 66 Södertälje',
      recyclingTypes: [primaryWasteType],
      vehicles,
      preAssignedBookings: preAssigned,
      bookingCount: totalBookings,
      source: 'waste-type-based',
    })
  })

  return fleets.sort((a, b) => b.bookingCount - a.bookingCount)
}

function createVehicleSpec(
  vehicleId: string,
  bookings: StandardizedBooking[],
  settings: any
): VehicleSpec | null {
  const bilSpec = settings?.bilar?.find((bil: any) => bil.ID === vehicleId)
  if (!bilSpec) return null

  const vehicleType = mapDescriptionToVehicleClass(bilSpec.BESKRIVNING || '')
  const fackDetails = extractFackDetails(bilSpec, bookings, settings)

  return {
    originalId: vehicleId,
    type: vehicleType,
    description: bilSpec.BESKRIVNING || `Bil ${vehicleId}`,
    weight: bilSpec.FACK1_VIKT || 0,
    parcelCapacity: calculateParcelCapacity(bilSpec, vehicleType),
    fackDetails,
    usageCount: bookings.length,
  }
}

// ---------------------------------- Flottor till UI (för "Flottor"-tabben)

export type FleetCard = {
  id: string
  name: string
  vehicleNumbers: string[]
  vehicleTypes: string[]
  wasteTypes: string[]
  frequencies: string[]
  bookingsCount: number
}

export type FleetGroup = {
  id: string
  label?: string
  wasteIds: string[]
}

export type FleetConfig = {
  groups: FleetGroup[]
  fallbackTopN?: number
}

function mapBilDescToType(desc?: string): string {
  const d = (desc || '').toLowerCase()
  if (d.includes('baklastare')) return 'Baklastare'
  if (d.includes('frontlastare')) return 'Frontlastare'
  if (d.includes('skåpbil') || d.includes('skapbil')) return 'Skåpbil'
  if (d.includes('kranbil')) return 'Kranbil'
  if (d.includes('lastväxlare') || d.includes('lastvxl')) return 'Lastväxlare'
  if (d.includes('matavfall') || d.includes('matbil')) return 'Matbil'
  if (d.includes('4-fack') || d.includes('fyrfack')) return 'Fyrfack'
  if (d.includes('2-fack')) return '2-fack'
  if (/^\d+/.test(d) && d.length <= 4) return 'Lastbil'
  return 'Lastbil'
}

/** Bygg 1..N flotta-kort från valda avfallstyper (alt. topp-N vanligaste). */
export function generateFleetCardsByAvfall(
  routeData: RouteRecord[],
  settings: Settings,
  selectedAvfallstyper?: string[]
): FleetCard[] {
  const avfIndex: Record<string, AvfSpec> = byId(settings?.avftyper || [])
  const bilIndex: Record<string, BilSpec> = byId(settings?.bilar || [])
  const freqIndex: Record<string, FreqSpec> = byId(settings?.frekvenser || [])

  const valid = (routeData || []).filter((r) => r && r.Bil && r.Avftyp)

  let targets = selectedAvfallstyper?.filter(Boolean) || []
  if (targets.length === 0) {
    const counts = new Map<string, number>()
    for (const r of valid) counts.set(r.Avftyp, (counts.get(r.Avftyp) || 0) + 1)
    targets = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id)
  }

  const fleets: FleetCard[] = []
  for (const avf of targets) {
    const sub = valid.filter((r) => r.Avftyp === avf)
    if (!sub.length) continue

    const vehicleNumbers = Array.from(new Set(sub.map((r) => r.Bil))).sort()
    const vehicleTypes = Array.from(
      new Set(
        vehicleNumbers.map((id) => mapBilDescToType(bilIndex[id]?.BESKRIVNING))
      )
    )
    const freqNames = Array.from(
      new Set(
        sub
          .map((r) =>
            r.Frekvens ? freqIndex[r.Frekvens]?.BESKRIVNING || r.Frekvens : ''
          )
          .filter(Boolean)
      )
    )
    const name = avfIndex[avf]?.BESKRIVNING
      ? `Flotta – ${avfIndex[avf].BESKRIVNING}`
      : `Flotta – ${avf}`

    fleets.push({
      id: `fleet-${avf}`,
      name,
      vehicleNumbers,
      vehicleTypes,
      wasteTypes: [avfIndex[avf]?.BESKRIVNING || avf],
      frequencies: freqNames,
      bookingsCount: sub.length,
    })
  }

  return fleets.sort((a, b) => b.bookingsCount - a.bookingsCount)
}

/** Flottor från konfigurerade grupper (intersectar ev. valda avfallstyper). */
export function generateFleetCardsFromConfig(
  routeData: RouteRecord[],
  settings: Settings,
  config: FleetConfig,
  selectedAvfallstyper?: string[]
): FleetCard[] {
  const groups = config?.groups || []
  if (!groups.length) {
    return generateFleetCardsByAvfall(routeData, settings, selectedAvfallstyper)
  }

  const avfIndex: Record<string, AvfSpec> = byId(settings?.avftyper || [])
  const bilIndex: Record<string, BilSpec> = byId(settings?.bilar || [])
  const freqIndex: Record<string, FreqSpec> = byId(settings?.frekvenser || [])
  const valid = (routeData || []).filter((r) => r && r.Bil && r.Avftyp)

  const selectedSet = new Set((selectedAvfallstyper || []).filter(Boolean))
  const fleets: FleetCard[] = []

  for (const g of groups) {
    if (selectedSet.size > 0 && !g.wasteIds.some((id) => selectedSet.has(id))) {
      continue
    }
    const wasteSet = new Set(g.wasteIds)
    const sub = valid.filter((r) => wasteSet.has(r.Avftyp))
    if (!sub.length) continue

    const vehicleNumbers = Array.from(new Set(sub.map((r) => r.Bil))).sort()
    const vehicleTypes = Array.from(
      new Set(
        vehicleNumbers.map((id) => mapBilDescToType(bilIndex[id]?.BESKRIVNING))
      )
    )
    const freqNames = Array.from(
      new Set(
        sub
          .map((r) =>
            r.Frekvens ? freqIndex[r.Frekvens]?.BESKRIVNING || r.Frekvens : ''
          )
          .filter(Boolean)
      )
    )

    const firstId = g.wasteIds[0]
    const firstLabel = firstId
      ? avfIndex[firstId]?.BESKRIVNING || firstId
      : 'Flotta'
    const name = g.label ? g.label : `Flotta – ${firstLabel}`

    const wasteNames = Array.from(
      new Set(
        g.wasteIds.map((id) => avfIndex[id]?.BESKRIVNING || id).filter(Boolean)
      )
    )

    fleets.push({
      id: `fleetgrp-${g.id}`,
      name,
      vehicleNumbers,
      vehicleTypes,
      wasteTypes: wasteNames,
      frequencies: freqNames,
      bookingsCount: sub.length,
    })
  }

  if (!fleets.length && valid.length) {
    return generateFleetCardsByAvfall(
      routeData,
      settings,
      selectedAvfallstyper?.length ? selectedAvfallstyper : undefined
    )
  }

  return fleets.sort((a, b) => b.bookingsCount - a.bookingsCount)
}

// ---------------------------------- TurID → en (1) flotta (adapter)
/**
 * Bygger en enda flotta från valfritt urval av routeData (t.ex. valda TurID).
 *
 * - Använder waste-type-baserade generatorn internt för att få korrekta VehicleSpec
 *   och standardiserade bokningar, men packar ihop allt till EN flotta.
 */
export function buildSingleFleetFromRouteData(
  routeData: RouteRecord[],
  settings: Settings,
  name: string = 'Flotta – Valda TurID'
): FleetConfiguration[] {
  const { fleets, allBookings } = generateFleetsAndBookings(
    routeData,
    settings as any
  )

  // Union av vehicle-specs (unika på originalId)
  const vehicleMap = new Map<string, VehicleSpec>()
  for (const f of fleets) {
    for (const v of f.vehicles || []) {
      if (!vehicleMap.has(v.originalId)) vehicleMap.set(v.originalId, v)
    }
  }

  // Mergad preAssignedBookings per fordon
  const preAssigned: Record<string, StandardizedBooking[]> = {}
  for (const f of fleets) {
    const pa = f.preAssignedBookings || {}
    for (const [veh, list] of Object.entries(pa)) {
      if (!preAssigned[veh]) preAssigned[veh] = []
      preAssigned[veh].push(...list)
    }
  }

  // Recycling-typer från allBookings (eller routeData)
  const recyclingTypes = Array.from(
    new Set(
      (allBookings.length ? allBookings : []).map((b) => b.recyclingType)
    )
  )

  const bookingCount = Object.values(preAssigned).reduce(
    (sum, arr) => sum + (arr?.length || 0),
    0
  )

  const singleFleet: FleetConfiguration = {
    name,
    hubAddress: (settings as any)?.hubAddress || 'LERHAGA 50, 151 66 Södertälje',
    recyclingTypes,
    vehicles: Array.from(vehicleMap.values()),
    preAssignedBookings: preAssigned,
    bookingCount,
    source: 'route-data',
  }

  return [singleFleet]
}
