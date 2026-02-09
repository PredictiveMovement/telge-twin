import { useCallback, useEffect, useMemo, useState } from 'react'
import { Car, Booking } from '@/types/map'
import { useMapSocket } from '@/hooks/useMapSocket'
import { toLonLatArray } from '@/utils/geo'
import { upsertListById } from '@/lib/utils'
import * as simulator from '@/api/simulator'

interface UseSimulationSessionOptions {
  type: 'replay' | 'sequential'
  datasetId?: string
  experimentId?: string
}

interface SimulationSessionState {
  cars: Car[]
  bookings: Booking[]
  isRunning: boolean
  isTimeRunning: boolean
  timeSpeed: number
  virtualTime: number | null
  error: string | null
  isConnected: boolean
  vroomPlan?: any
  hasSession: boolean
  start: () => Promise<void>
  stop: () => void
  play: () => void
  pause: () => void
  setSpeed: (speed: number) => void
  resetError: () => void
}

export const useSimulationSession = ({
  type,
  datasetId,
  experimentId,
}: UseSimulationSessionOptions): SimulationSessionState => {
  const { socket, isConnected } = useMapSocket()
  const [cars, setCars] = useState<Car[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [session, setSession] = useState<{ sessionId: string; parameters: any } | null>(
    null
  )
  const [isRunning, setRunning] = useState(false)
  const [isTimeRunning, setTimeRunning] = useState(false)
  const [timeSpeed, setTimeSpeed] = useState(60)
  const [virtualTime, setVirtualTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vroomPlan, setVroomPlan] = useState<any | undefined>(undefined)

  const upsertList = upsertListById

  const sortBookings = useCallback(
    (incoming: any[]): any[] => {
      if (type === 'sequential') {
        return [...incoming].sort((a, b) => {
          const orderA = a.turordningsnr ?? Number.MAX_SAFE_INTEGER
          const orderB = b.turordningsnr ?? Number.MAX_SAFE_INTEGER
          return orderA - orderB
        })
      }
      return incoming
    },
    [type]
  )

  useEffect(() => {
    if (!socket || !isConnected || !session?.sessionId) return
    const currentSessionId = session.sessionId

    socket.emit('joinSession', { sessionId: currentSessionId })

    const handleSessionStarted = (data: { sessionId: string; timeRunning?: boolean }) => {
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

    const handleTime = (time: number) => {
      setVirtualTime(time)
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
      const incomingBookings = Array.isArray(payload)
        ? payload
        : [payload]

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
    socket.on('time', handleTime)
    socket.on('cars', handleCars)
    socket.on('bookings', handleBookings)

    return () => {
      socket.emit('leaveSession', currentSessionId)
      socket.off('sessionStarted', handleSessionStarted)
      socket.off('sessionStopped', handleSessionStopped)
      socket.off('sessionError', handleSessionError)
      socket.off('time', handleTime)
      socket.off('cars', handleCars)
      socket.off('bookings', handleBookings)
    }
  }, [socket, isConnected, session?.sessionId, sortBookings, upsertList])

  useEffect(() => {
    let cancelled = false
    const fetchPlan = async () => {
      if (type === 'replay' && experimentId) {
        try {
          const plan = await simulator.getVroomPlan(experimentId)
          if (!cancelled) setVroomPlan(plan || undefined)
        } catch (_) {
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

  useEffect(() => {
    if (!socket || !isConnected || !session?.sessionId) return
    socket.emit('sessionSpeed', {
      sessionId: session.sessionId,
      speed: timeSpeed,
    })
  }, [socket, isConnected, session?.sessionId, timeSpeed])

  const start = useCallback(async () => {
    if (!socket || isRunning) return
    setError(null)

    try {
      let sessionResult
      if (type === 'replay') {
        if (!experimentId) {
          throw new Error('Experiment-ID saknas för replay-simulering')
        }
        sessionResult = await simulator.prepareReplay(experimentId)
        if (!sessionResult.success || !sessionResult.data) {
          throw new Error(sessionResult.error || 'Misslyckades med att förbereda replay')
        }
        setSession(sessionResult.data)

        socket.emit('startSessionReplay', {
          sessionId: sessionResult.data.sessionId,
          experimentId,
          parameters: sessionResult.data.parameters,
        })
      } else {
        if (!datasetId) {
          throw new Error('Dataset-ID saknas för sekventiell simulering')
        }
        sessionResult = await simulator.prepareSequentialSession(datasetId)
        if (!sessionResult.success || !sessionResult.data) {
          throw new Error(sessionResult.error || 'Misslyckades med att förbereda sekventiell simulering')
        }
        setSession(sessionResult.data)

        socket.emit('startSequentialSession', {
          sessionId: sessionResult.data.sessionId,
          datasetId,
        })
      }
      setRunning(true)
    } catch (err: any) {
      setError(err.message || 'Kunde inte starta simuleringen')
      setRunning(false)
      setSession(null)
      throw err
    }
  }, [socket, type, experimentId, datasetId, isRunning])

  const stop = useCallback(() => {
    if (!socket || !session?.sessionId) return
    socket.emit('stopSession', { sessionId: session.sessionId })
  }, [socket, session?.sessionId])

  const play = useCallback(() => {
    if (!socket || !session?.sessionId) return
    socket.emit('sessionPlay', { sessionId: session.sessionId })
    setTimeRunning(true)
  }, [socket, session?.sessionId])

  const pause = useCallback(() => {
    if (!socket || !session?.sessionId) return
    socket.emit('sessionPause', { sessionId: session.sessionId })
    setTimeRunning(false)
  }, [socket, session?.sessionId])

  const setSpeed = useCallback(
    (speed: number) => {
      if (!socket || !session?.sessionId) return
      socket.emit('sessionSpeed', { sessionId: session.sessionId, speed })
      setTimeSpeed(speed)
    },
    [socket, session?.sessionId]
  )

  const resetError = useCallback(() => setError(null), [])

  useEffect(() => {
    return () => {
      if (socket && session?.sessionId) {
        socket.emit('leaveSession', session.sessionId)
        socket.emit('stopSession', { sessionId: session.sessionId })
      }
    }
  }, [socket, session?.sessionId])

  return useMemo(
    () => ({
      cars,
      bookings,
      isRunning,
      isTimeRunning,
      timeSpeed,
      virtualTime,
      error,
      isConnected,
      vroomPlan,
      hasSession: Boolean(session?.sessionId),
      start,
      stop,
      play,
      pause,
      setSpeed,
      resetError,
    }),
    [
      cars,
      bookings,
      isRunning,
      isTimeRunning,
      timeSpeed,
      virtualTime,
      error,
      isConnected,
      vroomPlan,
      session?.sessionId,
      start,
      stop,
      play,
      pause,
      setSpeed,
      resetError,
    ]
  )
}
