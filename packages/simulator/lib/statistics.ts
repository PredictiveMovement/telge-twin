export {}

const { save } = require('./elastic')
const { virtualTime } = require('./virtualTime')

const collectExperimentMetadata = (experiment: any) => {
  return save(experiment, experiment.id, 'experiments')
}

const collectBooking = (booking: any, experimentSettings: any) => {
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

const collectCar = (car: any, experimentSettings: any) => {
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
