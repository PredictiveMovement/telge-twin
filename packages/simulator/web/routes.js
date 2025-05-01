const engine = require('../index')
const { save, read } = require('../config')
const { info } = require('../lib/log')
const { emitters, ignoreWelcomeMessage } = require('../config')
const cookie = require('cookie')
const moment = require('moment')
const fs = require('fs')
const path = require('path')
const { virtualTime } = require('../lib/virtualTime')

let experiment

function getUploadedFiles() {
  const uploadsDir = path.join(__dirname, '..', 'uploads')
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  try {
    return fs.readdirSync(uploadsDir).filter((file) => file.endsWith('.json'))
  } catch (error) {
    console.error('Error reading uploads directory:', error)
    return []
  }
}

function subscribe(experiment, socket) {
  const currentEmitters = emitters()
  return [
    currentEmitters.includes('bookings') &&
      require('./routes/bookings').register(experiment, socket),
    currentEmitters.includes('cars') &&
      require('./routes/cars').register(experiment, socket),
    currentEmitters.includes('municipalities') &&
      require('./routes/municipalities').register(experiment, socket),
    currentEmitters.includes('passengers') &&
      require('./routes/passengers').register(experiment, socket),
    currentEmitters.includes('postombud') &&
      require('./routes/postombud').register(experiment, socket),
    require('./routes/time').register(experiment, socket),
    require('./routes/log').register(experiment, socket),
  ]
    .filter((f) => f)
    .flat()
}

function start(socket, io) {
  const currentEmitters = emitters()
  if (!experiment) {
    experiment = engine.createExperiment({ defaultEmitters: currentEmitters })
    experiment.virtualTime
      .waitUntil(moment().endOf('day').valueOf())
      .then(() => {
        io.emit('reset')
        info('Experiment finished. Restarting...')
      })
  }
  socket.data.experiment = experiment
  if (socket.data.subscriptions) {
    socket.data.subscriptions.forEach((sub) => sub.unsubscribe())
  }
  socket.data.subscriptions = subscribe(experiment, socket)
}

function register(io) {
  if (ignoreWelcomeMessage) {
    io.engine.on('initial_headers', (headers) => {
      headers['set-cookie'] = cookie.serialize('hideWelcomeBox', 'true', {
        path: '/',
      })
    })
  }

  io.on('connection', function (socket) {
    start(socket, io)

    socket.data.experiment.parameters.initMapState = {
      latitude: parseFloat(process.env.LATITUDE) || 65.0964472642777,
      longitude: parseFloat(process.env.LONGITUDE) || 17.112050188704504,
      zoom: parseInt(process.env.ZOOM) || 5,
    }

    socket.data.emitCars = emitters().includes('cars')

    socket.emit('init')
    socket.on('reset', () => {
      info(
        'Manual reset of simulation, resetting time and recreating experiment'
      )
      virtualTime.reset()
      experiment = null
      start(socket, io)
      socket.emit('init')
      const params = read()
      socket.emit('parameters', params)
    })

    socket.on('carLayer', (val) => (socket.data.emitCars = val))
    socket.on('experimentParameters', (value) => {
      info('New expiriment settings: ', value)
      save(value)
      const params = read()
      socket.emit('parameters', params)

      info(
        'Experiment settings changed, resetting simulation time and recreating experiment'
      )
      virtualTime.reset()
      experiment = null
      start(socket, io)
      socket.emit('init')
    })

    socket.on('selectDataFile', (filename) => {
      info('Selected data file: ', filename)
      socket.data.selectedDataFile = filename
    })

    socket.on('saveDataFileSelection', (filename) => {
      info('Saving data file selection: ', filename)
      const params = read()

      params.selectedDataFile = filename
      save(params)
      socket.emit('parameters', params)

      info('Data file changed, resetting time and recreating experiment')
      virtualTime.reset()
      experiment = null
      start(socket, io)
      socket.emit('init')
    })

    socket.on('getUploadedFiles', () => {
      const files = getUploadedFiles()
      socket.emit('uploadedFiles', files)
    })

    socket.emit('parameters', socket.data.experiment.parameters)

    const files = getUploadedFiles()
    socket.emit('uploadedFiles', files)
    /* 
    
    This code is used to shut down the experiment if the client disconnects. it is currently disabled.
    It saves a lot of resources on the server, but it is also a bit annoying for the user.

    socket.on('connect', () => {
      if (socket.data.timeout) {
        info('Client connected again, cancelling shutdown')
        clearTimeout(socket.data.timeout)
      }
    })
*/
    /*socket.on('disconnect', (reason) => {
      info('Client disconnected', reason, 'Removing subscriptions..')
      socket.data.experiment.subscriptions.map((e) => e.unsubscribe())
    })*/
  })
}

module.exports = {
  register,
}
