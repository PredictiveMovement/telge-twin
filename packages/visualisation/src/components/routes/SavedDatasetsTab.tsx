import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  RouteDataset,
  OptimizationBreakSetting,
  getRouteDatasets,
  deleteRouteDataset,
  startSimulationFromDataset,
} from '@/api/simulator'
import { useMapSocket } from '@/hooks/useMapSocket'
import { toast } from 'sonner'
import { Trash2, Play, Info } from 'lucide-react'

export default function SavedDatasetsTab() {
  const [datasets, setDatasets] = useState<RouteDataset[]>([])
  const [loading, setLoading] = useState(true)
  const [startingSimulation, setStartingSimulation] = useState<string | null>(
    null
  )
  const { socket } = useMapSocket()

  useEffect(() => {
    loadDatasets()
  }, [])

  const loadDatasets = async () => {
    try {
      const datasetsData = await getRouteDatasets()
      setDatasets(datasetsData)
    } catch {
      toast.error('Fel vid hämtning av data')
    } finally {
      setLoading(false)
    }
  }

  const deleteDataset = async (datasetId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna dataset?')) {
      return
    }

    try {
      const result = await deleteRouteDataset(datasetId)
      if (result.success) {
        toast.success('Dataset borttagen')
        loadDatasets()
      } else {
        toast.error(`Fel vid borttagning: ${result.error}`)
      }
    } catch {
      toast.error('Fel vid borttagning av dataset')
    }
  }

  const startSimulation = async (dataset: RouteDataset) => {
    setStartingSimulation(dataset.id)
    try {
      const parameters = { experimentType: 'vroom' as const }

      await startSimulationFromDataset(
        socket,
        dataset.datasetId,
        dataset.name,
        parameters
      )

      toast.success(`VROOM-optimerad simulering startad för: ${dataset.name}`)
    } catch {
      toast.error('Fel vid start av simulering')
    } finally {
      setStartingSimulation(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderFilterCriteria = (criteria: RouteDataset['filterCriteria']) => {
    const filters = []

    if (criteria.dateRange?.from || criteria.dateRange?.to) {
      const from = criteria.dateRange.from
        ? new Date(criteria.dateRange.from).toLocaleDateString('sv-SE')
        : ''
      const to = criteria.dateRange.to
        ? new Date(criteria.dateRange.to).toLocaleDateString('sv-SE')
        : ''
      filters.push(`Datum: ${from || '...'} - ${to || '...'}`)
    }

    if (criteria.selectedBils?.length) {
      filters.push(`Bilar: ${criteria.selectedBils.length} st`)
    }

    if (criteria.selectedAvftyper?.length) {
      filters.push(`Avfallstyper: ${criteria.selectedAvftyper.length} st`)
    }

    if (criteria.selectedTjtyper?.length) {
      filters.push(`Tjänstetyper: ${criteria.selectedTjtyper.length} st`)
    }

    return filters.length > 0 ? filters.join(', ') : 'Inga filter'
  }

  const renderBreakBadges = (
    breakItems: OptimizationBreakSetting[] | undefined,
    label: string
  ) => {
    if (!breakItems?.length) {
      return null
    }

    return (
      <div>
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <div className="flex flex-wrap gap-1">
          {breakItems.map((breakItem) => {
            const timeSegment = breakItem.desiredTime
              ? `${breakItem.desiredTime}`
              : null
            const durationSegment = `${breakItem.duration} min`
            const details = [timeSegment, durationSegment]
              .filter(Boolean)
              .join(' · ')

            return (
              <Badge
                key={`${breakItem.id}-${breakItem.name}`}
                variant="outline"
                className="text-xs"
              >
                {breakItem.name}
                {details ? ` — ${details}` : ''}
              </Badge>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Laddar datasets...</p>
        </div>
      </div>
    )
  }

  if (datasets.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Info className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Inga sparade datasets
          </h3>
          <p className="text-gray-600 mb-4">
            Du har inga sparade route datasets ännu. Gå till 'Filuppladdning &
            Filtrering' för att skapa en.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sparade Route Datasets</h2>
        <Button onClick={loadDatasets} variant="outline" size="sm">
          Uppdatera
        </Button>
      </div>

      <div className="grid gap-4">
        {datasets.map((dataset) => (
          <Card key={dataset.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{dataset.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {dataset.description || 'Ingen beskrivning'}
                  </CardDescription>
                </div>
                <Badge
                  variant={dataset.status === 'ready' ? 'default' : 'secondary'}
                >
                  {dataset.status === 'ready' ? 'Redo' : dataset.status}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Records</p>
                    <p className="font-medium">
                      {dataset.recordCount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Ursprunglig fil</p>
                    <p className="font-medium">{dataset.originalFilename}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Skapad</p>
                    <p className="font-medium">
                      {formatDate(dataset.uploadTimestamp)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Från total</p>
                    <p className="font-medium">
                      {dataset.originalRecordCount.toLocaleString()}
                    </p>
                  </div>
                  {dataset.optimizationSettings?.workingHours && (
                    <div>
                      <p className="text-gray-600">Arbetstid</p>
                      <p className="font-medium">
                        {dataset.optimizationSettings.workingHours.start || '—'}
                        {' - '}
                        {dataset.optimizationSettings.workingHours.end || '—'}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    Tillämpade filter:
                  </p>
                  <p className="text-sm font-medium text-gray-800">
                    {renderFilterCriteria(dataset.filterCriteria)}
                  </p>
                </div>

                {dataset.associatedExperiments.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      Kopplade experiment:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {dataset.associatedExperiments.map((expId) => (
                        <Badge
                          key={expId}
                          variant="outline"
                          className="text-xs"
                        >
                          {expId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(dataset.optimizationSettings?.breaks?.length ||
                  dataset.optimizationSettings?.extraBreaks?.length) && (
                  <div className="space-y-2 pt-2 border-t border-dashed">
                    {renderBreakBadges(
                      dataset.optimizationSettings?.breaks,
                      'Raster'
                    )}
                    {renderBreakBadges(
                      dataset.optimizationSettings?.extraBreaks,
                      'Extra raster'
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    onClick={() => startSimulation(dataset)}
                    disabled={startingSimulation === dataset.id}
                    className="flex-1"
                    title="Starta simulering med VROOM route-optimering (sparar data till Elasticsearch)"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {startingSimulation === dataset.id
                      ? 'Startar...'
                      : 'VROOM Optimerad'}
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteDataset(dataset.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
