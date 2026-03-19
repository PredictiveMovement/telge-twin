import React, { useEffect, useMemo, useState } from 'react'
import Layout from '@/components/layout/Layout'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import SaveOptimizationForm from '@/components/optimize/SaveOptimizationForm'
import { toast } from '@/hooks/use-toast'
import {
  saveRouteDataset,
  startSimulationFromDatasetRest,
} from '@/api/simulator'
import { type Settings } from '@/utils/fleetGenerator'
import type { RouteRecord } from '@/components/routes/FileUpload'
import { useOptimizationContext } from '@/contexts/OptimizationContext'
import {
  buildOptimizationStartDate,
  prepareOptimizationData,
} from '@/utils/optimizationPreparation'

const SaveOptimizationProjectPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { startOptimization } = useOptimizationContext()

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

  const selectedVehicles = useMemo(
    () =>
      new Set(
        (navigationState?.selectedItems || [])
          .map((item: any) => item?.fordon)
          .filter(Boolean)
      ),
    [navigationState?.selectedItems]
  )

  const avftyper = useMemo(
    () =>
      (navigationState?.previewSettings as any)?.avftyper || [],
    [navigationState?.previewSettings]
  )

  const preparedOptimizationData = useMemo(
    () =>
      prepareOptimizationData({
        uploadedData: navigationState?.uploadedData,
        selectedRoutes: navigationState?.selectedRoutes,
        selectedVehicles,
        previewSettings: navigationState?.previewSettings,
      }),
    [
      navigationState?.previewSettings,
      navigationState?.selectedRoutes,
      navigationState?.uploadedData,
      selectedVehicles,
    ]
  )

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
      const previewSettings = navigationState.previewSettings as Settings
      const originalFilename = navigationState.originalFilename || 'routes.json'
      const selectedRouteData = preparedOptimizationData?.routeData || []
      const rawFleetConfig = preparedOptimizationData?.fleetConfiguration || []
      const fackOverrides = normalized.fackOverrides || []

      // Apply fack overrides to fleet configuration
      const fleetConfiguration = fackOverrides.length
        ? rawFleetConfig.map((fleet: any) => {
            const vehicles = (fleet.vehicles || []).map((v: any) => {
              if (!v.fackDetails?.length) return v
              const updatedFack = v.fackDetails.map((fack: any) => {
                const override = fackOverrides.find(
                  (o: any) =>
                    o.vehicleId === v.originalId &&
                    o.fackNumber === fack.fackNumber
                )
                if (!override) return fack
                return {
                  ...fack,
                  avfallstyper: override.allowedWasteTypes.map(
                    (avftyp: string) => {
                      const spec = avftyper.find(
                        (a: any) => a.ID === avftyp
                      )
                      return {
                        avftyp,
                        beskrivning: spec?.BESKRIVNING || null,
                      }
                    }
                  ),
                }
              })
              return { ...v, fackDetails: updatedFack }
            })
            return { ...fleet, vehicles }
          })
        : rawFleetConfig
      // Filter route data based on fack overrides — remove bookings
      // whose waste type no longer matches any fack on their vehicle
      let finalRouteData = selectedRouteData
      let overrideRemovedCount = 0
      if (fackOverrides.length) {
        const allowedByVehicle = new Map<string, Set<string>>()
        for (const fleet of fleetConfiguration as any[]) {
          for (const v of fleet.vehicles || []) {
            const allowed = new Set<string>()
            for (const fack of v.fackDetails || []) {
              for (const a of fack.avfallstyper || []) {
                if (a.avftyp) allowed.add(a.avftyp)
              }
            }
            allowedByVehicle.set(v.originalId, allowed)
          }
        }
        finalRouteData = selectedRouteData.filter((record: any) => {
          const allowed = allowedByVehicle.get(record.Bil)
          if (!allowed) return true // vehicle without fack config — keep
          if (allowed.size === 0) return false // all facks empty — remove
          return !record.Avftyp || allowed.has(record.Avftyp)
        })
        overrideRemovedCount = selectedRouteData.length - finalRouteData.length
      }

      const removedCount = (preparedOptimizationData?.removedCount || 0) + overrideRemovedCount

      if (removedCount > 0) {
        toast.info(`Filtrerat bort ${removedCount} bokningar utan passande fack`)
      }

      if (!finalRouteData.length) {
        toast.error('Inga rader matchar ditt urval efter filtrering.')
        return
      }

      // Build fleet configuration and save dataset
      const res = await saveRouteDataset({
        name: normalized.name || 'Optimering',
        description: normalized.description || 'Sparad optimering',
        originalFilename,
        filterCriteria: navigationState.filters || { mode: navigationState.viewMode },
        routeData: finalRouteData as unknown as Record<string, unknown>[],
        originalRecordCount: uploadedData.length,
        fleetConfiguration: fleetConfiguration as unknown as Record<string, unknown>[],
        originalSettings:
          preparedOptimizationData?.originalSettings ||
          (previewSettings as unknown as Record<string, unknown>),
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
          expectedVehicleCount,
        })

        // Start simulation via REST API (runs in background while animation plays)
        startSimulationFromDatasetRest(
          datasetId,
          normalized.name,
          {
            startDate: buildOptimizationStartDate(
              navigationState?.filters,
              normalized.workingHours
            ),
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

        <div>
          <SaveOptimizationForm
            onSave={handleSaveOptimization}
            selectedRoutes={navigationState?.selectedRoutes || []}
            filters={navigationState?.filters || {}}
            viewMode={
              navigationState?.viewMode as 'turid' | 'flottor' | undefined
            }
            selectedItems={navigationState?.selectedItems || []}
            avftyper={avftyper}
            estimateInputBase={
              preparedOptimizationData
                ? {
                    routeData:
                      preparedOptimizationData.routeData as unknown as Record<
                        string,
                        unknown
                      >[],
                    fleetConfiguration: preparedOptimizationData.fleetConfiguration,
                    originalSettings: preparedOptimizationData.originalSettings,
                  }
                : undefined
            }
          />
        </div>
      </div>
    </Layout>
  )
}

export default SaveOptimizationProjectPage
