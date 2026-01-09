import { RouteRecord } from './utils'
import { Settings } from '@/utils/fleetGenerator'

export interface UploadFilterOptions {
  avfallstyper: string[]
  vehicleOptions: Array<{ id: string; display: string }>
  tjanstetyper: string[]
  veckodagar: string[]
  frekvenser: string[]
  frequencyLookup: Record<string, string>
}

const WEEKDAY_ORDER: string[] = [
  'Måndag',
  'Tisdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lördag',
  'Söndag',
]

const weekdayFormatter = new Intl.DateTimeFormat('sv-SE', { weekday: 'long' })

export const formatWeekdayLabel = (dateInput: string | Date | undefined): string | null => {
  if (!dateInput) return null

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (Number.isNaN(date.getTime())) return null

  const formatted = weekdayFormatter.format(date)
  if (!formatted) return null

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

const sortWeekdays = (values: Set<string>) => {
  return Array.from(values).sort((a, b) => {
    const idxA = WEEKDAY_ORDER.indexOf(a)
    const idxB = WEEKDAY_ORDER.indexOf(b)
    if (idxA === -1 && idxB === -1) return a.localeCompare(b)
    if (idxA === -1) return 1
    if (idxB === -1) return -1
    return idxA - idxB
  })
}

const sortAlpha = (values: Set<string>) => Array.from(values).sort((a, b) => a.localeCompare(b, 'sv'))

const buildVehicleOptions = (
  vehiclesInData: Set<string>,
  settings?: Settings
): Array<{ id: string; display: string }> => {
  const options: Array<{ id: string; display: string }> = []
  const byId: Record<string, { BESKRIVNING?: string }> = {}

  if (Array.isArray(settings?.bilar)) {
    settings!.bilar!.forEach((bil) => {
      if (bil?.ID) {
        byId[bil.ID] = { BESKRIVNING: bil.BESKRIVNING }
      }
    })
  }

  vehiclesInData.forEach((id) => {
    if (!id) return
    const description = byId[id]?.BESKRIVNING || `Fordon ${id}`
    options.push({ id, display: `${id} ${description}`.trim() })
  })

  // Sort on numeric id when possible, otherwise lexical
  return options.sort((a, b) => {
    const aNum = Number(a.id)
    const bNum = Number(b.id)
    const aValid = Number.isFinite(aNum)
    const bValid = Number.isFinite(bNum)
    if (aValid && bValid) return aNum - bNum
    if (aValid) return -1
    if (bValid) return 1
    return a.id.localeCompare(b.id, 'sv')
  })
}

const buildFrequencyLookup = (settings?: Settings) => {
  const lookupById = new Map<string, string>()

  if (Array.isArray(settings?.frekvenser)) {
    settings!.frekvenser!.forEach((freq) => {
      if (!freq?.ID) return
      lookupById.set(freq.ID, freq.BESKRIVNING || freq.ID)
    })
  }

  return lookupById
}

export const buildUploadFilterOptions = (
  uploadedData: RouteRecord[],
  settings?: Settings | null
): UploadFilterOptions => {
  const avfallstyper = new Set<string>()
  const fordonsnummer = new Set<string>()
  const tjanstetyper = new Set<string>()
  const frekvenser = new Set<string>()
  const veckodagar = new Set<string>()

  const frequencyIdToDescription = buildFrequencyLookup(settings ?? undefined)
  const descriptionToId = new Map<string, string>()

  uploadedData.forEach((record) => {
    if (record?.Avftyp) avfallstyper.add(record.Avftyp)
    if (record?.Bil) fordonsnummer.add(record.Bil)
    if (record?.Tjtyp) tjanstetyper.add(record.Tjtyp)
    if (record?.Frekvens) frekvenser.add(record.Frekvens)

    if (record?.Datum) {
      const label = formatWeekdayLabel(record.Datum)
      if (label) veckodagar.add(label)
    }
  })

  const frequencyLabels = new Set<string>()
  frekvenser.forEach((id) => {
    if (!id) return
    const description = frequencyIdToDescription.get(id) || id
    frequencyLabels.add(description)
    if (!descriptionToId.has(description)) {
      descriptionToId.set(description, id)
    }
  })

  return {
    avfallstyper: sortAlpha(avfallstyper),
    vehicleOptions: buildVehicleOptions(fordonsnummer, settings ?? undefined),
    tjanstetyper: sortAlpha(tjanstetyper),
    veckodagar: sortWeekdays(veckodagar),
    frekvenser: sortAlpha(frequencyLabels),
    frequencyLookup: Object.fromEntries(descriptionToId.entries()),
  }
}
