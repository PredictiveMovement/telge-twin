import type { RouteRecord } from '@/components/routes/FileUpload'
import {
  buildSingleFleetFromRouteData,
  type Settings,
  type RouteRecord as FleetRouteRecord,
} from '@/utils/fleetGenerator'
import { byId, buildFackInfo, pickDominant, type BilSpec } from '@/utils/shared'

export interface PreparedOptimizationData {
  routeData: RouteRecord[]
  fleetConfiguration: Record<string, unknown>[]
  originalSettings: Record<string, unknown> | null
  removedCount: number
}

function matchesFack(
  avftyp: string | undefined,
  fack: Array<{ number: number; allowedWasteTypes: string[] }>
) {
  if (!avftyp) return false
  if (!Array.isArray(fack) || fack.length === 0) return true

  const hasAnyWasteTypes = fack.some(
    (item) =>
      Array.isArray(item.allowedWasteTypes) && item.allowedWasteTypes.length > 0
  )

  if (!hasAnyWasteTypes) return true

  return fack.some(
    (item) =>
      Array.isArray(item.allowedWasteTypes) &&
      item.allowedWasteTypes.includes(avftyp)
  )
}

export function prepareOptimizationData({
  uploadedData,
  selectedRoutes,
  selectedVehicles,
  previewSettings,
}: {
  uploadedData?: RouteRecord[]
  selectedRoutes?: string[]
  selectedVehicles?: Set<string>
  previewSettings?: Settings | null
}): PreparedOptimizationData | null {
  if (!uploadedData?.length || !selectedRoutes?.length) {
    return null
  }

  const selectedTurids = new Set(selectedRoutes)
  const routeData = uploadedData.filter(
    (record) =>
      selectedTurids.has(record.Turid) &&
      (!selectedVehicles?.size || selectedVehicles.has(record.Bil))
  )

  const byTur = new Map<string, RouteRecord[]>()
  routeData.forEach((record) => {
    if (!byTur.has(record.Turid)) byTur.set(record.Turid, [])
    byTur.get(record.Turid)!.push(record)
  })

  let removedCount = 0
  const filteredRouteData: RouteRecord[] = []

  for (const [, records] of Array.from(byTur.entries())) {
    const dominantBil = pickDominant(records.map((record) => record.Bil)) || records[0]?.Bil
    const bil = (byId(previewSettings?.bilar || []) as Record<string, BilSpec>)[
      dominantBil
    ]
    const fack = buildFackInfo(bil)
    const matchingRecords = records.filter((record) =>
      matchesFack(record.Avftyp, fack)
    )
    removedCount += records.length - matchingRecords.length
    filteredRouteData.push(...matchingRecords)
  }

  if (!filteredRouteData.length) {
    return {
      routeData: [],
      fleetConfiguration: [],
      originalSettings:
        (previewSettings as unknown as Record<string, unknown>) || null,
      removedCount,
    }
  }

  const fleetConfiguration = buildSingleFleetFromRouteData(
    filteredRouteData as FleetRouteRecord[],
    previewSettings || {},
    `Flotta – ${selectedRoutes.length}turer`
  ) as unknown as Record<string, unknown>[]

  return {
    routeData: filteredRouteData,
    fleetConfiguration,
    originalSettings:
      (previewSettings as unknown as Record<string, unknown>) || null,
    removedCount,
  }
}

export function buildOptimizationStartDate(
  filters: any,
  workingHours?: { start?: string }
): string {
  const startDate = filters?.dateRange?.from
    ? new Date(filters.dateRange.from)
    : new Date()

  const [hours, minutes] = (workingHours?.start || '06:00')
    .split(':')
    .map((value) => parseInt(value, 10))

  startDate.setHours(
    Number.isFinite(hours) ? hours : 6,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  )

  return startDate.toISOString()
}
