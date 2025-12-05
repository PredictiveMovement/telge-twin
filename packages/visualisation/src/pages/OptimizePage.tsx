import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Play, Menu, Loader2 } from 'lucide-react'

import Layout from '@/components/layout/Layout'
import {
  getExperiment,
  getExperimentStatistics,
  getOriginalBookings,
  getOriginalBookingsForExperiment,
  getVroomBookingsForExperiment,
  getVroomPlan,
  updateRouteOrder,
  Experiment,
  ExperimentStatistics,
} from '@/api/simulator'
import OptimizeHeader from '@/components/optimize/OptimizeHeader'
import OptimizeMapComparison from '@/components/optimize/OptimizeMapComparison'
import OptimizeStatistics from '@/components/optimize/OptimizeStatistics'
import OptimizeActions from '@/components/optimize/OptimizeActions'
import OptimizeProgressBar from '@/components/optimize/OptimizeProgressBar'
import RouteColumnsGrid from '@/components/optimize/RouteColumnsGrid'
import RouteStopsActions from '@/components/optimize/RouteStopsActions'
import { VersionSnapshot } from '@/components/optimize/HistorySheet'
import { useOptimizeProgress } from '@/hooks/useOptimizeProgress'
import { useRouteStopsLogic } from '@/hooks/useRouteStopsLogic'
import { Stop } from '@/types/stops'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Alert, AlertDescription } from '@/components/ui/alert'
import telgeSettings from '@/config/telge-settings.json'

// Bygg index: bil-ID -> fack-config (samma logik som HoverInfoBox)
const buildFackIndex = (): Map<string, { fackNumber: number; wasteTypes: string[]; volume: number; weightLimit: number }[]> => {
  const bilar = (telgeSettings as any).settings?.bilar || []
  const index = new Map<string, { fackNumber: number; wasteTypes: string[]; volume: number; weightLimit: number }[]>()

  bilar.forEach((bil: any) => {
    if (!bil?.FACK?.length) return

    // Gruppera avfallstyper per fack
    const fackMap = new Map<number, string[]>()
    bil.FACK.forEach((f: any) => {
      if (!f?.FACK || !f?.AVFTYP) return
      const list = fackMap.get(f.FACK) || []
      list.push(f.AVFTYP)
      fackMap.set(f.FACK, list)
    })

    // Konvertera till array sorterad efter facknummer, inkl volym och vikt
    const facks = Array.from(fackMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([num, types]) => ({
        fackNumber: num,
        wasteTypes: [...new Set(types)],
        volume: bil[`FACK${num}_VOLYM`] || 0,
        weightLimit: bil[`FACK${num}_VIKT`] || 0,
      }))

    if (facks.length > 0) {
      index.set(String(bil.ID), facks)
    }
  })

  return index
}

const fackIndex = buildFackIndex()

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

const extractAddress = (record?: DatasetRouteRecord): string | undefined => {
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

// Parsar Tjtyp till kärlstorlek: "K370L1" -> "370L", "K140L" -> "140L"
const parseContainerType = (tjtyp?: string): string | undefined => {
  if (!tjtyp) return undefined
  const match = tjtyp.match(/K?(\d+L\d?)/i)
  return match ? match[1] : undefined
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
  // Prioritera originalRouteRecord från booking (innehåller Thor-data)
  const origRecord = booking.originalData?.originalRouteRecord

  // Använd originalRecord först, sedan record som fallback
  const serviceType = origRecord?.Tjtyp || booking.serviceType || record?.Tjtyp
  const stopType = determineStopType(
    serviceType,
    origRecord?.Avftyp || booking.recyclingType || record?.Avftyp
  )

  const duration =
    parseMaybeNumber(
      origRecord?.Schemalagd ||
        record?.Schemalagd ||
        record?.SchemalagdTid ||
        record?.Stopptid ||
        record?.Stoptid
    ) ?? 15

  // Beräkna vehicleId för att kunna slå upp fack-config
  const vehicleId = normaliseVehicleId(booking, record)

  // Hämta fack-config från telge-settings baserat på bil-ID
  const vehicleFacks = fackIndex.get(vehicleId)
  const compartments = vehicleFacks?.map(fack => ({
    number: fack.fackNumber,
    wasteType: fack.wasteTypes.join(', '),
    volume: fack.volume,
    weightLimit: fack.weightLimit,
    containerType: '',
  }))

  const stop: Stop = {
    id: booking.id,
    type: stopType,
    address:
      origRecord?.Hsadress ||
      record?.Hsadress ||
      extractAddress(record) ||
      booking.id,
    wasteTypes: extractWasteTypes(
      origRecord?.Avftyp || booking.recyclingType,
      record
    ),
    vehicle: vehicleId,
    routeNumber:
      origRecord?.Turid?.toString() ||
      booking.turid?.toString() ||
      record?.Turid?.toString(),
    duration,
    originalPosition:
      origRecord?.Turordningsnr ??
      booking.ordning ??
      booking.arrayIndex ??
      record?.Turordningsnr,
    serviceType,
    // Kundinformation - Thor-fält direkt i record
    propertyDesignation:
      origRecord?.Fastbet ||
      record?.Fastbet ||
      record?.Fastighetsbeteckning ||
      record?.Fastighet,
    frequency:
      origRecord?.Frekvens ||
      record?.Frekvens,
    customerName:
      origRecord?.Abonnentnr ||
      record?.Abonnentnr ||
      record?.Kundnamn ||
      (record?.Kundnr != null ? String(record.Kundnr) : undefined),
    accessKey:
      origRecord?.Nyckelkod ||
      record?.Nyckelkod ||
      record?.Nyckel,
    walkingDistance:
      parseMaybeNumber(
        origRecord?.Gangstracka ||
          record?.Gangstracka ||
          record?.Dragvag ||
          record?.['Gångsträcka']
      ) || undefined,
    timePerStop:
      parseMaybeNumber(
        origRecord?.Schemalagd ||
          record?.Schemalagd ||
          record?.Tid
      ) || undefined,
    estimatedTime: formatEstimatedTime(booking.datum || record?.Datum),
    // Parsa containerType från Tjtyp (t.ex. "K370L1" -> "370L")
    containerType:
      parseContainerType(origRecord?.Tjtyp || record?.Tjtyp) ||
      record?.Karstorlek ||
      record?.Kärltyp,
    containerCount:
      parseMaybeNumber(
        record?.Karantal ||
          record?.Kärlantal ||
          record?.Behallarantal ||
          record?.Behållarantal
      ) || 1,
    // Fordonsfack från telge-settings.json
    compartments,
  }

  return stop
}

const buildRouteStopsData = (
  originalBookings: ExperimentBooking[],
  optimizedBookings: ExperimentBooking[],
  datasetRecords: DatasetRouteRecord[]
): Record<string, VehicleStops> => {
  // Build a map of dataset records by ID for quick lookup
  // Booking IDs are formatted as: Turid-Kundnr-Hsnr-Tjnr (e.g., "HEM22FRE-80019627-1-5")
  const datasetMap = new Map<string, DatasetRouteRecord>()
  datasetRecords.forEach((record) => {
    // Try existing ID fields first
    if (record.id) datasetMap.set(record.id, record)
    if (record.Id) datasetMap.set(record.Id, record)
    if (record.ID) datasetMap.set(record.ID, record)

    // Build composite key from Thor data to match booking IDs
    if (record.Turid && record.Kundnr !== undefined) {
      const compositeKey = `${record.Turid}-${record.Kundnr}-${record.Hsnr ?? 1}-${record.Tjnr ?? 1}`
      datasetMap.set(compositeKey, record)
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
    entry.currentStops.push(stop)
  })

  optimizedBookings.forEach((booking) => {
    const record = datasetMap.get(booking.id)
    const vehicleId = normaliseVehicleId(booking, record)
    const entry = ensureVehicleEntry(vehicleId)
    const stop = createStopFromBooking(booking, record)
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

const OptimizePage = () => {
  const { experimentId } = useParams<{ experimentId: string }>()
  const navigate = useNavigate()

  // Tab state
  const [activeTab, setActiveTab] = useState('uppspelning')

  // Data loading state
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statistics, setStatistics] = useState<ExperimentStatistics | null>(null)
  const [routeStopsData, setRouteStopsData] = useState<Record<string, VehicleStops>>({})
  const [selectedVehicle, setSelectedVehicle] = useState<string>('')

  // Map state
  const [mapData, setMapData] = useState<{
    optimizedStops: Stop[]
    selectedVehicle: string
  } | null>(null)

  // VROOM plan data (for saving route order)
  const [vroomPlanData, setVroomPlanData] = useState<any>(null)

  // Version history
  const [versions, setVersions] = useState<VersionSnapshot[]>([])

  const tabOptions = [
    {
      value: 'uppspelning',
      label: (
        <span className="flex items-center gap-2">
          <Play className="h-4 w-4" />
          Uppspelning
        </span>
      )
    },
    {
      value: 'korturordning',
      label: (
        <span className="flex items-center gap-2">
          <Menu className="h-4 w-4" />
          Körturordning
        </span>
      )
    }
  ]

  // Get current vehicle's stops
  const vehicleData = selectedVehicle ? routeStopsData[selectedVehicle] : undefined

  // Route stops logic hook
  const routeStopsLogic = useRouteStopsLogic({
    initialCurrentStops: vehicleData?.currentStops || [],
    initialOptimizedStops: vehicleData?.optimizedStops || [],
    startTime: '06:00',
  })

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

  // Fetch experiment data
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

        // Fetch statistics
        const statsData = await getExperimentStatistics(experimentId)
        setStatistics(statsData)

        // Fetch route stops and dataset records
        const [originalResp, vroomResp, vroomPlanResp, datasetResp] = await Promise.all([
          getOriginalBookingsForExperiment(experimentId),
          getVroomBookingsForExperiment(experimentId),
          getVroomPlan(experimentId),
          expData.sourceDatasetId
            ? getOriginalBookings(expData.sourceDatasetId)
            : Promise.resolve(null),
        ])

        // Store VROOM plan data for later use when saving
        // Note: getVroomPlan returns the data directly (unwrapped), not {success, data}
        if (vroomPlanResp) {
          setVroomPlanData(vroomPlanResp)
        }

        // Handle error responses
        if (originalResp && originalResp.success === false) {
          throw new Error(originalResp.error || 'Kunde inte läsa in ursprunglig körturordning')
        }

        // Extract data arrays from responses
        const originalBookings: ExperimentBooking[] = Array.isArray(originalResp?.data)
          ? originalResp.data
          : []
        const optimizedBookings: ExperimentBooking[] = Array.isArray(vroomResp?.data)
          ? vroomResp.data
          : []
        const datasetRecords: DatasetRouteRecord[] = Array.isArray(datasetResp)
          ? datasetResp
          : []

        const stopsData = buildRouteStopsData(originalBookings, optimizedBookings, datasetRecords)
        setRouteStopsData(stopsData)

        // Set first vehicle as selected
        const vehicles = Object.keys(stopsData)
        if (vehicles.length > 0) {
          setSelectedVehicle(vehicles[0])
        }
      } catch (err: any) {
        setError(err.message || 'Ett fel uppstod vid hämtning av data.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [experimentId])

  const handleViewMap = () => {
    if (!isMapLoading && routeStopsLogic.optimizedStops.length > 0) {
      setMapData({
        optimizedStops: routeStopsLogic.optimizedStops,
        selectedVehicle,
      })
      startMapProgress()
    }
  }

  const handleSaveRouteOrder = async () => {
    if (!experimentId || !selectedVehicle || !vroomPlanData) {
      throw new Error('Saknas nödvändiga data för att spara')
    }

    // Find the route for the selected vehicle
    const vehicleRoute = vroomPlanData.routes?.find(
      (route: any) => route.vehicle === selectedVehicle
    )

    if (!vehicleRoute?.steps) {
      throw new Error('Kunde inte hitta körturdata för valt fordon')
    }

    // Get the original completePlan (steps) for this vehicle
    const originalSteps = vehicleRoute.steps

    // Build new completePlan by reordering based on optimizedStops
    const regularStops = routeStopsLogic.optimizedStops.filter(
      (stop) => stop.type === 'regular'
    )

    const newCompletePlan = regularStops
      .map((stop) => {
        // Find the original instruction that matches this stop's ID
        const originalInstruction = originalSteps.find(
          (instr: any) => instr.booking?.id === stop.id
        )
        return originalInstruction
      })
      .filter(Boolean)

    if (newCompletePlan.length === 0) {
      throw new Error('Inga bokningar att spara')
    }

    // Call API to update the route order
    const result = await updateRouteOrder(
      experimentId,
      selectedVehicle,
      newCompletePlan
    )

    if (!result.success) {
      throw new Error(result.error || 'Kunde inte spara körturordning')
    }

    // Mark as saved in the local state
    routeStopsLogic.markAsSaved()
  }

  const handleRestoreVersion = (versionId: string) => {
    // Find version and restore
    const version = versions.find(v => v.id === versionId)
    if (version) {
      routeStopsLogic.resetToDefaults()
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </Layout>
    )
  }

  const vehicles = Object.keys(routeStopsData)

  return (
    <Layout>
      <OptimizeProgressBar
        isVisible={isMapLoading}
        progress={mapProgress}
      />

      <div className="space-y-8">
        <OptimizeHeader
          savedProject={experiment ? { id: experiment.documentId, name: experiment.name || 'Experiment' } : undefined}
          hasChanges={routeStopsLogic.hasChangesFromOriginal}
          onSaveChanges={handleSaveRouteOrder}
          onSendToThor={() => console.log('Send to Thor')}
          onViewMap={handleViewMap}
          isMapLoading={isMapLoading}
          mapData={mapData}
        />

        <SegmentedControl
          options={tabOptions}
          value={activeTab}
          onValueChange={setActiveTab}
        />

        {activeTab === 'uppspelning' && (
          <div className="space-y-8">
            <OptimizeMapComparison
              startTime="06:00"
              endTime="16:00"
              sequentialDatasetId={experiment?.sourceDatasetId}
              experimentId={experiment?.id || ''}
              areaPartitions={experiment?.areaPartitions}
            />

            <OptimizeStatistics statistics={statistics} />
          </div>
        )}

        {activeTab === 'korturordning' && (
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <RouteColumnsGrid
              currentStops={vehicleData?.currentStops || []}
              optimizedStops={routeStopsLogic.optimizedStops}
              startTime="06:00"
              draggedItem={routeStopsLogic.draggedItem}
              dragOverIndex={routeStopsLogic.dragOverIndex}
              onDragStart={routeStopsLogic.handleDragStart}
              onDragOver={routeStopsLogic.handleDragOver}
              onDragLeave={routeStopsLogic.handleDragLeave}
              onDrop={routeStopsLogic.handleDrop}
              onUpdateDuration={routeStopsLogic.updateStopDuration}
              onUpdateBreak={routeStopsLogic.updateBreak}
              onUpdateTipping={routeStopsLogic.updateTipping}
              onDeleteBreak={routeStopsLogic.deleteBreak}
              onDeleteTipping={routeStopsLogic.deleteTipping}
              onDeleteRegularStop={routeStopsLogic.deleteRegularStop}
              onParkStop={routeStopsLogic.parkStop}
            />

            <RouteStopsActions
              onUndo={routeStopsLogic.handleUndo}
              onRedo={routeStopsLogic.handleRedo}
              onClear={routeStopsLogic.handleClear}
              onAdd={routeStopsLogic.addNewStop}
              canUndo={routeStopsLogic.canUndo}
              canRedo={routeStopsLogic.canRedo}
              hasChanges={routeStopsLogic.hasChangesFromOriginal}
              existingStops={routeStopsLogic.optimizedStops}
              parkedStops={routeStopsLogic.parkedStops}
              onRestoreParkedStop={routeStopsLogic.restoreParkedStop}
              onDragStartFromParking={(e, id) => routeStopsLogic.handleDragStart(e, id, 'parked')}
              onRestoreMultipleParkedStops={routeStopsLogic.restoreMultipleParkedStops}
              versions={versions}
              onRestoreVersion={handleRestoreVersion}
            />
          </div>
        )}

        <OptimizeActions
          onSendToThor={() => console.log('Send to Thor')}
          onViewMap={handleViewMap}
          isMapLoading={isMapLoading}
          mapData={mapData}
        />
      </div>
    </Layout>
  )
}

export default OptimizePage
