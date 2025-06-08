import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import {
  getExperiment,
  getOriginalBookings,
  getVroomPlan,
  Experiment,
} from '@/api/simulator'
import SimulationView from '@/components/common/SimulationView'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Loader2 } from 'lucide-react'

const BookingList = ({ bookings }: { bookings: any[] | null }) => {
  if (!bookings)
    return <p className="text-sm text-gray-500">Laddar bokningar...</p>
  if (bookings.length === 0)
    return <p className="text-sm text-gray-500">Inga bokningar hittades.</p>

  return (
    <div className="space-y-2 mt-4 max-h-96 overflow-y-auto">
      {bookings.map((booking, index) => (
        <div
          key={booking.id || index}
          className="text-xs p-2 rounded-md bg-gray-50"
        >
          <p className="font-semibold">Bokning #{index + 1}</p>
          <p>ID: {booking.id}</p>
          <p>Typ: {booking.recyclingType}</p>
        </div>
      ))}
    </div>
  )
}

const ExperimentDetailPage = () => {
  const { experimentId } = useParams<{ experimentId: string }>()

  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [originalBookings, setOriginalBookings] = useState<any[] | null>(null)
  const [vroomPlan, setVroomPlan] = useState<any | null>(null)
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

        const [bookingsResult, planResult] = await Promise.allSettled([
          expData.sourceDatasetId
            ? getOriginalBookings(expData.sourceDatasetId)
            : Promise.resolve(null),
          getVroomPlan(experimentId),
        ])

        if (bookingsResult.status === 'fulfilled') {
          setOriginalBookings(bookingsResult.value)
        } else {
          console.error(
            'Failed to fetch original bookings:',
            bookingsResult.reason
          )
          setError('Kunde inte hämta de ursprungliga bokningarna.')
        }

        if (planResult.status === 'fulfilled') {
          setVroomPlan(planResult.value)
        } else {
          console.warn('VROOM plan not found:', planResult.reason)
          setVroomPlan(null)
        }
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

  const vroomBookings =
    vroomPlan?.summary?.unassigned === 0 && vroomPlan?.routes
      ? vroomPlan.routes.flatMap((route: any) =>
          route.steps
            .filter((step: any) => step.type === 'job')
            .map((step: any) => ({ id: step.id, recyclingType: 'N/A' }))
        )
      : []

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
                />
              )}
              <BookingList bookings={originalBookings} />
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
              />
              <BookingList bookings={vroomBookings} />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}

export default ExperimentDetailPage
