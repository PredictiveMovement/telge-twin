import { Socket, Server } from 'socket.io'
import { throttleTime } from 'rxjs/operators'
import { emitters } from '../../config'
import { virtualTime } from '../../lib/virtualTime'
import { experimentController } from './ExperimentController'
import { sessionController } from './SessionController'

export class SocketController {
  private ioInstance: Server | null = null

  setIoInstance(io: Server) {
    this.ioInstance = io
  }

  setupTimeControlsOnly(socket: Socket, experiment: any): void {
    const virtualTimeToUse = experiment.virtualTime

    socket.on('sessionReset', ({ sessionId }: { sessionId: string }) => {
      if (!sessionController.isSocketInSession(socket.id, sessionId)) {
        return
      }

      virtualTime.setCurrentSession(sessionId)
      virtualTimeToUse.reset()
      virtualTime.setCurrentSession(null)
    })

    socket.on('sessionPlay', ({ sessionId }: { sessionId: string }) => {
      if (!sessionController.isSocketInSession(socket.id, sessionId)) {
        return
      }

      virtualTime.setCurrentSession(sessionId)
      virtualTimeToUse.play()
      virtualTime.setCurrentSession(null)
    })

    socket.on('sessionPause', ({ sessionId }: { sessionId: string }) => {
      if (!sessionController.isSocketInSession(socket.id, sessionId)) {
        return
      }

      virtualTime.setCurrentSession(sessionId)
      virtualTimeToUse.pause()
      virtualTime.setCurrentSession(null)
    })

    socket.on(
      'sessionSpeed',
      ({ sessionId, speed }: { sessionId: string; speed: number }) => {
        if (!sessionController.isSocketInSession(socket.id, sessionId)) {
          console.warn(
            `Socket ${socket.id} tried to change speed for session ${sessionId} but is not a member`
          )
          return
        }

        virtualTime.setCurrentSession(sessionId)
        virtualTimeToUse.setTimeMultiplier(speed)
        virtualTime.setCurrentSession(null)
      }
    )
  }

  setupSessionTimeControls(
    socket: Socket,
    experiment: any,
    sessionId?: string
  ): void {
    if (!sessionId) {
      const socketSessions = sessionController.getSocketSessions(socket.id)
      if (!socketSessions || socketSessions.size === 0) return

      sessionId = Array.from(socketSessions)[0]
    }

    this.setupTimeControlsOnly(socket, experiment)

    const timeSubscription = experiment.virtualTime
      .getTimeStream()
      .pipe(throttleTime(1000))
      .subscribe((time: number) => {
        if (this.ioInstance) {
          this.ioInstance.to(sessionId!).emit('time', time)
        }
      })

    if (!socket.data.sessionTimeSubscription) {
      socket.data.sessionTimeSubscription = timeSubscription
    }
  }

  createSessionSubscriptions(sessionId: string, experiment: any): any[] {
    const currentEmitters = emitters()
    const routes: any[] = []

    const sessionBroadcastSocket = {
      emit: (event: string, data: any) => {
        if (this.ioInstance) {
          this.ioInstance.to(sessionId).emit(event, data)
        }
      },
      volatile: {
        emit: (event: string, data: any) => {
          if (this.ioInstance) {
            this.ioInstance.to(sessionId).volatile.emit(event, data)
          }
        },
      },
      data: { emitCars: currentEmitters.includes('cars') },
      on: () => {},
    }

    if (currentEmitters.includes('bookings')) {
      routes.push(
        require('../routes/bookings').register(
          experiment,
          sessionBroadcastSocket,
          sessionId
        )
      )
    }
    if (currentEmitters.includes('cars')) {
      routes.push(
        require('../routes/cars').register(
          experiment,
          sessionBroadcastSocket,
          sessionId
        )
      )
    }
    routes.push(
      require('../routes/log').register(
        experiment,
        sessionBroadcastSocket,
        sessionId
      )
    )

    return routes.flat().filter(Boolean)
  }

  subscribe(
    experiment: any,
    socket: Socket,
    sessionId?: string
  ): Array<unknown> {
    const currentEmitters = emitters()
    const routes: Array<unknown> = []

    if (currentEmitters.includes('bookings')) {
      routes.push(
        require('../routes/bookings').register(experiment, socket, sessionId, () => {
          // Första bokningar emitterade — spela tid om global simulering pausad
          if (!sessionId && experiment.virtualTime && !experiment.virtualTime.isPlaying()) {
            experiment.virtualTime.play()
            if (this.ioInstance) {
              this.ioInstance.emit('simulationReady', {
                experimentId: experiment.parameters?.id,
              })
            }
          }
        })
      )
    }
    if (currentEmitters.includes('cars')) {
      routes.push(
        require('../routes/cars').register(experiment, socket, sessionId)
      )
    }
    routes.push(
      require('../routes/time').register(experiment, socket, sessionId)
    )
    routes.push(
      require('../routes/log').register(experiment, socket, sessionId)
    )

    if (currentEmitters.includes('municipalities')) {
      routes.push(
        require('../routes/municipalities').register(experiment, socket)
      )
    }
    if (currentEmitters.includes('passengers')) {
      try {
        routes.push(
          require('../routes/passengers').register(experiment, socket)
        )
      } catch (_err) {
        // Ignore if passengers route is not available
      }
    }

    return routes.flat().filter(Boolean)
  }

  connectSocketToExperiment(socket: Socket, sessionId?: string) {
    let experiment: any

    if (sessionId) {
      experiment = experimentController.getSessionExperiment(sessionId)

      if (!experiment) {
        socket.emit('sessionStatus', {
          sessionId,
          running: false,
          experimentId: null,
        })
        return
      }

      if (socket.data.subscriptions) {
        socket.data.subscriptions.forEach((sub: { unsubscribe(): void }) =>
          sub.unsubscribe()
        )
        socket.data.subscriptions = []
      }

      socket.removeAllListeners('play')
      socket.removeAllListeners('pause')
      socket.removeAllListeners('speed')
      socket.removeAllListeners('reset')

      sessionController.removeGlobalWatcher(socket.id)

      sessionController.addSocketToSession(socket.id, sessionId)

      const watchers = sessionController.getSessionWatchers(sessionId)

      sessionController.joinSessionRoom(socket, sessionId)

      if (watchers && watchers.size === 1) {
        this.setupSessionTimeControls(socket, experiment, sessionId)

        const subscriptions = this.createSessionSubscriptions(
          sessionId,
          experiment
        )
        sessionController.setSessionSubscriptions(sessionId, subscriptions)
      } else {
        this.setupTimeControlsOnly(socket, experiment)
      }

      socket.emit('sessionStatus', {
        sessionId,
        running: true,
        experimentId: experiment.parameters.id,
      })
    } else {
      experiment = experimentController.currentGlobalExperiment
      if (!experiment) {
        socket.emit('simulationStatus', {
          running: false,
          experimentId: null,
        })
        return
      }

      sessionController.addGlobalWatcher(socket.id)
      socket.emit('simulationStatus', {
        running: experimentController.isGlobalRunning,
        experimentId: experiment.parameters.id,
        timeRunning: experiment.virtualTime?.isPlaying?.() ?? false,
        timeSpeed: experiment.virtualTime
          ? experiment.virtualTime.getTimeMultiplier()
          : 60,
      })

      socket.data.experiment = experiment

      if (socket.data.subscriptions) {
        socket.data.subscriptions.forEach((sub: { unsubscribe(): void }) =>
          sub.unsubscribe()
        )
      }

      socket.data.subscriptions = this.subscribe(experiment, socket)
    }

    socket.emit('parameters', {
      sessionId,
      payload: experiment.parameters,
    })
  }

  cleanupSocketSubscriptions(socket: Socket) {
    if (socket.data.sessionTimeSubscription) {
      socket.data.sessionTimeSubscription.unsubscribe()
      socket.data.sessionTimeSubscription = null
    }

    if (socket.data.subscriptions) {
      socket.data.subscriptions.forEach((sub: { unsubscribe(): void }) =>
        sub.unsubscribe()
      )
      socket.data.subscriptions = []
    }
  }

  cleanupSocketEventListeners(socket: Socket) {
    socket.removeAllListeners('sessionPlay')
    socket.removeAllListeners('sessionPause')
    socket.removeAllListeners('sessionSpeed')
    socket.removeAllListeners('sessionReset')

    socket.removeAllListeners('play')
    socket.removeAllListeners('pause')
    socket.removeAllListeners('speed')
    socket.removeAllListeners('reset')
  }

  broadcastSimulationStarted(data: {
    experimentId: string
    isReplay: boolean
    sourceDatasetId?: string
    datasetName?: string
  }): void {
    if (this.ioInstance) {
      this.ioInstance.emit('simulationStarted', data)
    }
  }

  /**
   * Emit when a truck plan is saved (optimization progress/completion).
   * `planSaved` is scoped to the dataset room so only clients watching that
   * specific dataset receive it (prevents counter collision between users).
   * A lightweight `experimentUpdated` is broadcast globally so list views can refresh.
   */
  emitPlanSaved(experimentId: string, planId: string, sourceDatasetId?: string): void {
    if (this.ioInstance && sourceDatasetId) {
      this.ioInstance.to(`dataset:${sourceDatasetId}`).emit('planSaved', {
        experimentId, planId, sourceDatasetId,
      })
      // Global notification for list views (no counter-sensitive payload)
      this.ioInstance.emit('experimentUpdated', { experimentId, sourceDatasetId })
    }
  }

  /**
   * Push area partitions update via Socket.IO to all connected global watchers.
   */
  emitAreaPartitions(experimentId: string, partitions: unknown[]): void {
    if (this.ioInstance) {
      this.ioInstance.emit('areaPartitions', { experimentId, partitions })
    }
  }

  /**
   * Push vroom plan update via Socket.IO to all connected global watchers.
   */
  emitVroomPlanUpdate(experimentId: string, vroomPlan: unknown): void {
    if (this.ioInstance) {
      this.ioInstance.emit('vroomPlanUpdate', { experimentId, vroomPlan })
    }
  }
}

export const socketController = new SocketController()
