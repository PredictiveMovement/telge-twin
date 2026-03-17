import { parseTimeToMinutes } from './utils/time'

export interface WorkingHoursInput {
  start?: string
  end?: string
}

export interface WorkdaySettings {
  start?: string
  end?: string
  startMinutes?: number
  endMinutes?: number
}

export interface BreakInput {
  id?: string
  enabled?: boolean
  duration?: number
  desiredTime?: string
  location?: string
  locationCoordinates?: { lat: number; lng: number }
}

export interface BreakSetting {
  id: string
  startMinutes: number
  durationMinutes: number
  location?: string
  locationCoordinates?: { lat: number; lng: number }
}

export function buildWorkdaySettings(
  workingHours?: WorkingHoursInput | null
): WorkdaySettings | null {
  if (!workingHours) return null

  const startMinutes = parseTimeToMinutes(workingHours.start)
  const endMinutes = parseTimeToMinutes(workingHours.end)

  if (startMinutes == null && endMinutes == null) {
    return null
  }

  return {
    ...workingHours,
    ...(startMinutes != null ? { startMinutes } : {}),
    ...(endMinutes != null ? { endMinutes } : {}),
  }
}

export function buildBreakSettings(
  breaks?: BreakInput[] | null,
  extraBreaks?: BreakInput[] | null
): BreakSetting[] {
  const candidates = [
    ...(Array.isArray(breaks) ? breaks : []),
    ...(Array.isArray(extraBreaks) ? extraBreaks : []),
  ]

  const parsed: BreakSetting[] = []

  candidates.forEach((candidate, index) => {
    if (!candidate || candidate.enabled === false) return

    const startMinutes = parseTimeToMinutes(candidate.desiredTime)
    if (startMinutes == null) return

    const durationMinutes =
      typeof candidate.duration === 'number' ? candidate.duration : 0
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return

    parsed.push({
      id: candidate.id || `break-${index}`,
      startMinutes,
      durationMinutes,
      ...(candidate.location ? { location: candidate.location } : {}),
      ...(candidate.locationCoordinates ? { locationCoordinates: candidate.locationCoordinates } : {}),
    })
  })

  return parsed
}
