import type { Socket } from 'socket.io'
import { isAuthConfigured, verifyToken } from './requireAuth'

export async function socketAuth(
  socket: Socket,
  next: (err?: Error) => void
) {
  if (!isAuthConfigured) return next()

  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('Missing token'))

  try {
    socket.data.user = await verifyToken(token)
    next()
  } catch {
    next(new Error('Invalid or expired token'))
  }
}
