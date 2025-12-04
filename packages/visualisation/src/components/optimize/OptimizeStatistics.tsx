import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Route, Calendar, LayoutGrid, Leaf, MapPin } from 'lucide-react'
import type { ExperimentStatistics } from '@/api/simulator'

interface OptimizeStatisticsProps {
  statistics: ExperimentStatistics | null
  loading?: boolean
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
  const statisticsData = [
    {
      title: 'Antal körturer',
      value: statistics ? formatNumber(statistics.vehicleCount) : '-',
      icon: Route,
      color: 'bg-telge-ljusgul',
    },
    {
      title: 'Antal bokningar',
      value: statistics ? formatNumber(statistics.bookingCount) : '-',
      icon: Calendar,
      color: 'bg-telge-telgegul',
    },
    {
      title: 'Antal kluster',
      value: statistics ? formatNumber(statistics.clusterCount) : '-',
      icon: LayoutGrid,
      color: 'bg-telge-ljusrod',
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
    {
      title: 'Körsträcka (original)',
      value: statistics?.baseline
        ? `${formatDecimal(statistics.baseline.totalDistanceKm)} km`
        : '-',
      icon: MapPin,
      color: 'bg-gray-200',
    },
    {
      title: 'CO₂ (original)',
      value: statistics?.baseline
        ? `${formatDecimal(statistics.baseline.totalCo2Kg)} kg`
        : '-',
      icon: Leaf,
      color: 'bg-gray-200',
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
            return (
              <div key={index} className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <IconComponent className="h-6 w-6 text-black" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
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
