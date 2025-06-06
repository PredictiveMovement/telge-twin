export interface VehicleInfo {
  id: string
  description: string
  fackConfiguration?: FackConfig[]
  usageCount: number
}

export interface FackConfig {
  fackNumber: number | null
  avfallstyper: string[]
  inferredFromUsage?: boolean
}

export interface FleetConfiguration {
  name: string
  hubAddress: string
  recyclingTypes: string[]
  vehicles: Record<string, number>
  compartmentConfiguration?: FackConfig[]
  swedishCategory: string
  vehicleIds: string[]
  assignedTurids: string[]
  bookingCount: number
  source: 'template' | 'custom'
  templateId?: string
}

export interface FleetTemplate {
  id: string
  name: string
  description: string
  wasteTypes: string[]
  vehicleTypes: string[]
  category: string
  priority: number
}

const PREDEFINED_FLEET_TEMPLATES: FleetTemplate[] = [
  {
    id: 'hushall',
    name: 'Hushållsavfall',
    description: 'Traditionellt hushållsavfall och hemsortering',
    wasteTypes: ['HUSHSORT', 'HEMSORT', 'BLANDAVF'],
    vehicleTypes: ['baklastare', '4-fack', 'hushåll'],
    category: 'KOMMUNALT_HUSHALL',
    priority: 5,
  },
  {
    id: 'plastforpackningar',
    name: 'Plastförpackningar',
    description: 'Plastförpackningar inklusive BNI',
    wasteTypes: ['PLASTFÖRP', 'BPLASTFÖRP'],
    vehicleTypes: ['2-fack', 'högservice', 'frontlastare'],
    category: 'PRODUCENT_FORPACKNING',
    priority: 10,
  },
  {
    id: 'metallforpackningar',
    name: 'Metallförpackningar',
    description: 'Metallförpackningar inklusive BNI',
    wasteTypes: ['METFÖRP', 'BMETFÖRP'],
    vehicleTypes: ['2-fack', 'högservice', 'frontlastare'],
    category: 'PRODUCENT_FORPACKNING',
    priority: 9,
  },
  {
    id: 'papper',
    name: 'Papper & Kartong',
    description: 'Returpapper och wellpapp',
    wasteTypes: [
      'RETURPAPP',
      'BRETURPAPP',
      'WELLPAPP',
      'PAPPFÖRP',
      'BPAPPFÖRP',
    ],
    vehicleTypes: ['2-fack', 'frontlastare', 'högservice'],
    category: 'PRODUCENT_PAPPER',
    priority: 7,
  },
  {
    id: 'glas',
    name: 'Glasåtervinning',
    description: 'Färgat och ofärgat glas',
    wasteTypes: ['GLOF', 'GLFÄ', 'BGLOF', 'BGLFÄ'],
    vehicleTypes: ['2-fack', 'högservice'],
    category: 'PRODUCENT_GLAS',
    priority: 6,
  },
  {
    id: 'organiskt',
    name: 'Organiskt Avfall',
    description: 'Matavfall och trädgårdsavfall',
    wasteTypes: ['MATAVF', 'TRÄDGÅRD'],
    vehicleTypes: ['baklastare', 'matbil', 'trädgård'],
    category: 'KOMMUNALT_ORGANISKT',
    priority: 4,
  },
  {
    id: 'specialavfall',
    name: 'Specialavfall',
    description: 'Farligt avfall, elektronik och textil',
    wasteTypes: ['FA', 'ELAVF', 'TEXTIL'],
    vehicleTypes: ['skåpbil', 'specialfordon'],
    category: 'SPECIALAVFALL',
    priority: 3,
  },
  {
    id: 'slam-latrin',
    name: 'Slam & Latrin',
    description: 'Slam, latrin och fett',
    wasteTypes: ['SLAM', 'LATRIN', 'FETT'],
    vehicleTypes: ['vakuum', 'spolbil'],
    category: 'SLAM_LATRIN',
    priority: 2,
  },
  {
    id: 'ovrigt',
    name: 'Övrigt Avfall',
    description: 'Övriga avfallstyper och fallback',
    wasteTypes: [
      'BRÄNN',
      'BRÄNNKL2',
      'DEP',
      'DUMP',
      'TRÄ',
      'HAVREASKA',
      'HÖGSMTRL',
      'FAST',
    ],
    vehicleTypes: ['universal', 'lastväxlare', 'kranbil'],
    category: 'ÖVRIGT',
    priority: 1,
  },
]

export function generateFleetConfiguration(
  routeData: any[],
  settings: any
): FleetConfiguration[] {
  const dataAnalysis = analyzeRouteData(routeData, settings)
  const fleets = createFleetsFromTemplates(dataAnalysis)
  return fleets
}

interface DataAnalysis {
  availableWasteTypes: string[]
  systemWasteTypes: string[]
  availableVehicles: VehicleInfo[]
  wasteTypeBookingCounts: Map<string, number>
  vehicleWasteUsage: Map<string, string[]>
  wasteVehicleUsage: Map<string, string[]>
  turidVehicleMapping: Map<string, string>
  totalBookings: number
  systemSettings: any
}

function analyzeRouteData(routeData: any[], settings: any): DataAnalysis {
  const wasteTypeBookingCounts = new Map<string, number>()
  const vehicleWasteUsage = new Map<string, string[]>()
  const wasteVehicleUsage = new Map<string, string[]>()
  const turidVehicleMapping = new Map<string, string>()
  const vehicleUsageCounts = new Map<string, number>()

  routeData.forEach((record) => {
    const wasteType = record.Avftyp
    const vehicleId = record.Bil
    const turid = record.Turid

    if (wasteType) {
      wasteTypeBookingCounts.set(
        wasteType,
        (wasteTypeBookingCounts.get(wasteType) || 0) + 1
      )

      if (vehicleId) {
        if (!vehicleWasteUsage.has(vehicleId)) {
          vehicleWasteUsage.set(vehicleId, [])
        }
        const vehicleWastes = vehicleWasteUsage.get(vehicleId)!
        if (!vehicleWastes.includes(wasteType)) {
          vehicleWastes.push(wasteType)
        }

        if (!wasteVehicleUsage.has(wasteType)) {
          wasteVehicleUsage.set(wasteType, [])
        }
        const wasteVehicles = wasteVehicleUsage.get(wasteType)!
        if (!wasteVehicles.includes(vehicleId)) {
          wasteVehicles.push(vehicleId)
        }

        vehicleUsageCounts.set(
          vehicleId,
          (vehicleUsageCounts.get(vehicleId) || 0) + 1
        )
      }
    }

    if (turid && vehicleId) {
      turidVehicleMapping.set(turid, vehicleId)
    }
  })

  const availableVehicles: VehicleInfo[] = Array.from(
    vehicleUsageCounts.entries()
  ).map(([vehicleId, usageCount]) => {
    const bilSpec = (settings.bilar || []).find((b: any) => b.ID === vehicleId)
    return {
      id: vehicleId,
      description: bilSpec?.BESKRIVNING || `Bil ${vehicleId}`,
      fackConfiguration: extractFackConfiguration(bilSpec),
      usageCount,
    }
  })

  const systemWasteTypes = (settings.avftyper || [])
    .map((avftyp: any) => avftyp.ID)
    .filter(Boolean)

  return {
    availableWasteTypes: Array.from(wasteTypeBookingCounts.keys()),
    systemWasteTypes,
    availableVehicles,
    wasteTypeBookingCounts,
    vehicleWasteUsage,
    wasteVehicleUsage,
    turidVehicleMapping,
    totalBookings: routeData.length,
    systemSettings: settings,
  }
}

function extractFackConfiguration(bilSpec: any): FackConfig[] {
  if (!bilSpec?.FACK || !Array.isArray(bilSpec.FACK)) {
    return []
  }

  const fackMap = new Map<number, string[]>()
  bilSpec.FACK.forEach((fack: any) => {
    const fackNr = fack.FACK
    const avfallstyp = fack.AVFTYP
    if (fackNr && avfallstyp) {
      if (!fackMap.has(fackNr)) {
        fackMap.set(fackNr, [])
      }
      fackMap.get(fackNr)!.push(avfallstyp)
    }
  })

  return Array.from(fackMap.entries())
    .map(([fackNumber, avfallstyper]) => ({
      fackNumber,
      avfallstyper,
    }))
    .sort((a, b) => (a.fackNumber || 0) - (b.fackNumber || 0))
}

function createFleetsFromTemplates(
  analysis: DataAnalysis
): FleetConfiguration[] {
  const fleets: FleetConfiguration[] = []
  const coveredWasteTypes = new Set<string>()

  const sortedTemplates = [...PREDEFINED_FLEET_TEMPLATES].sort(
    (a, b) => b.priority - a.priority
  )

  for (const template of sortedTemplates) {
    const matchingWasteTypes = template.wasteTypes.filter(
      (wasteType) =>
        analysis.availableWasteTypes.includes(wasteType) &&
        !coveredWasteTypes.has(wasteType)
    )

    if (matchingWasteTypes.length === 0) {
      continue
    }

    const compatibleVehicles = findCompatibleVehicles(
      matchingWasteTypes,
      analysis,
      template
    )

    if (compatibleVehicles.length === 0) {
      const fallbackVehicles = analysis.availableVehicles.slice(0, 1)
      compatibleVehicles.push(...fallbackVehicles)
    }

    const fleetBookings = calculateFleetBookings(
      matchingWasteTypes,
      compatibleVehicles.map((v) => v.id),
      analysis
    )

    const fleet: FleetConfiguration = {
      name: template.name,
      hubAddress: 'LERHAGA 50, 151 66 Södertälje',
      recyclingTypes: matchingWasteTypes,
      vehicles: generateVehicleConfig(
        compatibleVehicles,
        fleetBookings,
        matchingWasteTypes,
        analysis.systemSettings
      ),
      swedishCategory: template.category,
      vehicleIds: compatibleVehicles.map((v) => v.id),
      assignedTurids: getAssignedTurids(
        compatibleVehicles.map((v) => v.id),
        analysis
      ),
      bookingCount: fleetBookings,
      source: 'template',
      templateId: template.id,
    }

    if (fleet.bookingCount > 0) {
      fleets.push(fleet)

      matchingWasteTypes.forEach((wasteType) =>
        coveredWasteTypes.add(wasteType)
      )
    }
  }

  return fleets
}

function findCompatibleVehicles(
  wasteTypes: string[],
  analysis: DataAnalysis,
  template: FleetTemplate
): VehicleInfo[] {
  const directlyUsedVehicles = analysis.availableVehicles.filter((vehicle) =>
    wasteTypes.some((wasteType) => {
      const vehicleWastes = analysis.vehicleWasteUsage.get(vehicle.id) || []
      return vehicleWastes.includes(wasteType)
    })
  )

  if (directlyUsedVehicles.length > 0) {
    return directlyUsedVehicles
  }

  const typeCompatibleVehicles = analysis.availableVehicles.filter((vehicle) =>
    template.vehicleTypes.some((type) =>
      vehicle.description.toLowerCase().includes(type.toLowerCase())
    )
  )

  if (typeCompatibleVehicles.length > 0) {
    return typeCompatibleVehicles.slice(0, 2)
  }

  const fackCompatibleVehicles = analysis.availableVehicles.filter((vehicle) =>
    vehicle.fackConfiguration?.some((fack) =>
      fack.avfallstyper.some((avfallstyp) => wasteTypes.includes(avfallstyp))
    )
  )

  return fackCompatibleVehicles.slice(0, 2)
}

function calculateFleetBookings(
  wasteTypes: string[],
  vehicleIds: string[],
  analysis: DataAnalysis
): number {
  let totalBookings = 0

  wasteTypes.forEach((wasteType) => {
    const wasteTypeBookings =
      analysis.wasteTypeBookingCounts.get(wasteType) || 0
    totalBookings += wasteTypeBookings
  })

  return totalBookings
}

function generateVehicleConfig(
  vehicles: VehicleInfo[],
  bookingCount: number,
  wasteTypes: string[],
  settings: any
): Record<string, number> {
  let vehicleType = 'truck'

  if (vehicles.length > 0) {
    const vehicle = vehicles[0]
    if (
      vehicle.description.toLowerCase().includes('matbil') ||
      vehicle.description.toLowerCase().includes('matavfall')
    ) {
      vehicleType = 'matbil'
    } else if (
      vehicle.description.toLowerCase().includes('4-fack') ||
      vehicle.description.toLowerCase().includes('fyrfack')
    ) {
      vehicleType = 'fyrfack'
    } else if (vehicle.description.toLowerCase().includes('2-fack')) {
      vehicleType = '2-fack'
    } else if (vehicle.description.toLowerCase().includes('baklastare')) {
      vehicleType = 'baklastare'
    } else if (vehicle.description.toLowerCase().includes('frontlastare')) {
      vehicleType = 'frontlastare'
    } else if (vehicle.description.toLowerCase().includes('skåpbil')) {
      vehicleType = 'skåpbil'
    } else if (vehicle.description.toLowerCase().includes('kranbil')) {
      vehicleType = 'kranbil'
    } else if (vehicle.description.toLowerCase().includes('lastväxlare')) {
      vehicleType = 'lastväxlare'
    }
  }

  const optimalCount = calculateOptimalVehicleCount(
    bookingCount,
    wasteTypes,
    settings,
    vehicleType
  )

  return { [vehicleType]: optimalCount }
}

function getAssignedTurids(
  vehicleIds: string[],
  analysis: DataAnalysis
): string[] {
  const turids: string[] = []

  analysis.turidVehicleMapping.forEach((vehicleId, turid) => {
    if (vehicleIds.includes(vehicleId)) {
      turids.push(turid)
    }
  })

  return turids
}

const VEHICLE_BASE_CAPACITIES = {
  truck: 200,
  baklastare: 150,
  fyrfack: 300,
  '2-fack': 250,
  matbil: 100,
  frontlastare: 400,
  skåpbil: 50,
  kranbil: 300,
  lastväxlare: 500,
}

function calculateOptimalVehicleCount(
  bookings: number,
  wasteTypes: string[],
  settings: any,
  vehicleType: string = 'truck'
): number {
  const baseCapacity =
    VEHICLE_BASE_CAPACITIES[
      vehicleType as keyof typeof VEHICLE_BASE_CAPACITIES
    ] || VEHICLE_BASE_CAPACITIES.truck

  let adjustedCapacity = baseCapacity

  if (settings?.avftyper && wasteTypes.length > 0) {
    const avgVolymvikt =
      wasteTypes
        .map((wasteType) => {
          const avftyp = settings.avftyper.find((a: any) => a.ID === wasteType)
          return avftyp?.VOLYMVIKT || 100
        })
        .reduce((sum: number, val: number) => sum + val, 0) / wasteTypes.length

    const densityFactor = Math.min(2.0, Math.max(0.5, avgVolymvikt / 100))
    adjustedCapacity = Math.floor(baseCapacity / densityFactor)
  }

  if (wasteTypes.some((type) => ['MATAVF', 'LATRIN', 'FETT'].includes(type))) {
    adjustedCapacity = Math.floor(adjustedCapacity * 0.7)
  } else if (
    wasteTypes.some((type) => ['GLOF', 'GLFÄ', 'BGLOF', 'BGLFÄ'].includes(type))
  ) {
    adjustedCapacity = Math.floor(adjustedCapacity * 0.8)
  }

  const optimalCount = Math.max(
    1,
    Math.min(12, Math.ceil(bookings / Math.max(10, adjustedCapacity)))
  )

  return optimalCount
}
