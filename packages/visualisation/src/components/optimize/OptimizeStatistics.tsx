import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Route, Calendar, Leaf, MapPin, AlertTriangle } from 'lucide-react'
import type { ExperimentStatistics } from '@/api/simulator'

interface OptimizeStatisticsProps {
  statistics: ExperimentStatistics | null
  loading?: boolean
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isBaselineMissing = (statistics: ExperimentStatistics | null): boolean => {
  const baseline = statistics?.baseline
  if (!baseline) return true

  return (
    !isFiniteNumber(baseline.totalDistanceKm) ||
    !isFiniteNumber(baseline.totalCo2Kg) ||
    (baseline.bookingCount != null &&
      (!isFiniteNumber(baseline.bookingCount) || baseline.bookingCount < 0))
  )
}

const formatNumber = (value: number): string => {
  return value.toLocaleString('sv-SE')
}

const formatDecimal = (value: number): string => {
  return value.toFixed(1).replace('.', ',')
}

const OptimizeStatistics = ({
  statistics,
  loading = false,
}: OptimizeStatisticsProps) => {
  const baselineMissing = isBaselineMissing(statistics)

  const statisticsData = [
    {
      title: 'Antal körturer',
      value: statistics ? formatNumber(statistics.vehicleCount) : '-',
      icon: Route,
      color: 'bg-telge-ljusgul',
    },
    {
      title: 'Körsträcka (original)',
      value: baselineMissing
        ? 'Ej tillgänglig'
        : statistics?.baseline
          ? `${formatDecimal(statistics.baseline.totalDistanceKm)} km`
          : '-',
      icon: baselineMissing ? AlertTriangle : MapPin,
      color: baselineMissing ? 'bg-amber-100' : 'bg-gray-200',
      warning: baselineMissing,
    },
    {
      title: 'CO₂ (original)',
      value: baselineMissing
        ? 'Ej tillgänglig'
        : statistics?.baseline
          ? `${formatDecimal(statistics.baseline.totalCo2Kg)} kg`
          : '-',
      icon: baselineMissing ? AlertTriangle : Leaf,
      color: baselineMissing ? 'bg-amber-100' : 'bg-gray-200',
      warning: baselineMissing,
    },
    {
      title: 'Antal bokningar',
      value: statistics ? formatNumber(statistics.bookingCount) : '-',
      icon: Calendar,
      color: 'bg-telge-telgegul',
    },
    {
      title: 'Körsträcka (optimerad)',
      value: statistics
        ? `${formatDecimal(statistics.totalDistanceKm)} km`
        : '-',
      icon: MapPin,
      color: 'bg-telge-morkgul',
    },
    {
      title: 'CO₂ (optimerad)',
      value: statistics ? `${formatDecimal(statistics.totalCo2Kg)} kg` : '-',
      icon: Leaf,
      color: 'bg-telge-ljusgron',
    },
  ]

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="font-normal">Statistik och data</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {statisticsData.map((stat, index) => {
            const IconComponent = stat.icon
            const isWarning = 'warning' in stat && stat.warning
            return (
              <div
                key={index}
                className="flex items-center gap-4"
                title={isWarning ? 'Originalstatistik saknas för detta experiment' : undefined}
              >
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <IconComponent className={`h-6 w-6 ${isWarning ? 'text-amber-600' : 'text-black'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${isWarning ? 'text-amber-600 text-lg' : ''}`}>
                    {loading ? '...' : stat.value}
                  </p>
                  <p className="text-sm text-muted-foreground break-words whitespace-normal">
                    {stat.title}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default OptimizeStatistics
