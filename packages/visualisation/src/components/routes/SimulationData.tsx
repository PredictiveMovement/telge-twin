import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Database, RefreshCw, Calendar, Layers } from 'lucide-react'
import { fetchSimulations } from '@/api/simulator'

interface Simulation {
  planId: string
  fleetCount: number
  fleets: string[]
  latestTimestamp: string
  documentsCount: number
}

const SimulationData: React.FC = () => {
  const [simulations, setSimulations] = useState<Simulation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSimulations = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSimulations()
      setSimulations(data)
    } catch (err) {
      console.error('Error loading simulations:', err)
      setError('Kunde inte ladda simuleringsdata. Försök igen.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSimulations()
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

  const totalFleets = simulations.reduce((sum, sim) => sum + sim.fleetCount, 0)
  const latestSimulation = simulations[0]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-normal flex items-center gap-2">
          <Database size={24} />
          Simuleringar
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Översikt över alla sparade simuleringar i systemet. Data hämtas från
          Elasticsearch fleet-plans.
        </p>
        <div className="flex gap-2 mt-4">
          <Button
            onClick={loadSimulations}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {simulations.length}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Totalt antal simuleringar
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
                  <div className="text-2xl font-bold text-purple-600">
                    {latestSimulation
                      ? formatTimestamp(latestSimulation.latestTimestamp)
                      : 'N/A'}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Senaste simuleringen
                  </p>
                </CardContent>
              </Card>
            </div>

            {simulations.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Simuleringar</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 py-2 px-3 text-left">
                          <div className="flex items-center gap-2">
                            <Database size={16} />
                            Simulerings-ID
                          </div>
                        </th>
                        <th className="border border-gray-300 py-2 px-3 text-left">
                          <div className="flex items-center gap-2">
                            <Layers size={16} />
                            Antal Fleets
                          </div>
                        </th>
                        <th className="border border-gray-300 py-2 px-3 text-left">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} />
                            Skapad
                          </div>
                        </th>
                        <th className="border border-gray-300 py-2 px-3 text-left">
                          Fleet-typer
                        </th>
                        <th className="border border-gray-300 py-2 px-3 text-left">
                          Dokument
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulations.map((simulation, index) => (
                        <tr
                          key={simulation.planId || index}
                          className="hover:bg-gray-50"
                        >
                          <td className="border border-gray-300 py-2 px-3 text-sm font-mono">
                            {simulation.planId?.length > 20
                              ? `${simulation.planId.substring(0, 20)}...`
                              : simulation.planId || 'N/A'}
                          </td>
                          <td className="border border-gray-300 py-2 px-3">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {simulation.fleetCount}
                            </span>
                          </td>
                          <td className="border border-gray-300 py-2 px-3 text-sm">
                            {formatTimestamp(simulation.latestTimestamp)}
                          </td>
                          <td className="border border-gray-300 py-2 px-3 text-sm">
                            <div className="flex flex-wrap gap-1">
                              {simulation.fleets
                                .slice(0, 3)
                                .map((fleet, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700"
                                  >
                                    {fleet}
                                  </span>
                                ))}
                              {simulation.fleets.length > 3 && (
                                <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                                  +{simulation.fleets.length - 3} till
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="border border-gray-300 py-2 px-3 text-sm">
                            {simulation.documentsCount}
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
                <p>Inga simuleringar hittades.</p>
                <p className="text-sm mt-2">
                  Kör en simulering eller kontrollera
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
            <p className="text-muted-foreground">Laddar simuleringsdata...</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default SimulationData
