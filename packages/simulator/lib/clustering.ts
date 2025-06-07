const { from, pipe, of } = require('rxjs')
const { map, mergeMap, groupBy, toArray } = require('rxjs/operators')
const { plan, truckToVehicle, bookingToJob } = require('./vroom')
const { error, info } = require('./log')

const SIMULATION_ID = ''

// Calculate the center of each cluster of bookings
function calculateCenters(groups: any) {
  return from(groups).pipe(
    // För varje grupp av bokningar
    map(({ postalCode, bookings }: any) => {
      const total = bookings.length
      // Beräkna medelvärdet för latitud och longitud
      const sumPosition = bookings.reduce(
        (acc: any, booking: any) => {
          acc.lat += booking.pickup?.position?.lat || 0
          acc.lon += booking.pickup?.position?.lon || 0
          return acc
        },
        { lat: 0, lon: 0 }
      )
      const center = {
        lat: sumPosition.lat / total,
        lon: sumPosition.lon / total,
      }
      return { postalCode, center, bookings }
    }),
    toArray()
  )
}

function clusterByPostalCode(maxBookings = 100, maxUniquePostalCodes = 10) {
  return pipe(
    groupBy((booking: any) => booking.postalcode),
    map((group: any) => ({ postalCode: group.key, bookings: group })),
    mergeMap((group: any) =>
      group.bookings.pipe(
        toArray(),
        map((bookings: any[]) => ({ ...group, bookings }))
      )
    ),
    toArray(),
    map((groups: any[]) => {
      if (groups.length <= maxUniquePostalCodes) {
        return groups
      }

      return groups
        .sort((a, b) => b.bookings.length - a.bookings.length)
        .slice(0, maxUniquePostalCodes)
    }),
    mergeMap((groups: any[]) => from(groups)),
    mergeMap(({ postalCode, bookings }: any) => {
      if (bookings.length <= maxBookings) {
        return of({ postalCode, bookings })
      }

      const chunks: any[] = []
      for (let i = 0; i < bookings.length; i += maxBookings) {
        chunks.push({
          postalCode: `${postalCode}-chunk-${Math.floor(i / maxBookings)}`,
          bookings: bookings.slice(i, i + maxBookings),
        })
      }
      return from(chunks)
    })
  )
}

function chunkBookingsForVroom(
  bookings: any[],
  maxSize: number = 200
): any[][] {
  const chunks = []
  for (let i = 0; i < bookings.length; i += maxSize) {
    chunks.push(bookings.slice(i, i + maxSize))
  }
  return chunks
}

function mergeVroomChunkResults(chunkResults: any[], vehicles: any[]): any {
  const mergedRoutes = vehicles.map((vehicle, vehicleIndex) => ({
    vehicle: vehicleIndex,
    cost: 0,
    steps: [],
    duration: 0,
    distance: 0,
  }))

  let stepIdOffset = 0

  chunkResults.forEach(({ result, chunkIndex }) => {
    if (!result || !result.routes) return

    result.routes.forEach((route: any, routeIndex: number) => {
      if (routeIndex < mergedRoutes.length) {
        const adjustedSteps = route.steps.map((step: any) => ({
          ...step,
          id: step.id !== undefined ? step.id + stepIdOffset : step.id,
        }))

        mergedRoutes[routeIndex].steps.push(...adjustedSteps)
        mergedRoutes[routeIndex].cost += route.cost || 0
        mergedRoutes[routeIndex].duration += route.duration || 0
        mergedRoutes[routeIndex].distance += route.distance || 0
      }
    })

    if (result.jobs) {
      stepIdOffset += result.jobs.length
    }
  })

  return {
    routes: mergedRoutes,
    summary: {
      cost: mergedRoutes.reduce((sum, route) => sum + route.cost, 0),
      duration: mergedRoutes.reduce((sum, route) => sum + route.duration, 0),
      distance: mergedRoutes.reduce((sum, route) => sum + route.distance, 0),
    },
  }
}

async function planWithVroomChunked(
  experimentId: string,
  fleet: string,
  bookings: any[],
  vehicles: any[],
  isReplay: boolean = false
): Promise<any> {
  const chunks = chunkBookingsForVroom(bookings)

  if (chunks.length === 1) {
    const jobs = chunks[0].map((booking: any, i: number) =>
      bookingToJob(booking, i)
    )
    return await plan({ jobs, vehicles }, 0)
  }

  info(`Processing ${chunks.length} chunks with VROOM for fleet ${fleet}`)

  const chunkPromises = chunks.map(async (chunk, chunkIndex) => {
    const jobs = chunk.map((booking: any, i: number) =>
      bookingToJob(booking, i)
    )
    try {
      const result = await plan({ jobs, vehicles }, 0)
      return { chunkIndex, result, bookings: chunk }
    } catch (err) {
      error(`Failed to plan chunk ${chunkIndex} for fleet ${fleet}:`, err)
      return { chunkIndex, result: null, bookings: chunk }
    }
  })

  const chunkResults = await Promise.all(chunkPromises)

  return mergeVroomChunkResults(chunkResults, vehicles)
}

function convertToVroomCompatibleFormat() {
  return pipe(
    map(({ postalCode, bookings }: any) => {
      const groupedBookings = bookings.map((booking: any, i: number) => ({
        ...booking,
        groupedBookings: [booking],
      }))

      const jobs = groupedBookings.map((booking: any, i: number) =>
        bookingToJob(booking, i)
      )

      return { postalCode, bookings: groupedBookings, jobs }
    })
  )
}

function planWithVroom(
  experimentId: string,
  fleet: string,
  isReplay: boolean = false
) {
  return pipe(
    mergeMap(async ({ bookings, cars, jobs, vehicles }: any) => {
      info(`Calculating routes with VROOM for ${bookings.length} bookings`)

      let vroomResponse
      if (bookings.length > 200) {
        vroomResponse = await planWithVroomChunked(
          experimentId,
          fleet,
          bookings,
          vehicles,
          isReplay
        )
      } else {
        vroomResponse = await plan({ jobs, vehicles }, 0)
      }

      info(`✅ VROOM planning completed for fleet ${fleet}`)

      return { vroomResponse, cars, bookings }
    })
  )
}

function convertBackToBookings() {
  return pipe(
    mergeMap(({ vroomResponse, cars, bookings }: any) =>
      from(vroomResponse.routes).pipe(
        map((route: any) => {
          const car = cars[route.vehicle]
          const pickups = route.steps
            .filter(({ type }: any) => type === 'job')
            .map(({ id }: any) => bookings[id])
          return { car, bookings: pickups }
        }),
        map(({ car, bookings }: any) => ({
          car,
          bookings: bookings.flatMap(
            (booking: any) => booking?.groupedBookings || [booking]
          ),
        })),
        mergeMap(({ car, bookings }: any) =>
          from(bookings.map((booking: any) => ({ car, booking })))
        )
      )
    )
  )
}

module.exports = {
  planWithVroom,
  clusterByPostalCode,
  convertToVroomCompatibleFormat,
  convertBackToBookings,
  calculateCenters,
  chunkBookingsForVroom,
  planWithVroomChunked,
  mergeVroomChunkResults,
}
