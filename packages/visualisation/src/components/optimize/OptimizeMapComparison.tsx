import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Maximize2,
  List,
  Gauge,
  ZoomIn,
  ZoomOut,
  Link,
  Unlink,
} from 'lucide-react'

import Map from '@/components/Map'
import SettingsMenu from '@/components/SettingsMenu'
import LayersMenu from '@/components/LayersMenu'
import { MapPlaybackOverlay } from '@/components/map/MapPlaybackOverlay'
import { Button } from '@/components/ui/button'
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
import { useSimulationSession } from '@/hooks/useSimulationSession'
import * as simulator from '@/api/simulator'
import type { SettingsMenuProps } from '@/components/SettingsMenu/types'
import type { LayersMenuProps } from '@/components/LayersMenu/types'

interface OptimizeMapComparisonProps {
  startTime?: string
  endTime?: string
  sequentialDatasetId?: string
  experimentId: string
  areaPartitions?: simulator.AreaPartition[]
}

type ControlMode = 'synchronized' | 'individual'
type MapColumn = 'current' | 'optimized'

const speedOptions = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
]

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const OptimizeMapComparison: React.FC<OptimizeMapComparisonProps> = ({
  startTime = '06:00',
  endTime = '15:00',
  sequentialDatasetId,
  experimentId,
  areaPartitions,
}) => {
  const navigate = useNavigate()

  const currentSimulation = useSimulationSession({
    type: 'sequential',
    datasetId: sequentialDatasetId,
  })
  const optimizedSimulation = useSimulationSession({
    type: 'replay',
    experimentId,
  })

  const [controlMode, setControlMode] = useState<ControlMode>('synchronized')
  const [currentProgress, setCurrentProgress] = useState([0])
  const [optimizedProgress, setOptimizedProgress] = useState([0])
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [mapZoom, setMapZoom] = useState(12)

  // Current map state (left)
  const [currentMapStyle, setCurrentMapStyle] = useState(
    'mapbox://styles/mapbox/dark-v11'
  )
  const [currentEnable3D, setCurrentEnable3D] = useState(true)
  const [currentShowArcLayer, setCurrentShowArcLayer] = useState(false)
  const [currentShowActiveDeliveries, setCurrentShowActiveDeliveries] =
    useState(true)
  const [currentShowAssignedBookings, setCurrentShowAssignedBookings] =
    useState(true)
  const [currentMunicipalityLayer, setCurrentMunicipalityLayer] =
    useState(false)
  const [currentCarLayer, setCurrentCarLayer] = useState(true)
  const [currentUseIcons, setCurrentUseIcons] = useState(false)
  const [currentShowBookingLegend, setCurrentShowBookingLegend] =
    useState(false)
  const [currentShowAreaPartitionsLayer, setCurrentShowAreaPartitionsLayer] =
    useState(false)
  const [currentDebugMode, setCurrentDebugMode] = useState(false)
  const [currentDebugShowCentroids, setCurrentDebugShowCentroids] =
    useState(false)
  const [currentDebugShowClusterOrder, setCurrentDebugShowClusterOrder] =
    useState(false)
  const [currentDebugShowTransitions, setCurrentDebugShowTransitions] =
    useState(false)

  // Optimized map state (right)
  const [optimizedMapStyle, setOptimizedMapStyle] = useState(
    'mapbox://styles/mapbox/dark-v11'
  )
  const [optimizedEnable3D, setOptimizedEnable3D] = useState(true)
  const [optimizedShowArcLayer, setOptimizedShowArcLayer] = useState(false)
  const [optimizedShowActiveDeliveries, setOptimizedShowActiveDeliveries] =
    useState(true)
  const [optimizedShowAssignedBookings, setOptimizedShowAssignedBookings] =
    useState(true)
  const [optimizedMunicipalityLayer, setOptimizedMunicipalityLayer] =
    useState(false)
  const [optimizedCarLayer, setOptimizedCarLayer] = useState(true)
  const [optimizedUseIcons, setOptimizedUseIcons] = useState(false)
  const [optimizedShowBookingLegend, setOptimizedShowBookingLegend] =
    useState(false)
  const [
    optimizedShowAreaPartitionsLayer,
    setOptimizedShowAreaPartitionsLayer,
  ] = useState(false)
  const [optimizedDebugMode, setOptimizedDebugMode] = useState(false)
  const [optimizedDebugShowCentroids, setOptimizedDebugShowCentroids] =
    useState(false)
  const [optimizedDebugShowClusterOrder, setOptimizedDebugShowClusterOrder] =
    useState(false)
  const [optimizedDebugShowTransitions, setOptimizedDebugShowTransitions] =
    useState(false)

  const parseTimeToMinutes = useCallback((time: string) => {
    const [hours, minutes] = time.split(':').map((val) => Number(val) || 0)
    return hours * 60 + minutes
  }, [])

  const startMinutes = useMemo(
    () => parseTimeToMinutes(startTime),
    [startTime, parseTimeToMinutes]
  )
  const endMinutes = useMemo(
    () => parseTimeToMinutes(endTime),
    [endTime, parseTimeToMinutes]
  )
  const totalMinutes = useMemo(
    () => Math.max(1, endMinutes - startMinutes),
    [endMinutes, startMinutes]
  )

  const getMinuteOfDay = useCallback((virtualTime: number | null) => {
    if (!virtualTime) return null
    const date = new Date(virtualTime)
    if (Number.isNaN(date.getTime())) return null
    return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
  }, [])

  const virtualTimeToProgress = useCallback(
    (minuteOfDay: number | null, startMinute: number | null) => {
      if (minuteOfDay === null) return 0
      const baseline = startMinute ?? minuteOfDay
      const deltaMinutes = minuteOfDay - baseline
      const progress = (deltaMinutes / totalMinutes) * 100
      return Math.max(
        0,
        Math.min(100, Number.isFinite(progress) ? progress : 0)
      )
    },
    [totalMinutes]
  )

  const progressToTime = useCallback(
    (progress: number) => {
      const absoluteMinutes = startMinutes + (progress / 100) * totalMinutes
      const hours = Math.floor(absoluteMinutes / 60)
      const minutes = Math.round(absoluteMinutes % 60)
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}`
    },
    [startMinutes, totalMinutes]
  )

  const [currentStartMinute, setCurrentStartMinute] = useState<number | null>(
    null
  )
  const [optimizedStartMinute, setOptimizedStartMinute] = useState<
    number | null
  >(null)

  useEffect(() => {
    const minute = getMinuteOfDay(currentSimulation.virtualTime)
    if (minute === null) return

    if (currentStartMinute === null) {
      setCurrentStartMinute(minute)
      setCurrentProgress([0])
      return
    }

    setCurrentProgress([virtualTimeToProgress(minute, currentStartMinute)])
  }, [
    currentSimulation.virtualTime,
    currentStartMinute,
    getMinuteOfDay,
    virtualTimeToProgress,
  ])

  useEffect(() => {
    if (!currentSimulation.hasSession && !currentSimulation.isRunning) {
      setCurrentProgress([0])
      setCurrentStartMinute(null)
    }
  }, [currentSimulation.hasSession, currentSimulation.isRunning])

  useEffect(() => {
    const minute = getMinuteOfDay(optimizedSimulation.virtualTime)
    if (minute === null) return

    if (optimizedStartMinute === null) {
      setOptimizedStartMinute(minute)
      setOptimizedProgress([0])
      return
    }

    setOptimizedProgress([virtualTimeToProgress(minute, optimizedStartMinute)])
  }, [
    optimizedSimulation.virtualTime,
    optimizedStartMinute,
    getMinuteOfDay,
    virtualTimeToProgress,
  ])

  useEffect(() => {
    if (!optimizedSimulation.hasSession && !optimizedSimulation.isRunning) {
      setOptimizedProgress([0])
      setOptimizedStartMinute(null)
    }
  }, [optimizedSimulation.hasSession, optimizedSimulation.isRunning])

  const isSynchronized = controlMode === 'synchronized'

  const toggleSyncMode = () => {
    const newMode: ControlMode =
      controlMode === 'synchronized' ? 'individual' : 'synchronized'
    setControlMode(newMode)

    if (newMode === 'synchronized') {
      const avgProgress = Math.round(
        (currentProgress[0] + optimizedProgress[0]) / 2
      )
      setCurrentProgress([avgProgress])
      setOptimizedProgress([avgProgress])
    }

    toast(
      newMode === 'synchronized'
        ? 'Synkroniserad uppspelning'
        : 'Individuell uppspelning'
    )
  }

  const handleSpeedChange = (target: MapColumn, speed: number) => {
    setPlaybackSpeed(speed)
    const sessionSpeed = Math.max(1, Math.round(speed * 60))

    if (isSynchronized || target === 'current') {
      currentSimulation.setSpeed(sessionSpeed)
    }
    if (isSynchronized || target === 'optimized') {
      optimizedSimulation.setSpeed(sessionSpeed)
    }
  }

  const stopAndResetIfCompleted = async (target: MapColumn) => {
    const thresholdReached =
      target === 'current'
        ? currentProgress[0] >= 99
        : optimizedProgress[0] >= 99

    if (!thresholdReached) return

    if (target === 'current') {
      currentSimulation.stop()
      setCurrentProgress([0])
      setCurrentStartMinute(null)
    } else {
      optimizedSimulation.stop()
      setOptimizedProgress([0])
      setOptimizedStartMinute(null)
    }

    await delay(200)
  }

  const ensureSessionRunning = async (target: MapColumn) => {
    const simulation =
      target === 'current' ? currentSimulation : optimizedSimulation

    if (target === 'current' && !sequentialDatasetId) {
      toast('Saknar dataset för att starta sekventiell simulering')
      return false
    }

    if (!simulation.hasSession || !simulation.isRunning) {
      await stopAndResetIfCompleted(target)
      try {
        await simulation.start()
        if (target === 'current') {
          setCurrentStartMinute(null)
          setCurrentProgress([0])
        } else {
          setOptimizedStartMinute(null)
          setOptimizedProgress([0])
        }
      } catch (err: any) {
        const message = err?.message || 'Kunde inte starta simuleringen'
        toast(message)
        return false
      }
    } else if (!simulation.isTimeRunning) {
      simulation.play()
    }

    return true
  }

  const togglePlayback = async (target: MapColumn) => {
    const targets = isSynchronized
      ? (['current', 'optimized'] as const)
      : [target]
    const anyPlaying = targets.some((t) =>
      t === 'current'
        ? currentSimulation.isTimeRunning
        : optimizedSimulation.isTimeRunning
    )

    if (anyPlaying) {
      targets.forEach((t) => {
        const simulation =
          t === 'current' ? currentSimulation : optimizedSimulation
        simulation.pause()
      })
      return
    }

    const started: MapColumn[] = []

    for (const t of targets) {
      const ok = await ensureSessionRunning(t)
      if (!ok) {
        started.forEach((startedTarget) => {
          const simulation =
            startedTarget === 'current'
              ? currentSimulation
              : optimizedSimulation
          simulation.pause()
        })
        return
      }
      started.push(t)
    }
  }

  const handleViewInMap = () => {
    navigate('/optimize/map')
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 100)
  }

  const handleScrollToRouteOrder = () => {
    const routeOrderElement = document.querySelector('[data-route-order]')
    if (routeOrderElement) {
      const rect = routeOrderElement.getBoundingClientRect()
      const absoluteTop = rect.top + window.pageYOffset
      window.scrollTo({ top: absoluteTop - 100, behavior: 'smooth' })
    }
  }

  const handleZoomIn = () => setMapZoom((prev) => Math.min(prev + 1, 20))
  const handleZoomOut = () => setMapZoom((prev) => Math.max(prev - 1, 1))

  const renderStatusColor = (target: MapColumn) => {
    const simulation =
      target === 'current' ? currentSimulation : optimizedSimulation
    if (simulation.isTimeRunning) return 'bg-emerald-500'
    return target === 'current' ? 'bg-blue-500' : 'bg-emerald-400'
  }

  const renderMapCard = (target: MapColumn) => {
    const simulation =
      target === 'current' ? currentSimulation : optimizedSimulation
    const progress =
      target === 'current' ? currentProgress[0] : optimizedProgress[0]
    const isPlaying = simulation.isTimeRunning
    const isDisabled = target === 'current' && !sequentialDatasetId

    // Select state variables based on target
    const mapStyle = target === 'current' ? currentMapStyle : optimizedMapStyle
    const setMapStyle =
      target === 'current' ? setCurrentMapStyle : setOptimizedMapStyle
    const enable3D = target === 'current' ? currentEnable3D : optimizedEnable3D
    const setEnable3D =
      target === 'current' ? setCurrentEnable3D : setOptimizedEnable3D
    const showArcLayer =
      target === 'current' ? currentShowArcLayer : optimizedShowArcLayer
    const setShowArcLayer =
      target === 'current' ? setCurrentShowArcLayer : setOptimizedShowArcLayer
    const showActiveDeliveries =
      target === 'current'
        ? currentShowActiveDeliveries
        : optimizedShowActiveDeliveries
    const setShowActiveDeliveries =
      target === 'current'
        ? setCurrentShowActiveDeliveries
        : setOptimizedShowActiveDeliveries
    const showAssignedBookings =
      target === 'current'
        ? currentShowAssignedBookings
        : optimizedShowAssignedBookings
    const setShowAssignedBookings =
      target === 'current'
        ? setCurrentShowAssignedBookings
        : setOptimizedShowAssignedBookings
    const municipalityLayer =
      target === 'current'
        ? currentMunicipalityLayer
        : optimizedMunicipalityLayer
    const setMunicipalityLayer =
      target === 'current'
        ? setCurrentMunicipalityLayer
        : setOptimizedMunicipalityLayer
    const carLayer = target === 'current' ? currentCarLayer : optimizedCarLayer
    const setCarLayer =
      target === 'current' ? setCurrentCarLayer : setOptimizedCarLayer
    const useIcons = target === 'current' ? currentUseIcons : optimizedUseIcons
    const setUseIcons =
      target === 'current' ? setCurrentUseIcons : setOptimizedUseIcons
    const showBookingLegend =
      target === 'current'
        ? currentShowBookingLegend
        : optimizedShowBookingLegend
    const setShowBookingLegend =
      target === 'current'
        ? setCurrentShowBookingLegend
        : setOptimizedShowBookingLegend
    const showAreaPartitionsLayer =
      target === 'current'
        ? currentShowAreaPartitionsLayer
        : optimizedShowAreaPartitionsLayer
    const setShowAreaPartitionsLayer =
      target === 'current'
        ? setCurrentShowAreaPartitionsLayer
        : setOptimizedShowAreaPartitionsLayer
    const debugMode =
      target === 'current' ? currentDebugMode : optimizedDebugMode
    const setDebugMode =
      target === 'current' ? setCurrentDebugMode : setOptimizedDebugMode
    const debugShowCentroids =
      target === 'current'
        ? currentDebugShowCentroids
        : optimizedDebugShowCentroids
    const setDebugShowCentroids =
      target === 'current'
        ? setCurrentDebugShowCentroids
        : setOptimizedDebugShowCentroids
    const debugShowClusterOrder =
      target === 'current'
        ? currentDebugShowClusterOrder
        : optimizedDebugShowClusterOrder
    const setDebugShowClusterOrder =
      target === 'current'
        ? setCurrentDebugShowClusterOrder
        : setOptimizedDebugShowClusterOrder
    const debugShowTransitions =
      target === 'current'
        ? currentDebugShowTransitions
        : optimizedDebugShowTransitions
    const setDebugShowTransitions =
      target === 'current'
        ? setCurrentDebugShowTransitions
        : setOptimizedDebugShowTransitions

    // Create menu props for this specific map
    const settingsMenuProps: SettingsMenuProps = {
      activeLayers: {
        municipalityLayer,
        setMunicipalityLayer,
        carLayer,
        setCarLayer,
        useIcons,
        setUseIcons,
        showBookingLegend,
        setShowBookingLegend,
        showAreaPartitions: showAreaPartitionsLayer,
        setShowAreaPartitions: setShowAreaPartitionsLayer,
        enable3D,
        setEnable3D,
        mapStyle,
        setMapStyle,
      },
      showArcLayer,
      setShowArcLayer,
      showActiveDeliveries,
      setShowActiveDeliveries,
      showAssignedBookings,
      setShowAssignedBookings,
      debugMode,
      setDebugMode,
      debugShowCentroids,
      setDebugShowCentroids,
      debugShowClusterOrder,
      setDebugShowClusterOrder,
      debugShowTransitions,
      setDebugShowTransitions,
    }

    const layersMenuProps: LayersMenuProps = {
      mapStyle,
      setMapStyle,
      enable3D,
      setEnable3D,
    }

    const title = target === 'current' ? 'Nuvarande körtur' : 'VROOM Optimering'

    return (
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="bg-background px-4 py-3 border-b rounded-t-lg flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 ${renderStatusColor(
                target
              )}`}
            ></div>
            <h3 className="text-lg font-medium text-foreground">{title}</h3>
          </div>
        </div>

        <div className="relative">
          <div className="aspect-square bg-muted relative">
            <div className="absolute inset-0">
              <Map
                cars={simulation.cars}
                bookings={simulation.bookings}
                isSimulationRunning={simulation.isRunning}
                isConnected={simulation.isConnected}
                isTimeRunning={simulation.isTimeRunning}
                timeSpeed={simulation.timeSpeed}
                virtualTime={simulation.virtualTime}
                onPlayTime={simulation.play}
                onPauseTime={simulation.pause}
                onSpeedChange={simulation.setSpeed}
                areaPartitions={areaPartitions}
                vroomPlan={
                  target === 'optimized' ? simulation.vroomPlan : undefined
                }
                mapStyle={mapStyle}
                enable3D={enable3D}
                showArcLayer={showArcLayer}
                showActiveDeliveries={showActiveDeliveries}
                showAssignedBookings={showAssignedBookings}
                municipalityLayer={municipalityLayer}
                carLayer={carLayer}
                useIcons={useIcons}
                showBookingLegend={showBookingLegend}
                showAreaPartitionsLayer={showAreaPartitionsLayer}
                debugMode={debugMode}
                debugShowCentroids={debugShowCentroids}
                debugShowClusterOrder={debugShowClusterOrder}
                debugShowTransitions={debugShowTransitions}
                showLayerMenu={false}
                showSettingsMenu={false}
                showLegend={false}
                showPlaybackControls={false}
                showFullscreenControl={false}
                showVirtualTime={false}
              />
            </div>

            {!simulation.isConnected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/70 text-white px-4 py-2 rounded-md text-sm">
                  Ingen anslutning till servern
                </div>
              </div>
            )}

            {simulation.error && (
              <div className="absolute inset-x-4 bottom-4">
                <div className="bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-md text-sm shadow-lg">
                  {simulation.error}
                </div>
              </div>
            )}

            {!simulation.isRunning && !simulation.error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/60 text-white px-4 py-2 rounded-md text-sm">
                  Tryck på play för att starta simuleringen
                </div>
              </div>
            )}
          </div>

          <div className="absolute top-[calc(35%+28px)] -translate-y-1/2 right-4 hidden md:flex flex-col gap-3">
            {/* Fullscreen button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className="bg-white/90 text-gray-800 hover:bg-white hover:text-secondary h-8 w-8 transition-colors"
                  onClick={handleViewInMap}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Fullskärm</p>
              </TooltipContent>
            </Tooltip>

            <LayersMenu
              {...layersMenuProps}
              triggerClassName="bg-white/90 text-gray-800 hover:bg-white hover:text-secondary h-8 w-8 transition-colors"
              triggerVariant="ghost"
              triggerSize="icon"
              iconClassName="h-4 w-4"
              triggerTooltip="Kartlager"
              contentClassName="bg-white/95 backdrop-blur"
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-white/90 rounded-full p-1 flex flex-col">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-gray-800 hover:bg-gray-100 hover:text-secondary h-6 w-6 rounded-full transition-colors"
                    onClick={handleZoomIn}
                  >
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-gray-800 hover:bg-gray-100 hover:text-secondary h-6 w-6 rounded-full transition-colors"
                    onClick={handleZoomOut}
                  >
                    <ZoomOut className="h-3 w-3" />
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Zoom in/ut</p>
              </TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      className="bg-white/90 text-gray-800 hover:bg-white hover:text-secondary h-8 w-8 transition-colors"
                    >
                      <Gauge className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Hastighet ({playbackSpeed}x)</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {speedOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => handleSpeedChange(target, option.value)}
                    className={
                      playbackSpeed === option.value ? 'bg-accent' : ''
                    }
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <SettingsMenu
              {...settingsMenuProps}
              triggerClassName="bg-white/90 text-gray-800 hover:bg-white hover:text-secondary h-8 w-8 transition-colors"
              triggerVariant="ghost"
              triggerSize="icon"
              iconClassName="h-4 w-4"
              triggerTooltip="Kartinställningar"
              contentClassName="bg-white/95 backdrop-blur"
            />
          </div>

          <MapPlaybackOverlay
            progress={progress}
            progressLabel={progressToTime(progress)}
            startLabel={startTime}
            endLabel={endTime}
            isPlaying={isPlaying}
            onTogglePlayback={() => togglePlayback(target)}
            disabled={isDisabled}
          />
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
            {renderMapCard('current')}
            {renderMapCard('optimized')}
          </div>

          {/* Sync button centered between cards */}
          <div className="hidden md:block absolute left-1/2 top-[28px] -translate-x-1/2 z-10">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className="h-12 w-12 rounded-full bg-white hover:bg-white border-2 border shadow-lg transition-all group"
                  onClick={toggleSyncMode}
                >
                  {controlMode === 'synchronized' ? (
                    <Link className="h-5 w-5 text-telge-rod group-hover:text-secondary transition-colors" />
                  ) : (
                    <Unlink className="h-5 w-5 text-gray-600 group-hover:text-secondary transition-colors" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {controlMode === 'synchronized'
                    ? 'Synkroniserad uppspelning'
                    : 'Individuell uppspelning'}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-end hidden">
          <Button
            onClick={handleScrollToRouteOrder}
            className="flex items-center gap-2"
          >
            <List className="h-4 w-4" />
            Se körturordning
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default OptimizeMapComparison
