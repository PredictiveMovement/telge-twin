import { from, of } from 'rxjs'
import { map, filter, first, mergeMap, toArray } from 'rxjs/operators'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pelias = require('../lib/pelias')
import { haversine, addMeters } from '../lib/distance'
import perlin from 'perlin-noise'
import Booking from '../lib/models/booking'

const xy = (i: number, size = 100) => ({ x: i % size, y: Math.floor(i / size) })

// generate 100x100 grid of perlin noise probabilities
const randomPositions = perlin
  .generatePerlinNoise(100, 100)
  .map((probability: number, i: number) => ({
    x: xy(i).x * 10,
    y: xy(i).y * 10,
    probability,
  }))
  .sort((a: any, b: any) => b.probability - a.probability)

export function generateBookingsInMunicipality(municipality: any) {
  // attach nearest postombud to each square
  const squaresWithNearestPostombud = municipality.squares.pipe(
    mergeMap((square: any) =>
      municipality.postombud.pipe(
        map((ombud: any) => ({
          ...ombud,
          distance: haversine(ombud.position, square.position),
        })),
        toArray(),
        map((list: any[]) => list.sort((a, b) => a.distance - b.distance)[0]),
        map((nearestOmbud: any) => ({ ...square, nearestOmbud }))
      )
    )
  )

  const randomPointsInSquares = squaresWithNearestPostombud.pipe(
    mergeMap(({ population, nearestOmbud, position }: any) =>
      randomPositions
        .slice(0, population)
        .map(({ x, y }: any) => addMeters(position, { x, y }))
        .map((pos: any) => ({ nearestOmbud, position: pos }))
    )
  )

  const bookings$ = randomPointsInSquares.pipe(
    toArray(),
    mergeMap((arr: any[]) => from(arr.sort(() => Math.random() - 0.5))),
    mergeMap(({ nearestOmbud, position }: any) =>
      municipality.fleets.pipe(
        first(
          (fleet: any) => nearestOmbud.operator.startsWith(fleet.name),
          null
        ),
        mergeMap((fleet: any) =>
          fleet ? of(fleet) : municipality.fleets.pipe(first())
        ),
        map((fleet: any) => ({ nearestOmbud, position, fleet }))
      )
    ),
    mergeMap(({ nearestOmbud, position, fleet }: any) => {
      return pelias
        .nearest(position)
        .then((address: any) => {
          if (!address) return null
          const isCommercial = address.layer === 'venue'
          const homeDelivery = Math.random() < fleet.percentageHomeDelivery
          const returnDelivery = Math.random() < fleet.percentageReturnDelivery

          if (isCommercial || homeDelivery)
            return new Booking({
              pickup: fleet.hub,
              destination: address,
              origin: fleet.name,
            } as any)
          if (returnDelivery)
            return new Booking({
              pickup: nearestOmbud,
              destination: fleet.hub,
              origin: fleet.name,
            } as any)

          return new Booking({
            pickup: fleet.hub,
            destination: nearestOmbud,
            finalDestination: address,
            origin: fleet.name,
          } as any)
        })
        .catch(() => Promise.resolve(null))
    }, 1),
    filter((b: Booking | null) => b !== null)
  )
  return bookings$
}

export default { generateBookingsInMunicipality }

// CJS fallback
// @ts-ignore
if (typeof module !== 'undefined')
  module.exports = { generateBookingsInMunicipality }
