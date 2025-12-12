import telgeSettings from '@/config/telge-settings.json'
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
  Hsadress?: string
  Nyckelkod?: string
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

  // Get settings for translations lookup
  const settings = (telgeSettings as { settings?: any }).settings || {}
  const avfTypSettings = settings.avftyper || []
  const tjTypSettings = settings.tjtyper || []

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
    avftyper: Array.from(avfallstyper).map((typ) => {
      const existing = avfTypSettings.find((a: any) => a.ID === typ)
      return {
        ID: typ,
        BESKRIVNING: existing?.BESKRIVNING || typ,
        VOLYMVIKT: existing?.VOLYMVIKT || 100,
      }
    }),
    tjtyper: Array.from(tjtyper).map((typ) => {
      const existing = tjTypSettings.find((t: any) => t.ID === typ)
      return {
        ID: typ,
        BESKRIVNING: existing?.BESKRIVNING || typ,
        VOLYM: existing?.VOLYM || 0,
        FYLLNADSGRAD: existing?.FYLLNADSGRAD || 100,
      }
    }),
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

// Get settings for preview
export const getSettingsForPreview = (): Settings =>
  (telgeSettings as { settings?: Settings }).settings ?? {
    avftyper: [],
    bilar: [],
    tjtyper: [],
    frekvenser: [],
  }

// Process uploaded file and extract data
export const processUploadedFile = (rawData: any, _fileName: string) => {
  let data: any[]

  if (Array.isArray(rawData)) {
    data = rawData
  } else if (rawData.routeData && Array.isArray(rawData.routeData)) {
    data = rawData.routeData
  } else {
    throw new Error('Invalid data format')
  }

  return data
}

export type { RouteRecord, FilterCriteria }
