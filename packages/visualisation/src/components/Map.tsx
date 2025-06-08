import React, { useState, useMemo } from 'react'
import { StaticMap } from 'react-map-gl'
import DeckGL, {
  ScatterplotLayer,
  ArcLayer,
  IconLayer,
  PolygonLayer,
} from 'deck.gl'
import { Car, Booking } from '@/types/map'
import LayersMenu from './LayersMenu'
import BookingLegend from './BookingLegend'
import PlaybackControls from './PlaybackControls'
import { VirtualTimeDisplay } from './map/VirtualTimeDisplay'
import { BookingFilters } from './BookingLegend/types'
import { DEFAULT_FILTERS } from './BookingLegend/constants'

interface MapProps {
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
}

interface HoverInfo {
  id: string
  type: 'car' | 'booking' | 'municipality' | 'dropoff'
  x: number
  y: number
  viewport?: unknown
  name?: string
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

interface RouteData {
  inbound: number[]
  outbound: number[]
  from: [number, number]
  to: [number, number]
}

const BOOKING_COLORS = {
  DELIVERED: [128, 128, 128],
  PICKED_UP: [255, 165, 0],
  paper: [0, 100, 0],
  plastic: [255, 255, 0],
  glass: [0, 0, 255],
  metal: [192, 192, 192],
  organic: [139, 69, 19],
  default: [254, 254, 254],
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
}) => {
  const [mapState, setMapState] = useState({
    bearing: 0,
    pitch: 40,
    latitude: 59.1955,
    longitude: 17.6253,
    zoom: 10,
  })

  const [activeCar, setActiveCar] = useState<Car | null>(null)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)

  const [showArcLayer, setShowArcLayer] = useState(false)
  const [showActiveDeliveries, setShowActiveDeliveries] = useState(true)
  const [showAssignedBookings, setShowAssignedBookings] = useState(true)

  const [municipalityLayer, setMunicipalityLayer] = useState(false)
  const [carLayer, setCarLayer] = useState(true)
  const [useIcons, setUseIcons] = useState(false)
  const [showBookingLegend, setShowBookingLegend] = useState(false)

  const [bookingFilters, setBookingFilters] =
    useState<BookingFilters>(DEFAULT_FILTERS)

  const activeLayers = {
    municipalityLayer,
    setMunicipalityLayer,
    carLayer,
    setCarLayer,
    useIcons,
    setUseIcons,
    showBookingLegend,
    setShowBookingLegend,
  }

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

  const getColorBasedOnStatus = ({ status }: { status: string }) => {
    const opacity = Math.round((4 / 5) * 255)
    switch (status) {
      case 'delivery':
      case 'end':
      case 'ready':
      case 'returning':
        return [0, 200, 0, opacity]
      default:
        return [254, 254, 254, opacity]
    }
  }

  const getColorBasedOnType = ({ status, recyclingType }: Booking) => {
    const opacity = Math.round((4 / 5) * 255)

    if (status === 'Delivered') {
      return [...BOOKING_COLORS.DELIVERED, 55]
    }
    if (status === 'Picked up') {
      return [...BOOKING_COLORS.PICKED_UP, 128]
    }

    return [
      ...(BOOKING_COLORS[recyclingType as keyof typeof BOOKING_COLORS] ||
        BOOKING_COLORS.default),
      opacity,
    ]
  }

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      if (!showActiveDeliveries && booking.status === 'Picked up') return false
      if (
        !showAssignedBookings &&
        (booking.status === 'Assigned' || booking.status === 'Queued')
      )
        return false

      if (!bookingFilters.showAll) {
        if (!bookingFilters.recyclingTypes.has(booking.recyclingType))
          return false
        if (!bookingFilters.statuses.has(booking.status)) return false
      }

      return true
    })
  }, [bookings, showActiveDeliveries, showAssignedBookings, bookingFilters])

  const ICON_MAPPING = {
    ready: { x: 40, y: 0, width: 40, height: 40, mask: false },
    default: { x: 0, y: 0, width: 40, height: 40, mask: false },
  }

  const carIconLayer = useMemo(() => {
    if (!carLayer) return null

    if (useIcons) {
      return new IconLayer({
        id: 'car-icon-layer',
        data: cars,
        pickable: true,
        iconAtlas: '/combined_truck_icons.png',
        iconMapping: ICON_MAPPING,
        getIcon: (d: Car) => {
          const status = d.status.toLowerCase()
          return Object.prototype.hasOwnProperty.call(
            ICON_MAPPING,
            status as keyof typeof ICON_MAPPING
          )
            ? status
            : 'default'
        },
        sizeScale: 7,
        getPosition: (d: Car) => d.position,
        getSize: (_d: Car) => 5,
        getColor: getColorBasedOnStatus,
        onHover: ({ object, x, y, viewport }: LayerEvent) => {
          if (!object) return setHoverInfo(null)
          setHoverInfo({
            id: (object as Car).id,
            type: 'car',
            x,
            y,
            viewport,
          })
        },
        onClick: ({ object }: ClickEvent) => {
          if (!object) return
          const car = object as Car
          setMapState({
            ...mapState,
            zoom: 14,
            longitude: car.position[0],
            latitude: car.position[1],
          })
          setActiveCar(car)
        },
      })
    } else {
      return new ScatterplotLayer({
        id: 'car-circle-layer',
        data: cars,
        pickable: true,
        opacity: 0.8,
        stroked: false,
        filled: true,
        radiusScale: 1,
        radiusUnits: 'pixels',
        getPosition: (d: Car) => d.position,
        getRadius: () => 8,
        getFillColor: getColorBasedOnStatus,
        onHover: ({ object, x, y, viewport }: LayerEvent) => {
          if (!object) return setHoverInfo(null)
          setHoverInfo({
            id: (object as Car).id,
            type: 'car',
            x,
            y,
            viewport,
          })
        },
        onClick: ({ object }: ClickEvent) => {
          if (!object) return
          const car = object as Car
          setMapState({
            ...mapState,
            zoom: 14,
            longitude: car.position[0],
            latitude: car.position[1],
          })
          setActiveCar(car)
        },
      })
    }
  }, [cars, carLayer, useIcons, mapState, ICON_MAPPING])

  const bookingLayer = useMemo(
    () =>
      new ScatterplotLayer({
        id: 'booking-layer',
        data: filteredBookings,
        opacity: 1,
        stroked: false,
        filled: true,
        radiusScale: 1,
        radiusUnits: 'pixels',
        getPosition: (c: Booking) => c.pickup,
        getRadius: () => 4,
        getFillColor: (booking: Booking) => getColorBasedOnType(booking),
        pickable: true,
        onHover: ({ object, x, y, viewport }: LayerEvent) => {
          if (!object) return setHoverInfo(null)
          setHoverInfo({
            id: (object as Booking).id,
            type: 'booking',
            x,
            y,
            viewport,
          })
        },
      }),
    [filteredBookings]
  )

  const DESTINATION_ICON_MAPPING = {
    marker: { x: 0, y: 0, width: 40, height: 40, mask: false },
  }

  const destinationLayer = new IconLayer({
    id: 'destination-layer',
    data: [filteredBookings.find((b) => b.destination)].filter(Boolean),
    pickable: true,
    iconAtlas: '/base-big.png',
    iconMapping: DESTINATION_ICON_MAPPING,
    getIcon: (d: Booking) => 'marker',
    sizeScale: 7,
    getPosition: (b: Booking) => b.destination,
    getSize: (_d: Booking) => 5,
    onHover: ({ object, x, y, viewport }: LayerEvent) => {
      if (!object) return setHoverInfo(null)
      setHoverInfo({
        id: (object as Booking).id,
        type: 'dropoff',
        x,
        y,
        viewport,
      })
    },
  })

  const municipalityPolygonLayer = useMemo(() => {
    if (!municipalityLayer) return null

    return new PolygonLayer({
      id: 'municipality-layer',
      data: mockMunicipalityData,
      pickable: true,
      stroked: true,
      filled: true,
      wireframe: true,
      lineWidthMinPixels: 1,
      getPolygon: (d: { polygon: number[][] }) => d.polygon,
      getFillColor: [80, 210, 0, 80],
      getLineColor: [80, 210, 0, 255],
      getLineWidth: 2,
      onHover: ({ object, x, y, viewport }: LayerEvent) => {
        if (!object) return setHoverInfo(null)
        const municipality = object as { id: string; name: string }
        setHoverInfo({
          id: municipality.id,
          type: 'municipality',
          name: municipality.name,
          x,
          y,
          viewport,
        })
      },
    })
  }, [municipalityLayer, mockMunicipalityData])

  const routesData = useMemo(() => {
    if (!showArcLayer) return []

    return filteredBookings
      .map((booking) => {
        const car = cars.find((car) => car.id === booking.carId)
        if (!car) return null

        const bookingColor = getColorBasedOnType(booking)

        switch (booking.status) {
          case 'Picked up':
            return {
              inbound: bookingColor,
              outbound: bookingColor,
              from: car.position,
              to: booking.destination,
            }
          case 'Assigned':
          case 'Queued':
            return {
              inbound: bookingColor,
              outbound: bookingColor,
              from: car.position,
              to: booking.pickup,
            }
          case 'Delivered':
            return null
          default:
            return null
        }
      })
      .filter((b) => b)
  }, [filteredBookings, cars, showArcLayer])

  const routesLayer = useMemo(
    () =>
      new ArcLayer({
        id: 'routesLayer',
        data: routesData,
        pickable: true,
        getWidth: 0.5,
        getSourcePosition: (d: RouteData) => d.from,
        getTargetPosition: (d: RouteData) => d.to,
        getSourceColor: (d: RouteData) => d.inbound,
        getTargetColor: (d: RouteData) => d.outbound,
      }),
    [routesData]
  )

  const layers = useMemo(() => {
    const allLayers = []

    if (municipalityPolygonLayer) allLayers.push(municipalityPolygonLayer)
    allLayers.push(bookingLayer)
    allLayers.push(destinationLayer)
    if (showArcLayer) allLayers.push(routesLayer)
    if (carIconLayer) allLayers.push(carIconLayer)

    return allLayers
  }, [
    municipalityPolygonLayer,
    bookingLayer,
    destinationLayer,
    routesLayer,
    carIconLayer,
    showArcLayer,
  ])

  const HoverInfo = ({ info }: { info: HoverInfo }) => {
    if (!info) return null

    const { x, y, type, id, name } = info
    let content = ''

    if (type === 'car') {
      const car = cars.find((c) => c.id === id)
      content = car ? `Fordon ${car.id} - Status: ${car.status}` : 'Fordon'
    } else if (type === 'booking') {
      const booking = bookings.find((b) => b.id === id)
      content = booking
        ? `Bokning ${booking.id} - ${booking.recyclingType}`
        : 'Bokning'
    } else if (type === 'municipality') {
      content = `Kommun: ${name}`
    }

    return (
      <div
        style={{
          position: 'absolute',
          left: x + 10,
          top: y - 10,
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px',
          pointerEvents: 'none',
          zIndex: 1000,
        }}
      >
        {content}
      </div>
    )
  }

  return (
    <DeckGL
      mapboxApiAccessToken={
        (
          import.meta as unknown as {
            env: { VITE_MAPBOX_ACCESS_TOKEN: string }
          }
        ).env.VITE_MAPBOX_ACCESS_TOKEN
      }
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
      controller={true}
      layers={layers}
    >
      <StaticMap
        reuseMaps
        preventStyleDiffing={true}
        mapStyle="mapbox://styles/mapbox/dark-v10"
        mapboxApiAccessToken={
          (
            import.meta as unknown as {
              env: { VITE_MAPBOX_ACCESS_TOKEN: string }
            }
          ).env.VITE_MAPBOX_ACCESS_TOKEN
        }
      />

      {hoverInfo && <HoverInfo info={hoverInfo} />}

      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 1000,
        }}
      >
        <LayersMenu
          activeLayers={activeLayers}
          showArcLayer={showArcLayer}
          setShowArcLayer={setShowArcLayer}
          showActiveDeliveries={showActiveDeliveries}
          setShowActiveDeliveries={setShowActiveDeliveries}
          showAssignedBookings={showAssignedBookings}
          setShowAssignedBookings={setShowAssignedBookings}
        />
      </div>

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
            id: b.id,
            recyclingType: b.recyclingType,
            status: b.status,
          }))}
          filters={bookingFilters}
          onFiltersChange={setBookingFilters}
          isVisible={showBookingLegend}
        />
      </div>

      <VirtualTimeDisplay
        virtualTime={virtualTime}
        format="time"
        position="top-right"
      />

      {(isSimulationRunning || onPlayTime) && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
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
    </DeckGL>
  )
}

export default Map
