import {
  pipe,
  map,
  filter,
  tap,
  mergeMap,
  scan,
  startWith,
  combineLatest,
  throttleTime,
} from 'rxjs'
import type { Socket } from 'socket.io'

const count = () => pipe(scan((acc: number) => acc + 1, 0))

export function register(experiment: any, socket: Socket) {
  return [
    experiment.municipalities
      .pipe(
        tap(({ id, name, geometry, co2 }: any) =>
          socket.emit('municipality', { id, name, geometry, co2 })
        ),
        mergeMap(({ id, dispatchedBookings, name, cars }: any) => {
          // Passenger delivery stats
          const passengerDeliveryStatistics = dispatchedBookings.pipe(
            mergeMap((booking: any) => booking.deliveredEvents),
            filter((booking: any) => booking.type === 'passenger'),
            filter((b: any) => b.cost),
            scan(
              (
                { total, deliveryTimeTotal, totalCost }: any,
                { deliveryTime, cost }: any
              ) => ({
                total: total + 1,
                totalCost: totalCost + cost,
                deliveryTimeTotal: deliveryTimeTotal + deliveryTime,
              }),
              { total: 0, totalCost: 0, deliveryTimeTotal: 0 }
            ),
            startWith({ total: 0, totalCost: 0, deliveryTimeTotal: 0 }),
            map(({ total, totalCost, deliveryTimeTotal }) => ({
              totalDelivered: total,
              totalCost,
              averagePassengerCost: total ? totalCost / total : 0,
              averagePassengerDeliveryTime: total
                ? deliveryTimeTotal / total / 60 / 60
                : 0,
            }))
          )

          // Parcel delivery stats
          const parcelDeliveryStatistics = dispatchedBookings.pipe(
            mergeMap((booking: any) => booking.deliveredEvents),
            scan(
              (
                { total, deliveryTimeTotal, totalCost }: any,
                { deliveryTime, cost }: any
              ) => ({
                total: total + 1,
                totalCost: totalCost + cost,
                deliveryTimeTotal: deliveryTimeTotal + deliveryTime,
              }),
              { total: 0, totalCost: 0, deliveryTimeTotal: 0 }
            ),
            startWith({ total: 0, totalCost: 0, deliveryTimeTotal: 0 }),
            map(({ total, totalCost, deliveryTimeTotal }) => ({
              totalDelivered: total,
              totalCost,
              averageParcelCost: total ? totalCost / total : 0,
              averageParcelDeliveryTime: total
                ? deliveryTimeTotal / total / 60 / 60
                : 0,
            }))
          )

          const averageUtilization = cars.pipe(
            mergeMap((car: any) => car.cargoEvents),
            scan((acc: any, car: any) => ({ ...acc, [car.id]: car }), {}),
            map((carsObj: Record<string, any>) =>
              Object.values(carsObj).reduce(
                (acc: any, car: any) => ({
                  totalCargo: acc.totalCargo + car.cargo.length,
                  totalParcelCapacity:
                    acc.totalParcelCapacity + (car.parcelCapacity || 0),
                  totalPassengerCapacity:
                    acc.totalPassengerCapacity + (car.passengerCapacity || 0),
                  totalCo2: acc.totalCo2 + car.co2,
                }),
                {
                  totalCargo: 0,
                  totalParcelCapacity: 0,
                  totalPassengerCapacity: 0,
                  totalCo2: 0,
                }
              )
            ),
            map(
              ({
                totalCargo,
                totalParcelCapacity,
                totalPassengerCapacity,
                totalCo2,
              }) => ({
                totalCargo,
                totalParcelCapacity,
                totalPassengerCapacity,
                averagePassengerLoad: totalPassengerCapacity
                  ? totalCargo / totalPassengerCapacity
                  : 0,
                averageParcelLoad: totalParcelCapacity
                  ? totalCargo / totalParcelCapacity
                  : 0,
                totalCo2,
              })
            ),
            startWith({
              totalCargo: 0,
              totalParcelCapacity: 0,
              totalPassengerCapacity: 0,
              averageParcelLoad: 0,
              averagePassengerLoad: 0,
              totalCo2: 0,
            })
          )

          const totalCars = cars.pipe(count(), startWith(0))

          const totalPassengerCapacity = cars.pipe(
            filter((car: any) => car.passengerCapacity),
            scan((a: number, car: any) => a + car.passengerCapacity, 0),
            startWith(0)
          )

          const totalParcelCapacity = cars.pipe(
            filter((car: any) => car.parcelCapacity),
            scan((a: number, car: any) => a + car.parcelCapacity, 0),
            startWith(0)
          )

          return combineLatest([
            totalCars,
            averageUtilization,
            passengerDeliveryStatistics,
            parcelDeliveryStatistics,
            totalPassengerCapacity,
            totalParcelCapacity,
          ]).pipe(
            map((values: any[]) => {
              const [
                totalCarsVal,
                util,
                passStats,
                parcelStats,
                totalPassengerCapacityVal,
                totalParcelCapacityVal,
              ] = values

              const {
                totalCargo,
                totalCo2,
                averagePassengerLoad,
                averageParcelLoad,
              } = util

              const { averagePassengerDeliveryTime, averagePassengerCost } =
                passStats

              const {
                averageParcelDeliveryTime,
                averageParcelCost,
                totalDelivered,
              } = parcelStats

              return {
                id,
                name,
                totalCars: totalCarsVal,
                totalCargo,
                totalCo2,
                totalPassengerCapacity: totalPassengerCapacityVal,
                totalParcelCapacity: totalParcelCapacityVal,
                totalDelivered,
                averagePassengerDeliveryTime,
                averagePassengerCost,
                averagePassengerLoad,
                averageParcelLoad,
                averageParcelDeliveryTime,
                averageParcelCost,
              }
            }),
            throttleTime(1000)
          )
        }),
        filter(({ totalCars }: any) => totalCars > 0)
      )
      .subscribe((municipality: unknown) => {
        socket.emit('municipality', municipality)
      }),
  ]
}

export default { register }

// CJS fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = { register }
