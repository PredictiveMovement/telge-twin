import { type Settings } from '@/utils/fleetGenerator'

interface RouteRecord {
  Turid: string
  Datum: string
  Tjtyp: string
  Lat: number
  Lng: number
  Bil: string
  Turordningsnr: string
  Avftyp: string
  [key: string]: any
}

interface FilterCriteria {
  selectedBils?: string[]
  selectedAvftyper?: string[]
  selectedFrekvenser?: string[]
  selectedTjtyper?: string[]
}

// Helper function to extract unique values and create info objects
export const extractInfoFromData = (data: RouteRecord[]) => {
  const vehicles = new Map<string, any>()
  const avfallstyper = new Set<string>()
  const tjtyper = new Set<string>()

  data.forEach((record) => {
    const vehicleId = record.Bil
    if (!vehicles.has(vehicleId)) {
      vehicles.set(vehicleId, {
        ID: vehicleId,
        BESKRIVNING: `Bil ${vehicleId}`,
        FACK: [],
      })
    }
    avfallstyper.add(record.Avftyp)
    tjtyper.add(record.Tjtyp)
  })

  return {
    bilar: Array.from(vehicles.values()),
    avftyper: Array.from(avfallstyper).map((typ) => ({
      ID: typ,
      BESKRIVNING: typ,
      VOLYMVIKT: 100,
    })),
    tjtyper: Array.from(tjtyper).map((typ) => ({
      ID: typ,
      BESKRIVNING: typ,
      VOLYM: 0,
      FYLLNADSGRAD: 100,
    })),
  }
}

// Helper to get unique values from a specific field
export const getUniqueValues = (
  data: RouteRecord[],
  field: keyof RouteRecord
) => [...new Set(data.map((r) => r[field]))].filter(Boolean)

// Filter data based on criteria
export const filterRouteData = (
  data: RouteRecord[],
  criteria: FilterCriteria
) => {
  if (!data.length) return []

  return data.filter((record) => {
    const filters = [
      { criteria: criteria.selectedBils, value: record.Bil },
      { criteria: criteria.selectedAvftyper, value: record.Avftyp },
      { criteria: criteria.selectedTjtyper, value: record.Tjtyp },
    ]

    return filters.every(
      ({ criteria, value }) => !criteria?.length || criteria.includes(value)
    )
  })
}

// Get settings for preview, with localStorage fallback
export const getSettingsForPreview = (
  uploadedData: RouteRecord[],
  originalFilename: string
): Settings => {
  try {
    if (!uploadedData.length) {
      return { avftyper: [], bilar: [], tjtyper: [], frekvenser: [] }
    }

    const fileContent = localStorage.getItem(`fileContent_${originalFilename}`)
    if (fileContent) {
      const parsed = JSON.parse(fileContent)
      if (parsed.settings) return parsed.settings as Settings
    }

    return extractInfoFromData(uploadedData) as Settings
  } catch (error) {
    return { avftyper: [], bilar: [], tjtyper: [], frekvenser: [] }
  }
}

// Process uploaded file and extract data
export const processUploadedFile = (rawData: any, fileName: string) => {
  let data: any[]

  if (Array.isArray(rawData)) {
    data = rawData
  } else if (rawData.routeData && Array.isArray(rawData.routeData)) {
    data = rawData.routeData
    // Store original file content for settings extraction
    localStorage.setItem(`fileContent_${fileName}`, JSON.stringify(rawData))
  } else {
    throw new Error('Invalid data format')
  }

  return data
}

export type { RouteRecord, FilterCriteria }
