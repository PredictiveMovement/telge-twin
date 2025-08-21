import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  getOriginalBookingsForExperiment,
  getVroomBookingsForExperiment,
} from '@/api/simulator'
import {
  AlertTriangle,
  ArrowRight,
  Users,
  Package,
  Route,
  CheckCircle2,
} from 'lucide-react'

interface SimplifiedBooking {
  id: string
  turid: string
  ordning: number
  arrayIndex: number // Position in the saved array (for consistent comparison)
  originalOrderNumber?: number // Original schema order number (only for original bookings)
  recyclingType: string
  position: [number, number]
  vehicleId: string
  serviceType: string
  datum: string
  truckId?: string // Only for VROOM bookings
}

interface TuridComparison {
  turid: string
  originalBookings: SimplifiedBooking[]
  vroomBookings: SimplifiedBooking[]
  hasOptimization: boolean
  orderChanges: number
}

interface TuridComparisonViewProps {
  experimentId: string
}

const TuridComparisonView: React.FC<TuridComparisonViewProps> = ({
  experimentId,
}) => {
  const [data, setData] = useState<TuridComparison[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTurid, setSelectedTurid] = useState<string | null>(null)

  useEffect(() => {
    fetchComparisonData()
  }, [experimentId])

  const fetchComparisonData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch both original and VROOM bookings
      const [originalData, vroomData] = await Promise.all([
        getOriginalBookingsForExperiment(experimentId),
        getVroomBookingsForExperiment(experimentId),
      ])

      if (!originalData.success) {
        throw new Error(
          originalData.error || 'Failed to fetch original bookings'
        )
      }

      const originalBookings: SimplifiedBooking[] = originalData.data || []
      const vroomBookings: SimplifiedBooking[] = vroomData.success
        ? vroomData.data || []
        : []

      // Group by turid and create comparisons
      const turidGroups = new Map<string, TuridComparison>()

      // Add all original bookings
      originalBookings.forEach((booking) => {
        if (!turidGroups.has(booking.turid)) {
          turidGroups.set(booking.turid, {
            turid: booking.turid,
            originalBookings: [],
            vroomBookings: [],
            hasOptimization: false,
            orderChanges: 0,
          })
        }
        turidGroups.get(booking.turid)?.originalBookings.push(booking)
      })

      // Add VROOM bookings
      vroomBookings.forEach((booking) => {
        const group = turidGroups.get(booking.turid)
        if (group) {
          group.vroomBookings.push(booking)
          group.hasOptimization = true
        }
      })

      // Calculate order changes
      turidGroups.forEach((group) => {
        if (group.hasOptimization) {
          const originalOrder = group.originalBookings.sort(
            (a, b) => a.arrayIndex - b.arrayIndex
          )
          const vroomOrder = group.vroomBookings.sort(
            (a, b) => a.arrayIndex - b.arrayIndex
          )

          let changes = 0
          originalOrder.forEach((originalBooking, index) => {
            const vroomBooking = vroomOrder.find(
              (v) => v.id === originalBooking.id
            )
            if (
              vroomBooking &&
              vroomBooking.arrayIndex !== originalBooking.arrayIndex
            ) {
              changes++
            }
          })
          group.orderChanges = changes
        }
      })

      setData(Array.from(turidGroups.values()))
    } catch (err) {
      setError('Failed to fetch comparison data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Laddar turid-jämförelse...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600">{error}</p>
          <Button onClick={fetchComparisonData} className="mt-2">
            Försök igen
          </Button>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">Ingen jämförelsedata tillgänglig</p>
      </div>
    )
  }

  const summary = {
    totalTurids: data.length,
    turidsWithOptimization: data.filter((d) => d.hasOptimization).length,
    totalBookings: data.reduce((sum, d) => sum + d.originalBookings.length, 0),
    totalOptimizedBookings: data.reduce(
      (sum, d) => sum + d.vroomBookings.length,
      0
    ),
    totalOrderChanges: data.reduce((sum, d) => sum + d.orderChanges, 0),
  }

  const selectedComparison = selectedTurid
    ? data.find((c) => c.turid === selectedTurid)
    : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Route className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{summary.totalTurids}</div>
            <div className="text-sm text-gray-600">Totala Rutter</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{summary.totalBookings}</div>
            <div className="text-sm text-gray-600">Totala Bokningar</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">
              {summary.turidsWithOptimization}
            </div>
            <div className="text-sm text-gray-600">VROOM Optimerade</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">
              {summary.totalOptimizedBookings}
            </div>
            <div className="text-sm text-gray-600">VROOM Bokningar</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <ArrowRight className="h-8 w-8 text-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">
              {summary.totalOrderChanges}
            </div>
            <div className="text-sm text-gray-600">Positionsändringar</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Välj Rutt för Detaljerad Jämförelse</CardTitle>
          <CardDescription>
            Klicka på en rutt för att se detaljerad jämförelse mellan original
            och VROOM-optimerad ordning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.map((comparison) => (
              <div
                key={comparison.turid}
                className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                  selectedTurid === comparison.turid
                    ? 'border-blue-500 bg-blue-50'
                    : comparison.hasOptimization
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 bg-gray-50'
                }`}
                onClick={() => setSelectedTurid(comparison.turid)}
              >
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="font-medium">
                    {comparison.turid}
                  </Badge>
                  {!comparison.hasOptimization && (
                    <Badge variant="destructive" className="text-xs">
                      Ej optimerad
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Original Bokningar:</span>
                    <span className="font-medium">
                      {comparison.originalBookings.length}
                    </span>
                  </div>

                  {comparison.hasOptimization && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">VROOM Bokningar:</span>
                        <span className="font-medium text-green-600">
                          {comparison.vroomBookings.length}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Positionsändringar:
                        </span>
                        <span className="font-medium text-orange-600">
                          {comparison.orderChanges}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {comparison.hasOptimization && (
                  <div className="mt-3 pt-2 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                      Matchningsgrad:{' '}
                      {Math.round(
                        (comparison.vroomBookings.length /
                          comparison.originalBookings.length) *
                          100
                      )}
                      %
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedComparison && (
        <TuridDetailedComparison comparison={selectedComparison} />
      )}
    </div>
  )
}

const TuridDetailedComparison: React.FC<{ comparison: TuridComparison }> = ({
  comparison,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge variant="outline">{comparison.turid}</Badge>
          Detaljerad Ordningsjämförelse
        </CardTitle>
        <CardDescription>
          Jämförelse mellan original ordning (baserat på sparad sekvens) och
          VROOM-optimerad ordning. Siffror visar position i sekvensen, inte
          ursprungliga schemanummer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!comparison.hasOptimization ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Ingen VROOM-optimering tillgänglig
            </h3>
            <p className="text-gray-600">
              Denna rutt har inte optimerats med VROOM eller så finns ingen
              matchande data.
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Badge className="bg-blue-600">Original</Badge>
                Original Ordning (Sparad sekvens)
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {comparison.originalBookings
                  .sort((a, b) => a.arrayIndex - b.arrayIndex)
                  .map((booking, index) => (
                    <div
                      key={booking.id}
                      className="p-3 bg-blue-50 rounded border flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{booking.arrayIndex}</Badge>
                        <span className="font-mono text-sm">{booking.id}</span>
                        <span className="text-sm text-gray-600">
                          {booking.recyclingType}
                        </span>
                        {booking.originalOrderNumber &&
                          booking.originalOrderNumber !==
                            booking.arrayIndex && (
                            <Badge variant="secondary" className="text-xs">
                              Turordningsnr: {booking.originalOrderNumber}
                            </Badge>
                          )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {booking.vehicleId}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Badge className="bg-green-600">VROOM</Badge>
                Optimerad Ordning
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {comparison.vroomBookings
                  .sort((a, b) => a.arrayIndex - b.arrayIndex)
                  .map((booking, index) => {
                    const originalBooking = comparison.originalBookings.find(
                      (orig) => orig.id === booking.id
                    )
                    const positionChanged = originalBooking
                      ? originalBooking.arrayIndex !== booking.arrayIndex
                      : false

                    return (
                      <div
                        key={booking.id}
                        className={`p-3 rounded border flex items-center justify-between ${
                          positionChanged
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-green-50 border-green-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{booking.arrayIndex}</Badge>
                          <span className="font-mono text-sm">
                            {booking.id}
                          </span>
                          <span className="text-sm text-gray-600">
                            {booking.recyclingType}
                          </span>
                          {positionChanged && (
                            <Badge variant="secondary" className="text-xs">
                              {originalBooking?.arrayIndex} →{' '}
                              {booking.arrayIndex}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {booking.truckId}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default TuridComparisonView
