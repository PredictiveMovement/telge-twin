import path from 'path'
import fs from 'fs'
import cookie from 'cookie'
import moment from 'moment'
import { Server, Socket } from 'socket.io'
import { filter, take } from 'rxjs/operators'
import { emitters } from '../config'
import { save, read } from '../config'
import { virtualTime } from '../lib/virtualTime'
import { safeId } from '../lib/id'

// Data collectors for stats
const collectedData = {
  bookings: new Set(),
  vehicles: new Set(),
  lastReset: Date.now(),
}

let globalExperiment: any = null
let isSimulationRunning = false
const mapWatchers = new Set<string>()

// CJS engine import to keep compatibility
// eslint-disable-next-line @typescript-eslint/no-var-requires
const engine: {
  createExperiment: (opts: unknown) => unknown
} = require('../index')

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

function getUploadedFiles(): string[] {
  const uploadsDir = path.join(__dirname, '..', 'uploads')
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }
  try {
    return fs.readdirSync(uploadsDir).filter((file) => file.endsWith('.json'))
  } catch (err) {
    console.error('Error reading uploads directory:', err)
    return []
  }
}

function getOrCreateGlobalExperiment() {
  if (!globalExperiment) {
    const currentEmitters = emitters()
    globalExperiment = engine.createExperiment({
      defaultEmitters: currentEmitters,
      id: read().id,
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
  }
  return globalExperiment
}

function stopGlobalSimulation() {
  if (globalExperiment) {
    globalExperiment = null
    isSimulationRunning = false

    collectedData.bookings.clear()
    collectedData.vehicles.clear()
    collectedData.lastReset = Date.now()

    mapWatchers.forEach((socketId) => {
      const socket = require('socket.io').sockets.sockets.get(socketId)
      if (socket) {
        socket.emit('simulationStopped')
      }
    })
  }
}

function connectSocketToGlobalExperiment(socket: Socket) {
  const experiment = getOrCreateGlobalExperiment()

  socket.data.experiment = experiment

  if (socket.data.subscriptions) {
    socket.data.subscriptions.forEach((sub: { unsubscribe(): void }) =>
      sub.unsubscribe()
    )
  }

  socket.data.subscriptions = subscribe(experiment, socket)

  socket.emit('parameters', experiment.parameters)
}

// -----------------------------------------------------------------------------
// Dynamic sub-route registration
// -----------------------------------------------------------------------------

function subscribe(experiment: any, socket: Socket): Array<unknown> {
  const currentEmitters = emitters()
  const routes: Array<unknown> = []

  if (currentEmitters.includes('bookings')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bookingsRoute = require('./routes/bookings.ts').register(
      experiment,
      socket
    )

    // Add a collector for bookings
    if (experiment.dispatchedBookings) {
      experiment.dispatchedBookings.subscribe((booking: any) => {
        if (booking && booking.id) {
          collectedData.bookings.add(booking.id)
        }
      })
    }

    routes.push(bookingsRoute)
  }
  if (currentEmitters.includes('cars')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const carsRoute = require('./routes/cars.ts').register(experiment, socket)

    // Add a collector for vehicles
    if (experiment.cars) {
      experiment.cars.subscribe((car: any) => {
        if (car && car.id) {
          collectedData.vehicles.add(car.id)
        }
      })
    }

    routes.push(carsRoute)
  }
  if (currentEmitters.includes('municipalities')) {
    routes.push(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('./routes/municipalities.ts').register(experiment, socket)
    )
  }
  if (currentEmitters.includes('passengers')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    routes.push(require('./routes/passengers').register(experiment, socket))
  }
  if (currentEmitters.includes('postombud')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    routes.push(require('./routes/postombud').register(experiment, socket))
  }

  // Always include time and log routes
  routes.push(require('./routes/time.ts').register(experiment, socket))
  routes.push(require('./routes/log.ts').register(experiment, socket))

  // Flatten and filter falsey
  return routes.flat().filter(Boolean)
}

// -----------------------------------------------------------------------------
// Public API (register)
// -----------------------------------------------------------------------------

// Helper flag: read once to determine if welcome message should be hidden
const IGNORE_WELCOME_MESSAGE = Boolean(process.env.IGNORE_WELCOME_BOX)

function register(io: Server): void {
  if (IGNORE_WELCOME_MESSAGE) {
    io.engine.on('initial_headers', (headers) => {
      headers['set-cookie'] = cookie.serialize('hideWelcomeBox', 'true', {
        path: '/',
      })
    })
  }

  io.on('connection', (socket: Socket) => {
    socket.data.emitCars = emitters().includes('cars')

    socket.on('startSimulation', (simData, parameters) => {
      const experimentId = parameters?.id || safeId()
      const currentEmitters = emitters()
      const paramsToSave = {
        ...parameters,
        id: experimentId,
        emitters: currentEmitters,
      }

      globalExperiment = null
      getOrCreateGlobalExperiment()
      isSimulationRunning = true

      virtualTime.reset()

      mapWatchers.forEach((socketId) => {
        const socket = io.sockets.sockets.get(socketId)
        if (socket) {
          connectSocketToGlobalExperiment(socket)
        }
      })

      collectedData.bookings.clear()
      collectedData.vehicles.clear()
      collectedData.lastReset = Date.now()

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
      mapWatchers.add(socket.id)
      socket.data.isWatchingMap = true

      if (isSimulationRunning) {
        connectSocketToGlobalExperiment(socket)
      }

      socket.emit('simulationStatus', {
        running: isSimulationRunning,
        experimentId: globalExperiment?.parameters?.id,
      })
    })

    socket.on('leaveMap', () => {
      mapWatchers.delete(socket.id)
      socket.data.isWatchingMap = false

      if (socket.data.subscriptions) {
        socket.data.subscriptions.forEach((sub: { unsubscribe(): void }) =>
          sub.unsubscribe()
        )
        socket.data.subscriptions = []
      }
    })

    socket.on('reset', () => {
      virtualTime.reset()

      if (isSimulationRunning) {
        globalExperiment = null
        getOrCreateGlobalExperiment()

        mapWatchers.forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId)
          if (socket) {
            connectSocketToGlobalExperiment(socket)
          }
        })
      }

      collectedData.bookings.clear()
      collectedData.vehicles.clear()
      collectedData.lastReset = Date.now()

      io.emit('init')

      if (globalExperiment) {
        io.emit('parameters', globalExperiment.parameters)
      }
    })

    socket.on('carLayer', (val: boolean) => (socket.data.emitCars = val))

    socket.on('experimentParameters', (value: unknown) => {
      save(value as any)

      if (isSimulationRunning) {
        globalExperiment = null
        virtualTime.reset()
        getOrCreateGlobalExperiment()

        mapWatchers.forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId)
          if (socket) {
            connectSocketToGlobalExperiment(socket)
          }
        })
      }

      io.emit('init')
      if (globalExperiment) {
        io.emit('parameters', globalExperiment.parameters)
      }
    })

    socket.on('selectDataFile', (filename: string) => {
      socket.data.selectedDataFile = filename
    })

    socket.on('saveDataFileSelection', (filename: string) => {
      const params = read()
      params.selectedDataFile = filename
      save(params)

      if (isSimulationRunning) {
        globalExperiment = null
        virtualTime.reset()
        getOrCreateGlobalExperiment()

        mapWatchers.forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId)
          if (socket) {
            connectSocketToGlobalExperiment(socket)
          }
        })
      }

      io.emit('init')
      if (globalExperiment) {
        io.emit('parameters', globalExperiment.parameters)
      }
    })

    socket.on('getUploadedFiles', () => {
      const files = getUploadedFiles()
      socket.emit('uploadedFiles', files)
    })

    socket.on('getBookingsAndVehicles', () => {
      const bookingsCount = collectedData.bookings.size
      const vehiclesCount = collectedData.vehicles.size

      let bookings: any[] = []
      let vehicles: any[] = []

      if (collectedData.bookings.size > 0) {
        bookings = Array.from(collectedData.bookings).map((id) => ({ id }))
      }

      if (collectedData.vehicles.size > 0) {
        vehicles = Array.from(collectedData.vehicles).map((id) => ({ id }))
      }

      socket.emit('bookingsAndVehiclesData', {
        bookings,
        vehicles,
        stats: {
          bookingsCount,
          vehiclesCount,
        },
      })
    })

    socket.on('disconnect', () => {
      mapWatchers.delete(socket.id)
    })
  })
}

// -----------------------------------------------------------------------------
// Module exports (CJS + TS default)
// -----------------------------------------------------------------------------

const api = { register }
export default api

// CommonJS fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = api
