import { useEffect, useState } from 'react'
import Layout from '@/components/layout/Layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Map, Route, Play, Square, Activity } from 'lucide-react'
import MapSimulator from '@/components/MapSimulator'
import { useSocket } from '@/hooks/useSocket'
import { startSimulation } from '@/api/simulator'

const MapPage = () => {
  const { socket, isConnected } = useSocket()

  const [isSimulationRunning, setIsSimulationRunning] = useState(false)
  const [simulationData, setSimulationData] = useState(null)
  const [experimentId, setExperimentId] = useState(null)

  const [cars, setCars] = useState([])
  const [bookings, setBookings] = useState([])
  const [isMapActive, setIsMapActive] = useState(false)

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
    }

    const handleSimulationStarted = (data: any) => {
      console.log('🚀 Received simulationStarted:', data)
      setIsSimulationRunning(true)
      setSimulationData(data.data)
      setExperimentId(data.experimentId)
      setCars([])
      setBookings([])
    }

    const handleSimulationStopped = () => {
      console.log('🛑 Received simulationStopped')
      setIsSimulationRunning(false)
      setSimulationData(null)
      setExperimentId(null)
      setCars([])
      setBookings([])
    }

    const handleSimulationFinished = () => {
      console.log('✅ Received simulationFinished')
      setIsSimulationRunning(false)
      setSimulationData(null)
      setExperimentId(null)
    }

    const handleCars = (carData: any) => {
      console.log('🚗 Received car data:', carData)
      setCars((prev) => {
        const existingIndex = prev.findIndex((car) => car.id === carData.id)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = carData
          return updated
        } else {
          return [...prev, carData]
        }
      })
    }

    const handleBookings = (bookingData: any) => {
      console.log('📋 Received booking data:', bookingData)
      setBookings((prev) => {
        const existingIndex = prev.findIndex(
          (booking) => booking.id === bookingData.id
        )
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = bookingData
          return updated
        } else {
          return [...prev, bookingData]
        }
      })
    }

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

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-normal">Karta</h1>
            <p className="text-muted-foreground mt-1">
              Visualisera och övervaka rutter i realtid
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline">
              <Route size={16} className="mr-2" />
              Välj rutter
            </Button>
            {!isSimulationRunning ? (
              <Button
                className="bg-telge-bla hover:bg-telge-bla/90"
                onClick={handleStartSimulation}
                disabled={!isConnected}
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

        <Card className="border-l-4 border-l-telge-bla">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isSimulationRunning
                      ? 'bg-green-500 animate-pulse'
                      : 'bg-gray-400'
                  }`}
                />
                <div>
                  <p className="font-medium">
                    {isSimulationRunning
                      ? 'Simulering aktiv'
                      : 'Ingen aktiv simulering'}
                  </p>
                  {experimentId && (
                    <p className="text-sm text-muted-foreground">
                      Experiment ID: {experimentId}
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
                <MapSimulator
                  cars={cars}
                  bookings={bookings}
                  isSimulationRunning={isSimulationRunning}
                  isConnected={isConnected}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="satellite" className="mt-4">
            <Card className="relative h-[500px] overflow-hidden">
              <CardContent className="absolute inset-0 p-0">
                <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white">
                  <div className="text-center">
                    <Map size={48} className="mx-auto mb-2" />
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
                  {isSimulationRunning ? 'Aktiv' : 'Stoppad'}
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
