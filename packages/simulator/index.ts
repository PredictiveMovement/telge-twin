import { filter, merge, share, shareReplay } from 'rxjs'
import { mergeMap, catchError } from 'rxjs/operators'

// Importing CommonJS modules using `require` to keep backward-compatibility while other files are still in JavaScript
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { virtualTime } = require('./lib/virtualTime')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { safeId } = require('./lib/id')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { read } = require('./config')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const statistics = require('./lib/statistics')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { info, error, logStream } = require('./lib/log')

export interface ExperimentParameters {
  id: string
  startDate: Date
  fixedRoute: number
  emitters?: any
  fleets: Record<string, any>
  selectedDataFile?: string
}

export interface Experiment {
  parameters: ExperimentParameters
  logStream: typeof logStream
  lineShapes: any
  municipalities: any
  dispatchedBookings: any
  cars: any
  bookingUpdates: any
  carUpdates: any
  subscriptions: Array<{ unsubscribe(): void }>
  virtualTime: typeof virtualTime
}

const engine = {
  subscriptions: [] as Array<{ unsubscribe(): void }>,
  createExperiment: (
    { defaultEmitters, id = safeId() } = {} as {
      defaultEmitters?: any
      id?: string
    }
  ): Experiment => {
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

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const regions = require('./streams/regions')(savedParams)

    const parameters: ExperimentParameters = {
      id,
      startDate: new Date(),
      fixedRoute: savedParams.fixedRoute || 100,
      emitters: defaultEmitters,
      fleets: savedParams.fleets,
      selectedDataFile: savedParams.selectedDataFile,
    }
    statistics.collectExperimentMetadata(parameters)
    const experiment: any = {
      logStream,
      lineShapes: regions.pipe(
        filter((region: any) => region.lineShapes),
        mergeMap((region: any) => region.lineShapes),
        shareReplay()
      ),
      municipalities: regions.pipe(
        mergeMap((region: any) => region.municipalities),
        shareReplay()
      ),
      subscriptions: [],
      virtualTime,
      dispatchedBookings: regions.pipe(
        mergeMap((region: any) => region.dispatchedBookings)
      ),

      // VEHICLES
      cars: regions.pipe(mergeMap((region: any) => region.cars)),

      parameters,
    }

    experiment.bookingUpdates = experiment.dispatchedBookings.pipe(
      mergeMap((booking: any) => booking.statusEvents),
      catchError((err: Error, caught: any) => {
        error('bookingUpdates', err)
        return caught
      }),
      shareReplay()
    )

    experiment.subscriptions.push(
      experiment.bookingUpdates.subscribe((booking: any) =>
        statistics.collectBooking(booking, parameters)
      )
    )

    // TODO: Rename to vehicleUpdates
    experiment.carUpdates = merge(
      // experiment.buses,
      experiment.cars
      // experiment.taxis,
    ).pipe(
      mergeMap((car: any) => car.movedEvents),
      catchError((err: Error) => error('car updates err', err)),

      share()
    )

    experiment.subscriptions.push(
      experiment.cars
        .pipe(mergeMap((car: any) => car.statusEvents))
        .subscribe((car: any) => statistics.collectCar(car, parameters))
    )

    return experiment
  },
}

export default engine

// Provide CommonJS compatibility so existing JavaScript files can still `require('../index')`
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
  module.exports = engine
}
