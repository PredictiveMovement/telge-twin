const { save } = require('./elastic')

const collectExperimentMetadata = (experiment) => {
  return save(experiment, experiment.id, 'experiments')
}

const collectBooking = (booking, experimentSettings) => {
  return save(
    {
      ...booking.toObject(),
      timestamp: new Date(),
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
      timestamp: new Date(),
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
