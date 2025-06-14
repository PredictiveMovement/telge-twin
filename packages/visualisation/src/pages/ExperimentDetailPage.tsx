import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import { getExperiment, Experiment } from '@/api/simulator'
import SimulationView from '@/components/common/SimulationView'
import TuridComparisonView from '@/components/experiments/TuridComparisonView'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Loader2 } from 'lucide-react'

const ExperimentDetailPage = () => {
  const { experimentId } = useParams<{ experimentId: string }>()

  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!experimentId) {
      setError('Experiment ID saknas.')
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)

        const expData = await getExperiment(experimentId)
        if (!expData) {
          throw new Error('Kunde inte hitta experimentet.')
        }
        setExperiment(expData)
      } catch (err: any) {
        setError(err.message || 'Ett fel uppstod vid hämtning av data.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [experimentId])

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="mr-2 h-8 w-8 animate-spin" />
          <p>Laddar experimentdata...</p>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </Layout>
    )
  }

  if (!experiment) {
    return (
      <Layout>
        <p>Kunde inte ladda experimentet.</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-normal">Jämförelse av Experiment</h1>
          <p className="text-muted-foreground mt-1">
            Experiment: {experiment.datasetName} ({experiment.id})
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Före optimering (Sekventiell)</CardTitle>
            </CardHeader>
            <CardContent>
              {experiment.sourceDatasetId && (
                <SimulationView
                  title="Sekventiell Uppspelning"
                  type="sequential"
                  datasetId={experiment.sourceDatasetId}
                  areaPartitions={experiment.areaPartitions}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Efter optimering (VROOM)</CardTitle>
            </CardHeader>
            <CardContent>
              <SimulationView
                title="VROOM Replay"
                type="replay"
                experimentId={experiment.id}
                datasetId={experiment.sourceDatasetId || ''}
                areaPartitions={experiment.areaPartitions}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rutt-jämförelse per Turid</CardTitle>
            <CardDescription>
              Jämför ordningen av bokningar per rutt mellan sekventiell och
              VROOM-optimerad körning
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TuridComparisonView experimentId={experiment.id} />
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

export default ExperimentDetailPage
