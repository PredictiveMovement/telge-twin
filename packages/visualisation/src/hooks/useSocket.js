import { useContext, useEffect, useRef, useState } from 'react'
import { SocketIOContext } from '../context/socketIOContext'

export const useSocketEvent = (eventKey, callback) => {
  const socket = useContext(SocketIOContext)
  const callbackRef = useRef(callback)

  callbackRef.current = callback

  const socketHandlerRef = useRef(function () {
    if (callbackRef.current) {
      callbackRef.current.apply(this, arguments)
    }
  })

  useEffect(() => {
    const subscribe = () => {
      if (eventKey) {
        socket.on(eventKey, socketHandlerRef.current)
      }
    }

    const unsubscribe = () => {
      if (eventKey) {
        socket.removeListener(eventKey, socketHandlerRef.current)
      }
    }

    subscribe()

    return unsubscribe
  }, [eventKey, socket])

  return { socket }
}

export const useSocket = () => {
  const socket = useContext(SocketIOContext)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!socket) return

    const handleConnect = () => setIsConnected(true)
    const handleDisconnect = () => setIsConnected(false)

    setIsConnected(socket.connected)

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
    }
  }, [socket])

  return { socket, isConnected }
}
