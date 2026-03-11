import type { RouteEstimate } from '@/api/simulator'

export interface VehicleFeasibility {
  vehicleId: string
  stopCount: number
  unreachableStopCount: number
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

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

export function computeFeasibility(
  estimates: RouteEstimate[],
  startTime: string,
  endTime: string
): FeasibilityResult {
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = parseTimeToMinutes(endTime)
  const workdayMinutes =
    endMinutes <= startMinutes
      ? endMinutes + 24 * 60 - startMinutes
      : endMinutes - startMinutes
  const availableMinutes = Math.max(0, workdayMinutes)

  const vehicles: VehicleFeasibility[] = estimates.map((est) => {
    const estimatedMinutes = est.durationSeconds / 60
    const utilization =
      availableMinutes > 0
        ? (estimatedMinutes / availableMinutes) * 100
        : estimatedMinutes > 0
          ? 999
          : 100

    let status: VehicleFeasibility['status'] = 'fits'
    if ((est.unreachableStopCount || 0) > 0 || utilization > 100) {
      status = 'overflows'
    }
    else if (utilization > 80) status = 'tight'

    return {
      vehicleId: est.vehicleId,
      stopCount: est.stopCount,
      unreachableStopCount: est.unreachableStopCount || 0,
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
