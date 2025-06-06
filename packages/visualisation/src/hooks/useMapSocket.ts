import { useEffect, useState, useRef } from 'react'
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
      console.error('🔌 Map socket connection error:', error)
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

  const joinMap = () => {
    if (state.socket) {
      state.socket.emit('joinMap')
    }
  }

  const leaveMap = () => {
    if (state.socket) {
      state.socket.emit('leaveMap')
    }
  }

  const joinSession = (sessionId: string, replayId?: string) => {
    if (state.socket) {
      state.socket.emit('joinSession', { sessionId, replayId })
    }
  }

  const leaveSession = (sessionId: string) => {
    if (state.socket) {
      state.socket.emit('leaveSession', sessionId)
    }
  }

  const playTime = () => {
    if (state.socket) {
      state.socket.emit('play')
    }
  }

  const pauseTime = () => {
    if (state.socket) {
      state.socket.emit('pause')
    }
  }

  const setTimeSpeed = (speed: number) => {
    if (state.socket) {
      state.socket.emit('speed', speed)
    }
  }

  return {
    ...state,
    joinMap,
    leaveMap,
    joinSession,
    leaveSession,
    playTime,
    pauseTime,
    setTimeSpeed,
  }
}
