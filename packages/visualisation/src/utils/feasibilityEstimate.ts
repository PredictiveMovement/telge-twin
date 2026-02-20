import type { RouteEstimate } from '@/api/simulator'

export interface BreakConfig {
  id: string
  name: string
  duration: number
  enabled: boolean
  desiredTime?: string
}

export interface VehicleFeasibility {
  vehicleId: string
  stopCount: number
  estimatedMinutes: number
  availableMinutes: number
  utilizationPercent: number
  status: 'fits' | 'tight' | 'overflows'
}

export interface FeasibilityResult {
  vehicles: VehicleFeasibility[]
  summary: {
    total: number
    fits: number
    tight: number
    overflows: number
  }
}

export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':')
  if (parts.length < 2) return 0
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
  return hours * 60 + minutes
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

export { formatMinutes }

export function computeFeasibility(
  estimates: RouteEstimate[],
  startTime: string,
  endTime: string,
  breaks: BreakConfig[],
  extraBreaks: BreakConfig[]
): FeasibilityResult {
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = parseTimeToMinutes(endTime)
  const workingMinutes = Math.max(0, endMinutes - startMinutes)

  const totalBreakMinutes = [...breaks, ...extraBreaks]
    .filter((b) => b.enabled)
    .reduce((sum, b) => sum + (b.duration || 0), 0)

  const availableMinutes = Math.max(0, workingMinutes - totalBreakMinutes)

  const vehicles: VehicleFeasibility[] = estimates.map((est) => {
    const estimatedMinutes = est.durationSeconds / 60
    const utilization =
      availableMinutes > 0 ? (estimatedMinutes / availableMinutes) * 100 : 100

    let status: VehicleFeasibility['status'] = 'fits'
    if (utilization > 100) status = 'overflows'
    else if (utilization > 80) status = 'tight'

    return {
      vehicleId: est.vehicleId,
      stopCount: est.stopCount,
      estimatedMinutes: Math.round(estimatedMinutes),
      availableMinutes: Math.round(availableMinutes),
      utilizationPercent: Math.round(utilization),
      status,
    }
  })

  // Sort: overflows first, then tight, then fits
  vehicles.sort((a, b) => {
    const order = { overflows: 0, tight: 1, fits: 2 }
    return order[a.status] - order[b.status]
  })

  const summary = {
    total: vehicles.length,
    fits: vehicles.filter((v) => v.status === 'fits').length,
    tight: vehicles.filter((v) => v.status === 'tight').length,
    overflows: vehicles.filter((v) => v.status === 'overflows').length,
  }

  return { vehicles, summary }
}
