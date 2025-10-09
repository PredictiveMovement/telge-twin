const MS_PER_MINUTE = 60 * 1000

const DEFAULT_SHIFT_MINUTES = 8 * 60

export type ScheduledBreak = {
  id: string
  startMs: number
  durationMs: number
  taken: boolean
}

export interface WorkdaySettingsLike {
  startMinutes?: number
  start?: string
  endMinutes?: number
  end?: string
}

export interface OptimizationSettingsLike {
  workingHours?: {
    start?: string
    end?: string
  }
}

export interface VirtualTimeLike {
  getWorkdayBounds?: () => { startMs: number; endMs: number }
  now?: () => number
}

type BreakCandidate = {
  id?: string
  startMinutes?: number
  durationMinutes?: number
  desiredTime?: string
  duration?: number
}

const parseMinutes = (value?: string | null): number | null => {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^([0-9]{1,2}):([0-9]{2})$/)
  if (!match) return null
  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  if (
    Number.isFinite(hours) &&
    Number.isFinite(minutes) &&
    hours >= 0 &&
    hours < 24 &&
    minutes >= 0 &&
    minutes < 60
  ) {
    return hours * 60 + minutes
  }
  return null
}

const resolveWorkdayStartMinutes = (
  dayStart: number,
  workdaySettings?: WorkdaySettingsLike | null,
  optimizationSettings?: OptimizationSettingsLike | null
): number | null => {
  if (typeof workdaySettings?.startMinutes === 'number') {
    return workdaySettings.startMinutes
  }

  const fromSettings =
    parseMinutes(workdaySettings?.start) ??
    parseMinutes(optimizationSettings?.workingHours?.start)

  if (fromSettings != null) {
    return fromSettings
  }

  const date = new Date(dayStart)
  if (Number.isNaN(date.getTime())) return null
  return date.getHours() * 60 + date.getMinutes()
}

const resolveWorkdayEndMinutes = (
  startMinutes: number | null,
  workdaySettings?: WorkdaySettingsLike | null,
  optimizationSettings?: OptimizationSettingsLike | null
): number | null => {
  if (typeof workdaySettings?.endMinutes === 'number') {
    return workdaySettings.endMinutes
  }

  const fromSettings =
    parseMinutes(workdaySettings?.end) ??
    parseMinutes(optimizationSettings?.workingHours?.end)

  if (fromSettings != null) {
    return fromSettings
  }

  if (startMinutes == null) return null
  return startMinutes + DEFAULT_SHIFT_MINUTES
}

const floorToDay = (timestamp: number): number => {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function buildBreakSchedule({
  virtualTime,
  breaks,
  workdaySettings,
  optimizationSettings,
}: {
  virtualTime?: VirtualTimeLike | null
  breaks?: BreakCandidate[] | null
  workdaySettings?: WorkdaySettingsLike | null
  optimizationSettings?: OptimizationSettingsLike | null
}): ScheduledBreak[] {
  const rawBreaks = Array.isArray(breaks) ? breaks : []
  if (!rawBreaks.length) return []

  const bounds = virtualTime?.getWorkdayBounds?.()
  const referenceTime =
    typeof virtualTime?.now === 'function' ? virtualTime.now() : Date.now()

  const startMinutes = resolveWorkdayStartMinutes(
    bounds?.startMs ?? referenceTime,
    workdaySettings,
    optimizationSettings
  )

  let dayStart = Number(bounds?.startMs)
  if (!Number.isFinite(dayStart)) {
    if (startMinutes != null) {
      dayStart = floorToDay(referenceTime) + startMinutes * MS_PER_MINUTE
    } else {
      dayStart = referenceTime
    }
  }

  let dayEnd = Number(bounds?.endMs)
  if (!Number.isFinite(dayEnd)) {
    const endMinutes = resolveWorkdayEndMinutes(
      startMinutes,
      workdaySettings,
      optimizationSettings
    )

    if (endMinutes != null && startMinutes != null) {
      dayEnd =
        dayStart + Math.max(0, endMinutes - startMinutes) * MS_PER_MINUTE
    } else {
      dayEnd = dayStart + DEFAULT_SHIFT_MINUTES * MS_PER_MINUTE
    }
  }

  const workdayStartMinutes = resolveWorkdayStartMinutes(
    dayStart,
    workdaySettings,
    optimizationSettings
  )
  const datasetMidnightMs =
    dayStart - (workdayStartMinutes ?? 0) * MS_PER_MINUTE

  return rawBreaks
    .map((candidate, index) => {
      const startMinutes =
        typeof candidate?.startMinutes === 'number'
          ? candidate.startMinutes
          : parseMinutes(candidate?.desiredTime)

      const durationMinutes =
        typeof candidate?.durationMinutes === 'number'
          ? candidate.durationMinutes
          : typeof candidate?.duration === 'number'
            ? candidate.duration
            : null

      if (
        startMinutes == null ||
        !Number.isFinite(startMinutes) ||
        durationMinutes == null ||
        !Number.isFinite(durationMinutes)
      ) {
        return null
      }

      const desiredStartMs =
        datasetMidnightMs + startMinutes * MS_PER_MINUTE
      const clampedStartMs = Math.max(dayStart, desiredStartMs)
      if (clampedStartMs >= dayEnd) return null

      const durationMs = Math.max(
        0,
        durationMinutes * MS_PER_MINUTE
      )
      if (durationMs <= 0) return null

      const id =
        typeof candidate.id === 'string'
          ? candidate.id
          : `break-${index}`

      return {
        id,
        startMs: clampedStartMs,
        durationMs,
        taken: false,
      }
    })
    .filter(
      (entry): entry is ScheduledBreak =>
        entry !== null && Number.isFinite(entry.startMs)
    )
    .sort((a, b) => a.startMs - b.startMs)
}
