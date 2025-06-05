import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { StaticMap } from 'react-map-gl'
import DeckGL, {
  PolygonLayer,
  ScatterplotLayer,
  ArcLayer,
  LinearInterpolator,
  IconLayer,
} from 'deck.gl'
import inside from 'point-in-polygon'
import { ParagraphLarge } from './Typography/index.jsx'
import MunicipalityStatisticsBox from './MunicipalityStatisticsBox/index.jsx'
import TimeProgressBar from './TimeProgressBar/index.jsx'
import LayersMenu from './LayersMenu/index.jsx'
import HoverInfoBox from './HoverInfoBox/index.jsx'
import BookingLegend from './BookingLegend/index.jsx'
import { BOOKING_COLORS, groupedColors } from '../constants.js'

const transitionInterpolator = new LinearInterpolator(['bearing'])

const Map = ({
  activeLayers,
  cars,
  bookings,
  municipalities,
  activeCar,
  setActiveCar,
  time,
  setShowEditExperimentModal,
  experimentId,
  initMapState,
  socket,
  selectedDataFile,
  setSelectedDataFile,
  uploadedFiles,
}) => {
  const [mapState, setMapState] = useState({
    bearing: 0,
    pitch: 40,
    ...initMapState,
  })

  const rotateCamera = useCallback(() => {
    setMapState((mapState) => ({
      ...mapState,
      bearing: mapState.bearing + 1,
      transitionDuration: 1000,
      transitionInterpolator,
      onTransitionEnd: rotateCamera,
    }))
  }, [])

  const [hoverInfo, setHoverInfo] = useState(null)
  const hoverInfoRef = useRef(null)
  const [municipalityInfo, setMunicipalityInfo] = useState(null)

  const municipalityLayer = new PolygonLayer({
    id: 'municipality-layer',
    data: municipalities,
    stroked: true,
    // we need the fill layer for our hover function
    filled: true,
    extruded: false,
    wireframe: false,
    lineWidthUtils: 'pixels',
    lineWidthMinPixels: 1,
    getLineWidth: 50,
    lineJointRounded: true,
    getElevation: 0,
    opacity: 0.3,
    polygonOffset: 1,
    getPolygon: (k) => k.geometry.coordinates,
    getLineColor: [0, 255, 128, 100],
    getFillColor: [0, 0, 0, 0], // this isn't actually opaque, it just ends up not rendering any color
    pickable: true,
    onHover: (info, event) => {
      const { object } = info
      setMunicipalityInfo((current) => {
        if (!!object) return object
        // Seems to happen if you leave the viewport at the same time you leave a polygon
        if (!Array.isArray(info.coordinate)) return null

        // If mouse is inside our polygon we keep ourselves open
        if (
          current.geometry.coordinates.some((polygon) =>
            inside(info.coordinate, polygon)
          )
        ) {
          return current
        }
        return null
      })
    },
  })

  const getColorBasedOnStatus = ({ status }) => {
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

  const getColorBasedOnType = ({ id, status, recyclingType }) => {
    const opacity = Math.round((4 / 5) * 255)

    if (status === 'Delivered') {
      return [...BOOKING_COLORS.DELIVERED, 55] // Lower opacity for delivered
    }
    if (status === 'Picked up') {
      return [...BOOKING_COLORS.PICKED_UP, 128]
    }

    return [...(BOOKING_COLORS[recyclingType] || [254, 254, 254]), opacity]
  }

  const ICON_MAPPING = {
    ready: { x: 40, y: 0, width: 40, height: 40, mask: false },
    default: { x: 0, y: 0, width: 40, height: 40, mask: false },
  }

  const carIconLayer = new IconLayer({
    id: 'car-icon-layer',
    data: cars,
    pickable: true,
    iconAtlas: '/combined_truck_icons.png',
    iconMapping: ICON_MAPPING,
    getIcon: (d) => {
      const status = d.status.toLowerCase()
      return ICON_MAPPING.hasOwnProperty(status) ? status : 'default'
    },
    sizeScale: 7,
    getPosition: (d) => d.position,
    getSize: (d) => 5,
    getColor: getColorBasedOnStatus,
    onHover: ({ object, x, y, viewport }) => {
      if (!object) return setHoverInfo(null)
      setHoverInfo({
        id: object.id,
        type: 'car',
        x,
        y,
        viewport,
      })
    },
    onClick: ({ object }) => {
      setMapState({
        ...mapState,
        zoom: 14,
        longitude: object.position[0],
        latitude: object.position[1],
      })
      setActiveCar(object)
    },
  })

  const carLayer = new ScatterplotLayer({
    id: 'car-layer',
    data: cars,
    //opacity: 0.7,
    stroked: false,
    filled: true,
    radiusScale: 6,
    radiusUnits: 'pixels',
    getPosition: (c) => {
      return c.position
    },
    //getRadius: (c) => (c.fleet === 'Privat' ? 4 : 8),
    getFillColor: getColorBasedOnStatus,
    pickable: true,
    onHover: ({ object, x, y, viewport }) => {
      if (!object) return setHoverInfo(null)
      setHoverInfo({
        id: object.id,
        type: 'car',
        x,
        y,
        viewport,
      })
    },
    onClick: ({ object }) => {
      setMapState({
        ...mapState,
        zoom: 14,
        longitude: object.position[0],
        latitude: object.position[1],
      })
      setActiveCar(object)
    },
  })

  const [activeFilter, setActiveFilter] = useState(null)

  const filteredBookings = useMemo(() => {
    return activeFilter
      ? bookings.filter((b) =>
          groupedColors[activeFilter].includes(b.recyclingType)
        )
      : bookings
  }, [bookings, activeFilter])

  const bookingLayer = useMemo(
    () =>
      new ScatterplotLayer({
        id: 'booking-layer',
        data: filteredBookings.filter((b) => b.type === 'recycle'),
        opacity: 1,
        stroked: false,
        filled: true,
        radiusScale: 1,
        radiusUnits: 'pixels',
        getPosition: (c) => {
          return c.pickup
        },
        getRadius: () => 4,
        getFillColor: (booking) => getColorBasedOnType(booking),
        pickable: true,
        onHover: ({ object, x, y, viewport }) => {
          if (!object) return setHoverInfo(null)
          setHoverInfo({
            id: object.id,
            type: 'booking',
            x,
            y,
            viewport,
          })
        },
      }),
    [filteredBookings]
  )

  // Add this constant for the icon mapping
  const DESTINATION_ICON_MAPPING = {
    marker: { x: 0, y: 0, width: 40, height: 40, mask: false },
  }

  // Replace the existing destinationLayer with this new IconLayer
  const destinationLayer = new IconLayer({
    id: 'destination-layer',
    data: [bookings.find((b) => b.destination)].filter(Boolean),
    pickable: true,
    iconAtlas: '/base-big.png', // Make sure this image exists in your public folder
    iconMapping: DESTINATION_ICON_MAPPING,
    getIcon: (d) => 'marker',
    sizeScale: 7,
    getPosition: (b) => b.destination,
    getSize: (d) => 5,
    onHover: ({ object, x, y, viewport }) => {
      if (!object) return setHoverInfo(null)
      setHoverInfo({
        id: object.id,
        type: 'dropoff',
        x,
        y,
        viewport,
      })
    },
  })

  const [showAssignedBookings, setShowAssignedBookings] = useState(false)
  const [showActiveDeliveries, setShowActiveDeliveries] = useState(false)

  const routesData = useMemo(() => {
    if (!(showActiveDeliveries || showAssignedBookings)) return []

    return bookings
      .filter(
        (booking) =>
          !activeFilter ||
          groupedColors[activeFilter].includes(booking.recyclingType)
      )
      .map((booking) => {
        if (!cars) return null
        const car = cars.find((car) => car.id === booking.carId)
        if (car === undefined) return null

        const bookingColor = getColorBasedOnType(booking)

        switch (booking.status) {
          case 'Picked up':
            return (
              showActiveDeliveries && {
                inbound: bookingColor,
                outbound: bookingColor,
                from: car.position,
                to: booking.destination,
              }
            )
          case 'Assigned':
          case 'Queued':
            return (
              showAssignedBookings && {
                inbound: bookingColor,
                outbound: bookingColor,
                from: car.position,
                to: booking.pickup,
              }
            )
          case 'Delivered':
            return null

          default:
            return {
              inbound: bookingColor,
              outbound: bookingColor,
              from: booking.pickup,
              to: booking.destination,
            }
        }
      })
      .filter((b) => b) // remove null values
  }, [
    bookings,
    cars,
    showActiveDeliveries,
    showAssignedBookings,
    activeFilter,
    getColorBasedOnType,
  ])

  const routesLayer = useMemo(
    () =>
      new ArcLayer({
        id: 'routesLayer',
        data: routesData,
        pickable: true,
        getWidth: 0.5,
        getSourcePosition: (d) => d.from,
        getTargetPosition: (d) => d.to,
        getSourceColor: (d) => d.inbound,
        getTargetColor: (d) => d.outbound,
      }),
    [routesData]
  )

  const arcData = cars
    .map((car) => {
      return {
        inbound: [167, 55, 255],
        outbound: [167, 55, 255],
        from: car.position,
        to: car.destination,
      }
    })
    .filter(({ from, to }) => from && to)
  const [showArcLayer, setShowArcLayer] = useState(false)

  const arcLayer = new ArcLayer({
    id: 'arc-layer',
    data: showArcLayer && arcData,
    pickable: true,
    getWidth: 1,
    getSourcePosition: (d) => d.from,
    getTargetPosition: (d) => d.to,
    getSourceColor: (d) => d.inbound,
    getTargetColor: (d) => d.outbound,
  })

  useEffect(() => {
    if (!cars.length) return
    if (!activeCar) return
    const car = cars.filter(({ id }) => id === activeCar.id)[0]
    if (!car) return
    setMapState((state) => ({
      ...state,
      zoom: 14,
      longitude: car.position[0],
      latitude: car.position[1],
    }))
  }, [activeCar, cars])

  const map = useRef()

  return (
    <DeckGL
      //mapLib={maplibregl}
      mapboxApiAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
      // initialViewState={mapState.viewport}
      viewState={mapState}
      ref={map}
      // onLoad={rotateCamera}
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
      layers={[
        // The order of these layers matter, roughly equal to increasing z-index by 1
        activeLayers.municipalityLayer && municipalityLayer, // TODO: This hides some items behind it, sort of
        bookingLayer,
        destinationLayer,
        showArcLayer && arcLayer,
        (showAssignedBookings || showActiveDeliveries) && routesLayer,
        activeLayers.carLayer &&
          (activeLayers.useIcons ? carIconLayer : carLayer),
      ]}
    >
      <div
        style={{
          bottom: '40px',
          right: '20px',
          position: 'absolute',
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
          setShowEditExperimentModal={setShowEditExperimentModal}
          experimentId={experimentId}
          socket={socket}
          selectedDataFile={selectedDataFile}
          setSelectedDataFile={setSelectedDataFile}
          uploadedFiles={uploadedFiles}
        />
      </div>
      <StaticMap
        reuseMaps
        preventStyleDiffing={true}
        //mapLib={maplibregl}
        //mapStyle="https://maptiler.iteam.services/styles/basic-preview/style.json"
        mapStyle="mapbox://styles/mapbox/dark-v10"
        mapboxApiAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
      />
      {hoverInfo && mapState.zoom > 6 && (
        <div>
          <HoverInfoBox data={hoverInfo} cars={cars} bookings={bookings} />
        </div>
      )}

      {/* Time progress bar. */}
      <TimeProgressBar time={time} />

      {/* Experiment clock. */}
      <div
        style={{
          right: '3rem',
          top: '30px',
          position: 'absolute',
          textAlign: 'right',
        }}
      >
        <ParagraphLarge white>
          Just nu är klockan{' '}
          <b>
            {new Date(time).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </b>{' '}
          <br />i simuleringen
        </ParagraphLarge>
      </div>

      {/* Municipality stats. */}
      {municipalityInfo && <MunicipalityStatisticsBox {...municipalityInfo} />}

      {activeLayers.showBookingLegend && (
        <BookingLegend
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
        />
      )}
    </DeckGL>
  )
}

export default Map
