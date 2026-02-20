import React, { useEffect, useState } from 'react'
import Layout from '@/components/layout/Layout'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import SaveOptimizationForm from '@/components/optimize/SaveOptimizationForm'
import { toast } from '@/hooks/use-toast'
import {
  saveRouteDataset,
  startSimulationFromDatasetRest,
  estimateRouteFeasibility,
  type RouteEstimate,
} from '@/api/simulator'
import {
  buildSingleFleetFromRouteData,
  type Settings,
} from '@/utils/fleetGenerator'
import { byId, buildFackInfo, pickDominant, type BilSpec } from '@/utils/shared'
import type { RouteRecord } from '@/components/routes/FileUpload'
import { useOptimizationContext } from '@/contexts/OptimizationContext'

const SaveOptimizationProjectPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { startOptimization } = useOptimizationContext()

  const [routeEstimates, setRouteEstimates] = useState<RouteEstimate[]>([])
  const [estimatesLoading, setEstimatesLoading] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Get data from navigation state
  const navigationState = location.state as {
    selectedRoutes?: string[]
    filters?: any
    viewMode?: string
    selectedItems?: any[]
    uploadedData?: RouteRecord[]
    originalFilename?: string
    previewSettings?: Settings
  } | null

  // Fetch OSRM-based route estimates on mount
  useEffect(() => {
    const uploadedData = navigationState?.uploadedData
    const selectedRoutes = navigationState?.selectedRoutes
    if (!uploadedData?.length || !selectedRoutes?.length) return

    const DEPOT: [number, number] = [17.571239, 59.135449]
    const selectedTurids = new Set(selectedRoutes)
    const selected = uploadedData.filter((r) => selectedTurids.has(r.Turid))

    // Group by vehicle (Bil)
    const byVehicle = new Map<string, RouteRecord[]>()
    for (const r of selected) {
      const bil = r.Bil || 'unknown'
      if (!byVehicle.has(bil)) byVehicle.set(bil, [])
      byVehicle.get(bil)!.push(r)
    }

    // Build coordinate chains per vehicle: depot → stops (by Turordningsnr) → depot
    const vehicles = Array.from(byVehicle.entries()).map(
      ([vehicleId, records]) => {
        const sorted = [...records].sort((a, b) => {
          const aOrd = parseInt(String(a.Turordningsnr ?? 0), 10) || 0
          const bOrd = parseInt(String(b.Turordningsnr ?? 0), 10) || 0
          return aOrd - bOrd
        })

        const stopCoords: [number, number][] = sorted
          .filter(
            (r) =>
              typeof r.Lat === 'number' &&
              typeof r.Lng === 'number' &&
              r.Lat !== 0 &&
              r.Lng !== 0
          )
          .map((r) => [r.Lng, r.Lat] as [number, number])

        return {
          vehicleId,
          coordinates: [DEPOT, ...stopCoords, DEPOT] as [number, number][],
        }
      }
    )

    if (vehicles.length === 0) return

    setEstimatesLoading(true)
    estimateRouteFeasibility(vehicles)
      .then((estimates) => setRouteEstimates(estimates))
      .catch(() => {
        // Silently fail — indicator just won't show
      })
      .finally(() => setEstimatesLoading(false))
  }, [navigationState?.uploadedData, navigationState?.selectedRoutes])

  const handleSaveOptimization = async (optimization: any) => {
    // Ensure archived flag exists
    const normalized = {
      ...optimization,
      archived: optimization?.archived ?? false,
    }

    // Create dataset from selection and save to Elasticsearch
    try {
      if (!navigationState?.uploadedData?.length) {
        toast.error('Ingen data att spara (saknar uploadedData).')
        return
      }
      if (!navigationState?.selectedRoutes?.length) {
        toast.error('Inget urval funnet att spara.')
        return
      }

      const uploadedData = navigationState.uploadedData
      const selectedTurids = new Set(navigationState.selectedRoutes)
      const previewSettings = navigationState.previewSettings as Settings
      const originalFilename = navigationState.originalFilename || 'routes.json'

      // Build selected route data with strict fack-matching per TurID
      const allSelected = uploadedData.filter((r) => selectedTurids.has(r.Turid))
      const byTur = new Map<string, RouteRecord[]>()
      for (const r of allSelected) {
        if (!byTur.has(r.Turid)) byTur.set(r.Turid, [])
        byTur.get(r.Turid)!.push(r)
      }

      const matchesFack = (
        avftyp: string | undefined,
        fack: Array<{ number: number; allowedWasteTypes: string[] }>
      ) => {
        if (!avftyp) return false
        // If no fack defined or all fack have no waste types, accept all
        if (!Array.isArray(fack) || fack.length === 0) return true
        
        // Check if any fack has allowedWasteTypes defined
        const hasAnyWasteTypes = fack.some(fx => 
          Array.isArray(fx.allowedWasteTypes) && fx.allowedWasteTypes.length > 0
        )
        
        // If no waste types defined in any fack, accept all
        if (!hasAnyWasteTypes) return true
        
        // Otherwise, check if waste type matches any fack
        for (const fx of fack) {
          if (
            Array.isArray(fx.allowedWasteTypes) &&
            fx.allowedWasteTypes.includes(avftyp)
          ) {
            return true
          }
        }
        return false
      }

      let removedCount = 0
      const selectedRouteData: RouteRecord[] = []
      for (const [, records] of Array.from(byTur.entries())) {
        const dominantBil = pickDominant(records.map((b) => b.Bil)) || records[0].Bil
        const bil = (byId(previewSettings?.bilar || []) as Record<string, BilSpec>)[
          dominantBil
        ]
        const fack = buildFackInfo(bil)
        const groupMatched = records.filter((r) => matchesFack(r.Avftyp, fack))
        removedCount += records.length - groupMatched.length
        selectedRouteData.push(...groupMatched)
      }

      if (removedCount > 0) {
        toast.info(`Filtrerat bort ${removedCount} bokningar utan passande fack`)
      }

      if (!selectedRouteData.length) {
        toast.error('Inga rader matchar ditt urval efter filtrering.')
        return
      }

      // Build fleet configuration and save dataset
      const selectionLabel = `${navigationState.selectedRoutes.length}turer`

      const fleetConfiguration = buildSingleFleetFromRouteData(
        selectedRouteData as any,
        previewSettings,
        `Flotta – ${selectionLabel}`
      )

      const res = await saveRouteDataset({
        name: normalized.name || 'Optimering',
        description: normalized.description || 'Sparad optimering',
        originalFilename,
        filterCriteria: navigationState.filters || { mode: navigationState.viewMode },
        routeData: selectedRouteData as unknown as Record<string, unknown>[],
        originalRecordCount: uploadedData.length,
        fleetConfiguration: fleetConfiguration as unknown as Record<string, unknown>[],
        originalSettings: previewSettings as unknown as Record<string, unknown>,
        optimizationSettings: {
          workingHours: normalized.workingHours,
          breaks: normalized.breaks,
          extraBreaks: normalized.extraBreaks,
        },
      })

      const datasetId = (res as any)?.data?.datasetId || (res as any)?.datasetId
      if ((res as any)?.success && datasetId) {
        // Calculate expected vehicle count from fleet configuration
        const expectedVehicleCount = fleetConfiguration.reduce(
          (sum, fleet) => sum + (fleet.vehicles?.length || 0), 0
        )

        // Start optimization animation (shows phases and navigates after first phase)
        startOptimization(datasetId, normalized.name || 'Optimering', {
          onNavigate: () => {
            navigate('/routes?tab=optimizations', { replace: true })
          },
          onComplete: () => {
            // Optional: any cleanup after animation completes
          },
          expectedVehicleCount,
        })

        // Determine start time from working hours
        let startHour = 6
        let startMinute = 0
        const workingHoursStart = normalized.workingHours?.start
        if (workingHoursStart) {
          const parts = workingHoursStart.split(':')
          if (parts.length >= 2) {
            startHour = parseInt(parts[0], 10)
            startMinute = parseInt(parts[1], 10)
          }
        }

        // Determine date from filter criteria or default to today
        let startDate = new Date()
        if (navigationState?.filters?.dateRange?.from) {
          startDate = new Date(navigationState.filters.dateRange.from)
        }
        startDate.setHours(startHour, startMinute, 0, 0)

        // Start simulation via REST API (runs in background while animation plays)
        startSimulationFromDatasetRest(
          datasetId,
          normalized.name,
          {
            startDate: startDate.toISOString(),
            experimentType: 'vroom',
          }
        ).catch(() => {
          toast.error('Fel vid start av simulering')
        })
      } else if ((res as any)?.success) {
        // Dataset saved but no datasetId returned
        toast.success(`Dataset sparat: ${normalized.name}`)
        navigate('/routes?tab=optimizations', { replace: true })
      } else {
        toast.error(`Fel vid sparning: ${(res as any)?.error || 'okänt fel'}`)
      }
    } catch {
      toast.error('Fel vid sparning av dataset')
    }
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center gap-6">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Tillbaka</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-4xl font-normal break-words hyphens-auto">
              Anpassa optimering
            </h1>
            <p className="text-muted-foreground mt-1">
              Konfigurera arbetstider, raster och ge ditt optimeringsprojekt ett
              namn
            </p>
          </div>
        </div>

        <div className="max-w-4xl">
          <SaveOptimizationForm
            onSave={handleSaveOptimization}
            selectedRoutes={navigationState?.selectedRoutes || []}
            filters={navigationState?.filters || {}}
            viewMode={
              navigationState?.viewMode as 'turid' | 'flottor' | undefined
            }
            selectedItems={navigationState?.selectedItems || []}
            routeEstimates={routeEstimates}
            estimatesLoading={estimatesLoading}
          />
        </div>
      </div>
    </Layout>
  )
}

export default SaveOptimizationProjectPage
