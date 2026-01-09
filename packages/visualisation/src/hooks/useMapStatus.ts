import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export type MapMode = 'global' | 'replay' | 'idle'

export interface MapStatus {
  mode: MapMode
  running: boolean
  loading: boolean
  error: string | null
  experimentId: string | null
  sessionId: string | null
  timeRunning: boolean
  timeSpeed: number
}

export const useMapStatus = () => {
  const [searchParams] = useSearchParams()

  const [status, setStatus] = useState<MapStatus>({
    mode: 'idle',
    running: false,
    loading: false,
    error: null,
    experimentId: null,
    sessionId: null,
    timeRunning: false,
    timeSpeed: 60,
  })

  useEffect(() => {
    const replayParam = searchParams.get('replay')
    const sessionParam = searchParams.get('session')

    if (replayParam) {
      setStatus((prev) => ({
        ...prev,
        mode: 'replay',
        sessionId: sessionParam,
      }))
    } else {
      setStatus((prev) => ({
        ...prev,
        mode: prev.running ? 'global' : 'idle',
        sessionId: null,
      }))
    }
  }, [searchParams])

  const updateStatus = (updates: Partial<MapStatus>) => {
    setStatus((prev) => ({ ...prev, ...updates }))
  }

  const setLoading = (loading: boolean) => {
    setStatus((prev) => ({ ...prev, loading }))
  }

  const setError = (error: string | null) => {
    setStatus((prev) => ({ ...prev, error }))
  }

  const setRunning = (running: boolean, experimentId?: string | null) => {
    setStatus((prev) => ({
      ...prev,
      running,
      experimentId: experimentId ?? prev.experimentId,
      mode: running ? (prev.sessionId ? 'replay' : 'global') : 'idle',
      error: running ? null : prev.error,
    }))
  }

  const setTimeState = (timeRunning: boolean, timeSpeed?: number) => {
    setStatus((prev) => ({
      ...prev,
      timeRunning,
      timeSpeed: timeSpeed ?? prev.timeSpeed,
    }))
  }

  const setSessionId = (sessionId: string | null) => {
    setStatus((prev) => ({
      ...prev,
      sessionId,
      mode: sessionId ? 'replay' : prev.running ? 'global' : 'idle',
    }))
  }

  const reset = () => {
    setStatus({
      mode: 'idle',
      running: false,
      loading: false,
      error: null,
      experimentId: null,
      sessionId: null,
      timeRunning: false,
      timeSpeed: 60,
    })
  }

  const isReplayMode = status.mode === 'replay'
  const isGlobalMode = status.mode === 'global'
  const isIdle = status.mode === 'idle'

  const statusMessage = () => {
    if (status.error) {
      return {
        type: 'error' as const,
        message: status.error,
        icon: '❌',
      }
    }

    if (status.loading) {
      return {
        type: 'loading' as const,
        message:
          status.mode === 'replay'
            ? 'Startar replay...'
            : 'Startar simulering...',
        icon: '⏳',
      }
    }

    if (status.mode === 'replay') {
      if (!status.running) {
        return {
          type: 'warning' as const,
          message: 'Replay ej tillgänglig',
          icon: '⚠️',
        }
      }
      return {
        type: 'success' as const,
        message: status.timeRunning ? 'Replay aktiv' : 'Replay pausad',
        icon: status.timeRunning ? '🔄' : '⏸️',
      }
    }

    if (status.mode === 'global') {
      return {
        type: 'success' as const,
        message: status.timeRunning ? 'Simulering aktiv' : 'Simulering pausad',
        icon: status.timeRunning ? '🚀' : '⏸️',
      }
    }

    return {
      type: 'info' as const,
      message: 'Ingen aktiv simulering',
      icon: '🗺️',
    }
  }

  return {
    status,
    updateStatus,
    setLoading,
    setError,
    setRunning,
    setTimeState,
    setSessionId,
    reset,
    isReplayMode,
    isGlobalMode,
    isIdle,
    statusMessage: statusMessage(),
  }
}
