// Import the original data interface
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

interface RouteRecord {
  Turid: string
  Avftyp: string
  Bil: string
  Lat: number
  Lng: number
  Tjtyp?: string
  Turordningsnr?: string
  Kundnr?: number
  Hsnr?: number
  Tjnr?: number
  Frekvens?: string
  Datum?: string
  Dec?: string
  Schemalagd?: number
  [key: string]: any
}

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

  return {
    fleets,
    allBookings,
  }
}

function transformToStandardizedBookings(
  routeData: RouteRecord[]
): StandardizedBooking[] {
  return routeData
    .filter((record) => record.Avftyp && record.Bil && record.Lat && record.Lng)
    .map((record, index) => {
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
            : parseInt(record.Turordningsnr) || 0,
        originalRouteRecord: record,
      }

      return {
        id: `${record.Turid}-${record.Kundnr || 0}-${record.Hsnr || 0}-${
          record.Tjnr || 0
        }`,
        vehicleId: record.Bil,
        recyclingType: record.Avftyp,
        position: {
          lat: record.Lat,
          lng: record.Lng,
        },
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
        order: record.Turordningsnr || '0',
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

  bookings.forEach((booking) => {
    const vehicleId = booking.vehicleId
    if (!groups.has(vehicleId)) {
      groups.set(vehicleId, [])
    }
    groups.get(vehicleId)!.push(booking)
  })

  return groups
}

function determineVehiclePrimaryWasteTypes(
  vehicleGroups: Map<string, StandardizedBooking[]>
): Map<string, string> {
  const vehiclePrimaryWasteTypes = new Map<string, string>()

  vehicleGroups.forEach((bookings, vehicleId) => {
    const wasteTypeCounts = new Map<string, number>()

    bookings.forEach((booking) => {
      const wasteType = booking.recyclingType
      wasteTypeCounts.set(wasteType, (wasteTypeCounts.get(wasteType) || 0) + 1)
    })

    let primaryWasteType = ''
    let maxCount = 0

    wasteTypeCounts.forEach((count, wasteType) => {
      if (count > maxCount) {
        maxCount = count
        primaryWasteType = wasteType
      }
    })

    vehiclePrimaryWasteTypes.set(vehicleId, primaryWasteType)
  })

  return vehiclePrimaryWasteTypes
}

function createFleetsFromVehicleGroups(
  vehicleGroups: Map<string, StandardizedBooking[]>,
  vehiclePrimaryWasteTypes: Map<string, string>,
  settings: any
): FleetConfiguration[] {
  const wasteTypeVehicles = new Map<string, string[]>()

  vehiclePrimaryWasteTypes.forEach((wasteType, vehicleId) => {
    if (!wasteTypeVehicles.has(wasteType)) {
      wasteTypeVehicles.set(wasteType, [])
    }
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

    if (vehicles.length === 0) {
      return
    }

    const preAssignedBookings: Record<string, StandardizedBooking[]> = {}
    vehicleIds.forEach((vehicleId) => {
      const vehicleBookings = vehicleGroups.get(vehicleId) || []
      preAssignedBookings[vehicleId] = vehicleBookings
    })

    const totalBookings = vehicleIds.reduce((sum, vehicleId) => {
      return sum + (vehicleGroups.get(vehicleId)?.length || 0)
    }, 0)

    const fleet: FleetConfiguration = {
      name: `${primaryWasteType} Fleet`,
      hubAddress: 'LERHAGA 50, 151 66 Södertälje',
      recyclingTypes: [primaryWasteType],
      vehicles,
      preAssignedBookings,
      bookingCount: totalBookings,
      source: 'waste-type-based',
    }

    fleets.push(fleet)
  })

  return fleets.sort((a, b) => b.bookingCount - a.bookingCount)
}

function createVehicleSpec(
  vehicleId: string,
  bookings: StandardizedBooking[],
  settings: any
): VehicleSpec | null {
  const bilSpec = settings.bilar?.find((bil: any) => bil.ID === vehicleId)
  if (!bilSpec) {
    return null
  }

  const vehicleType = mapDescriptionToVehicleClass(bilSpec.BESKRIVNING || '')
  const vehicleBookings = bookings.filter((b) => b.vehicleId === vehicleId)
  const fackDetails = extractFackDetails(bilSpec, vehicleBookings, settings)

  return {
    originalId: vehicleId,
    type: vehicleType,
    description: bilSpec.BESKRIVNING || `Bil ${vehicleId}`,
    weight: bilSpec.FACK1_VIKT || 0,
    parcelCapacity: calculateParcelCapacity(bilSpec, vehicleType),
    fackDetails,
    usageCount: vehicleBookings.length,
  }
}

function mapDescriptionToVehicleClass(description: string): string {
  const desc = description.toLowerCase()

  if (desc.includes('matbil') || desc.includes('matavfall')) {
    return 'matbil'
  }

  if (desc.includes('4-fack') || desc.includes('fyrfack')) {
    return 'fyrfack'
  }
  if (desc.includes('2-fack')) {
    return '2-fack'
  }

  if (desc.includes('baklastare')) {
    return 'baklastare'
  }
  if (desc.includes('frontlastare')) {
    return 'frontlastare'
  }
  if (desc.includes('skåpbil')) {
    return 'skåpbil'
  }
  if (desc.includes('kranbil')) {
    return 'kranbil'
  }
  if (desc.includes('lastväxlare') || desc.includes('lastvxl')) {
    return 'lastväxlare'
  }

  if (desc.includes('trädgård')) {
    return 'trädgårdsavfall'
  }
  if (desc.includes('spolbil') || desc.includes('avfett')) {
    return 'spolbil'
  }
  if (desc.includes('sortering')) {
    return 'sorteringsteam'
  }
  if (desc.includes('latrin')) {
    return 'latrin'
  }
  if (desc.includes('städ') || desc.includes('åvs')) {
    return 'städ'
  }
  if (desc.includes('personal') || desc.includes('åvc')) {
    return 'personal'
  }
  if (desc.includes('högservice')) {
    return 'högservice'
  }

  if (/^\d+/.test(desc) && desc.length <= 4) {
    return 'truck'
  }

  return 'truck'
}

function extractFackDetails(
  bilSpec: any,
  bookings: StandardizedBooking[],
  settings: any
): FackDetail[] {
  if (!bilSpec?.FACK || !Array.isArray(bilSpec.FACK)) {
    return []
  }

  const fackMap = new Map<number, FackWasteType[]>()

  bilSpec.FACK.forEach((fack: any) => {
    const fackNr = fack.FACK
    const avfallstyp = fack.AVFTYP

    if (fackNr && avfallstyp) {
      if (!fackMap.has(fackNr)) {
        fackMap.set(fackNr, [])
      }

      const avftypSpec = settings.avftyper?.find(
        (a: any) => a.ID === avfallstyp
      )
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
    }
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

  if (relevantBookings.length === 0) {
    return null
  }

  const tjtyper = [
    ...new Set(
      relevantBookings
        .map((b) => b.originalData?.originalTjtyp || b.originalRecord?.Tjtyp)
        .filter(Boolean)
    ),
  ]

  if (tjtyper.length === 0) {
    return null
  }

  let totalFyllnadsgrad = 0
  let count = 0

  tjtyper.forEach((tjtyp) => {
    const tjtypSpec = settings.tjtyper?.find((t: any) => t.ID === tjtyp)
    if (tjtypSpec?.FYLLNADSGRAD !== undefined) {
      totalFyllnadsgrad += tjtypSpec.FYLLNADSGRAD
      count++
    }
  })

  return count > 0 ? Math.round(totalFyllnadsgrad / count) : null
}

function getFackVolym(bilSpec: any, fackNumber: number): number | null {
  const volumKey = `FACK${fackNumber}_VOLYM`
  return bilSpec[volumKey] || null
}

function getFackVikt(bilSpec: any, fackNumber: number): number | null {
  const viktKey = `FACK${fackNumber}_VIKT`
  return bilSpec[viktKey] || null
}

function calculateParcelCapacity(bilSpec: any, vehicleClass: string): number {
  const totalVolume =
    (bilSpec.FACK1_VOLYM || 0) +
    (bilSpec.FACK2_VOLYM || 0) +
    (bilSpec.FACK3_VOLYM || 0) +
    (bilSpec.FACK4_VOLYM || 0)

  if (totalVolume > 0) {
    return Math.floor(totalVolume / 10)
  }

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
