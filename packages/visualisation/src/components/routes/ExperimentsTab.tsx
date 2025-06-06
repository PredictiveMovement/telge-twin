import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fetchExperiments } from '@/api/simulator'
import {
  RotateCcw,
  Info,
  Database,
  RefreshCw,
  Calendar,
  Layers,
} from 'lucide-react'

interface Experiment {
  id: string
  startDate: string
  fixedRoute: number
  emitters: string[]
  fleets: Record<string, any>
  selectedDataFile?: string
  sourceDatasetId?: string
  datasetName?: string
  simulationStatus?: string
  routeDataSource?: string
  fleetCount: number
  vehicleCount: number
  documentId: string
}

export default function ExperimentsTab() {
  const navigate = useNavigate()
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadExperiments = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchExperiments()
      setExperiments(data)
    } catch (err) {
      console.error('Error loading experiments:', err)
      setError('Kunde inte ladda experimentdata. Försök igen.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExperiments()
  }, [])

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleReplayExperiment = (experimentId: string) => {
    navigate(`/map?replay=${experimentId}`)
  }

  const totalFleets = experiments.reduce((sum, exp) => sum + exp.fleetCount, 0)
  const totalVehicles = experiments.reduce(
    (sum, exp) => sum + exp.vehicleCount,
    0
  )
  const latestExperiment = experiments[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Laddar experiment...</p>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-normal flex items-center gap-2">
          <Database size={24} />
          Experiment
        </CardTitle>
        <CardDescription>
          Översikt över alla sparade experiment i systemet. Klicka på "Replay"
          för att spela upp ett experiment på nytt.
        </CardDescription>
        <div className="flex gap-2 mt-4">
          <Button
            onClick={loadExperiments}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={`mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            {loading ? 'Laddar...' : 'Uppdatera data'}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {experiments.length}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Totalt antal experiment
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {totalFleets}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Totalt antal fleets
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-600">
                    {totalVehicles}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Totalt antal fordon
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-purple-600">
                    {latestExperiment
                      ? formatTimestamp(latestExperiment.startDate)
                      : 'N/A'}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Senaste experimentet
                  </p>
                </CardContent>
              </Card>
            </div>

            {experiments.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Experiment</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 py-2 px-3 text-left">
                          <div className="flex items-center gap-2">
                            <Database size={16} />
                            Experiment-ID
                          </div>
                        </th>
                        <th className="border border-gray-300 py-2 px-3 text-left">
                          <div className="flex items-center gap-2">
                            <Layers size={16} />
                            Fleets
                          </div>
                        </th>
                        <th className="border border-gray-300 py-2 px-3 text-left">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} />
                            Skapad
                          </div>
                        </th>
                        <th className="border border-gray-300 py-2 px-3 text-left">
                          Fordon
                        </th>
                        <th className="border border-gray-300 py-2 px-3 text-left">
                          Dataset
                        </th>
                        <th className="border border-gray-300 py-2 px-3 text-left">
                          Åtgärder
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {experiments.map((experiment, index) => (
                        <tr
                          key={experiment.id || index}
                          className="hover:bg-gray-50"
                        >
                          <td className="border border-gray-300 py-2 px-3 text-sm font-mono">
                            {experiment.id?.length > 20
                              ? `${experiment.id.substring(0, 20)}...`
                              : experiment.id || 'N/A'}
                          </td>
                          <td className="border border-gray-300 py-2 px-3">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {experiment.fleetCount}
                            </span>
                          </td>
                          <td className="border border-gray-300 py-2 px-3 text-sm">
                            {formatTimestamp(experiment.startDate)}
                          </td>
                          <td className="border border-gray-300 py-2 px-3">
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              {experiment.vehicleCount}
                            </span>
                          </td>
                          <td className="border border-gray-300 py-2 px-3 text-sm">
                            {experiment.datasetName ||
                              experiment.selectedDataFile ||
                              'N/A'}
                            {experiment.sourceDatasetId && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                ES Dataset
                              </Badge>
                            )}
                          </td>
                          <td className="border border-gray-300 py-2 px-3">
                            <Button
                              onClick={() =>
                                handleReplayExperiment(experiment.id)
                              }
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              <RotateCcw size={14} />
                              Replay
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Info className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Inga experiment
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Du har inga körda experiment ännu. Starta en simulering från
                    'Sparade Filtreringar' för att skapa ett experiment.
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Om Experiment</h4>
              <p className="text-sm text-blue-800">
                Experiment skapas när du startar en simulering från en sparad
                dataset. Varje experiment har ett unikt ID och kan reprisas för
                att köra samma simulering igen. Klicka på "Replay" för att öppna
                experimentet i kartvisningen.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
