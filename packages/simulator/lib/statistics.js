const { save } = require('./elastic')
const virtualTime = require('./virtualTime')

const collectExperimentMetadata = (experiment) => {
  return save(experiment, experiment.id, 'experiments')
}

const collectBooking = (booking, experimentSettings) => {
  return save(
    {
      ...booking.toObject(),
      timestamp: virtualTime.now(),
      experimentSettings,
      passenger: booking.passenger?.toObject(),
    },
    booking.id,
    'bookings'
  )
}

const collectCar = (car, experimentSettings) => {
  return save(
    {
      ...car.toObject(),
      timestamp: virtualTime.now(),
      experimentSettings,
    },
    car.id,
    'cars'
  )
}

module.exports = {
  collectExperimentMetadata,
  collectBooking,
  collectCar,
}
