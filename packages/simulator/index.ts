import { filter, merge, share, shareReplay } from 'rxjs'
import { mergeMap, catchError } from 'rxjs/operators'

// Importing CommonJS modules using `require` to keep backward-compatibility while other files are still in JavaScript
const { virtualTime } = require('./lib/virtualTime')
const { safeId } = require('./lib/id')
const { read } = require('./config')
const statistics = require('./lib/statistics')
const { info, error, logStream } = require('./lib/log')

export interface ExperimentParameters {
  id: string
  startDate: Date
  createdAt?: Date
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
    {
      defaultEmitters,
      id = safeId(),
      directParams = null,
      virtualTime: customVirtualTime = null,
    } = {} as {
      defaultEmitters?: any
      id?: string
      directParams?: any & { isReplay?: boolean }
      virtualTime?: any
    }
  ): Experiment => {
    engine.subscriptions.forEach((subscription) => subscription.unsubscribe())

    const savedParams = directParams || read()
    const params = {
      ...savedParams,
      id: id,
      virtualTime: customVirtualTime,
    }

    info(`Starting experiment ${id}`, {
      id: params.id,
      source: directParams ? 'direct params' : 'config file',
    })

    const regions = require('./streams/regions')(params)

    const parameters: ExperimentParameters = {
      id,
      startDate: directParams?.startDate
        ? new Date(directParams.startDate)
        : new Date(),
      createdAt: new Date(),
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
        .then(() => info(`Saved experiment metadata: ${id}`))
        .catch((err: any) => error(`Error saving experiment metadata: ${err}`))
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
      virtualTime: customVirtualTime || virtualTime,
      dispatchedBookings: regions.pipe(
        mergeMap((region: any) => region.dispatchedBookings)
      ),
      cars: regions.pipe(mergeMap((region: any) => region.cars)),
      parameters,
    }

    experiment.bookingUpdates = experiment.dispatchedBookings.pipe(
      filter((booking: any) => booking && booking.statusEvents),
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

    experiment.carUpdates = merge(experiment.cars).pipe(
      // Emit updates on movement, status changes and cargo/compartment changes
      mergeMap((car: any) => merge(car.movedEvents, car.statusEvents, car.cargoEvents)),
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
