import {
  map,
  bufferTime,
  filter,
  last,
  mergeMap,
  groupBy,
  windowTime,
} from 'rxjs'
import type { Socket } from 'socket.io'

type CarInput = {
  id: string
  position: { lon: number; lat: number }
  altitude?: number
  destination?: { lon: number; lat: number }
  speed: number
  bearing: number
  status: string
  fleet?: { name: string }
  cargo: unknown[]
  parcelCapacity?: number
  queue: unknown[]
  co2: number
  distance: number
  ema: unknown
  eta: unknown
  vehicleType: string
  recyclingTypes?: string[]
  delivered: unknown[]
}

function cleanCars(car: CarInput) {
  const {
    position: { lon, lat },
    id,
    altitude,
    destination,
    speed,
    bearing,
    status,
    fleet,
    cargo,
    parcelCapacity,
    queue,
    co2,
    distance,
    ema,
    eta,
    vehicleType,
    recyclingTypes,
    delivered,
  } = car

  return {
    id,
    destination: destination ? [destination.lon, destination.lat] : null,
    speed,
    bearing,
    position: [lon, lat, altitude ?? 0],
    status,
    fleet: fleet?.name ?? 'Privat',
    co2,
    distance,
    ema,
    eta,
    cargo: cargo.length,
    queue: queue.length,
    parcelCapacity,
    vehicleType,
    recyclingTypes,
    delivered: delivered.length,
  }
}

export function register(experiment: any, socket: Socket) {
  return [
    experiment.cars.pipe(map(cleanCars)).subscribe((car: unknown) => {
      socket.emit('cars', [car])
    }),
    experiment.carUpdates
      .pipe(
        windowTime(100),
        mergeMap((win: any) =>
          win.pipe(
            groupBy((car: CarInput) => car.id),
            mergeMap((cars: any) => cars.pipe(last()))
          )
        ),
        filter((car: CarInput | undefined | null) => {
          if (!car) return false
          if (car.vehicleType === 'car' && !socket.data.emitCars) return false
          return true
        }),
        map(cleanCars),
        map((vehicle: unknown) => ({
          experimentId: experiment.parameters.id,
          ...(vehicle as Record<string, unknown>),
        })),
        bufferTime(100, undefined, 100)
      )
      .subscribe((cars: unknown[]) => {
        if (!cars.length) return
        socket.volatile.emit('cars', cars)
      }),
  ]
}

export default { register }

// cjs fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = { register }
