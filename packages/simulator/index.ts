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
  sourceDatasetId?: string
  datasetName?: string
  routeDataSource?: string
  simulationStatus?: string
  experimentType?: string
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
    { defaultEmitters, id = safeId(), directParams = null } = {} as {
      defaultEmitters?: any
      id?: string
      directParams?: any & { isReplay?: boolean }
    }
  ): Experiment => {
    console.log('Creating experiment')
    engine.subscriptions.forEach((subscription) => subscription.unsubscribe())

    const savedParams = directParams || read()
    const params = {
      ...savedParams,
      id: id,
    }

    info(`*** Starting experiment ${id} with params:`, {
      id: params.id,
      fixedRoute: params.fixedRoute,
      emitters: params.emitters,
      municipalities: Object.keys(params.fleets).map((municipality) => {
        return `${municipality} (${params.fleets[municipality].fleets.length} fleets)`
      }),
      source: directParams ? 'direct params' : 'config file',
    })

    const regions = require('./streams/regions')(params)

    const parameters: ExperimentParameters = {
      id,
      startDate: directParams?.startDate
        ? new Date(directParams.startDate)
        : new Date(),
      fixedRoute: savedParams.fixedRoute || 100,
      emitters: directParams?.emitters || defaultEmitters,
      fleets: savedParams.fleets || {},
      sourceDatasetId: directParams?.sourceDatasetId,
      datasetName: directParams?.datasetName,
      routeDataSource: directParams?.routeDataSource,
      simulationStatus: 'running',
      experimentType: directParams?.experimentType,
    }

    if (!directParams?.isReplay) {
      statistics
        .collectExperimentMetadata(parameters)
        .then(() =>
          info(`✅ Successfully saved experiment metadata for: ${id}`)
        )
        .catch((err: any) =>
          error(`❌ Error saving experiment metadata: ${err}`)
        )
    } else {
      info(`🔄 Skipping experiment metadata save for replay: ${id}`)
    }
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
