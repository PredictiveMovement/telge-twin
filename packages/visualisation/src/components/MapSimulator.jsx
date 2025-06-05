// @ts-nocheck
import React, { useState } from 'react'
import 'jsoneditor-react/es/editor.min.css'
import { useSocketEvent } from '../hooks/useSocket.js'

import Map from './Map.jsx'
import Loading from './Loading/index.jsx'
import PlaybackOptions from './PlaybackOptions/index.jsx'
import ResetExperiment from './ResetExperiment/index.jsx'
import EditExperimentModal from './EditExperimentModal/index.jsx'
import Logo from './Logo/index.jsx'
import ExperimentDoneModal from './ExperimentDoneModal/index.jsx'
import { Snackbar, SnackbarContent } from '@mui/material'

import Slide from '@mui/material/Slide'

const MapSimulator = ({
  cars = [],
  bookings = [],
  isSimulationRunning = false,
  isConnected = false,
}) => {
  const [activeCar, setActiveCar] = useState(null)
  const [reset, setReset] = useState(false)
  const [speed, setSpeed] = useState(60)
  const [time, setTime] = useState(-3600000) // 00:00
  const [carLayer, setCarLayer] = useState(true)
  const [useIcons, setUseIcons] = useState(false)
  const [showBookingLegend, setShowBookingLegend] = useState(false)
  const [passengerLayer, setPassengerLayer] = useState(true)
  const [postombudLayer, setPostombudLayer] = useState(false)
  const [commercialAreasLayer, setCommercialAreasLayer] = useState(false)
  const [busLineLayer, setBusLineLayer] = useState(true)
  const [municipalityLayer, setMunicipalityLayer] = useState(true)
  const [experimentParameters, setExperimentParameters] = useState({})
  const [currentParameters, setCurrentParameters] = useState({})
  const [fleets, setFleets] = useState({})
  const [latestLogMessage, setLatestLogMessage] = useState('')
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [showEditExperimentModal, setShowEditExperimentModal] = useState(false)
  const [showExperimentDoneModal, setShowExperimentDoneModal] = useState(false)
  const [previousExperimentId, setPreviousExperimentId] = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [selectedDataFile, setSelectedDataFile] = useState(null)
  const [bookingAndVehicleStats, setBookingAndVehicleStats] = useState(null)

  const { socket } = useSocketEvent()

  const activeLayers = {
    carLayer,
    setCarLayer,
    useIcons,
    setUseIcons,
    showBookingLegend,
    setShowBookingLegend,
    postombudLayer,
    setPostombudLayer,
    passengerLayer,
    setPassengerLayer,
    commercialAreasLayer,
    setCommercialAreasLayer,
    municipalityLayer,
    setMunicipalityLayer,
    busLineLayer,
    setBusLineLayer,
  }

  const restartSimulation = () => {
    setShowEditExperimentModal(false)
    socket.emit('experimentParameters', experimentParameters)
  }

  useSocketEvent('init', () => {
    console.log('Init experiment')
    setPostombud([])
    setLineShapes([])
    setmunicipalities([])
    setLatestLogMessage('')
    socket.emit('speed', speed) // reset speed on server
  })

  useSocketEvent('reset', () => {
    console.log('Reset experiment')
    setPreviousExperimentId(experimentParameters.id)
    setShowExperimentDoneModal(true)
    socket.emit('experimentParameters', experimentParameters)
  })

  function upsert(array, object, idProperty = 'id', deep = false) {
    const currentIndex = array.findIndex(
      (k) => k[idProperty] === object[idProperty]
    )
    let new_arr = [...array]

    if (currentIndex >= 0) {
      if (deep) {
        new_arr[currentIndex] = { ...new_arr[currentIndex], ...object }
      } else {
        new_arr[currentIndex] = object
      }
    } else {
      new_arr.push(object)
    }
    return new_arr
  }

  useSocketEvent('time', (time) => {
    setTime(time)
  })

  useSocketEvent('log', (message) => {
    setLatestLogMessage(message)
    setSnackbarOpen(true)
  })

  const [postombud, setPostombud] = React.useState([])
  useSocketEvent('postombud', (newPostombud) => {
    setReset(false)
    setPostombud((current) => [
      ...current,
      ...newPostombud.map(({ position, ...rest }) => ({
        position: [position.lon, position.lat],
        ...rest,
      })),
    ])
  })

  const [lineShapes, setLineShapes] = React.useState([])
  useSocketEvent('lineShapes', (lineShapes) => {
    setLineShapes(lineShapes)
  })

  const [municipalities, setmunicipalities] = React.useState([])
  useSocketEvent('municipality', (municipality) => {
    setReset(false)
    setmunicipalities((current) => {
      console.log('Received municipality data:', municipality)
      return upsert(current, municipality, 'id', true)
    })
  })

  useSocketEvent('uploadedFiles', (files) => {
    setUploadedFiles(files)
  })

  useSocketEvent('bookingsAndVehiclesData', (data) => {
    console.log('bookingsAndVehiclesData', data)
  })

  useSocketEvent('parameters', (currentParameters) => {
    console.log('ExperimentId', currentParameters.id)
    console.log(
      '📍 Received parameters with initMapState:',
      currentParameters.initMapState
    )

    if (!previousExperimentId) {
      setPreviousExperimentId(currentParameters.id)
    }

    setCurrentParameters(currentParameters)
    const layerSetFunctions = {
      cars: setCarLayer,
      passengers: setPassengerLayer,
      postombud: setPostombudLayer,
      municipalities: setMunicipalityLayer,
      commercialAreas: setCommercialAreasLayer,
    }

    Object.entries(layerSetFunctions).map(([emitterName, setStateFunction]) => {
      if (currentParameters.emitters.includes(emitterName)) {
        setStateFunction(true)
      } else {
        setStateFunction(false)
      }
    })

    setFleets(currentParameters.fleets)
    setExperimentParameters(currentParameters)
  })

  const onPause = () => {
    socket.emit('pause')
  }

  const onPlay = () => {
    socket.emit('speed', speed)
  }

  const onSpeedChange = (value) => {
    setSpeed(value)
    socket.emit('speed', value)
  }

  const resetSimulation = () => {
    socket.emit('reset')
    setReset(true)
    setShowExperimentDoneModal(false)
    setBookingAndVehicleStats(null)
  }

  const requestBookingsAndVehicles = () => {
    socket.emit('getBookingsAndVehicles')
  }

  const saveFleets = (updatedJson) => {
    setExperimentParameters(updatedJson)
  }

  if (!socket) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-lg font-medium text-gray-600 mb-2">
            Ansluter till simulator...
          </div>
          <div className="text-sm text-gray-500">
            Kontrollera att simulatorn körs på rätt adress
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <Map
        activeCar={activeCar}
        setActiveCar={setActiveCar}
        cars={cars}
        bookings={bookings}
        postombud={postombud}
        lineShapes={lineShapes}
        municipalities={municipalities}
        currentParameters={currentParameters}
        fleets={fleets}
        time={time}
        activeLayers={activeLayers}
        loading={false}
        reset={reset}
        initMapState={{
          latitude: 59.1955,
          longitude: 17.6253,
          zoom: 10,
          ...currentParameters.initMapState,
        }}
        experimentId={currentParameters.id}
        socket={socket}
        setShowEditExperimentModal={setShowEditExperimentModal}
        selectedDataFile={selectedDataFile}
        setSelectedDataFile={setSelectedDataFile}
        uploadedFiles={uploadedFiles}
      />

      {!isSimulationRunning && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg text-center shadow-lg">
            <div className="text-lg font-medium text-gray-800 mb-2">
              Ingen simulering körs
            </div>
            <p className="text-sm text-gray-600">
              Starta en simulering för att se live data på kartan
            </p>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 z-40">
        <Logo />
      </div>

      <div className="absolute top-4 right-4 z-40">
        <div className="bg-white p-2 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isSimulationRunning ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
            <span className="text-sm">
              {isSimulationRunning ? 'Live' : 'Stoppad'}
            </span>
          </div>
        </div>
      </div>

      {isSimulationRunning && (
        <>
          <PlaybackOptions
            onPlay={onPlay}
            onPause={onPause}
            onSpeedChange={onSpeedChange}
            reset={reset}
            speed={speed}
            time={time}
          />

          <ResetExperiment
            resetSimulation={resetSimulation}
            requestBookingsAndVehicles={requestBookingsAndVehicles}
            setShowEditExperimentModal={setShowEditExperimentModal}
          />
        </>
      )}

      <EditExperimentModal
        fleets={fleets}
        show={showEditExperimentModal}
        setShow={setShowEditExperimentModal}
        restartSimulation={restartSimulation}
        saveFleets={saveFleets}
      />

      <ExperimentDoneModal
        experimentId={previousExperimentId}
        show={showExperimentDoneModal}
        setShow={setShowExperimentDoneModal}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        TransitionComponent={TransitionDown}
      >
        <SnackbarContent message={latestLogMessage} />
      </Snackbar>
    </div>
  )
}

function TransitionDown(props) {
  return <Slide {...props} direction="down" />
}

export default MapSimulator
