import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Database, RefreshCw, Calendar, Layers, Map, Play } from 'lucide-react'
import { fetchExperiments } from '@/api/simulator'

interface Experiment {
  id: string
  startDate: string
  fixedRoute: number
  emitters: string[]
  fleets: Record<string, any>
  selectedDataFile: string
  fleetCount: number
  vehicleCount: number
  documentId: string
}

const SimulationData: React.FC = () => {
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-normal flex items-center gap-2">
          <Database size={24} />
          Experiment
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Översikt över alla sparade experiment i systemet. Klicka på kartan för
          att spela upp ett experiment på nytt.
        </p>
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
                          Datafil
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
                            {experiment.selectedDataFile || 'N/A'}
                          </td>
                          <td className="border border-gray-300 py-2 px-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleReplayExperiment(experiment.id)
                              }
                              className="flex items-center gap-1"
                            >
                              <Map size={14} />
                              <Play size={12} />
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
              <div className="text-center py-8 text-muted-foreground">
                <Database size={48} className="mx-auto mb-4 opacity-50" />
                <p>Inga experiment hittades.</p>
                <p className="text-sm mt-2">
                  Kör ett experiment eller kontrollera
                  Elasticsearch-anslutningen.
                </p>
              </div>
            )}
          </>
        )}

        {loading && (
          <div className="text-center py-8">
            <RefreshCw
              size={48}
              className="mx-auto mb-4 opacity-50 animate-spin"
            />
            <p className="text-muted-foreground">Laddar experimentdata...</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default SimulationData
