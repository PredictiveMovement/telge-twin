import path from 'path'
import fs from 'fs'
import cookie from 'cookie'
import moment from 'moment'
import { Server, Socket } from 'socket.io'
import { filter, take, toArray, map } from 'rxjs/operators'
import { emitters } from '../config'
import { save, read } from '../config'
import { info } from '../lib/log'
import { virtualTime } from '../lib/virtualTime'
import { firstValueFrom } from 'rxjs'

// Data collectors for stats
const collectedData = {
  bookings: new Set(),
  vehicles: new Set(),
  lastReset: Date.now(),
}

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

// -----------------------------------------------------------------------------
// Dynamic sub-route registration
// -----------------------------------------------------------------------------

function subscribe(experiment: any, socket: Socket): Array<unknown> {
  const currentEmitters = emitters()

  // Import sub-routes lazily to avoid circular deps during compile
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

function start(socket: Socket, io: Server) {
  const currentEmitters = emitters()
  let experiment: any = (socket.data as any).experiment // may be undefined initially

  if (!experiment) {
    experiment = engine.createExperiment({ defaultEmitters: currentEmitters })
    let endOfDaySubscription = experiment.virtualTime
      .getTimeStream()
      .pipe(
        filter((time: number) => time >= moment().endOf('day').valueOf()),
        take(1)
      )
      .subscribe(() => {
        io.emit('reset')
        info('Experiment finished. Restarting...')
        endOfDaySubscription.unsubscribe()
      })
  }

  socket.data.experiment = experiment

  if (socket.data.subscriptions) {
    socket.data.subscriptions.forEach((sub: { unsubscribe(): void }) =>
      sub.unsubscribe()
    )
  }
  socket.data.subscriptions = subscribe(experiment, socket)
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
    start(socket, io)

    // Default map settings from env
    socket.data.experiment.parameters.initMapState = {
      latitude: parseFloat(process.env.LATITUDE || '65.0964472642777'),
      longitude: parseFloat(process.env.LONGITUDE || '17.112050188704504'),
      zoom: parseInt(process.env.ZOOM || '5', 10),
    }

    socket.data.emitCars = emitters().includes('cars')

    socket.emit('init')

    socket.on('reset', () => {
      info('Manual reset of simulation, recreating experiment')
      virtualTime.reset()
      io.sockets.sockets.forEach((s) => start(s as Socket, io))
      io.emit('init')
      const params = read()
      io.emit('parameters', params)

      // Clear the collected data
      collectedData.bookings.clear()
      collectedData.vehicles.clear()
      collectedData.lastReset = Date.now()
    })

    socket.on('carLayer', (val: boolean) => (socket.data.emitCars = val))

    socket.on('experimentParameters', (value: unknown) => {
      info('New experiment settings:', value)
      save(value as any)
      const params = read()
      io.emit('parameters', params)
      virtualTime.reset()
      io.sockets.sockets.forEach((s) => start(s as Socket, io))
      io.emit('init')
    })

    socket.on('selectDataFile', (filename: string) => {
      info('Selected data file:', filename)
      socket.data.selectedDataFile = filename
    })

    socket.on('saveDataFileSelection', (filename: string) => {
      info('Saving data file selection:', filename)
      const params = read()
      params.selectedDataFile = filename
      save(params)
      io.emit('parameters', params)
      virtualTime.reset()
      io.sockets.sockets.forEach((s) => start(s as Socket, io))
      io.emit('init')
    })

    socket.on('getUploadedFiles', () => {
      const files = getUploadedFiles()
      socket.emit('uploadedFiles', files)
    })

    socket.on('getBookingsAndVehicles', () => {
      const bookingsCount = collectedData.bookings.size
      const vehiclesCount = collectedData.vehicles.size

      // Get the experiment to extract detailed data
      const experiment = socket.data.experiment
      let bookings: any[] = []
      let vehicles: any[] = []

      if (experiment) {
        // Get vehicles data from socket if available
        if (socket.data.cars && socket.data.cars.length > 0) {
          vehicles = socket.data.cars
        }

        // Get bookings data from socket if available
        if (socket.data.bookings && socket.data.bookings.length > 0) {
          bookings = socket.data.bookings
        }

        // If we have fleets, we can try to get data directly from them
        if (
          experiment.fleets &&
          (bookings.length === 0 || vehicles.length === 0)
        ) {
          try {
            // Get all the active bookings from all fleets
            const allBookings: any[] = []
            const allVehicles: any[] = []

            Object.values(experiment.fleets).forEach((fleet: any) => {
              // Try to get the current bookings
              if (fleet.unhandledBookings && fleet.unhandledBookings._events) {
                allBookings.push(...fleet.unhandledBookings._events)
              }
              if (
                fleet.dispatchedBookings &&
                fleet.dispatchedBookings._events
              ) {
                allBookings.push(...fleet.dispatchedBookings._events)
              }

              // Try to get the vehicles/cars
              if (fleet.cars && fleet.cars._events) {
                allVehicles.push(...fleet.cars._events)
              }
            })

            if (allBookings.length > 0 && bookings.length === 0) {
              bookings = allBookings
            }

            if (allVehicles.length > 0 && vehicles.length === 0) {
              vehicles = allVehicles
            }
          } catch (e) {
            // Ignore errors
          }
        }

        // If we still don't have data, convert the collected IDs to objects
        if (bookings.length === 0 && collectedData.bookings.size > 0) {
          bookings = Array.from(collectedData.bookings).map((id) => ({ id }))
        }

        if (vehicles.length === 0 && collectedData.vehicles.size > 0) {
          vehicles = Array.from(collectedData.vehicles).map((id) => ({ id }))
        }
      }

      // Send all data to the client
      socket.emit('bookingsAndVehiclesData', {
        bookings,
        vehicles,
        stats: {
          bookingsCount,
          vehiclesCount,
        },
      })
    })

    socket.emit('parameters', socket.data.experiment.parameters)
    socket.emit('uploadedFiles', getUploadedFiles())
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
