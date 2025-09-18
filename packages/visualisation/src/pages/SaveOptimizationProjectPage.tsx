import React, { useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import SaveOptimizationForm from '@/components/optimize/SaveOptimizationForm'
import { toast } from 'sonner'
import { saveRouteDataset } from '@/api/simulator'
import {
  buildSingleFleetFromRouteData,
  type Settings,
} from '@/utils/fleetGenerator'
import { byId, buildFackInfo, pickDominant, type BilSpec } from '@/utils/shared'
import type { RouteRecord } from '@/components/routes/FileUpload'

const SaveOptimizationProjectPage = () => {
  const navigate = useNavigate()
  const location = useLocation()

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

  const handleSaveOptimization = async (optimization: any) => {
    // Save to localStorage
    const saved = localStorage.getItem('savedOptimizations')
    let optimizations = [] as any[]
    if (saved) {
      try {
        optimizations = JSON.parse(saved)
      } catch (error) {
        toast.error('Kunde inte läsa sparade optimeringar')
      }
    }
    // Ensure archived flag exists
    const normalized = {
      ...optimization,
      archived: optimization?.archived ?? false,
    }
    optimizations.unshift(normalized)
    localStorage.setItem('savedOptimizations', JSON.stringify(optimizations))

    // Create dataset from selection (mock UI, real save)
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
        if (!Array.isArray(fack) || fack.length === 0) return false
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
      for (const [turid, records] of Array.from(byTur.entries())) {
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
      })

      if ((res as any)?.success) {
        toast.success(`Dataset sparat: ${normalized.name}`)
        // Visa 3s loader och gå därefter till Sparade Filtreringar
        navigate('/optimize/processing', {
          state: { activeTab: 'datasets' },
          replace: true,
        })
      } else {
        toast.error(`Fel vid sparning: ${(res as any)?.error || 'okänt fel'}`)
      }
    } catch (e) {
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
          />
        </div>
      </div>
    </Layout>
  )
}

export default SaveOptimizationProjectPage
