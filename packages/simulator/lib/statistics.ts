export {}

const { save } = require('./elastic')
const { virtualTime } = require('./virtualTime')

const collectExperimentMetadata = async (experiment: any) => {
  try {
    const result = await save(experiment, experiment.id, 'experiments')
    return result
  } catch (err) {
    console.error(`❌ Failed to save experiment to ES: ${experiment.id}`, err)
    throw err
  }
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
