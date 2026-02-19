/**
 * Parse time string (HH:MM) to minutes since midnight.
 */
export function parseTimeToMinutes(
  timeStr?: string | null
): number | null {
  if (typeof timeStr !== 'string') return null
  const match = timeStr.trim().match(/^([0-9]{1,2}):([0-9]{2})$/)
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
