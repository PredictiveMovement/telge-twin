import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/layout/Layout'
import { Car, Booking } from '@/types/map'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MapIcon, Square, WifiOff, AlertTriangle } from 'lucide-react'
import Map from '@/components/Map'
import StatusBadges from '@/components/StatusBadges'
import { useMapSocket } from '@/hooks/useMapSocket'
import { useMapStatus } from '@/hooks/useMapStatus'
import { toLonLatArray } from '@/utils/geo'
import { upsertListById } from '@/lib/utils'
import { getExperiment, AreaPartition, getVroomPlan } from '@/api/simulator'

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

  const handleCars = useCallback((payload: Car | Car[]) => {
    setCars((prev) =>
      upsertList(prev, payload, (car) => ({
        ...car,
        position: toLonLatArray(car.position),
      }))
    )
  }, [])

  const handleBookings = useCallback((payload: Booking | Booking[]) => {
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
  }, [])

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

  // Fetch area partitions whenever we have a running simulation tied to an experiment
  useEffect(() => {
    let cancelled = false
    let interval: number | undefined
    const fetchPartitions = async () => {
      if (status.running && status.experimentId) {
        try {
          const exp = await getExperiment(status.experimentId)
          if (!cancelled) {
            setAreaPartitions(exp?.areaPartitions || [])
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
                Starta en simulering för att visa kartdata i realtid.
              </p>
              <p className="text-sm text-gray-500">
                Gå till simuleringssektionen för att starta en ny simulering.
              </p>
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
                    areaPartitions={areaPartitions}
                    vroomPlan={vroomPlan as any}
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
