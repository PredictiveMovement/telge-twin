import moment from 'moment'
import { Server, Socket } from 'socket.io'
import { filter, take } from 'rxjs/operators'
import { emitters } from '../config'
import { save } from '../config'
import { virtualTime } from '../lib/virtualTime'
import { safeId } from '../lib/id'
import { Client } from '@elastic/elasticsearch'

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

function createFleetConfigFromDataset(fleetConfigurations: any[]) {
  const fleets = fleetConfigurations.map((fleet) => {
    return {
      name: fleet.name,
      hubAddress: fleet.hubAddress || 'LERHAGA 50, 151 66 Södertälje',
      recyclingTypes: fleet.recyclingTypes,
      vehicles: fleet.vehicles,
      optimizedRoutes: true,
      compartmentConfiguration: fleet.compartmentConfiguration,
      swedishCategory: fleet.swedishCategory,
      vehicleIds: fleet.vehicleIds,
      assignedTurids: fleet.assignedTurids,
      bookingCount: fleet.bookingCount,
      source: fleet.source,
      templateId: fleet.templateId,
    }
  })

  console.log(`✅ Converted ${fleets.length} fleets successfully`)

  return {
    'Södertälje kommun': {
      settings: { optimizedRoutes: true },
      fleets,
    },
  }
}

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

    socket.on('saveRouteDataset', async (datasetData) => {
      try {
        const datasetId = safeId()
        const routeDataset = {
          datasetId,
          name: datasetData.name,
          description: datasetData.description || '',
          uploadTimestamp: new Date().toISOString(),
          originalFilename: datasetData.originalFilename,
          filterCriteria: datasetData.filterCriteria,
          recordCount: datasetData.routeData.length,
          originalRecordCount: datasetData.originalRecordCount,
          routeData: datasetData.routeData,
          status: 'ready',
          associatedExperiments: [],
          fleetConfiguration: datasetData.fleetConfiguration || null,
          originalSettings: datasetData.originalSettings || null,
        }

        await client.index({
          index: 'route-datasets',
          id: datasetId,
          body: routeDataset,
        })

        await client.indices.refresh({ index: 'route-datasets' })

        socket.emit('routeDatasetSaved', {
          success: true,
          datasetId,
          dataset: routeDataset,
        })
      } catch (error) {
        console.error('Error saving route dataset:', error)
        socket.emit('routeDatasetSaved', {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    socket.on('getRouteDatasets', async () => {
      try {
        const response = await client.search({
          index: 'route-datasets',
          body: {
            query: { match_all: {} },
            sort: [{ uploadTimestamp: { order: 'desc' } }],
            size: 100,
          },
        })

        const datasets = response.body.hits.hits.map((hit: any) => ({
          id: hit._id,
          ...hit._source,
        }))

        socket.emit('routeDatasets', datasets)
      } catch (error) {
        console.error('Error fetching route datasets:', error)
        socket.emit('routeDatasets', [])
      }
    })

    socket.on('deleteRouteDataset', async (datasetId) => {
      try {
        await client.delete({
          index: 'route-datasets',
          id: datasetId,
        })

        await client.indices.refresh({ index: 'route-datasets' })

        socket.emit('routeDatasetDeleted', {
          success: true,
          datasetId,
        })
      } catch (error) {
        console.error('Error deleting route dataset:', error)
        socket.emit('routeDatasetDeleted', {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    socket.on('getExperiments', async () => {
      try {
        const response = await client.search({
          index: 'experiments',
          body: {
            query: { match_all: {} },
            sort: [{ startDate: { order: 'desc' } }],
            size: 100,
          },
        })

        const experiments = response.body.hits.hits.map((hit: any) => ({
          id: hit._id,
          ...hit._source,
        }))

        socket.emit('experiments', experiments)
      } catch (error) {
        console.error('Error fetching experiments:', error)
        socket.emit('experiments', [])
      }
    })

    socket.on('startSimulation', async (simData, parameters) => {
      const experimentId = parameters?.id || safeId()

      let datasetFleetConfig = null
      if (simData.sourceDatasetId) {
        try {
          const datasetResponse = await client.get({
            index: 'route-datasets',
            id: simData.sourceDatasetId,
          })
          const dataset = datasetResponse.body._source
          datasetFleetConfig = dataset.fleetConfiguration
          console.log(
            '💾 Använder fleet configuration från dataset:',
            datasetFleetConfig?.length || 0,
            'fleets'
          )
        } catch (error) {
          console.warn(
            '⚠️ Kunde inte hämta dataset fleet config, använder default'
          )
        }
      }

      const fleetConfig = createFleetConfigFromDataset(datasetFleetConfig)

      globalExperiment = null
      createGlobalSimulation({
        ...parameters,
        sourceDatasetId: simData.sourceDatasetId,
        datasetName: simData.datasetName,
        routeDataSource: 'elasticsearch',
        fleets: fleetConfig,
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
        experimentId,
      })
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
