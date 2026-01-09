import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Route, Calendar, Leaf, MapPin, AlertTriangle } from 'lucide-react'
import type { ExperimentStatistics } from '@/api/simulator'

interface OptimizeStatisticsProps {
  statistics: ExperimentStatistics | null
  loading?: boolean
}

// Check if baseline data is missing/invalid (identical to optimized values indicates missing turordning)
const isBaselineMissing = (statistics: ExperimentStatistics | null): boolean => {
  if (!statistics?.baseline) return true
  // If baseline equals optimized (within tolerance), turordning was likely missing
  // Using relative tolerance for floating point comparison
  const distanceDiff = Math.abs(statistics.baseline.totalDistanceKm - statistics.totalDistanceKm)
  const co2Diff = Math.abs(statistics.baseline.totalCo2Kg - statistics.totalCo2Kg)
  const distanceTolerance = Math.max(statistics.totalDistanceKm * 0.001, 0.1) // 0.1% or 0.1km
  const co2Tolerance = Math.max(statistics.totalCo2Kg * 0.001, 0.01) // 0.1% or 0.01kg
  return distanceDiff < distanceTolerance && co2Diff < co2Tolerance
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
                title={isWarning ? 'Turordning saknas i originaldata' : undefined}
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
