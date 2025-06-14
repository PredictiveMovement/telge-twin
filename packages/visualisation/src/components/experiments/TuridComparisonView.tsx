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
import { getTuridComparison } from '@/api/simulator'
import BookingDisplayCard from '@/components/common/BookingDisplayCard'
import {
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Users,
  Package,
  Route,
  CheckCircle2,
} from 'lucide-react'

interface BookingComparison {
  standardBookingId: string
  sequential: {
    id: string
    bookingId: string
    standardBookingId: string
    turordningsnr: number
    recyclingType: string
    vehicleId: string
    serviceType: string
    frequency: string
    position: [number, number]
    dec: string
    datum: string
    scheduled: boolean
  }
  vroom: {
    id: string
    fullId: string
    bookingId: string
    standardBookingId: string
    recyclingType: string
    truckId: string
    stepIndex: number
    vehicleId: string
    serviceType: string
    frequency: string
    position: [number, number]
    dec: string
    datum: string
    scheduled: boolean
  } | null
  matched: boolean
  positionChanged: boolean
}

interface TuridComparison {
  turid: string
  hasOptimization: boolean
  totalBookings: number
  optimizedBookings: number
  bookingComparisons: BookingComparison[]
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
      const result = await getTuridComparison(experimentId)

      if (result.success) {
        setData(
          Array.isArray(result.data)
            ? result.data
            : result.data.comparisons || []
        )
      } else {
        setError(result.error || 'Failed to fetch comparison data')
      }
    } catch (err) {
      setError('Failed to fetch comparison data')
      console.error(err)
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
    totalBookings: data.reduce((sum, d) => sum + d.totalBookings, 0),
    totalOptimizedBookings: data.reduce(
      (sum, d) => sum + d.optimizedBookings,
      0
    ),
    totalOrderChanges: data.reduce(
      (sum, d) =>
        sum + d.bookingComparisons.filter((b) => b.positionChanged).length,
      0
    ),
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
            <div className="text-sm text-gray-600">Matchade Bokningar</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <ArrowRight className="h-8 w-8 text-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">
              {summary.totalOrderChanges}
            </div>
            <div className="text-sm text-gray-600">Ordningsändringar</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Välj Rutt för Detaljerad Jämförelse</CardTitle>
          <CardDescription>
            Klicka på en rutt för att se detaljerad jämförelse mellan
            sekventiell och VROOM-optimerad ordning
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
                    <span className="text-gray-600">Bokningar:</span>
                    <span className="font-medium">
                      {comparison.totalBookings}
                    </span>
                  </div>

                  {comparison.hasOptimization && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          VROOM Matchningar:
                        </span>
                        <span className="font-medium text-green-600">
                          {comparison.optimizedBookings}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-gray-600">Flyttade:</span>
                        <span className="font-medium text-orange-600">
                          {
                            comparison.bookingComparisons.filter(
                              (b) => b.positionChanged
                            ).length
                          }
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {comparison.hasOptimization && (
                  <div className="mt-3 pt-2 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                      Optimeringsgrad:{' '}
                      {Math.round(
                        (comparison.optimizedBookings /
                          comparison.totalBookings) *
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
          Jämförelse mellan sekventiell ordning (Turordningsnr) och
          VROOM-optimerad ordning. Använder standardiserade booking IDs för
          perfekt matchning.
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
                <Badge className="bg-blue-600">Sekventiell</Badge>
                Original Ordning (Turordningsnr)
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {comparison.bookingComparisons.map((bookingComparison) => {
                  const status = bookingComparison.matched
                    ? bookingComparison.positionChanged
                      ? 'moved'
                      : 'unchanged'
                    : 'missing'

                  return (
                    <BookingDisplayCard
                      key={bookingComparison.standardBookingId}
                      booking={bookingComparison.sequential}
                      variant="comparison"
                      status={status}
                      comparisonData={{
                        originalOrder:
                          bookingComparison.sequential.turordningsnr,
                        newOrder: bookingComparison.vroom?.stepIndex,
                        positionChanged: bookingComparison.positionChanged,
                      }}
                    />
                  )
                })}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Badge className="bg-green-600">VROOM</Badge>
                Optimerad Ordning
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {comparison.bookingComparisons
                  .filter((bc) => bc.vroom)
                  .sort(
                    (a, b) =>
                      (a.vroom?.stepIndex || 0) - (b.vroom?.stepIndex || 0)
                  )
                  .map((bookingComparison) => {
                    const vroomBooking = bookingComparison.vroom!
                    const status = bookingComparison.positionChanged
                      ? 'moved'
                      : 'unchanged'

                    return (
                      <BookingDisplayCard
                        key={bookingComparison.standardBookingId}
                        booking={{
                          ...vroomBooking,
                          turordningsnr: vroomBooking.stepIndex,
                        }}
                        variant="comparison"
                        status={status}
                        comparisonData={{
                          originalOrder:
                            bookingComparison.sequential.turordningsnr,
                          newOrder: vroomBooking.stepIndex,
                          positionChanged: bookingComparison.positionChanged,
                        }}
                      />
                    )
                  })}
              </div>
            </div>
          </div>
        )}

        {comparison.hasOptimization &&
          comparison.bookingComparisons.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold mb-3">
                Ordningsändringar Sammanfattning
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-gray-800">
                    {comparison.bookingComparisons.length}
                  </div>
                  <div className="text-gray-600">Totala bokningar</div>
                </div>

                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-800">
                    {comparison.optimizedBookings}
                  </div>
                  <div className="text-gray-600">VROOM matchningar</div>
                </div>

                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-lg font-bold text-orange-800">
                    {
                      comparison.bookingComparisons.filter(
                        (c) => c.positionChanged
                      ).length
                    }
                  </div>
                  <div className="text-gray-600">Bokningar som bytte plats</div>
                </div>

                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-800">
                    {
                      comparison.bookingComparisons.filter(
                        (c) => !c.positionChanged && c.matched
                      ).length
                    }
                  </div>
                  <div className="text-gray-600">Behöll sin position</div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Matchningsgrad:</span>{' '}
                    <span className="text-green-600">
                      {Math.round(
                        (comparison.optimizedBookings /
                          comparison.totalBookings) *
                          100
                      )}
                      %
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Omsorteringsgrad:</span>{' '}
                    <span className="text-orange-600">
                      {Math.round(
                        (comparison.bookingComparisons.filter(
                          (c) => c.positionChanged
                        ).length /
                          comparison.totalBookings) *
                          100
                      )}
                      %
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  )
}

export default TuridComparisonView
