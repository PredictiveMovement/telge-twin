import { useEffect, useState, useCallback, useMemo } from 'react'
import Layout from '@/components/layout/Layout'
import { Car, Booking } from '@/types/map'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Square, Gauge, ZoomIn, ZoomOut, AlertTriangle } from 'lucide-react'
import StatusBadges from '@/components/StatusBadges'
import { useMapSocket } from '@/hooks/useMapSocket'
import { useMapStatus } from '@/hooks/useMapStatus'
import { toLonLatArray } from '@/utils/geo'
import { upsertListById } from '@/lib/utils'
import { getExperiment, AreaPartition, getVroomPlan } from '@/api/simulator'
import { MapDisplayCard } from '@/components/map/MapDisplayCard'
import { MapPlaybackOverlay } from '@/components/map/MapPlaybackOverlay'
import type { MapControls } from '@/components/Map'
import SettingsMenu from '@/components/SettingsMenu'
import type { SettingsMenuProps } from '@/components/SettingsMenu/types'
import LayersMenu from '@/components/LayersMenu'
import type { LayersMenuProps } from '@/components/LayersMenu/types'

const MapPage = () => {
  const {
    socket,
    isConnected,
    error: socketError,
    virtualTime,
    joinMap,
    leaveMap,
    playTime,
    pauseTime,
    setTimeSpeed: setSocketTimeSpeed,
  } = useMapSocket()

  const { status, setRunning, setTimeState } = useMapStatus()

  const [cars, setCars] = useState<Car[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isMapActive, setIsMapActive] = useState(false)
  const [areaPartitions, setAreaPartitions] = useState<
    AreaPartition[] | undefined
  >(undefined)
  const [vroomPlan, setVroomPlan] = useState<any | undefined>(undefined)
  const [settingsMenuProps, setSettingsMenuProps] =
    useState<SettingsMenuProps | null>(null)
  const [layersMenuProps, setLayersMenuProps] =
    useState<LayersMenuProps | null>(null)
  const [mapControls, setMapControls] = useState<MapControls | null>(null)
  const [workingHours, setWorkingHours] = useState<{ start: string; end: string }>({
    start: '06:00',
    end: '15:00',
  })

  const speedOptions = useMemo(
    () => [1, 10, 20, 30, 60, 120, 300, 600, 900],
    []
  )

  const upsertList = upsertListById

  useEffect(() => {
    if (!socket) {
      return
    }

    joinMap()
    setIsMapActive(true)

    return () => {
      leaveMap()
      setIsMapActive(false)
    }
  }, [socket, joinMap, leaveMap])

  const handleSimulationStatus = useCallback(
    (socketStatus: {
      running: boolean
      experimentId?: string
      timeRunning?: boolean
      timeSpeed?: number
    }) => {
      setRunning(socketStatus.running, socketStatus.experimentId)

      if (socketStatus.running) {
        const backendTimeRunning = socketStatus.timeRunning ?? true
        const backendTimeSpeed = socketStatus.timeSpeed ?? 60
        setTimeState(backendTimeRunning, backendTimeSpeed)
      }
    },
    [setRunning, setTimeState]
  )

  const handleSimulationStarted = useCallback(
    (data: { experimentId: string }) => {
      setRunning(true, data.experimentId)
      setCars([])
      setBookings([])
      setSocketTimeSpeed(status.timeSpeed)
    },
    [setRunning, status.timeSpeed, setSocketTimeSpeed]
  )

  const handleSimulationStopped = useCallback(() => {
    setRunning(false, null)
    setCars([])
    setBookings([])
    setTimeState(false)
    pauseTime()
    setAreaPartitions(undefined)
  }, [setRunning, setTimeState, pauseTime])

  const handleSimulationFinished = useCallback(() => {
    setRunning(false, null)
    setTimeState(false)
    pauseTime()
    setAreaPartitions(undefined)
  }, [setRunning, setTimeState, pauseTime])

  const handleCars = useCallback(
    (payload: Car | Car[]) => {
      setCars((prev) =>
        upsertList(prev, payload, (car) => ({
          ...car,
          position: toLonLatArray(car.position),
        }))
      )
    },
    [upsertList]
  )

  const handleBookings = useCallback(
    (payload: Booking | Booking[]) => {
      setBookings((prev) =>
        upsertList(prev, payload, (b) => ({
          ...b,
          pickup: b.pickup ? toLonLatArray(b.pickup) : null,
          destination: b.destination
            ? toLonLatArray(b.destination)
            : null,
        }))
      )
    },
    [upsertList]
  )

  useEffect(() => {
    if (!socket || !isMapActive) return

    socket.on('simulationStatus', handleSimulationStatus)
    socket.on('simulationStarted', handleSimulationStarted)
    socket.on('simulationStopped', handleSimulationStopped)
    socket.on('simulationFinished', handleSimulationFinished)
    socket.on('cars', handleCars)
    socket.on('bookings', handleBookings)

    return () => {
      socket.off('simulationStatus', handleSimulationStatus)
      socket.off('simulationStarted', handleSimulationStarted)
      socket.off('simulationStopped', handleSimulationStopped)
      socket.off('simulationFinished', handleSimulationFinished)
      socket.off('cars', handleCars)
      socket.off('bookings', handleBookings)
    }
  }, [
    socket,
    isMapActive,
    handleSimulationStatus,
    handleSimulationStarted,
    handleSimulationStopped,
    handleSimulationFinished,
    handleCars,
    handleBookings,
  ])

  // Fetch area partitions and working hours whenever we have a running simulation tied to an experiment
  useEffect(() => {
    let cancelled = false
    let interval: number | undefined
    const fetchPartitions = async () => {
      if (status.running && status.experimentId) {
        try {
          const exp = await getExperiment(status.experimentId)
          if (!cancelled) {
            setAreaPartitions(exp?.areaPartitions || [])
            // Extract working hours from experiment
            const wh = exp?.optimizationSettings?.workingHours
            if (wh?.start && wh?.end) {
              setWorkingHours({ start: wh.start, end: wh.end })
            }
          }
        } catch (_err) {
          if (!cancelled) setAreaPartitions([])
        }
      } else {
        setAreaPartitions(undefined)
      }
    }
    fetchPartitions()
    if (status.running && status.experimentId) {
      interval = window.setInterval(fetchPartitions, 10000)
    }
    return () => {
      cancelled = true
      if (interval) window.clearInterval(interval)
    }
  }, [status.running, status.experimentId])

  // Fetch VROOM consolidated plan for debug transitions
  useEffect(() => {
    let cancelled = false
    let interval: number | undefined
    const fetchVroom = async () => {
      if (status.running && status.experimentId) {
        try {
          const plan = await getVroomPlan(status.experimentId)
          if (!cancelled) setVroomPlan(plan || undefined)
        } catch (_err) {
          if (!cancelled) setVroomPlan(undefined)
        }
      } else {
        setVroomPlan(undefined)
      }
    }
    fetchVroom()
    if (status.running && status.experimentId) {
      interval = window.setInterval(fetchVroom, 15000)
    }
    return () => {
      cancelled = true
      if (interval) window.clearInterval(interval)
    }
  }, [status.running, status.experimentId])

  const handlePlayTime = () => {
    setTimeState(true, status.timeSpeed)
    playTime()
  }

  const handlePauseTime = () => {
    setTimeState(false, status.timeSpeed)
    pauseTime()
  }

  const handleSpeedChange = (speed: number) => {
    setTimeState(status.timeRunning, speed)
    setSocketTimeSpeed(speed)
  }

  const handleStopSimulation = () => {
    if (socket) {
      socket.emit('stopSimulation')
    }
  }

  const displayError = socketError

  // Helper to parse time string to minutes
  const parseTimeToMinutes = useCallback((time: string) => {
    const [hours, minutes] = time.split(':').map((val) => Number(val) || 0)
    return hours * 60 + minutes
  }, [])

  const startMinutes = useMemo(
    () => parseTimeToMinutes(workingHours.start),
    [workingHours.start, parseTimeToMinutes]
  )
  const endMinutes = useMemo(
    () => parseTimeToMinutes(workingHours.end),
    [workingHours.end, parseTimeToMinutes]
  )
  const totalMinutes = useMemo(
    () => Math.max(1, endMinutes - startMinutes),
    [endMinutes, startMinutes]
  )

  const minuteOfDay = useMemo(() => {
    if (!virtualTime) return null
    const date = new Date(virtualTime)
    if (Number.isNaN(date.getTime())) return null
    return (
      date.getHours() * 60 +
      date.getMinutes() +
      date.getSeconds() / 60 +
      date.getMilliseconds() / 60000
    )
  }, [virtualTime])

  const mapProgress = useMemo(() => {
    if (minuteOfDay === null) return 0
    // Calculate progress within working hours window
    const progress = ((minuteOfDay - startMinutes) / totalMinutes) * 100
    return Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0))
  }, [minuteOfDay, startMinutes, totalMinutes])

  const progressLabel = useMemo(() => {
    if (!virtualTime) return '--:--'
    const date = new Date(virtualTime)
    if (Number.isNaN(date.getTime())) return '--:--'
    return date.toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [virtualTime])

  const isPlaybackDisabled = !status.running || !isConnected

  const handleTogglePlayback = () => {
    if (isPlaybackDisabled) return
    if (status.timeRunning) {
      handlePauseTime()
    } else {
      handlePlayTime()
    }
  }

  const handleZoomIn = () => mapControls?.zoomIn()
  const handleZoomOut = () => mapControls?.zoomOut()

  const statusColorClass = status.running
    ? status.timeRunning
      ? 'bg-emerald-500'
      : 'bg-blue-500'
    : 'bg-gray-400'

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-normal">Karta</h1>
            <p className="text-muted-foreground mt-1 mb-1">
              Visualisera och övervaka rutter i realtid
            </p>
            <StatusBadges
              mode={status.mode}
              experimentId={status.experimentId}
            />
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex space-x-2">
              {status.running && (
                <Button variant="destructive" onClick={handleStopSimulation}>
                  <Square size={16} className="mr-2" />
                  Stoppa simulering
                </Button>
              )}
            </div>
          </div>
        </div>

        {displayError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{displayError}</AlertDescription>
          </Alert>
        )}

        <TooltipProvider>
          <MapDisplayCard
            title="Live-karta"
            statusColorClass={statusColorClass}
            isConnected={isConnected}
            isRunning={status.running}
            error={displayError}
            idleMessage="Ingen aktiv simulering. Starta en simulering för att visa kartdata."
            disconnectedMessage="Ingen anslutning till servern"
            sideControls={
              <>
                {settingsMenuProps && (
                  <SettingsMenu
                    {...settingsMenuProps}
                    triggerClassName="bg-white/90 text-gray-800 hover:bg-white h-8 w-8"
                    triggerVariant="ghost"
                    triggerSize="icon"
                    iconClassName="h-4 w-4"
                    triggerTooltip="Kartinställningar"
                    contentClassName="bg-white/95 backdrop-blur"
                  />
                )}

                {layersMenuProps && (
                  <LayersMenu
                    {...layersMenuProps}
                    triggerClassName="bg-white/90 text-gray-800 hover:bg-white h-8 w-8"
                    triggerVariant="ghost"
                    triggerSize="icon"
                    iconClassName="h-4 w-4"
                    triggerTooltip="Kartlager"
                    contentClassName="bg-white/95 backdrop-blur"
                  />
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-white/90 rounded-full p-1 flex flex-col">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-gray-800 hover:bg-gray-100 h-6 w-6 rounded-full"
                        onClick={handleZoomIn}
                        disabled={!mapControls}
                      >
                        <ZoomIn className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-gray-800 hover:bg-gray-100 h-6 w-6 rounded-full"
                        onClick={handleZoomOut}
                        disabled={!mapControls}
                      >
                        <ZoomOut className="h-3 w-3" />
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Zooma (demo)</p>
                  </TooltipContent>
                </Tooltip>

                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          className="bg-white/90 text-gray-800 hover:bg-white h-8 w-8"
                        >
                          <Gauge className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Hastighet ({status.timeSpeed}x)</p>
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end">
                    {speedOptions.map((option) => (
                      <DropdownMenuItem
                        key={option}
                        onClick={() => handleSpeedChange(option)}
                        className={
                          status.timeSpeed === option ? 'bg-accent' : ''
                        }
                      >
                        {option}x
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            }
            overlay={
              <MapPlaybackOverlay
                progress={mapProgress}
                progressLabel={progressLabel}
                startLabel={workingHours.start}
                endLabel={workingHours.end}
                isPlaying={status.timeRunning}
                onTogglePlayback={handleTogglePlayback}
                disabled={isPlaybackDisabled}
              />
            }
            mapClassName="w-full h-[75vh] max-h-screen min-h-[420px]"
            mapProps={{
              cars,
              bookings,
              isSimulationRunning: status.running,
              isConnected,
              isTimeRunning: status.timeRunning,
              timeSpeed: status.timeSpeed,
              virtualTime,
              onPlayTime: handlePlayTime,
              onPauseTime: handlePauseTime,
              onSpeedChange: handleSpeedChange,
              areaPartitions,
              vroomPlan: vroomPlan as any,
              showLayerMenu: false,
              showSettingsMenu: false,
              showLegend: false,
              showPlaybackControls: false,
              showFullscreenControl: false,
              showVirtualTime: false,
              onSettingsMenuProps: setSettingsMenuProps,
              onLayersMenuProps: setLayersMenuProps,
              onControlsReady: setMapControls,
            }}
          />
        </TooltipProvider>

        {isConnected && status.running && (
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-telge-ljusgul p-4 rounded-md">
                  <p className="text-sm font-medium">Aktiva fordon</p>
                  <h3 className="text-2xl font-normal mt-1">{cars.length}</h3>
                </div>
                <div className="bg-telge-ljusgron p-4 rounded-md">
                  <p className="text-sm font-medium">Aktiva bokningar</p>
                  <h3 className="text-2xl font-normal mt-1">
                    {bookings.length}
                  </h3>
                </div>
                <div className="bg-telge-ljusbla p-4 rounded-md">
                  <p className="text-sm font-medium">Status</p>
                  <h3 className="text-2xl font-normal mt-1">
                    {status.timeRunning ? 'Aktiv' : 'Pausad'}
                  </h3>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  )
}

export default MapPage
