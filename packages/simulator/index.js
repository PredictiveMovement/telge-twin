const { filter, share, merge, shareReplay } = require('rxjs')
const { mergeMap, catchError } = require('rxjs/operators')

const { virtualTime } = require('./lib/virtualTime')
const { safeId } = require('./lib/id')
const { read } = require('./config')
const statistics = require('./lib/statistics')
const { info, error, logStream } = require('./lib/log')

const engine = {
  subscriptions: [],
  createExperiment: ({ defaultEmitters, id = safeId() } = {}) => {
    console.log('Creating experiment')
    engine.subscriptions.forEach((subscription) => subscription.unsubscribe())
    const savedParams = read()
    info(`*** Starting experiment ${id} with params:`, {
      id: savedParams.id,
      fixedRoute: savedParams.fixedRoute,
      emitters: savedParams.emitters,
      municipalities: Object.keys(savedParams.fleets).map((municipality) => {
        return `${municipality} (${savedParams.fleets[municipality].fleets.length} fleets)`
      }),
    })

    const regions = require('./streams/regions')(savedParams)

    const parameters = {
      id,
      startDate: new Date(),
      fixedRoute: savedParams.fixedRoute || 100,
      emitters: defaultEmitters,
      fleets: savedParams.fleets,
    }
    statistics.collectExperimentMetadata(parameters)
    const experiment = {
      logStream,
      lineShapes: regions.pipe(
        filter((region) => region.lineShapes),
        mergeMap((region) => region.lineShapes),
        shareReplay()
      ),
      municipalities: regions.pipe(
        mergeMap((region) => region.municipalities),
        shareReplay()
      ),
      subscriptions: [],
      virtualTime,
      dispatchedBookings: regions.pipe(
        mergeMap((region) => region.dispatchedBookings)
      ),

      // VEHICLES
      cars: regions.pipe(mergeMap((region) => region.cars)),

      parameters,
    }

    experiment.bookingUpdates = experiment.dispatchedBookings.pipe(
      mergeMap((booking) => booking.statusEvents),
      catchError((err, caught) => {
        error('bookingUpdates', err)
        return caught
      }),
      share()
    )
    experiment.subscriptions.push(
      experiment.bookingUpdates.subscribe((booking) =>
        statistics.collectBooking(booking, parameters)
      )
    )

    experiment.subscriptions.push(
      experiment.cars.subscribe((car) => statistics.collectCar(car, parameters))
    )

    // TODO: Rename to vehicleUpdates
    experiment.carUpdates = merge(
      // experiment.buses,
      experiment.cars
      // experiment.taxis,
    ).pipe(
      mergeMap((car) => car.movedEvents),
      catchError((err) => error('car updates err', err)),

      share()
    )

    return experiment
  },
}

module.exports = engine
