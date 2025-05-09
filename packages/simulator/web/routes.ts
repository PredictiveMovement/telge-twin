import path from 'path'
import fs from 'fs'
import cookie from 'cookie'
import moment from 'moment'
import { Server, Socket } from 'socket.io'
import { filter, take } from 'rxjs/operators'
import { emitters } from '../config'
import { save, read } from '../config'
import { info } from '../lib/log'
import { virtualTime } from '../lib/virtualTime'

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

function subscribe(experiment: unknown, socket: Socket): Array<unknown> {
  const currentEmitters = emitters()

  // Import sub-routes lazily to avoid circular deps during compile
  const routes: Array<unknown> = []

  if (currentEmitters.includes('bookings')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    routes.push(require('./routes/bookings.ts').register(experiment, socket))
  }
  if (currentEmitters.includes('cars')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    routes.push(require('./routes/cars.ts').register(experiment, socket))
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
