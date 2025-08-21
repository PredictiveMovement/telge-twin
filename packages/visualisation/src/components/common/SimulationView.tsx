import { useEffect, useState, useCallback } from 'react'
import { Car, Booking } from '@/types/map'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { WifiOff, AlertTriangle, Play, Square } from 'lucide-react'
import Map from '@/components/Map'
import { useMapSocket } from '../../hooks/useMapSocket'
import { toLonLatArray } from '@/utils/geo'
import { upsertListById } from '@/lib/utils'
import * as simulator from '@/api/simulator'

interface SimulationViewProps {
  title: string
  type: 'replay' | 'sequential'
  datasetId: string
  experimentId?: string
  areaPartitions?: simulator.AreaPartition[]
}

const SimulationView: React.FC<SimulationViewProps> = ({
  title,
  type,
  datasetId,
  experimentId,
  areaPartitions,
}) => {
  const [cars, setCars] = useState<Car[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [session, setSession] = useState<{
    sessionId: string
    parameters: any
  } | null>(null)
  const [isRunning, setRunning] = useState(false)
  const [isTimeRunning, setTimeRunning] = useState(false)
  const [timeSpeed, setTimeSpeed] = useState(60)
  const [virtualTime, setVirtualTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { socket, isConnected } = useMapSocket()
  const [vroomPlan, setVroomPlan] = useState<any | undefined>(undefined)

  const upsertList = upsertListById

  const sortBookings = useCallback(
    (bookings: any[]): any[] => {
      if (type === 'sequential') {
        // For sequential simulations, sort by turordningsnr
        return [...bookings].sort((a, b) => {
          const orderA = a.turordningsnr ?? Number.MAX_SAFE_INTEGER
          const orderB = b.turordningsnr ?? Number.MAX_SAFE_INTEGER
          return orderA - orderB
        })
      } else if (type === 'replay' && experimentId) {
        // For vroom replay, will implement vroom order sorting later
        return bookings
      }
      return bookings
    },
    [type, experimentId]
  )

  useEffect(() => {
    if (!socket || !isConnected || !session?.sessionId) return
    const currentSessionId = session.sessionId

    socket.emit('joinSession', { sessionId: currentSessionId })

    const handleSessionStarted = (data: {
      sessionId: string
      timeRunning?: boolean
      [key: string]: any
    }) => {
      if (data.sessionId !== currentSessionId) return
      setRunning(true)
      setTimeRunning(data.timeRunning ?? false)
      setError(null)
      setCars([])
      setBookings([])
    }

    const handleSessionStopped = (data: { sessionId: string }) => {
      if (data.sessionId !== currentSessionId) return
      setRunning(false)
      setTimeRunning(false)
      setSession(null)
    }

    const handleSessionError = (data: { sessionId: string; error: string }) => {
      if (data.sessionId !== currentSessionId) return
      setError(data.error)
      setRunning(false)
      setTimeRunning(false)
      setSession(null)
    }

    const handleVirtualTime = (data: {
      sessionId: string
      payload: number
    }) => {
      if (data.sessionId !== currentSessionId) return
      setVirtualTime(data.payload)
    }

    const handleCars = (data: { sessionId: string; payload: any | any[] }) => {
      if (data.sessionId !== currentSessionId) return
      setCars((prev) =>
        upsertList(prev, data.payload, (car) => ({
          ...car,
          position: toLonLatArray(car.position),
        }))
      )
    }

    const handleBookings = (data: {
      sessionId: string
      payload: any | any[]
    }) => {
      if (data.sessionId !== currentSessionId) return

      const incomingBookings = Array.isArray(data.payload)
        ? data.payload
        : [data.payload]

      setBookings((prev) => {
        const updatedBookings = upsertList(prev, incomingBookings, (b) => ({
          ...b,
          pickup: b.pickup ? toLonLatArray(b.pickup) : null,
          destination: b.destination ? toLonLatArray(b.destination) : null,
        }))

        return sortBookings(updatedBookings)
      })
    }

    socket.on('sessionStarted', handleSessionStarted)
    socket.on('sessionStopped', handleSessionStopped)
    socket.on('sessionError', handleSessionError)
    socket.on('virtualTime', handleVirtualTime)
    socket.on('cars', handleCars)
    socket.on('bookings', handleBookings)

    return () => {
      if (currentSessionId) {
        socket.emit('leaveSession', currentSessionId)
      }
      socket.off('sessionStarted', handleSessionStarted)
      socket.off('sessionStopped', handleSessionStopped)
      socket.off('sessionError', handleSessionError)
      socket.off('virtualTime', handleVirtualTime)
      socket.off('cars', handleCars)
      socket.off('bookings', handleBookings)
    }
  }, [socket, isConnected, session?.sessionId, type, sortBookings])

  // Emit speed changes without re-joining session
  useEffect(() => {
    if (!socket || !isConnected || !session?.sessionId) return
    socket.emit('sessionSpeed', {
      sessionId: session.sessionId,
      speed: timeSpeed,
    })
  }, [socket, isConnected, session?.sessionId, timeSpeed])

  // Fetch VROOM plan for debug overlays when experimentId is provided (replay mode)
  useEffect(() => {
    let cancelled = false
    const fetchPlan = async () => {
      if (type === 'replay' && experimentId) {
        try {
          const plan = await simulator.getVroomPlan(experimentId)
          if (!cancelled) setVroomPlan(plan || undefined)
        } catch (_err) {
          if (!cancelled) setVroomPlan(undefined)
        }
      } else {
        setVroomPlan(undefined)
      }
    }
    fetchPlan()
    return () => {
      cancelled = true
    }
  }, [type, experimentId])

  const handleStart = async () => {
    if (!socket || isRunning) return
    setError(null)
    setRunning(true)

    try {
      let sessionResult
      if (type === 'replay' && experimentId) {
        sessionResult = await simulator.prepareReplay(experimentId)
        if (!sessionResult.success || !sessionResult.data) {
          throw new Error(sessionResult.error || 'Failed to prepare replay')
        }
        setSession(sessionResult.data)

        socket.emit('startSessionReplay', {
          sessionId: sessionResult.data.sessionId,
          experimentId,
          parameters: sessionResult.data.parameters,
        })
      } else if (type === 'sequential' && datasetId) {
        sessionResult = await simulator.prepareSequentialSession(datasetId)
        if (!sessionResult.success || !sessionResult.data) {
          throw new Error(
            sessionResult.error || 'Failed to prepare sequential session'
          )
        }
        setSession(sessionResult.data)

        socket.emit('startSequentialSession', {
          sessionId: sessionResult.data.sessionId,
          datasetId,
          parameters: sessionResult.data.parameters,
        })
      } else {
        throw new Error('Invalid props for starting simulation')
      }
    } catch (err: any) {
      setError(err.message || `Failed to start ${type} session`)
      setRunning(false)
      setSession(null)
    }
  }

  const handleStop = () => {
    if (!socket || !session?.sessionId) return
    socket.emit('stopSession', { sessionId: session.sessionId })
  }

  const handlePlay = useCallback(() => {
    if (!socket || !session?.sessionId) return
    socket.emit('sessionPlay', { sessionId: session.sessionId })
    setTimeRunning(true)
  }, [socket, session?.sessionId])

  const handlePause = useCallback(() => {
    if (!socket || !session?.sessionId) return
    socket.emit('sessionPause', { sessionId: session.sessionId })
    setTimeRunning(false)
  }, [socket, session?.sessionId])

  const handleSpeedChange = useCallback(
    (speed: number) => {
      if (!socket || !session?.sessionId) return
      socket.emit('sessionSpeed', { sessionId: session.sessionId, speed })
      setTimeSpeed(speed)
    },
    [socket, session?.sessionId]
  )

  const displayError = !isConnected ? 'Ingen anslutning till servern.' : error

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          {isRunning && (
            <div className="text-sm text-gray-600 mt-1">
              Simulering:{' '}
              {type === 'replay' ? 'VROOM Optimerad' : 'Sekventiell'}
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          {!isRunning ? (
            <Button onClick={handleStart} disabled={!isConnected || isRunning}>
              <Play className="mr-2 h-4 w-4" /> Start
            </Button>
          ) : (
            <Button onClick={handleStop} variant="destructive">
              <Square className="mr-2 h-4 w-4" /> Stoppa
            </Button>
          )}
        </div>
      </div>

      {displayError && (
        <Alert variant="destructive">
          {!isConnected && <WifiOff className="h-4 w-4" />}
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      <Card className="relative h-[400px] overflow-hidden">
        <CardContent className="absolute inset-0 p-0">
          <Map
            cars={cars}
            bookings={bookings}
            isSimulationRunning={isRunning}
            isConnected={isConnected}
            isTimeRunning={isTimeRunning}
            timeSpeed={timeSpeed}
            virtualTime={virtualTime}
            onPlayTime={handlePlay}
            onPauseTime={handlePause}
            onSpeedChange={handleSpeedChange}
            areaPartitions={areaPartitions}
            vroomPlan={vroomPlan as any}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default SimulationView
