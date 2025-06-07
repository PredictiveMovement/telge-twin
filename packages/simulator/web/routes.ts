import moment from 'moment'
import { Server, Socket } from 'socket.io'
import { filter, take } from 'rxjs/operators'
import { emitters } from '../config'
import { save } from '../config'
import { virtualTime } from '../lib/virtualTime'
import { safeId } from '../lib/id'
import { Client } from '@elastic/elasticsearch'
import { createFleetConfigFromDataset } from '../lib/fleet-utils'

import {
  globalExperiment as sharedGlobalExperiment,
  isGlobalSimulationRunning as sharedIsGlobalSimulationRunning,
  sessionExperiments as sharedSessionExperiments,
} from './api'

let globalExperiment: any = sharedGlobalExperiment
let isGlobalSimulationRunning = sharedIsGlobalSimulationRunning
const globalMapWatchers = new Set<string>()

const sessionExperiments = sharedSessionExperiments
const socketToSession = new Map<string, string>()
const sessionWatchers = new Map<string, Set<string>>()

let ioInstance: Server | null = null

const engine: {
  createExperiment: (opts: unknown) => unknown
} = require('../index')

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
})

function createGlobalSimulation(directParams?: any) {
  const currentEmitters = emitters()
  const experimentId = directParams?.id || safeId()

  globalExperiment = engine.createExperiment({
    defaultEmitters: currentEmitters,
    id: experimentId,
    directParams: { ...directParams, isReplay: false },
  })

  if (!globalExperiment.parameters.emitters) {
    globalExperiment.parameters.emitters = currentEmitters
  }

  globalExperiment.parameters.initMapState = {
    latitude: parseFloat(process.env.LATITUDE || '59.1955'),
    longitude: parseFloat(process.env.LONGITUDE || '17.6253'),
    zoom: parseInt(process.env.ZOOM || '10', 10),
  }

  if (globalExperiment.virtualTime) {
    globalExperiment.virtualTime
      .getTimeStream()
      .pipe(
        filter((time: number) => time >= moment().endOf('day').valueOf()),
        take(1)
      )
      .subscribe(() => {
        stopGlobalSimulation()
      })
  }

  return globalExperiment
}

function createSessionSimulation(sessionId: string, directParams?: any) {
  const currentEmitters = emitters()
  const experimentId = directParams?.id || safeId()

  const experiment = engine.createExperiment({
    defaultEmitters: currentEmitters,
    id: experimentId,
    directParams: { ...directParams, isReplay: true },
  }) as any

  if (!experiment.parameters.emitters) {
    experiment.parameters.emitters = currentEmitters
  }

  experiment.parameters.initMapState = {
    latitude: parseFloat(process.env.LATITUDE || '59.1955'),
    longitude: parseFloat(process.env.LONGITUDE || '17.6253'),
    zoom: parseInt(process.env.ZOOM || '10', 10),
  }

  if (experiment.virtualTime) {
    experiment.virtualTime
      .getTimeStream()
      .pipe(
        filter((time: number) => time >= moment().endOf('day').valueOf()),
        take(1)
      )
      .subscribe(() => {
        stopSessionSimulation(sessionId)
      })
  }

  sessionExperiments.set(sessionId, experiment)
  if (!sessionWatchers.has(sessionId)) {
    sessionWatchers.set(sessionId, new Set())
  }

  return experiment
}

function stopGlobalSimulation() {
  if (globalExperiment) {
    globalExperiment = null
    isGlobalSimulationRunning = false

    virtualTime.reset()

    if (ioInstance) {
      globalMapWatchers.forEach((socketId) => {
        const socket = ioInstance!.sockets.sockets.get(socketId)
        if (socket) {
          socket.emit('simulationStopped')
        }
      })
    }
  }
}

function stopSessionSimulation(sessionId: string) {
  const experiment = sessionExperiments.get(sessionId)
  if (experiment) {
    sessionExperiments.delete(sessionId)

    const watchers = sessionWatchers.get(sessionId)
    if (watchers && ioInstance) {
      watchers.forEach((socketId) => {
        const socket = ioInstance!.sockets.sockets.get(socketId)
        if (socket) {
          socket.emit('sessionStopped', sessionId)
          socketToSession.delete(socketId)
        }
      })
      sessionWatchers.delete(sessionId)
    }
  }
}

function cleanupSession(sessionId: string) {
  const watchers = sessionWatchers.get(sessionId)
  if (!watchers || watchers.size === 0) {
    stopSessionSimulation(sessionId)
  }
}

function connectSocketToExperiment(socket: Socket, sessionId?: string) {
  let experiment: any

  if (sessionId) {
    experiment = sessionExperiments.get(sessionId)

    if (!experiment) {
      socket.emit('sessionStatus', {
        sessionId,
        running: false,
        experimentId: null,
      })
      return
    }

    socketToSession.set(socket.id, sessionId)
    const watchers = sessionWatchers.get(sessionId) || new Set()
    watchers.add(socket.id)
    sessionWatchers.set(sessionId, watchers)

    socket.emit('sessionStatus', {
      sessionId,
      running: true,
      experimentId: experiment.parameters.id,
    })
  } else {
    experiment = globalExperiment
    if (!experiment) {
      socket.emit('simulationStatus', {
        running: false,
        experimentId: null,
      })
      return
    }

    globalMapWatchers.add(socket.id)
    socket.emit('simulationStatus', {
      running: isGlobalSimulationRunning,
      experimentId: experiment.parameters.id,
    })
  }

  socket.data.experiment = experiment

  if (socket.data.subscriptions) {
    socket.data.subscriptions.forEach((sub: { unsubscribe(): void }) =>
      sub.unsubscribe()
    )
  }

  socket.data.subscriptions = subscribe(experiment, socket)
  socket.emit('parameters', experiment.parameters)
}

function subscribe(experiment: any, socket: Socket): Array<unknown> {
  const currentEmitters = emitters()
  const routes: Array<unknown> = []

  if (currentEmitters.includes('bookings')) {
    const bookingsRoute = require('./routes/bookings.ts').register(
      experiment,
      socket
    )

    routes.push(bookingsRoute)
  }
  if (currentEmitters.includes('cars')) {
    const carsRoute = require('./routes/cars.ts').register(experiment, socket)

    routes.push(carsRoute)
  }
  if (currentEmitters.includes('municipalities')) {
    routes.push(
      require('./routes/municipalities.ts').register(experiment, socket)
    )
  }
  if (currentEmitters.includes('passengers')) {
    try {
      routes.push(require('./routes/passengers').register(experiment, socket))
    } catch (err) {}
  }

  routes.push(require('./routes/time.ts').register(experiment, socket))
  routes.push(require('./routes/log.ts').register(experiment, socket))

  return routes.flat().filter(Boolean)
}

function register(io: Server): void {
  ioInstance = io

  io.on('connection', (socket: Socket) => {
    socket.data.emitCars = emitters().includes('cars')

    socket.on('startSimulation', async (simData, parameters) => {
      const { experimentId, datasetId, isReplay } = simData
      let currentExperimentId = experimentId || safeId()
      let fleetsConfig: any[] = []
      let experimentSettings: any = {}

      try {
        if (isReplay && experimentId) {
          const experimentResponse = await client.get({
            index: 'experiments',
            id: experimentId,
          })

          const experimentData = experimentResponse.body._source
          fleetsConfig = experimentData.fleets || []
          experimentSettings = {
            ...experimentData.settings,
            replayExperiment: experimentId,
            isReplay: true,
          }

          console.log(
            `🔄 Replay mode: Loading experiment ${experimentId} with ${fleetsConfig.length} fleets`
          )
        } else if (datasetId) {
          const datasetResponse = await client.get({
            index: 'route-datasets',
            id: datasetId,
          })

          const datasetData = datasetResponse.body._source
          fleetsConfig = datasetData.fleetConfiguration || []

          const newExperimentData = {
            id: currentExperimentId,
            name: `Experiment from ${datasetData.name}`,
            description: `Auto-generated from dataset: ${datasetData.description}`,
            datasetId: datasetId,
            fleets: fleetsConfig,
            settings: datasetData.originalSettings || {},
            startDate: new Date().toISOString(),
            status: 'running',
          }

          await client.index({
            index: 'experiments',
            id: currentExperimentId,
            body: newExperimentData,
          })
        } else if (simData.sourceDatasetId) {
          const datasetResponse = await client.get({
            index: 'route-datasets',
            id: simData.sourceDatasetId,
          })
          const dataset = datasetResponse.body._source
          fleetsConfig = dataset.fleetConfiguration || []
        } else {
          const defaultConfig = createFleetConfigFromDataset(
            [],
            undefined,
            parameters
          )
          fleetsConfig = defaultConfig['Södertälje kommun']?.fleets || []
        }

        globalExperiment = null
        createGlobalSimulation({
          ...parameters,
          ...experimentSettings,
          experimentId: currentExperimentId,
          sourceDatasetId: datasetId || simData.sourceDatasetId,
          datasetName: simData.datasetName,
          routeDataSource: 'elasticsearch',
          fleets: {
            'Södertälje kommun': {
              settings: {
                optimizedRoutes: true,
                saveToElastic: true,
                createReplay: true,
              },
              fleets: fleetsConfig,
            },
          },
        })
        isGlobalSimulationRunning = true

        virtualTime.reset()

        globalMapWatchers.forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId)
          if (socket) {
            connectSocketToExperiment(socket)
          }
        })

        io.emit('simulationStarted', {
          running: true,
          data: simData,
          experimentId: currentExperimentId,
          isReplay: !!isReplay,
        })
      } catch (error) {
        console.error('Error starting simulation:', error)
        socket.emit('simulationError', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    socket.on('stopSimulation', () => {
      stopGlobalSimulation()
    })

    socket.on('joinMap', () => {
      connectSocketToExperiment(socket)
    })

    socket.on('leaveMap', () => {
      globalMapWatchers.delete(socket.id)

      if (socket.data.subscriptions) {
        socket.data.subscriptions.forEach((sub: { unsubscribe(): void }) =>
          sub.unsubscribe()
        )
        socket.data.subscriptions = []
      }
    })

    socket.on('joinSession', ({ sessionId, replayId }) => {
      if (!sessionId) return

      connectSocketToExperiment(socket, sessionId)
    })

    socket.on('leaveSession', (sessionId) => {
      if (!sessionId) return

      socketToSession.delete(socket.id)
      const watchers = sessionWatchers.get(sessionId)
      if (watchers) {
        watchers.delete(socket.id)
        if (watchers.size === 0) {
          cleanupSession(sessionId)
        }
      }

      if (socket.data.subscriptions) {
        socket.data.subscriptions.forEach((sub: { unsubscribe(): void }) =>
          sub.unsubscribe()
        )
        socket.data.subscriptions = []
      }
    })

    socket.on(
      'startSessionReplay',
      ({ sessionId, experimentId, parameters }) => {
        if (!sessionId) return

        const experiment = createSessionSimulation(sessionId, parameters)
        virtualTime.reset()

        connectSocketToExperiment(socket, sessionId)

        socket.emit('sessionStarted', {
          sessionId,
          running: true,
          experimentId: experiment.parameters.id,
        })
      }
    )

    socket.on('reset', () => {
      virtualTime.reset()

      if (isGlobalSimulationRunning) {
        globalExperiment = null
        createGlobalSimulation()

        globalMapWatchers.forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId)
          if (socket) {
            connectSocketToExperiment(socket)
          }
        })
      }

      io.emit('init')

      if (globalExperiment) {
        io.emit('parameters', globalExperiment.parameters)
      }
    })

    socket.on('carLayer', (val: boolean) => (socket.data.emitCars = val))

    socket.on('experimentParameters', (value: unknown) => {
      save(value as any)

      if (isGlobalSimulationRunning) {
        globalExperiment = null
        virtualTime.reset()
        createGlobalSimulation()

        globalMapWatchers.forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId)
          if (socket) {
            connectSocketToExperiment(socket)
          }
        })
      }

      io.emit('init')
      if (globalExperiment) {
        io.emit('parameters', globalExperiment.parameters)
      }
    })

    socket.on('disconnect', () => {
      globalMapWatchers.delete(socket.id)

      const sessionId = socketToSession.get(socket.id)
      if (sessionId) {
        socketToSession.delete(socket.id)
        const watchers = sessionWatchers.get(sessionId)
        if (watchers) {
          watchers.delete(socket.id)
          if (watchers.size === 0) {
            cleanupSession(sessionId)
          }
        }
      }
    })
  })
}

const api = { register }
export default api

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = api
