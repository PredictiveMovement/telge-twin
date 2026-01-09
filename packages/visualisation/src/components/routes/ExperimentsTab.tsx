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
import { getExperiments, deleteExperiment } from '@/api/simulator'
import {
  Search,
  Info,
  Database,
  RefreshCw,
  Calendar,
  Trash2,
} from 'lucide-react'

interface Experiment {
  id: string
  startDate: string
  createdAt?: string
  fixedRoute: number
  emitters: string[]
  fleets: Record<string, unknown>
  selectedDataFile?: string
  sourceDatasetId?: string
  datasetName?: string
  simulationStatus?: string
  routeDataSource?: string
  experimentType?: 'vroom' | 'sequential' | 'replay'
  fleetCount: number
  vehicleCount: number
  documentId: string
}

export default function ExperimentsTab() {
  const navigate = useNavigate()
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean
    experimentId: string
    experimentName: string
  }>({ open: false, experimentId: '', experimentName: '' })

  const loadExperiments = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getExperiments()
      setExperiments(data as Experiment[])
    } catch (_err) {
      setError('Kunde inte ladda experimentdata. Försök igen.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExperiments()
  }, [])

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'N/A'
    const parsed = new Date(timestamp)
    if (isNaN(parsed.getTime())) return 'N/A'

    return parsed.toLocaleString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getExperimentTimestamp = (experiment: Experiment) =>
    experiment.createdAt || experiment.startDate

  const handleOpenExperimentDetails = (experimentId: string) => {
    navigate(`/optimize/${experimentId}`)
  }

  const totalVehicles = experiments.reduce(
    (sum, exp) => sum + exp.vehicleCount,
    0
  )
  const latestExperiment = experiments[0]

  const handleDeleteExperiment = async (documentId: string) => {
    setDeletingId(documentId)
    setError(null)
    setSuccessMessage(null)
    try {
      const result = await deleteExperiment(documentId)
      if (result.success) {
        setExperiments((prev) =>
          prev.filter((exp) => exp.documentId !== documentId)
        )
        setDeleteConfirm({ open: false, experimentId: '', experimentName: '' })
        setSuccessMessage('Experimentet har tagits bort')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(result.error || 'Kunde inte ta bort experimentet')
      }
    } catch (_error) {
      setError('Ett fel uppstod vid borttagning av experimentet')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteClick = (experiment: Experiment) => {
    setDeleteConfirm({
      open: true,
      experimentId: experiment.documentId,
      experimentName: experiment.id || 'Okänt experiment',
    })
  }

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
          Översikt över alla sparade experiment i systemet. Klicka på "Granska"
          för att granska ett experiment i detaljerad jämförelsevy.
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

        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
            <p className="text-green-700 text-sm">{successMessage}</p>
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
                      ? formatTimestamp(getExperimentTimestamp(latestExperiment))
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
                          Typ
                        </th>
                        <th className="border border-gray-300 py-2 px-3 text-left">
                          Åtgärder
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {experiments.map((experiment, index) => (
                        <tr
                          key={experiment.documentId || index}
                          className="hover:bg-gray-50"
                        >
                          <td className="border border-gray-300 py-2 px-3 text-sm font-mono">
                            {experiment.id?.length > 20
                              ? `${experiment.id.substring(0, 20)}...`
                              : experiment.id || 'N/A'}
                          </td>
                          <td className="border border-gray-300 py-2 px-3 text-sm">
                            {formatTimestamp(getExperimentTimestamp(experiment))}
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
                            <Badge
                              variant={
                                experiment.experimentType === 'vroom'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className="text-xs"
                            >
                              {experiment.experimentType === 'vroom'
                                ? 'VROOM'
                                : experiment.experimentType === 'sequential'
                                ? 'Sekventiell'
                                : experiment.experimentType === 'replay'
                                ? 'Replay'
                                : 'Okänd'}
                            </Badge>
                          </td>
                          <td className="border border-gray-300 py-2 px-3">
                            <div className="flex gap-2">
                              {experiment.experimentType === 'vroom' && (
                                <Button
                                  onClick={() =>
                                    handleOpenExperimentDetails(
                                      experiment.documentId
                                    )
                                  }
                                  size="sm"
                                  variant="outline"
                                  className="flex items-center gap-1"
                                  title="Granska och jämför VROOM-optimerat experiment"
                                >
                                  <Search size={14} />
                                  Granska
                                </Button>
                              )}
                              <Button
                                onClick={() => handleDeleteClick(experiment)}
                                size="sm"
                                variant="outline"
                                className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:border-red-300"
                                title="Ta bort experiment"
                                disabled={deletingId === experiment.documentId}
                              >
                                <Trash2 size={14} />
                                {deletingId === experiment.documentId
                                  ? 'Tar bort...'
                                  : 'Ta bort'}
                              </Button>
                            </div>
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
                att köra samma simulering igen. Klicka på "Granska" för att
                öppna experimentet i en detaljerad jämförelsevy.
              </p>
            </div>

            {deleteConfirm.open && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Bekräfta borttagning
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Är du säker på att du vill ta bort experimentet "
                    {deleteConfirm.experimentName}"? Denna åtgärd kan inte
                    ångras och all relaterad data kommer att tas bort.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button
                      onClick={() =>
                        setDeleteConfirm({
                          open: false,
                          experimentId: '',
                          experimentName: '',
                        })
                      }
                      variant="outline"
                      size="sm"
                      disabled={deletingId !== null}
                    >
                      Avbryt
                    </Button>
                    <Button
                      onClick={() =>
                        handleDeleteExperiment(deleteConfirm.experimentId)
                      }
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      disabled={deletingId !== null}
                    >
                      {deletingId === deleteConfirm.experimentId
                        ? 'Tar bort...'
                        : 'Ta bort'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
