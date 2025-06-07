export {}

const { save } = require('./elastic')
const { virtualTime } = require('./virtualTime')

const collectExperimentMetadata = async (experiment: any) => {
  try {
    const cleanExperiment = {
      id: experiment.id,
      startDate: experiment.startDate,
      fixedRoute: experiment.fixedRoute,
      emitters: experiment.emitters,
      sourceDatasetId: experiment.sourceDatasetId,
      datasetName: experiment.datasetName,
      routeDataSource: experiment.routeDataSource,
      simulationStatus: experiment.simulationStatus,
      initMapState: experiment.initMapState,
      fleets: experiment.fleets
        ? Object.keys(experiment.fleets).reduce((acc: any, key: string) => {
            const fleet = experiment.fleets[key]
            acc[key] = {
              settings: fleet.settings || {},
              fleets: fleet.fleets
                ? fleet.fleets.map((f: any) => ({
                    name: f.name,
                    hubAddress: f.hubAddress,
                    recyclingTypes: f.recyclingTypes,
                    vehicleCount: f.vehicles ? f.vehicles.length : 0,
                    bookingCount: f.bookingCount,
                    source: f.source,
                  }))
                : [],
            }
            return acc
          }, {})
        : {},
    }

    const result = await save(cleanExperiment, experiment.id, 'experiments')
    return result
  } catch (err) {
    console.error(`❌ Failed to save experiment to ES: ${experiment.id}`, err)
    throw err
  }
}

const collectBooking = (booking: any, experimentSettings: any) => {
  const saveToElastic =
    experimentSettings.fleets?.['Södertälje kommun']?.settings?.saveToElastic ??
    true

  if (!saveToElastic) {
    return Promise.resolve()
  }

  const cleanExperimentSettings = {
    id: experimentSettings.id,
    startDate: experimentSettings.startDate,
    fixedRoute: experimentSettings.fixedRoute,
    emitters: experimentSettings.emitters,
    sourceDatasetId: experimentSettings.sourceDatasetId,
    datasetName: experimentSettings.datasetName,
    routeDataSource: experimentSettings.routeDataSource,
    simulationStatus: experimentSettings.simulationStatus,
    initMapState: experimentSettings.initMapState,
  }

  return save(
    {
      ...booking.toObject(),
      timestamp: virtualTime.now(),
      experimentSettings: cleanExperimentSettings,
      passenger: booking.passenger?.toObject(),
    },
    booking.id,
    'bookings'
  )
}

const collectCar = (car: any, experimentSettings: any) => {
  const saveToElastic =
    experimentSettings.fleets?.['Södertälje kommun']?.settings?.saveToElastic ??
    true

  if (!saveToElastic) {
    return Promise.resolve()
  }

  const cleanExperimentSettings = {
    id: experimentSettings.id,
    startDate: experimentSettings.startDate,
    fixedRoute: experimentSettings.fixedRoute,
    emitters: experimentSettings.emitters,
    sourceDatasetId: experimentSettings.sourceDatasetId,
    datasetName: experimentSettings.datasetName,
    routeDataSource: experimentSettings.routeDataSource,
    simulationStatus: experimentSettings.simulationStatus,
    initMapState: experimentSettings.initMapState,
  }

  return save(
    {
      ...car.toObject(),
      timestamp: virtualTime.now(),
      experimentSettings: cleanExperimentSettings,
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
