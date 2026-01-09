import { Server, Socket } from 'socket.io'
import { VirtualTime } from '../../lib/virtualTime'

export class SessionController {
  private socketToSessions = new Map<string, Set<string>>() // Socket can be in multiple sessions
  private sessionWatchers = new Map<string, Set<string>>()
  private sessionSubscriptions = new Map<string, any[]>()
  private globalMapWatchers = new Set<string>()

  addSocketToSession(socketId: string, sessionId: string) {
    if (!this.socketToSessions.has(socketId)) {
      this.socketToSessions.set(socketId, new Set())
    }
    this.socketToSessions.get(socketId)!.add(sessionId)

    const watchers = this.sessionWatchers.get(sessionId) || new Set()
    watchers.add(socketId)
    this.sessionWatchers.set(sessionId, watchers)
  }

  removeSocketFromSession(socketId: string, sessionId: string) {
    const socketSessions = this.socketToSessions.get(socketId)
    if (socketSessions) {
      socketSessions.delete(sessionId)
      if (socketSessions.size === 0) {
        this.socketToSessions.delete(socketId)
      }
    }

    const watchers = this.sessionWatchers.get(sessionId)
    if (watchers) {
      watchers.delete(socketId)
      if (watchers.size === 0) {
        this.sessionWatchers.delete(sessionId)
        return true
      }
    }
    return false
  }

  getSocketSessions(socketId: string): Set<string> | undefined {
    return this.socketToSessions.get(socketId)
  }

  getSessionWatchers(sessionId: string): Set<string> | undefined {
    return this.sessionWatchers.get(sessionId)
  }

  isSocketInSession(socketId: string, sessionId: string): boolean {
    const socketSessions = this.socketToSessions.get(socketId)
    return socketSessions ? socketSessions.has(sessionId) : false
  }

  addGlobalWatcher(socketId: string) {
    this.globalMapWatchers.add(socketId)
  }

  removeGlobalWatcher(socketId: string) {
    this.globalMapWatchers.delete(socketId)
  }

  getGlobalWatchers(): Set<string> {
    return this.globalMapWatchers
  }

  setSessionSubscriptions(sessionId: string, subscriptions: any[]) {
    this.sessionSubscriptions.set(sessionId, subscriptions)
  }

  getSessionSubscriptions(sessionId: string): any[] | undefined {
    return this.sessionSubscriptions.get(sessionId)
  }

  cleanupSessionSubscriptions(sessionId: string) {
    const subscriptions = this.sessionSubscriptions.get(sessionId)
    if (subscriptions) {
      subscriptions.forEach((sub: any) => {
        if (sub && typeof sub.unsubscribe === 'function') {
          sub.unsubscribe()
        }
      })
      this.sessionSubscriptions.delete(sessionId)
    }
  }

  cleanupSession(sessionId: string) {
    this.cleanupSessionSubscriptions(sessionId)
    this.sessionWatchers.delete(sessionId)
  }

  cleanupSocket(socketId: string) {
    this.globalMapWatchers.delete(socketId)

    const socketSessions = this.socketToSessions.get(socketId)
    const sessionsToCleanup: string[] = []

    if (socketSessions) {
      socketSessions.forEach((sessionId) => {
        const watchers = this.sessionWatchers.get(sessionId)
        if (watchers) {
          watchers.delete(socketId)
          if (watchers.size === 0) {
            sessionsToCleanup.push(sessionId)
          }
        }
      })
      this.socketToSessions.delete(socketId)
    }

    return sessionsToCleanup
  }

  notifySessionWatchers(
    io: Server,
    sessionId: string,
    event: string,
    data?: any
  ) {
    const watchers = this.sessionWatchers.get(sessionId)
    if (watchers && io) {
      watchers.forEach((socketId) => {
        const socket = io.sockets.sockets.get(socketId)
        if (socket) {
          socket.emit(event, data || sessionId)
        }
      })
    }
  }

  notifyGlobalWatchers(io: Server, event: string, data?: any) {
    if (io) {
      this.globalMapWatchers.forEach((socketId) => {
        const socket = io.sockets.sockets.get(socketId)
        if (socket) {
          socket.emit(event, data)
        }
      })
    }
  }

  joinSessionRoom(socket: Socket, sessionId: string) {
    socket.join(sessionId)
    socket.data.currentSessionId = sessionId
  }

  leaveSessionRoom(socket: Socket, sessionId: string) {
    socket.leave(sessionId)
    if (socket.data.currentSessionId === sessionId) {
      delete socket.data.currentSessionId
    }
  }
}

export const sessionController = new SessionController()
