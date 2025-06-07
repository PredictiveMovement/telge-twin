import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import { Car, Booking } from '@/types/map'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  MapIcon,
  Square,
  RotateCcw,
  WifiOff,
  AlertTriangle,
} from 'lucide-react'
import Map from '@/components/Map'
import StatusBadges from '@/components/StatusBadges'
import { useMapSocket } from '@/hooks/useMapSocket'
import { useMapStatus } from '@/hooks/useMapStatus'
import { toLonLatArray } from '@/utils/geo'
import * as simulator from '@/api/simulator'

const MapPage = () => {
  const {
    socket,
    isConnected,
    error: socketError,
    virtualTime,
    joinMap,
    leaveMap,
    joinSession,
    leaveSession,
    playTime,
    pauseTime,
    setTimeSpeed: setSocketTimeSpeed,
  } = useMapSocket()

  const {
    status,
    setLoading,
    setError,
    setRunning,
    setTimeState,
    setSessionId,
    reset,
    isReplayMode,
  } = useMapStatus()

  const [searchParams, setSearchParams] = useSearchParams()
  const [cars, setCars] = useState<Car[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isMapActive, setIsMapActive] = useState(false)

  const upsertList = <T extends { id: any }>(
    prev: T[],
    incoming: T | T[],
    mapper: (item: T) => T
  ) => {
    const list = Array.isArray(incoming) ? incoming : [incoming]
    const next = [...prev]
    list.forEach((raw) => {
      const item = mapper(raw)
      const i = next.findIndex((x) => x.id === item.id)
      i >= 0 ? (next[i] = item) : next.push(item)
    })
    return next
  }

  useEffect(() => {
    const replayParam = searchParams.get('replay')
    const sessionParam = searchParams.get('session')

    if (replayParam && !sessionParam && socket && isConnected) {
      handleReplaySimulation(replayParam)
    }
  }, [searchParams, socket, isConnected])

  useEffect(() => {
    if (!socket) {
      return
    }

    if (status.sessionId) {
      const replayParam = searchParams.get('replay')
      joinSession(status.sessionId, replayParam)
      setIsMapActive(true)
    } else {
      joinMap()
      setIsMapActive(true)
    }

    return () => {
      if (status.sessionId) {
        leaveSession(status.sessionId)
      } else {
        leaveMap()
      }
      setIsMapActive(false)
    }
  }, [socket, status.sessionId])

  useEffect(() => {
    if (!socket || !isMapActive) return

    const handleSimulationStatus = (socketStatus: any) => {
      if (!status.sessionId) {
        setRunning(socketStatus.running, socketStatus.experimentId)
        if (socketStatus.running) {
          setTimeState(true, status.timeSpeed)
          playTime()
          setSocketTimeSpeed(status.timeSpeed)
        }
      }
    }

    const handleSimulationStarted = (data: any) => {
      if (!status.sessionId) {
        setRunning(true, data.experimentId)
        setCars([])
        setBookings([])
        setTimeState(true, status.timeSpeed)
        playTime()
        setSocketTimeSpeed(status.timeSpeed)
      }
    }

    const handleSimulationStopped = () => {
      if (!status.sessionId) {
        setRunning(false, null)
        setCars([])
        setBookings([])
        setTimeState(false)
        pauseTime()
      }
    }

    const handleSimulationFinished = () => {
      if (!status.sessionId) {
        setRunning(false, null)
        setTimeState(false)
        pauseTime()
      }
    }

    const handleSessionStatus = (socketStatus: any) => {
      if (status.sessionId && socketStatus.sessionId === status.sessionId) {
        if (!socketStatus.running && socketStatus.experimentId === null) {
          setError('Replay experiment not found or stopped')
          setRunning(false, null)
        } else if (socketStatus.running) {
          setError(null)
          setRunning(true, socketStatus.experimentId)
          setTimeState(true, status.timeSpeed)
          playTime()
          setSocketTimeSpeed(status.timeSpeed)
        } else {
          setRunning(false, socketStatus.experimentId)
        }
      }
    }

    const handleSessionStarted = (data: any) => {
      if (status.sessionId && data.sessionId === status.sessionId) {
        setRunning(true, data.experimentId)
        setCars([])
        setBookings([])
        setTimeState(true, status.timeSpeed)
        setError(null)
        playTime()
        setSocketTimeSpeed(status.timeSpeed)
      }
    }

    const handleSessionStopped = (stoppedSessionId: string) => {
      if (status.sessionId && stoppedSessionId === status.sessionId) {
        setRunning(false, null)
        setCars([])
        setBookings([])
        setTimeState(false)
        pauseTime()
      }
    }

    const handleCars = (payload: any | any[]) => {
      setCars((prev) =>
        upsertList(prev, payload, (car) => ({
          ...car,
          position: toLonLatArray(car.position),
        }))
      )
    }

    const handleBookings = (payload: any | any[]) => {
      setBookings((prev) =>
        upsertList(prev, payload, (b) => {
          const processed = {
            ...b,
            pickup: b.pickup ? toLonLatArray(b.pickup) : null,
            destination: b.destination ? toLonLatArray(b.destination) : null,
          }
          return processed
        })
      )
    }

    socket.on('simulationStatus', handleSimulationStatus)
    socket.on('simulationStarted', handleSimulationStarted)
    socket.on('simulationStopped', handleSimulationStopped)
    socket.on('simulationFinished', handleSimulationFinished)
    socket.on('cars', handleCars)
    socket.on('bookings', handleBookings)

    socket.on('sessionStatus', handleSessionStatus)
    socket.on('sessionStarted', handleSessionStarted)
    socket.on('sessionStopped', handleSessionStopped)

    return () => {
      socket.off('simulationStatus', handleSimulationStatus)
      socket.off('simulationStarted', handleSimulationStarted)
      socket.off('simulationStopped', handleSimulationStopped)
      socket.off('simulationFinished', handleSimulationFinished)
      socket.off('cars', handleCars)
      socket.off('bookings', handleBookings)
      socket.off('sessionStatus', handleSessionStatus)
      socket.off('sessionStarted', handleSessionStarted)
      socket.off('sessionStopped', handleSessionStopped)
    }
  }, [socket, isMapActive, status.sessionId, status.timeSpeed])

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

  const handleReplaySimulation = async (replayExperimentId: string) => {
    setLoading(true)
    setError(null)

    try {
      const sessionId = await simulator.startSessionReplay(
        socket,
        replayExperimentId
      )
      setSessionId(sessionId)

      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('session', sessionId)
      setSearchParams(newSearchParams)
    } catch (error) {
      console.error('Failed to start replay simulation:', error)
      setError('Failed to start replay simulation')
    } finally {
      setLoading(false)
    }
  }

  const handleStopSimulation = () => {
    if (socket && !isReplayMode) {
      socket.emit('stopSimulation')
    }
  }

  const handleExitReplay = async () => {
    if (status.sessionId) {
      leaveSession(status.sessionId)
    }

    reset()
    setSearchParams({})
    setCars([])
    setBookings([])
  }

  const displayError = status.error || socketError

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-normal">
              {isReplayMode ? 'Karta - Replay' : 'Karta'}
            </h1>
            <p className="text-muted-foreground mt-1 mb-1">
              {isReplayMode
                ? `Spelar upp experiment: ${searchParams.get('replay')}`
                : 'Visualisera och övervaka rutter i realtid'}
            </p>
            <StatusBadges
              sessionId={status.sessionId}
              mode={status.mode}
              experimentId={status.experimentId}
            />
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex space-x-2">
              {isReplayMode ? (
                <Button variant="outline" onClick={handleExitReplay}>
                  <RotateCcw size={16} className="mr-2" />
                  Lämna replay
                </Button>
              ) : (
                status.running && (
                  <Button variant="destructive" onClick={handleStopSimulation}>
                    <Square size={16} className="mr-2" />
                    Stoppa simulering
                  </Button>
                )
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

        {!isConnected ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-8 text-center">
              <WifiOff size={48} className="mx-auto mb-4 text-red-500" />
              <h3 className="text-xl font-semibold text-red-700 mb-2">
                Ingen anslutning till servern
              </h3>
              <p className="text-red-600 mb-4">
                Kartan kan inte visas utan en aktiv anslutning. Kontrollera din
                internetanslutning och försök igen.
              </p>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                Försök igen
              </Button>
            </CardContent>
          </Card>
        ) : !status.running ? (
          <Card className="border-gray-200 bg-gray-50">
            <CardContent className="p-8 text-center">
              <MapIcon size={48} className="mx-auto mb-4 text-gray-500" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Ingen aktiv simulering
              </h3>
              <p className="text-gray-600 mb-4">
                {isReplayMode
                  ? 'Replay-sessionen är pausad eller har avslutats.'
                  : 'Starta en simulering för att visa kartdata i realtid.'}
              </p>
              {!isReplayMode && (
                <p className="text-sm text-gray-500">
                  Gå till simuleringssektionen för att starta en ny simulering.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="map" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="map">Kartvy</TabsTrigger>
              <TabsTrigger value="satellite">Satellitvy</TabsTrigger>
            </TabsList>
            <TabsContent value="map" className="mt-4">
              <Card className="relative h-[500px] overflow-hidden">
                <CardContent className="absolute inset-0 p-0">
                  <Map
                    cars={cars}
                    bookings={bookings}
                    isSimulationRunning={status.running}
                    isConnected={isConnected}
                    isTimeRunning={status.timeRunning}
                    timeSpeed={status.timeSpeed}
                    virtualTime={virtualTime}
                    onPlayTime={handlePlayTime}
                    onPauseTime={handlePauseTime}
                    onSpeedChange={handleSpeedChange}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="satellite" className="mt-4">
              <Card className="relative h-[500px] overflow-hidden">
                <CardContent className="absolute inset-0 p-0">
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white">
                    <div className="text-center">
                      <MapIcon size={48} className="mx-auto mb-2" />
                      <p>Satellitvy laddas här.</p>
                      <p className="text-sm text-gray-300 mt-1">
                        Växla tillbaka till standardkarta för bättre
                        rutt-visning.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

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
