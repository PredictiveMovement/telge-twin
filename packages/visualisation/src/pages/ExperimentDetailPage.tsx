import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'

import Layout from '@/components/layout/Layout'
import {
  getExperiment,
  getExperimentStatistics,
  getOriginalBookings,
  getOriginalBookingsForExperiment,
  getVroomBookingsForExperiment,
  getRouteDataset,
  Experiment,
  ExperimentStatistics,
  RouteDataset,
} from '@/api/simulator'
import OptimizeHeader from '@/components/optimize/OptimizeHeader'
import OptimizeMapComparison from '@/components/optimize/OptimizeMapComparison'
import OptimizeStatistics from '@/components/optimize/OptimizeStatistics'
import ExperimentRouteStops from '@/components/optimize/ExperimentRouteStops'
import OptimizeActions from '@/components/optimize/OptimizeActions'
import OptimizeProgressBar from '@/components/optimize/OptimizeProgressBar'
import { useOptimizeProgress } from '@/hooks/useOptimizeProgress'
import { Stop } from '@/types/stops'
import { Alert, AlertDescription } from '@/components/ui/alert'

type ExperimentBooking = {
  id: string
  turid?: string
  ordning?: number
  arrayIndex?: number
  originalOrderNumber?: number
  recyclingType?: string
  position?: [number, number]
  vehicleId?: string
  serviceType?: string
  datum?: string
  truckId?: string
}

type DatasetRouteRecord = Record<string, any>

type VehicleStops = {
  currentStops: Stop[]
  optimizedStops: Stop[]
}

const createBookingKey = (
  turid?: string | number,
  kundnr?: string | number,
  hsnr?: string | number,
  tjnr?: string | number
) =>
  `${turid ?? 'undefined'}-${kundnr ?? 'undefined'}-${hsnr ?? 'undefined'}-${tjnr ?? 'undefined'}`

const parseMaybeNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const formatEstimatedTime = (value?: string) => {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const determineStopType = (
  serviceType?: string,
  recyclingType?: string
): Stop['type'] => {
  const service = (serviceType || '').toLowerCase()
  const recycling = (recyclingType || '').toLowerCase()

  if (service.includes('lunch')) return 'lunch'
  if (service.includes('rast') || service.includes('paus')) return 'break'
  if (service.includes('tipp') || recycling.includes('tipp')) return 'tipping'
  return 'regular'
}

const extractAddress = (record?: DatasetRouteRecord) => {
  if (!record) return undefined
  const candidate =
    record.Hsadress ||
    record.Adress ||
    record.address ||
    record.Adress1 ||
    record.Leveransadress ||
    record.Gatuadress ||
    record.Gatuadress1

  if (candidate) return candidate

  const hasCoordinates =
    typeof record.Lat === 'number' && typeof record.Lng === 'number'

  if (hasCoordinates) {
    const lat = Number(record.Lat).toFixed(5)
    const lng = Number(record.Lng).toFixed(5)
    return `${lat}, ${lng}`
  }

  const parts: Array<string | number | undefined> = [
    record.Turid,
    record.Kundnr,
    record.Hsnr,
    record.Tjnr,
  ]
  const fallback = parts
    .map((part) => (part !== undefined && part !== null ? String(part) : ''))
    .filter(Boolean)
    .join(' • ')

  return fallback || undefined
}

const extractWasteTypes = (
  primary?: string,
  record?: DatasetRouteRecord
): string[] | undefined => {
  const values = new Set<string>()
  const push = (value?: string) => {
    if (!value) return
    const trimmed = value.toString().trim()
    if (trimmed) values.add(trimmed)
  }

  push(primary)
  const recordValue = record?.Avftyp || record?.Avfallstyp || record?.Avfall || record?.Fraktion
  if (recordValue) {
    recordValue
      .toString()
      .split(/[;,]/)
      .forEach((part: string) => push(part))
  }

  return values.size ? Array.from(values) : undefined
}

const normaliseVehicleId = (
  booking: ExperimentBooking,
  record?: DatasetRouteRecord
) => {
  const raw =
    booking.vehicleId ??
    booking.truckId ??
    record?.Bil ??
    record?.vehicleId ??
    record?.Vehicle

  let value = raw != null ? String(raw).trim() : ''

  if (!value || value === 'undefined' || value === 'null') {
    if (booking.turid) {
      value = String(booking.turid)
    } else if (record?.Turid) {
      value = String(record.Turid)
    } else {
      value = 'Okänt'
    }
  }

  return value
}

const createStopFromBooking = (
  booking: ExperimentBooking & { originalData?: any },
  record?: DatasetRouteRecord
): Stop => {
  const serviceType = booking.serviceType || record?.Tjtyp
  const stopType = determineStopType(serviceType, booking.recyclingType || record?.Avftyp)
  const duration =
    parseMaybeNumber(
      record?.Schemalagd ||
        record?.SchemalagdTid ||
        record?.Stopptid ||
        record?.Stoptid ||
        record?.SchemalagdMinuter ||
        record?.SchemalagdMin
    ) ?? 15

  const stop: Stop = {
    id: booking.id,
    type: stopType,
    address: extractAddress(booking.originalData?.originalRouteRecord) || extractAddress(record) || booking.id,
    wasteTypes: extractWasteTypes(booking.recyclingType, record),
    vehicle: normaliseVehicleId(booking, record),
    routeNumber: booking.turid
      ? String(booking.turid)
      : record?.Turid
      ? String(record.Turid)
      : undefined,
    duration,
    originalPosition:
      booking.ordning ?? booking.arrayIndex ?? record?.Turordningsnr ?? undefined,
    serviceType,
    propertyDesignation:
      record?.Fastighetsbeteckning || record?.Fastighet || record?.Fastighetstext,
    frequency: record?.Frekvens,
    customerName:
      record?.Kundnamn ||
      (record?.Kundnr != null ? String(record.Kundnr) : undefined),
    accessKey: booking.originalData?.originalRouteRecord?.Nyckelkod || record?.Nyckelkod || record?.Nyckel || record?.Nyckeltext,
    walkingDistance:
      parseMaybeNumber(record?.Gangstracka || record?.['Gångsträcka'] || record?.GangAvstand) ||
      undefined,
    timePerStop:
      parseMaybeNumber(record?.Tid || record?.TidPerStop || record?.StopptidPer) ||
      undefined,
    estimatedTime: formatEstimatedTime(booking.datum || record?.Datum),
    containerType:
      record?.Karstorlek ||
      record?.Kärltyp ||
      record?.Behallartyp ||
      record?.Behållartyp,
    containerCount:
      parseMaybeNumber(
        record?.Karantal ||
          record?.Kärlantal ||
          record?.Behallarantal ||
          record?.Behållarantal
      ) || undefined,
  }

  return stop
}

const buildRouteStopsData = (
  originalBookings: ExperimentBooking[],
  optimizedBookings: ExperimentBooking[],
  datasetRecords: DatasetRouteRecord[]
): Record<string, VehicleStops> => {
  const datasetMap = new Map<string, DatasetRouteRecord>()
  datasetRecords.forEach((record) => {
    const key = createBookingKey(record?.Turid, record?.Kundnr, record?.Hsnr, record?.Tjnr)
    if (key) {
      datasetMap.set(key, record)
    }
  })

  const byVehicle = new Map<string, VehicleStops>()

  const ensureVehicleEntry = (vehicleId: string) => {
    if (!byVehicle.has(vehicleId)) {
      byVehicle.set(vehicleId, { currentStops: [], optimizedStops: [] })
    }
    return byVehicle.get(vehicleId) as VehicleStops
  }

  originalBookings.forEach((booking) => {
    const record = datasetMap.get(booking.id)
    const vehicleId = normaliseVehicleId(booking, record)
    const entry = ensureVehicleEntry(vehicleId)
    const stop = createStopFromBooking(booking, record)
    const orderValue =
      parseMaybeNumber(booking.ordning) ??
      parseMaybeNumber(booking.arrayIndex) ??
      parseMaybeNumber(record?.Turordningsnr)
    stop.originalPosition = orderValue ?? entry.currentStops.length
    entry.currentStops.push(stop)
  })

  optimizedBookings.forEach((booking) => {
    const record = datasetMap.get(booking.id)
    const vehicleId = normaliseVehicleId(booking, record)
    const entry = ensureVehicleEntry(vehicleId)
    const stop = createStopFromBooking(booking, record)
    const orderValue =
      parseMaybeNumber(booking.ordning) ??
      parseMaybeNumber(booking.arrayIndex) ??
      parseMaybeNumber(record?.Turordningsnr)
    stop.originalPosition = orderValue ?? entry.optimizedStops.length
    entry.optimizedStops.push(stop)
  })

  byVehicle.forEach((entry) => {
    entry.currentStops.sort(
      (a, b) => (a.originalPosition ?? 0) - (b.originalPosition ?? 0)
    )
    entry.optimizedStops.sort(
      (a, b) => (a.originalPosition ?? 0) - (b.originalPosition ?? 0)
    )

    if (!entry.optimizedStops.length) {
      entry.optimizedStops = entry.currentStops.map((stop) => ({ ...stop }))
    }
  })

  return Object.fromEntries(byVehicle.entries())
}

const ExperimentDetailPage = () => {
  const { experimentId } = useParams<{ experimentId: string }>()
  const navigate = useNavigate()

  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [dataset, setDataset] = useState<RouteDataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statistics, setStatistics] = useState<ExperimentStatistics | null>(
    null
  )
  const [statisticsLoading, setStatisticsLoading] = useState(false)
  const [mapData, setMapData] = useState<{
    optimizedStops: Stop[]
    selectedVehicle: string
  } | null>(null)
  const [routeStopsData, setRouteStopsData] = useState<Record<string, VehicleStops>>({})
  const [routeStopsLoading, setRouteStopsLoading] = useState(false)
  const [routeStopsError, setRouteStopsError] = useState<string | null>(null)

  const {
    isLoading: isMapLoading,
    progress: mapProgress,
    startProgress: startMapProgress,
  } = useOptimizeProgress({
    onComplete: () => {
      if (mapData) {
        navigate('/optimize/map', {
          state: {
            optimizedStops: mapData.optimizedStops,
            selectedVehicle: mapData.selectedVehicle,
          },
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
  })

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

        // Fetch the source dataset to get current optimizationSettings
        if (expData.sourceDatasetId) {
          const datasetData = await getRouteDataset(expData.sourceDatasetId)
          if (datasetData) {
            setDataset(datasetData)
          }
        }
      } catch (err: any) {
        setError(err.message || 'Ett fel uppstod vid hämtning av data.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [experimentId])

  useEffect(() => {
    if (!experimentId) {
      setStatistics(null)
      return
    }

    let cancelled = false

    const loadStatistics = async () => {
      try {
        setStatisticsLoading(true)
        const stats = await getExperimentStatistics(experimentId)
        if (!cancelled) {
          setStatistics(stats)
        }
      } catch {
        if (!cancelled) {
          setStatistics(null)
        }
      } finally {
        if (!cancelled) {
          setStatisticsLoading(false)
        }
      }
    }

    loadStatistics()

    return () => {
      cancelled = true
    }
  }, [experimentId])

  useEffect(() => {
    if (!experiment) {
      return
    }

    let cancelled = false

    const loadRouteStops = async () => {
      try {
        setRouteStopsLoading(true)
        setRouteStopsError(null)
        setMapData(null)

        const [originalResp, vroomResp, datasetResp] = await Promise.all([
          getOriginalBookingsForExperiment(experiment.id),
          getVroomBookingsForExperiment(experiment.id),
          experiment.sourceDatasetId
            ? getOriginalBookings(experiment.sourceDatasetId)
            : Promise.resolve(null),
        ])

        if (originalResp && originalResp.success === false) {
          throw new Error(
            originalResp.error ||
              'Kunde inte läsa in ursprunglig körturordning för experimentet'
          )
        }

        const originalBookings: ExperimentBooking[] = Array.isArray(
          originalResp?.data
        )
          ? (originalResp?.data as ExperimentBooking[])
          : []

        const vroomBookings: ExperimentBooking[] = Array.isArray(
          vroomResp?.data
        )
          ? (vroomResp?.data as ExperimentBooking[])
          : []

        const datasetRecords: DatasetRouteRecord[] = Array.isArray(datasetResp)
          ? (datasetResp as DatasetRouteRecord[])
          : []

        const routeData = buildRouteStopsData(
          originalBookings,
          vroomBookings,
          datasetRecords
        )

        if (!cancelled) {
          setRouteStopsData(routeData)
        }
      } catch (err) {
        if (!cancelled) {
          setRouteStopsData({})
          setMapData(null)
          setRouteStopsError(
            err instanceof Error
              ? err.message
              : 'Kunde inte läsa in körturordningen'
          )
        }
      } finally {
        if (!cancelled) {
          setRouteStopsLoading(false)
        }
      }
    }

    loadRouteStops()

    return () => {
      cancelled = true
    }
  }, [experiment])

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

  // Get start/end times with explicit fallback chain
  // This avoids issues with empty workingHours objects where start/end are undefined
  const getStartTime = () => {
    const expStart = experiment?.optimizationSettings?.workingHours?.start
    const datasetStart = dataset?.optimizationSettings?.workingHours?.start
    return expStart || datasetStart || '06:00'
  }

  const getEndTime = () => {
    const expEnd = experiment?.optimizationSettings?.workingHours?.end
    const datasetEnd = dataset?.optimizationSettings?.workingHours?.end
    return expEnd || datasetEnd || '15:00'
  }

  // planGroupId - groups all truck plans for this experiment
  const planGroupId = experiment.planGroupId

  const routeVehicles = Object.keys(routeStopsData)

  const aggregatedRouteNumbers = (() => {
    const identifiers = new Set<string>()
    Object.values(routeStopsData).forEach(({ currentStops, optimizedStops }) => {
      currentStops.forEach((stop) => {
        if (stop.routeNumber) identifiers.add(String(stop.routeNumber))
      })
      optimizedStops.forEach((stop) => {
        if (stop.routeNumber) identifiers.add(String(stop.routeNumber))
      })
    })
    return Array.from(identifiers)
  })()

  const savedProject = {
    id: experiment.id,
    name: experiment.name || experiment.datasetName || dataset?.name || `Experiment ${experiment.id}`,
    description: experiment.description || dataset?.description || (experiment.routeDataSource
      ? `Datakälla: ${experiment.routeDataSource}`
      : 'Optimerad körtur'),
    workingHours: {
      start: getStartTime(),
      end: getEndTime(),
    },
    vehicles: routeVehicles.length
      ? routeVehicles
      : Array.isArray((experiment as any)?.vehicles)
      ? ((experiment as any)?.vehicles as string[])
      : experiment.emitters || [],
    planGroupId,
  }

  const handleSaveChanges = () => {
    const event = new CustomEvent('optimizationSaved', {
      detail: { timestamp: new Date().toISOString() },
    })
    window.dispatchEvent(event)
  }

  const handleMapDataChange = (data: {
    optimizedStops: Stop[]
    selectedVehicle: string
  }) => {
    setMapData(data)
  }

  const handleViewMap = () => {
    if (mapData && !isMapLoading) {
      startMapProgress()
    }
  }

  const handleHeaderMapClick = (optimizedStops: Stop[], selectedVehicle: string) => {
    setMapData({ optimizedStops, selectedVehicle })
    startMapProgress()
  }

  return (
    <Layout>
      <OptimizeProgressBar isVisible={isMapLoading} progress={mapProgress} />

      <div className="space-y-8">
        <OptimizeHeader
          savedProject={savedProject}
          hasChanges={false}
          onSaveChanges={handleSaveChanges}
        />

        {experiment.dispatchErrors && experiment.dispatchErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-1">Ruttplanering misslyckades för följande fordon:</p>
              <ul className="list-disc pl-5 space-y-1">
                {experiment.dispatchErrors.map((err, i) => (
                  <li key={i}>
                    {err.truckId} ({err.fleet}): {err.error}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <OptimizeMapComparison
          startTime={savedProject.workingHours.start}
          endTime={savedProject.workingHours.end}
          sequentialDatasetId={experiment.sourceDatasetId}
          experimentId={experiment.id}
          areaPartitions={experiment.areaPartitions}
        />

        <OptimizeStatistics
          statistics={statistics}
          loading={statisticsLoading}
        />

        <ExperimentRouteStops
          data={routeStopsData}
          startTime={savedProject.workingHours.start}
          selectedRoutes={aggregatedRouteNumbers}
          isLoading={routeStopsLoading}
          error={routeStopsError}
          onMapDataChange={handleMapDataChange}
          onHeaderMapClick={handleHeaderMapClick}
        />

        <OptimizeActions
          onViewMap={handleViewMap}
          isMapLoading={isMapLoading}
          mapData={mapData}
        />
      </div>
    </Layout>
  )
}

export default ExperimentDetailPage
