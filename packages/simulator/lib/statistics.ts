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
      experimentType: experiment.experimentType,
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
  const shouldSave = experimentSettings.experimentType !== 'replay'

  if (!shouldSave) {
    return Promise.resolve()
  }

  const normalizePosition = (pos: any) => {
    if (!pos || typeof pos !== 'object') return pos
    const lat = pos.lat
    const lon = pos.lon ?? pos.lng
    if (lat === undefined || lon === undefined) return pos
    return { lon: Number(lon), lat: Number(lat) }
  }

  const normalizeBookingForGeo = (doc: any) => {
    if (!doc || typeof doc !== 'object') return doc
    return {
      ...doc,
      position: normalizePosition(doc.position),
      pickupPosition: normalizePosition(doc.pickupPosition),
      deliveredPosition: normalizePosition(doc.deliveredPosition),
      pickup: doc.pickup
        ? { ...doc.pickup, position: normalizePosition(doc.pickup.position) }
        : undefined,
      destination: doc.destination
        ? {
            ...doc.destination,
            position: normalizePosition(doc.destination.position),
          }
        : undefined,
    }
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

  const baseDoc = {
    ...booking.toObject(),
    timestamp: virtualTime.now(),
    experimentSettings: cleanExperimentSettings,
    passenger: booking.passenger?.toObject(),
  }

  const normalized = normalizeBookingForGeo(baseDoc)

  return save(normalized, booking.id, 'bookings')
}

const collectCar = (car: any, experimentSettings: any) => {
  const shouldSave = experimentSettings.experimentType !== 'replay'

  if (!shouldSave) {
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
