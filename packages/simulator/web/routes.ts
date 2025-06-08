import { Server, Socket } from 'socket.io'
import { save } from '../config'
import { virtualTime } from '../lib/virtualTime'
import { experimentController } from './controllers/ExperimentController'
import { sessionController } from './controllers/SessionController'
import { socketController } from './controllers/SocketController'

function register(io: Server): void {
  socketController.setIoInstance(io)

  io.on('connection', (socket: Socket) => {
    socket.data.emitCars = true

    socket.on('startSimulation', async (simData, parameters) => {
      try {
        const result = await experimentController.startSimulationFromData(
          simData,
          parameters
        )

        virtualTime.reset()

        sessionController.getGlobalWatchers().forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId)
          if (socket) {
            socketController.connectSocketToExperiment(socket)
          }
        })

        io.emit('simulationStarted', {
          running: true,
          data: simData,
          experimentId: result.experimentId,
          isReplay: result.isReplay,
        })
      } catch (error) {
        console.error('Error starting simulation:', error)
        socket.emit('simulationError', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    socket.on('stopSimulation', () => {
      const stopped = experimentController.stopGlobalExperiment()
      if (stopped) {
        sessionController.notifyGlobalWatchers(io, 'simulationStopped')
      }
    })

    socket.on('joinMap', () => {
      socketController.cleanupSocketEventListeners(socket)
      socketController.cleanupSocketSubscriptions(socket)

      socketController.connectSocketToExperiment(socket)
    })

    socket.on('leaveMap', () => {
      sessionController.removeGlobalWatcher(socket.id)
      socketController.cleanupSocketSubscriptions(socket)
    })

    socket.on('joinSession', ({ sessionId }) => {
      if (!sessionId) return

      socketController.connectSocketToExperiment(socket, sessionId)
    })

    socket.on('leaveSession', (sessionId) => {
      if (!sessionId) return

      const sessionIsEmpty = sessionController.removeSocketFromSession(
        socket.id,
        sessionId
      )
      if (sessionIsEmpty) {
        sessionController.cleanupSession(sessionId)
        experimentController.stopSessionExperiment(sessionId)
      }

      socketController.cleanupSocketSubscriptions(socket)
      socketController.cleanupSocketEventListeners(socket)
    })

    socket.on(
      'startSessionReplay',
      async ({ sessionId, experimentId, parameters }) => {
        if (!sessionId) return

        try {
          const experiment = await experimentController.startSessionReplay(
            sessionId,
            experimentId,
            parameters
          )

          socketController.connectSocketToExperiment(socket, sessionId)

          io.to(sessionId).emit('sessionStarted', {
            sessionId,
            running: true,
            experimentId: experiment.parameters.id,
            timeRunning: false,
          })
        } catch (error) {
          console.error(`❌ Error starting session replay:`, error)
          socket.emit('sessionError', {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    )

    socket.on(
      'startSequentialSession',
      ({ sessionId, datasetId, parameters }) => {
        if (!sessionId) return

        const experiment = experimentController.createSequentialSession(
          sessionId,
          datasetId,
          parameters
        )

        socketController.connectSocketToExperiment(socket, sessionId)

        io.to(sessionId).emit('sessionStarted', {
          sessionId,
          running: true,
          experimentId: experiment.parameters.id,
          timeRunning: false,
        })
      }
    )

    socket.on('reset', () => {
      const experiment = experimentController.resetGlobalExperiment()

      if (experiment) {
        sessionController.getGlobalWatchers().forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId)
          if (socket) {
            socketController.connectSocketToExperiment(socket)
          }
        })

        io.emit('init')
        io.emit('parameters', experiment.parameters)
      }
    })

    socket.on('carLayer', (val: boolean) => (socket.data.emitCars = val))

    socket.on('experimentParameters', (value: unknown) => {
      save(value as any)

      const experiment = experimentController.resetGlobalExperiment()

      if (experiment) {
        sessionController.getGlobalWatchers().forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId)
          if (socket) {
            socketController.connectSocketToExperiment(socket)
          }
        })

        io.emit('init')
        io.emit('parameters', experiment.parameters)
      }
    })

    socket.on('disconnect', () => {
      const sessionsToCleanup = sessionController.cleanupSocket(socket.id)

      sessionsToCleanup.forEach((sessionId) => {
        sessionController.cleanupSession(sessionId)
        experimentController.stopSessionExperiment(sessionId)
      })

      socketController.cleanupSocketSubscriptions(socket)
    })
  })
}

const api = { register }
export default api

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = api
