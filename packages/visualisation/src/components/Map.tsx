import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { StaticMap } from 'react-map-gl'
import DeckGL from 'deck.gl'
import { Button } from '@/components/ui/button'
import { Maximize2, Minimize2, Loader2 } from 'lucide-react'
import { Car, Booking } from '@/types/map'
import SettingsMenu from './SettingsMenu'
import LayersMenu from './LayersMenu'
import BookingLegend from './BookingLegend'
import PlaybackControls from './PlaybackControls'
import HoverInfoBox, { HoverInfoData } from './HoverInfoBox'
import { VirtualTimeDisplay } from './map/VirtualTimeDisplay'
import { BookingFilters } from './BookingLegend/types'
import { DEFAULT_FILTERS } from './BookingLegend/constants'
import { AreaPartition } from '@/api/simulator'
import type { SettingsMenuProps } from './SettingsMenu/types'
import type { LayersMenuProps } from './LayersMenu/types'
import { createCameraFlyover } from './dev/CameraFlyover'
import {
  enable3D,
  disable3D,
  lightingEffect,
  getBookingColor,
  getPartitionColor,
} from './map/utils'
import {
  createCarLayer,
  createBookingLayer,
  createDestinationLayer,
  createMunicipalityLayer,
  createAreaPartitionLayer,
  createCentroidPointLayer,
  createCentroidLabelLayer,
  createClusterOrderPathLayer,
  createClusterTransitionsLayer,
  createTransitionEndpointsLayer,
  createRoutesLayer,
  computePartitionData,
  computeClusterTransitions,
  computeTransitionEndpoints,
} from './map/layers'

export interface MapControls {
  zoomIn: () => void
  zoomOut: () => void
}

export interface MapProps {
  cars: Car[]
  bookings: Booking[]
  isSimulationRunning: boolean
  isConnected: boolean
  isTimeRunning?: boolean
  timeSpeed?: number
  virtualTime?: number | null
  onPlayTime?: () => void
  onPauseTime?: () => void
  onSpeedChange?: (speed: number) => void
  areaPartitions?: AreaPartition[]
  vroomPlan?: any

  // Optional props to control menu visibility
  showLayerMenu?: boolean
  showSettingsMenu?: boolean
  showLegend?: boolean
  showPlaybackControls?: boolean
  showFullscreenControl?: boolean
  showVirtualTime?: boolean

  // Optional props to override internal state
  mapStyle?: string
  enable3D?: boolean
  showArcLayer?: boolean
  showActiveDeliveries?: boolean
  showAssignedBookings?: boolean
  municipalityLayer?: boolean
  carLayer?: boolean
  useIcons?: boolean
  showBookingLegend?: boolean
  showAreaPartitionsLayer?: boolean
  debugMode?: boolean
  debugShowCentroids?: boolean
  debugShowClusterOrder?: boolean
  debugShowTransitions?: boolean

  // Callbacks to provide menu props to parent
  onSettingsMenuProps?: (props: SettingsMenuProps) => void
  onLayersMenuProps?: (props: LayersMenuProps) => void
  onControlsReady?: (controls: MapControls) => void
}

interface LayerEvent {
  object?: Car | Booking | { id: string; name: string }
  x: number
  y: number
  viewport?: unknown
}

interface ClickEvent {
  object?: Car | Booking
}

const Map: React.FC<MapProps> = ({
  cars,
  bookings,
  isSimulationRunning,
  isConnected,
  isTimeRunning = false,
  timeSpeed = 60,
  virtualTime = null,
  onPlayTime,
  onPauseTime,
  onSpeedChange,
  areaPartitions,
  vroomPlan,
  showLayerMenu = true,
  showSettingsMenu = true,
  showLegend = true,
  showPlaybackControls = true,
  showFullscreenControl = true,
  showVirtualTime = true,
  mapStyle: externalMapStyle,
  enable3D: externalEnable3D,
  showArcLayer: externalShowArcLayer,
  showActiveDeliveries: externalShowActiveDeliveries,
  showAssignedBookings: externalShowAssignedBookings,
  municipalityLayer: externalMunicipalityLayer,
  carLayer: externalCarLayer,
  useIcons: externalUseIcons,
  showBookingLegend: externalShowBookingLegend,
  showAreaPartitionsLayer: externalShowAreaPartitionsLayer,
  debugMode: externalDebugMode,
  debugShowCentroids: externalDebugShowCentroids,
  debugShowClusterOrder: externalDebugShowClusterOrder,
  debugShowTransitions: externalDebugShowTransitions,
  onSettingsMenuProps,
  onLayersMenuProps,
  onControlsReady,
}) => {
  const [isFullscreen, setFullscreen] = useState(false)
  const isFullscreenRef = useRef(false)
  const [mapState, setMapState] = useState({
    bearing: 0,
    pitch: 40,
    latitude: 59.1955,
    longitude: 17.6253,
    zoom: 10,
  })

  const [activeCar, setActiveCar] = useState<Car | null>(null)
  const [hoverInfo, setHoverInfo] = useState<HoverInfoData | null>(null)
  const flyoverRef = useRef<{
    start: () => void
    stop: () => void
    isRunning: () => boolean
    cycleChaseVehicle?: () => void
  } | null>(null)
  const currentViewStateRef = useRef(mapState)
  const areaPartitionsRef = useRef<any[]>([])
  const carsRef = useRef<Car[]>([])
  const mapRef = useRef<any>(null)
  const isHoveredRef = useRef<boolean>(false)

  const [showArcLayer, setShowArcLayer] = useState(
    externalShowArcLayer ?? false
  )
  const [showActiveDeliveries, setShowActiveDeliveries] = useState(
    externalShowActiveDeliveries ?? true
  )
  const [showAssignedBookings, setShowAssignedBookings] = useState(
    externalShowAssignedBookings ?? true
  )

  const [municipalityLayer, setMunicipalityLayer] = useState(
    externalMunicipalityLayer ?? false
  )
  const [carLayer, setCarLayer] = useState(externalCarLayer ?? true)
  const [useIcons, setUseIcons] = useState(externalUseIcons ?? false)
  const [showBookingLegend, setShowBookingLegend] = useState(
    externalShowBookingLegend ?? false
  )
  const [showAreaPartitions, setShowAreaPartitions] = useState(
    externalShowAreaPartitionsLayer ?? false
  )
  const [enable3DView, setEnable3DView] = useState(externalEnable3D ?? true)
  const [mapStyle, setMapStyle] = useState<string>(
    externalMapStyle ??
      (import.meta as unknown as { env: { VITE_DEFAULT_MAP_STYLE?: string } })
        .env.VITE_DEFAULT_MAP_STYLE ??
      'mapbox://styles/mapbox/dark-v11'
  )
  const enable3DRef = useRef(enable3DView)

  const [bookingFilters, setBookingFilters] =
    useState<BookingFilters>(DEFAULT_FILTERS)

  // Debug toggles
  const [debugMode, setDebugMode] = useState(externalDebugMode ?? false)
  const [debugShowCentroids, setDebugShowCentroids] = useState(
    externalDebugShowCentroids ?? true
  )
  const [debugShowClusterOrder, setDebugShowClusterOrder] = useState(
    externalDebugShowClusterOrder ?? true
  )
  const [debugShowTransitions, setDebugShowTransitions] = useState(
    externalDebugShowTransitions ?? false
  )

  const activeLayers = useMemo(
    () => ({
      municipalityLayer,
      setMunicipalityLayer,
      carLayer,
      setCarLayer,
      useIcons,
      setUseIcons,
      showBookingLegend,
      setShowBookingLegend,
      showAreaPartitions,
      setShowAreaPartitions,
      enable3D: enable3DView,
      setEnable3D: setEnable3DView,
      mapStyle,
      setMapStyle,
    }),
    [
      municipalityLayer,
      carLayer,
      useIcons,
      showBookingLegend,
      showAreaPartitions,
      enable3DView,
      mapStyle,
    ]
  )

  useEffect(() => {
    enable3DRef.current = enable3DView
  }, [enable3DView])

  useEffect(() => {
    isFullscreenRef.current = isFullscreen
  }, [isFullscreen])

  // Sync external props to internal state
  useEffect(() => {
    if (externalMapStyle !== undefined) setMapStyle(externalMapStyle)
  }, [externalMapStyle])

  useEffect(() => {
    if (externalEnable3D !== undefined) setEnable3DView(externalEnable3D)
  }, [externalEnable3D])

  useEffect(() => {
    if (externalShowArcLayer !== undefined)
      setShowArcLayer(externalShowArcLayer)
  }, [externalShowArcLayer])

  useEffect(() => {
    if (externalShowActiveDeliveries !== undefined)
      setShowActiveDeliveries(externalShowActiveDeliveries)
  }, [externalShowActiveDeliveries])

  useEffect(() => {
    if (externalShowAssignedBookings !== undefined)
      setShowAssignedBookings(externalShowAssignedBookings)
  }, [externalShowAssignedBookings])

  useEffect(() => {
    if (externalMunicipalityLayer !== undefined)
      setMunicipalityLayer(externalMunicipalityLayer)
  }, [externalMunicipalityLayer])

  useEffect(() => {
    if (externalCarLayer !== undefined) setCarLayer(externalCarLayer)
  }, [externalCarLayer])

  useEffect(() => {
    if (externalUseIcons !== undefined) setUseIcons(externalUseIcons)
  }, [externalUseIcons])

  useEffect(() => {
    if (externalShowBookingLegend !== undefined)
      setShowBookingLegend(externalShowBookingLegend)
  }, [externalShowBookingLegend])

  useEffect(() => {
    if (externalShowAreaPartitionsLayer !== undefined)
      setShowAreaPartitions(externalShowAreaPartitionsLayer)
  }, [externalShowAreaPartitionsLayer])

  useEffect(() => {
    if (externalDebugMode !== undefined) setDebugMode(externalDebugMode)
  }, [externalDebugMode])

  useEffect(() => {
    if (externalDebugShowCentroids !== undefined)
      setDebugShowCentroids(externalDebugShowCentroids)
  }, [externalDebugShowCentroids])

  useEffect(() => {
    if (externalDebugShowClusterOrder !== undefined)
      setDebugShowClusterOrder(externalDebugShowClusterOrder)
  }, [externalDebugShowClusterOrder])

  useEffect(() => {
    if (externalDebugShowTransitions !== undefined)
      setDebugShowTransitions(externalDebugShowTransitions)
  }, [externalDebugShowTransitions])

  // Provide menu props to parent if callbacks are provided
  useEffect(() => {
    if (onSettingsMenuProps) {
      onSettingsMenuProps({
        activeLayers,
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
      })
    }
  }, [
    onSettingsMenuProps,
    activeLayers,
    showArcLayer,
    showActiveDeliveries,
    showAssignedBookings,
    debugMode,
    debugShowCentroids,
    debugShowClusterOrder,
    debugShowTransitions,
  ])

  useEffect(() => {
    if (onLayersMenuProps) {
      onLayersMenuProps({
        mapStyle,
        setMapStyle,
        enable3D: enable3DView,
        setEnable3D: setEnable3DView,
      })
    }
  }, [onLayersMenuProps, mapStyle, enable3DView])

  // Provide zoom controls to parent
  useEffect(() => {
    if (onControlsReady) {
      const controls: MapControls = {
        zoomIn: () => {
          setMapState((prev) => ({
            ...prev,
            zoom: Math.min(prev.zoom + 1, 20),
          }))
        },
        zoomOut: () => {
          setMapState((prev) => ({
            ...prev,
            zoom: Math.max(prev.zoom - 1, 1),
          }))
        },
      }
      onControlsReady(controls)
    }
  }, [onControlsReady])

  const mockMunicipalityData = useMemo(
    () => [
      {
        id: 'stockholm',
        name: 'Stockholm',
        polygon: [
          [17.8, 59.3],
          [18.2, 59.3],
          [18.2, 59.0],
          [17.8, 59.0],
          [17.8, 59.3],
        ],
      },
    ],
    []
  )

  const displayAreaPartitions = useMemo(
    () => areaPartitions ?? [],
    [areaPartitions]
  )

  // colors and booking color come from utils

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      if (!showActiveDeliveries && booking.status === 'Picked up') return false
      if (
        !showAssignedBookings &&
        ['Assigned', 'Queued'].includes(booking.status)
      )
        return false
      if (!bookingFilters.showAll) {
        return (
          bookingFilters.recyclingTypes.has(booking.recyclingType) &&
          bookingFilters.statuses.has(booking.status)
        )
      }
      return true
    })
  }, [bookings, showActiveDeliveries, showAssignedBookings, bookingFilters])

  const createHoverHandler =
    (type: HoverInfoData['type']) =>
      ({ object, x, y, viewport }: LayerEvent) => {
        if (!object) return setHoverInfo(null)
        setHoverInfo({
          id: (object as any).id,
          type,
          x,
          y,
          viewport:
            viewport &&
            typeof (viewport as any).width === 'number' &&
            typeof (viewport as any).height === 'number'
              ? {
                  width: (viewport as any).width,
                  height: (viewport as any).height,
                }
              : null,
        })
      }

  const handleCarClick = useCallback(
    ({ object }: ClickEvent) => {
      if (!object) return
      const car = object as Car
      setMapState((prev) => ({
        ...prev,
        zoom: 14,
        longitude: car.position[0],
        latitude: car.position[1],
      }))
      setActiveCar(car)
    },
    []
  )

  const carIconLayer = useMemo(() => {
    if (!carLayer) return null
    return createCarLayer(cars, useIcons, {
      onHover: createHoverHandler('car'),
      onClick: handleCarClick,
    })
  }, [cars, carLayer, useIcons, handleCarClick])

  const bookingLayer = useMemo(
    () => createBookingLayer(filteredBookings, createHoverHandler('booking')),
    [filteredBookings]
  )

  const destinationLayer = createDestinationLayer(
    filteredBookings,
    createHoverHandler('dropoff')
  )

  const municipalityPolygonLayer = useMemo(() => {
    if (!municipalityLayer) return null

    return createMunicipalityLayer(
      mockMunicipalityData as any,
      ({ object, x, y, viewport }: LayerEvent) => {
        if (!object) return setHoverInfo(null)
        const municipality = object as { id: string; name: string }
        setHoverInfo({
          id: municipality.id,
          type: 'municipality',
          name: municipality.name,
          x,
          y,
          viewport:
            viewport &&
            typeof (viewport as any).width === 'number' &&
            typeof (viewport as any).height === 'number'
              ? {
                  width: (viewport as any).width,
                  height: (viewport as any).height,
                }
              : null,
        })
      }
    )
  }, [municipalityLayer, mockMunicipalityData])

  const areaPartitionLayer = useMemo(() => {
    if (!showAreaPartitions) return null

    const partitionData = computePartitionData(displayAreaPartitions as any)
    return createAreaPartitionLayer(
      partitionData as any,
      ({ object, x, y, viewport }: any) => {
        if (!object) return setHoverInfo(null)
        const p = object as any
        const isRectangle =
          p.polygon.length === 5 &&
          p.polygon[0][0] === p.bounds.minLng &&
          p.polygon[0][1] === p.bounds.minLat
        setHoverInfo({
          id: p.id,
          type: 'area-partition',
          name: `Kluster ${p.id} (${p.count} bokningar) - ${
            isRectangle ? 'rektangel' : 'convex hull'
          }`,
          x,
          y,
          viewport:
            viewport &&
            typeof (viewport as any).width === 'number' &&
            typeof (viewport as any).height === 'number'
              ? {
                  width: (viewport as any).width,
                  height: (viewport as any).height,
                }
              : null,
        })
      },
      debugMode
    )
  }, [showAreaPartitions, displayAreaPartitions, debugMode])

  // Debug: centroid points and labels
  const centroidPointLayer = useMemo(() => {
    if (!debugMode || !debugShowCentroids || !displayAreaPartitions.length)
      return null
    const data = displayAreaPartitions.map((p: any) => ({
      id: p.id,
      position: [p.center.lon, p.center.lat] as [number, number],
      label: `${p.id} (${p.count})`,
      color: p.truckId ? getPartitionColor(p.truckId) : [255, 255, 255],
    }))
    return createCentroidPointLayer(data)
  }, [debugMode, debugShowCentroids, displayAreaPartitions])

  const centroidLabelLayer = useMemo(() => {
    if (
      !debugMode ||
      !debugShowCentroids ||
      !displayAreaPartitions.length ||
      mapState.zoom < 11
    )
      return null
    const data = displayAreaPartitions.map((p, idx) => ({
      id: p.id,
      position: [p.center.lon, p.center.lat] as [number, number],
      text: `K#${idx + 1} • ${p.count} • ${(p.recyclingTypes || []).join(
        ', '
      )}`,
    }))
    const getSize = () => {
      const base = 12
      const scale = Math.max(0, mapState.zoom - 10)
      return Math.min(20, base + scale * 2)
    }
    return createCentroidLabelLayer(data, getSize)
  }, [debugMode, debugShowCentroids, displayAreaPartitions, mapState.zoom])

  // Debug: cluster order per fordon (rita för vald eller alla fordon)
  const clusterOrderPathLayer = useMemo(() => {
    if (!debugMode || !debugShowClusterOrder) return null
    const carsToDraw = activeCar ? [activeCar] : cars
    if (!carsToDraw.length || displayAreaPartitions.length === 0) return null

    const pathsData: any[] = []
    carsToDraw.forEach((car) => {
      // filtrera partitions för bilen om truckId finns
      const partsForCar = displayAreaPartitions.filter(
        (p: any) => !p.truckId || String(p.truckId) === String(car.id)
      )
      if (partsForCar.length === 0) return

      const remaining = [...partsForCar]
      const path: [number, number][] = []
      let cursor: [number, number] = [car.position[0], car.position[1]]

      while (remaining.length) {
        remaining.sort((a, b) => {
          const da = Math.hypot(
            a.center.lon - cursor[0],
            a.center.lat - cursor[1]
          )
          const db = Math.hypot(
            b.center.lon - cursor[0],
            b.center.lat - cursor[1]
          )
          return da - db
        })
        const next = remaining.shift()!
        const nextPos: [number, number] = [next.center.lon, next.center.lat]
        path.push(nextPos)
        cursor = nextPos
      }

      if (path.length) {
        pathsData.push({
          path: [[car.position[0], car.position[1]], ...path],
          color: getPartitionColor(car.id || 'car'),
        })
      }
    })

    return createClusterOrderPathLayer(pathsData)
  }, [debugMode, debugShowClusterOrder, displayAreaPartitions, activeCar, cars])

  // Debug: transitions mellan efterföljande kluster i vald ordning (bokning→bokning) för ALLA fordon
  const clusterTransitionsLayer = useMemo(() => {
    if (!debugMode || !debugShowTransitions) return null
    const routes = (vroomPlan as any)?.routes || []
    if (!routes?.length) return null

    const partitions = displayAreaPartitions
    const segs = computeClusterTransitions(routes, partitions as any)
    if (!segs.length) return null
    return createClusterTransitionsLayer(segs)
  }, [debugMode, debugShowTransitions, displayAreaPartitions, vroomPlan])

  // Debug: endpoints (sista/forsta) för transitions — för ALLA fordon
  const transitionEndpointsLayer = useMemo(() => {
    if (!debugMode || !debugShowTransitions) return null
    const routes = (vroomPlan as any)?.routes || []
    if (!routes?.length) return null

    const partitions = displayAreaPartitions
    const points = computeTransitionEndpoints(routes, partitions as any)
    if (!points.length) return null
    return createTransitionEndpointsLayer(points)
  }, [debugMode, debugShowTransitions, vroomPlan, displayAreaPartitions])

  const routesData = useMemo(() => {
    if (!showArcLayer) return []

    return filteredBookings
      .map((booking) => {
        const car = cars.find((car) => car.id === booking.carId)
        if (!car || booking.status === 'Delivered') return null

        const bookingColor = getBookingColor(booking)
        const to =
          booking.status === 'Picked up' ? booking.destination : booking.pickup

        return {
          inbound: bookingColor,
          outbound: bookingColor,
          from: car.position,
          to,
        }
      })
      .filter(Boolean)
  }, [filteredBookings, cars, showArcLayer])

  const routesLayer = useMemo(() => createRoutesLayer(routesData), [routesData])

  const layers = useMemo(() => {
    const allLayers = []

    if (municipalityPolygonLayer) allLayers.push(municipalityPolygonLayer)
    if (areaPartitionLayer) allLayers.push(areaPartitionLayer)
    if (centroidPointLayer) allLayers.push(centroidPointLayer)
    if (centroidLabelLayer) allLayers.push(centroidLabelLayer)
    if (clusterOrderPathLayer) allLayers.push(clusterOrderPathLayer)
    if (clusterTransitionsLayer) allLayers.push(clusterTransitionsLayer)
    if (transitionEndpointsLayer) allLayers.push(transitionEndpointsLayer)
    allLayers.push(bookingLayer)
    allLayers.push(destinationLayer)
    if (showArcLayer) allLayers.push(routesLayer)
    if (carIconLayer) allLayers.push(carIconLayer)

    return allLayers
  }, [
    municipalityPolygonLayer,
    areaPartitionLayer,
    centroidPointLayer,
    centroidLabelLayer,
    clusterOrderPathLayer,
    clusterTransitionsLayer,
    transitionEndpointsLayer,
    bookingLayer,
    destinationLayer,
    routesLayer,
    carIconLayer,
    showArcLayer,
  ])

  // Check if any vehicle is planning (for global loading indicator)
  const hasVehiclePlanning = useMemo(() => {
    return cars.some((c) => c.status === 'planning')
  }, [cars])

  // Keep refs in sync without re-creating the controller during animation
  useEffect(() => {
    currentViewStateRef.current = mapState
  }, [mapState])

  useEffect(() => {
    areaPartitionsRef.current = displayAreaPartitions
  }, [displayAreaPartitions])

  useEffect(() => {
    carsRef.current = cars
  }, [cars])

  // Dev: camera flyover (press "C" to toggle)
  useEffect(() => {
    const controller = createCameraFlyover({
      getWaypoints: () => {
        const parts = (areaPartitionsRef.current || []) as any[]
        const points = parts.map(
          (p) => [p.center.lon, p.center.lat] as [number, number]
        )
        if (!points.length) return []
        const remaining = [...points]
        const path: [number, number][] = []
        const vs = currentViewStateRef.current
        let cursor: [number, number] = [vs.longitude, vs.latitude]
        while (remaining.length) {
          remaining.sort((a, b) => {
            const da = Math.hypot(a[0] - cursor[0], a[1] - cursor[1])
            const db = Math.hypot(b[0] - cursor[0], b[1] - cursor[1])
            return da - db
          })
          const next = remaining.shift()!
          path.push(next)
          cursor = next
        }
        return path
      },
      getCurrentViewState: () => ({
        latitude: currentViewStateRef.current.latitude,
        longitude: currentViewStateRef.current.longitude,
        zoom: currentViewStateRef.current.zoom,
        bearing: currentViewStateRef.current.bearing,
        pitch: currentViewStateRef.current.pitch,
      }),
      setViewState: (vs) => setMapState(vs as any),
      options: {
        hopDurationMs: 12000,
        dwellMs: 0,
        baseZoom: 11.8,
        basePitch: 56,
        bearingFollow: true,
        loop: true,
        zoomInDelta: 0.3,
        durationJitterPct: 0.02,
        speedBurstProbability: 0,
        speedBurstFactor: 1,
        autoFollow: false,
      },
      getVehicles: () =>
        (carsRef.current || []).map((c) => ({
          id: c.id,
          position: c.position as [number, number],
        })),
    })

    flyoverRef.current = controller

    const onKey = (e: KeyboardEvent) => {
      // Only handle hotkeys when this map is hovered or in fullscreen
      if (!isHoveredRef.current && !isFullscreenRef.current) return
      if (e.key.toLowerCase() === 'c') {
        if (!flyoverRef.current) return
        if (flyoverRef.current.isRunning()) {
          flyoverRef.current.stop()
        } else {
          flyoverRef.current.start()
        }
      } else if (e.key.toLowerCase() === 'v') {
        // Toggle chase cam: cycle vehicles; after last, resume normal flyover
        flyoverRef.current?.cycleChaseVehicle &&
          flyoverRef.current.cycleChaseVehicle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      flyoverRef.current?.stop()
      flyoverRef.current = null
    }
  }, [])
  const mapboxToken = (
    import.meta as unknown as { env: { VITE_MAPBOX_ACCESS_TOKEN: string } }
  ).env.VITE_MAPBOX_ACCESS_TOKEN

  // React to 3D toggle at runtime — only toggle 3D buildings, preserve camera
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
      if (enable3DView) {
        enable3D(map)
      } else {
        disable3D(map)
      }
    } catch {}
  }, [enable3DView])

  // lightingEffect and enable3D imported from utils

  return (
    <div
      style={
        isFullscreen
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 30,
              width: '100vw',
              height: '100vh',
              background: '#0b0b0b',
            }
          : { position: 'relative', width: '100%', height: '100%' }
      }
      onMouseEnter={() => (isHoveredRef.current = true)}
      onMouseLeave={() => (isHoveredRef.current = false)}
    >
      <DeckGL
        mapboxApiAccessToken={mapboxToken}
        viewState={mapState}
        onViewStateChange={({ viewState }) => {
          setMapState(viewState)
          if (activeCar) {
            setActiveCar(null)
          }
        }}
        onClick={(event) => {
          if (!event.layer) setActiveCar(null)
        }}
        effects={[lightingEffect]}
        glOptions={{ antialias: true }}
        controller={true}
        layers={layers}
      >
        <StaticMap
          reuseMaps={false}
          preventStyleDiffing={true}
          mapStyle={mapStyle}
          mapboxApiAccessToken={mapboxToken}
          onLoad={(e: any) => {
            const map = e.target
            mapRef.current = map
            // Enable 3D on load and increase default pitch
            if (enable3DView) {
              map.once('idle', () => {
                // Kontrollera aktuell inställning — använd ref så vi följer senaste togglet.
                if (enable3DRef.current) {
                  try {
                    enable3D(map)
                  } catch {}
                }
              })
            }
            setMapState((s) => ({
              ...s,
              pitch: Math.max(55, s.pitch ?? 55),
              bearing: typeof s.bearing === 'number' ? s.bearing : -20,
            }))

            const apply3D = () => {
              if (!mapRef.current) return
              try {
                if (enable3DRef.current) {
                  enable3D(mapRef.current)
                } else {
                  disable3D(mapRef.current)
                }
              } catch {}
            }

            // Re-apply 3D when style changes via setStyle (mapStyle prop)
            const onStyleData = () => apply3D()
            const onStyleLoad = () => apply3D()
            map.on('styledata', onStyleData)
            map.on('style.load', onStyleLoad)
            // Cleanup on unmount
            map.on('remove', () => {
              try {
                map.off('styledata', onStyleData)
                map.off('style.load', onStyleLoad)
              } catch {}
            })
          }}
        />

        <HoverInfoBox hoverInfo={hoverInfo} cars={cars} bookings={bookings} />

        {(showSettingsMenu || showLayerMenu) && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {showSettingsMenu && (
              <LayersMenu
                mapStyle={mapStyle}
                setMapStyle={setMapStyle}
                enable3D={enable3DView}
                setEnable3D={setEnable3DView}
              />
            )}
            {showLayerMenu && (
              <SettingsMenu
                activeLayers={activeLayers}
                showArcLayer={showArcLayer}
                setShowArcLayer={setShowArcLayer}
                showActiveDeliveries={showActiveDeliveries}
                setShowActiveDeliveries={setShowActiveDeliveries}
                showAssignedBookings={showAssignedBookings}
                setShowAssignedBookings={setShowAssignedBookings}
                debugMode={debugMode}
                setDebugMode={setDebugMode}
                debugShowCentroids={debugShowCentroids}
                setDebugShowCentroids={setDebugShowCentroids}
                debugShowClusterOrder={debugShowClusterOrder}
                setDebugShowClusterOrder={setDebugShowClusterOrder}
                debugShowTransitions={debugShowTransitions}
                setDebugShowTransitions={setDebugShowTransitions}
              />
            )}
          </div>
        )}

        {showLegend && (
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              zIndex: 1000,
            }}
          >
            <BookingLegend
              bookings={bookings.map((b) => ({
                ...b,
                recyclingType: b.recyclingType || 'unknown',
              }))}
              filters={bookingFilters}
              onFiltersChange={setBookingFilters}
              isVisible={showBookingLegend}
            />
          </div>
        )}

        {showVirtualTime && (
          <VirtualTimeDisplay
            virtualTime={virtualTime}
            format="time"
            position="top-right"
          />
        )}

        {/* Global planning indicator */}
        {hasVehiclePlanning && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: showVirtualTime ? '180px' : '20px',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(0, 0, 0, 0.7)',
              padding: '8px 12px',
              borderRadius: '8px',
            }}
          >
            <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
            <span className="text-sm text-white">Beräknar rutter...</span>
          </div>
        )}

        {(isSimulationRunning || onPlayTime) && (
          <>
            {showFullscreenControl && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  right: '20px',
                  zIndex: 1001,
                }}
              >
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setFullscreen((v) => !v)}
                  aria-label={isFullscreen ? 'Avsluta helskärm' : 'Helskärm'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
            {showPlaybackControls && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  right: showFullscreenControl ? '68px' : '20px',
                  zIndex: 1000,
                }}
              >
                <PlaybackControls
                  isPlaying={isTimeRunning}
                  speed={timeSpeed}
                  onPlay={onPlayTime || (() => {})}
                  onPause={onPauseTime || (() => {})}
                  onSpeedChange={onSpeedChange || (() => {})}
                  disabled={!isConnected || !isSimulationRunning}
                />
              </div>
            )}
          </>
        )}
      </DeckGL>
    </div>
  )
}

export default Map
