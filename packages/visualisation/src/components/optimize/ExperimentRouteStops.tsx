import React, { useEffect, useMemo, useState } from 'react'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import RouteStopsHeader from '@/components/optimize/RouteStopsHeader'
import RouteColumn from '@/components/optimize/RouteColumn'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stop } from '@/types/stops'

interface VehicleStops {
  currentStops: Stop[]
  optimizedStops: Stop[]
}

interface ExperimentRouteStopsProps {
  data: Record<string, VehicleStops>
  startTime?: string
  onMapDataChange?: (data: {
    optimizedStops: Stop[]
    selectedVehicle: string
  }) => void
  onHeaderMapClick?: (optimizedStops: Stop[], selectedVehicle: string) => void
  selectedRoutes?: string[]
  isLoading?: boolean
  error?: string | null
}

const ExperimentRouteStops: React.FC<ExperimentRouteStopsProps> = ({
  data,
  startTime,
  onMapDataChange,
  onHeaderMapClick,
  selectedRoutes,
  isLoading = false,
  error = null,
}) => {
  const vehicleIds = useMemo(() => Object.keys(data), [data])
  const [selectedVehicle, setSelectedVehicle] = useState<string>(
    vehicleIds[0] || ''
  )

  useEffect(() => {
    if (!vehicleIds.length) {
      setSelectedVehicle('')
      return
    }

    setSelectedVehicle((prev) =>
      prev && vehicleIds.includes(prev) ? prev : vehicleIds[0]
    )
  }, [vehicleIds])

  const selectedData = selectedVehicle ? data[selectedVehicle] : undefined

  const derivedSelectedRoutes = useMemo(() => {
    if (!selectedData) return []
    const routeNumbers = new Set<string>()
    selectedData.currentStops.forEach((stop) => {
      if (stop.routeNumber) routeNumbers.add(String(stop.routeNumber))
    })
    selectedData.optimizedStops.forEach((stop) => {
      if (stop.routeNumber) routeNumbers.add(String(stop.routeNumber))
    })
    return Array.from(routeNumbers)
  }, [selectedData])

  useEffect(() => {
    if (!selectedData) return
    onMapDataChange?.({
      optimizedStops: selectedData.optimizedStops,
      selectedVehicle,
    })
  }, [selectedData, onMapDataChange, selectedVehicle])

  const handleMapClick = () => {
    if (!selectedData) return
    onHeaderMapClick?.(selectedData.optimizedStops, selectedVehicle)
  }

  if (isLoading) {
    return (
      <Card className="flex flex-col shadow-none" data-route-order>
        <CardHeader>
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-40 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="flex flex-col shadow-none" data-route-order>
        <CardHeader>
          <p className="text-sm text-destructive">{error}</p>
        </CardHeader>
      </Card>
    )
  }

  if (!vehicleIds.length) {
    return (
      <Card className="flex flex-col shadow-none" data-route-order>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            Ingen körturordning tillgänglig för detta experiment.
          </p>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col shadow-none" data-route-order>
      <CardHeader className="space-y-4">
        <RouteStopsHeader
          optimizedStops={selectedData?.optimizedStops || []}
          selectedVehicle={selectedVehicle}
          selectedRoutes={
            derivedSelectedRoutes.length > 0
              ? derivedSelectedRoutes
              : selectedRoutes
          }
          hasChanges={false}
          onMapClick={handleMapClick}
        />
        {vehicleIds.length > 1 && (
          <SegmentedControl
            options={vehicleIds.map((vehicleId) => ({
              value: vehicleId,
              label: vehicleId,
            }))}
            value={selectedVehicle}
            onValueChange={setSelectedVehicle}
          />
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="grid grid-cols-6 gap-6">
          <RouteColumn
            title="Nuvarande ordning"
            subtitle=""
            stops={selectedData?.currentStops || []}
            listType="current"
            startTime={startTime}
            currentStops={selectedData?.currentStops || []}
          />

          <RouteColumn
            title="Optimerad körtur"
            subtitle=""
            stops={selectedData?.optimizedStops || []}
            listType="optimized"
            startTime={startTime}
            currentStops={selectedData?.currentStops || []}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default ExperimentRouteStops
