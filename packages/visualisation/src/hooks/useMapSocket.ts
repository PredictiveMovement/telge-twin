import { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { SIMULATOR_CONFIG } from '../config/simulator'

interface MapSocketState {
  socket: Socket | null
  isConnected: boolean
  error: string | null
  virtualTime: number | null
}

export const useMapSocket = () => {
  const [state, setState] = useState<MapSocketState>({
    socket: null,
    isConnected: false,
    error: null,
    virtualTime: null,
  })

  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io(SIMULATOR_CONFIG.url, {
      transports: ['websocket', 'polling'],
      timeout: SIMULATOR_CONFIG.requestConfig.timeout,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setState((prev) => ({
        ...prev,
        socket,
        isConnected: true,
        error: null,
      }))
    })

    socket.on('disconnect', (reason) => {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: `Disconnected: ${reason}`,
      }))
    })

    socket.on('connect_error', (error) => {
      setState((prev) => ({
        ...prev,
        error: `Connection error: ${error.message}`,
      }))
    })

    socket.on('time', (time: number) => {
      setState((prev) => ({
        ...prev,
        virtualTime: time,
      }))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const joinMap = useCallback(() => {
    if (state.socket) {
      state.socket.emit('joinMap')
    }
  }, [state.socket])

  const leaveMap = useCallback(() => {
    if (state.socket) {
      state.socket.emit('leaveMap')
    }
  }, [state.socket])

  const joinSession = useCallback(
    (sessionId: string, replayId?: string) => {
      if (state.socket) {
        state.socket.emit('joinSession', { sessionId, replayId })
      }
    },
    [state.socket]
  )

  const leaveSession = useCallback(
    (sessionId: string) => {
      if (state.socket) {
        state.socket.emit('leaveSession', sessionId)
      }
    },
    [state.socket]
  )

  const playTime = useCallback(() => {
    if (state.socket) {
      state.socket.emit('play')
    }
  }, [state.socket])

  const pauseTime = useCallback(() => {
    if (state.socket) {
      state.socket.emit('pause')
    }
  }, [state.socket])

  const resetTime = useCallback(() => {
    if (state.socket) {
      state.socket.emit('reset')
    }
  }, [state.socket])

  const setTimeSpeed = useCallback(
    (speed: number) => {
      if (state.socket) {
        state.socket.emit('speed', speed)
      }
    },
    [state.socket]
  )

  const stopSimulation = useCallback(() => {
    if (state.socket) {
      state.socket.emit('stopSimulation')
    }
  }, [state.socket])

  return {
    ...state,
    joinMap,
    leaveMap,
    joinSession,
    leaveSession,
    playTime,
    pauseTime,
    resetTime,
    setTimeSpeed,
    stopSimulation,
  }
}
