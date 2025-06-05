import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import { Car, Booking } from '@/types/map'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MapIcon, Route, Play, Square, Activity, RotateCcw } from 'lucide-react'
import Map from '@/components/Map'
import { useSocket } from '@/hooks/useSocket'
import { startSimulation, startReplaySimulation } from '@/api/simulator'
import { toLonLatArray } from '@/utils/geo'

const MapPage = () => {
  const { socket, isConnected } = useSocket()
  const [searchParams, setSearchParams] = useSearchParams()

  const [isSimulationRunning, setIsSimulationRunning] = useState(false)
  const [simulationData, setSimulationData] = useState(null)
  const [experimentId, setExperimentId] = useState(null)
  const [isReplayMode, setIsReplayMode] = useState(false)

  const [cars, setCars] = useState<Car[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isMapActive, setIsMapActive] = useState(false)

  const [isTimeRunning, setIsTimeRunning] = useState(false)
  const [timeSpeed, setTimeSpeed] = useState(60)

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
    if (replayParam) {
      setIsReplayMode(true)
      if (socket && isConnected) {
        handleReplaySimulation(replayParam)
      }
    }
  }, [searchParams, socket, isConnected])

  useEffect(() => {
    if (!socket) {
      console.log('❌ Cannot join map - no socket')
      return
    }

    console.log(
      '🎯 Joining map streaming... (socket exists, connection status:',
      isConnected,
      ')'
    )
    socket.emit('joinMap')
    setIsMapActive(true)

    return () => {
      console.log('👋 Leaving map streaming...')
      if (socket) {
        socket.emit('leaveMap')
      }
      setIsMapActive(false)
    }
  }, [socket])

  useEffect(() => {
    if (!socket || !isMapActive) return

    const handleSimulationStatus = (status: any) => {
      console.log('🔍 Received simulationStatus:', status)
      setIsSimulationRunning(status.running)
      setSimulationData(status.data)
      setExperimentId(status.experimentId)
      if (status.running && socket) {
        setIsTimeRunning(true)
        socket.emit('play')
        socket.emit('speed', timeSpeed)
      }
    }

    const handleSimulationStarted = (data: any) => {
      console.log('🚀 Received simulationStarted:', data)
      setIsSimulationRunning(true)
      setSimulationData(data.data)
      setExperimentId(data.experimentId)
      setCars([])
      setBookings([])
      setIsTimeRunning(true)
      if (socket) {
        socket.emit('play')
        socket.emit('speed', timeSpeed)
      }
    }

    const handleSimulationStopped = () => {
      console.log('🛑 Received simulationStopped')
      setIsSimulationRunning(false)
      setSimulationData(null)
      setExperimentId(null)
      setCars([])
      setBookings([])
      setIsTimeRunning(false)
      if (socket) {
        socket.emit('pause')
      }
    }

    const handleSimulationFinished = () => {
      console.log('✅ Received simulationFinished')
      setIsSimulationRunning(false)
      setSimulationData(null)
      setExperimentId(null)
      setIsTimeRunning(false)
      if (socket) {
        socket.emit('pause')
      }
    }

    const handleCars = (payload: any | any[]) =>
      setCars((prev) =>
        upsertList(prev, payload, (car) => ({
          ...car,
          position: toLonLatArray(car.position),
        }))
      )

    const handleBookings = (payload: any | any[]) =>
      setBookings((prev) =>
        upsertList(prev, payload, (b) => ({
          ...b,
          pickup: toLonLatArray(b.pickup),
          destination: toLonLatArray(b.destination),
        }))
      )

    console.log('🔌 Setting up socket event listeners...')

    socket.on('simulationStatus', handleSimulationStatus)
    socket.on('simulationStarted', handleSimulationStarted)
    socket.on('simulationStopped', handleSimulationStopped)
    socket.on('simulationFinished', handleSimulationFinished)
    socket.on('cars', handleCars)
    socket.on('bookings', handleBookings)

    return () => {
      console.log('🧹 Cleaning up socket event listeners...')
      socket.off('simulationStatus', handleSimulationStatus)
      socket.off('simulationStarted', handleSimulationStarted)
      socket.off('simulationStopped', handleSimulationStopped)
      socket.off('simulationFinished', handleSimulationFinished)
      socket.off('cars', handleCars)
      socket.off('bookings', handleBookings)
    }
  }, [socket, isMapActive])

  const handleStartSimulation = () => {
    if (!socket) return

    const routeData = {
      name: 'Avfallshantering Södertälje',
      description: 'Simulering av avfallshantering i Södertälje kommun',
      startTime: new Date().toISOString(),
    }

    startSimulation(socket, routeData)
  }

  const handleStopSimulation = () => {
    if (!socket) return
    socket.emit('stopSimulation')
  }

  const handlePlayTime = () => {
    if (!socket) return
    setIsTimeRunning(true)
    socket.emit('play')
  }

  const handlePauseTime = () => {
    if (!socket) return
    setIsTimeRunning(false)
    socket.emit('pause')
  }

  const handleSpeedChange = (speed: number) => {
    if (!socket) return
    setTimeSpeed(speed)
    socket.emit('speed', speed)
  }

  const handleReplaySimulation = async (replayExperimentId: string) => {
    if (!socket) return
    try {
      await startReplaySimulation(socket, replayExperimentId)
    } catch (error) {
      console.error('Failed to start replay simulation:', error)
    }
  }

  const handleExitReplay = () => {
    setIsReplayMode(false)
    setSearchParams({})
    if (socket && isSimulationRunning) {
      socket.emit('stopSimulation')
    }
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-normal">
              {isReplayMode ? 'Karta - Replay' : 'Karta'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isReplayMode
                ? `Spelar upp experiment: ${searchParams.get('replay')}`
                : 'Visualisera och övervaka rutter i realtid'}
            </p>
          </div>
          <div className="flex space-x-2">
            {isReplayMode ? (
              <Button variant="outline" onClick={handleExitReplay}>
                <RotateCcw size={16} className="mr-2" />
                Lämna replay
              </Button>
            ) : (
              <Button variant="outline">
                <Route size={16} className="mr-2" />
                Välj rutter
              </Button>
            )}
            {!isSimulationRunning ? (
              <Button
                className="bg-telge-bla hover:bg-telge-bla/90"
                onClick={handleStartSimulation}
                disabled={!isConnected || isReplayMode}
              >
                <Play size={16} className="mr-2" />
                Starta simulering
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleStopSimulation}
                disabled={!isConnected}
              >
                <Square size={16} className="mr-2" />
                Stoppa simulering
              </Button>
            )}
          </div>
        </div>

        <Card
          className={`border-l-4 ${
            isReplayMode ? 'border-l-orange-500' : 'border-l-telge-bla'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isSimulationRunning && isTimeRunning
                      ? 'bg-green-500 animate-pulse'
                      : isSimulationRunning
                      ? 'bg-yellow-500'
                      : 'bg-gray-400'
                  }`}
                />
                <div>
                  <p className="font-medium">
                    {isSimulationRunning
                      ? isTimeRunning
                        ? isReplayMode
                          ? 'Replay aktiv'
                          : 'Simulering aktiv'
                        : isReplayMode
                        ? 'Replay pausad'
                        : 'Simulering pausad'
                      : isReplayMode
                      ? 'Replay stoppad'
                      : 'Ingen aktiv simulering'}
                  </p>
                  {experimentId && (
                    <p className="text-sm text-muted-foreground">
                      Experiment ID: {experimentId}
                    </p>
                  )}
                  {isReplayMode && (
                    <p className="text-sm text-orange-600 font-medium">
                      🔄 Replay-läge aktivt
                    </p>
                  )}
                  {isSimulationRunning && (
                    <p className="text-sm text-muted-foreground">
                      Hastighet: {timeSpeed}x | Tid:{' '}
                      {isTimeRunning ? 'Körs' : 'Pausad'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div
                  className={`flex items-center space-x-2 ${
                    !isConnected ? 'text-red-500' : 'text-green-500'
                  }`}
                >
                  <Activity size={16} />
                  <span className="text-sm">
                    {isConnected ? 'Ansluten' : 'Frånkopplad'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
                  isSimulationRunning={isSimulationRunning}
                  isConnected={isConnected}
                  isTimeRunning={isTimeRunning}
                  timeSpeed={timeSpeed}
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
                      Växla tillbaka till standardkarta för bättre rutt-visning.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="bg-telge-ljusgul p-4 rounded-md">
                <p className="text-sm font-medium">Aktiva fordon</p>
                <h3 className="text-2xl font-normal mt-1">{cars.length}</h3>
              </div>
              <div className="bg-telge-ljusgron p-4 rounded-md">
                <p className="text-sm font-medium">Aktiva bokningar</p>
                <h3 className="text-2xl font-normal mt-1">{bookings.length}</h3>
              </div>
              <div className="bg-telge-ljusbla p-4 rounded-md">
                <p className="text-sm font-medium">Status</p>
                <h3 className="text-2xl font-normal mt-1">
                  {isSimulationRunning
                    ? isTimeRunning
                      ? 'Aktiv'
                      : 'Pausad'
                    : 'Stoppad'}
                </h3>
              </div>
              <div className="bg-telge-ljusgra p-4 rounded-md">
                <p className="text-sm font-medium">Anslutning</p>
                <h3 className="text-2xl font-normal mt-1">
                  {isConnected ? 'Online' : 'Offline'}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

export default MapPage
