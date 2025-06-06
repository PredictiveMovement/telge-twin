const { from, pipe, of } = require('rxjs')
const { map, mergeMap, groupBy, toArray } = require('rxjs/operators')
const { plan, truckToVehicle, bookingToJob } = require('./vroom')
const { save, search } = require('./elastic')
const { error, info } = require('./log')
const { randomUUID } = require('crypto')

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

function clusterByPostalCode(maxClusters = 800, length = 4) {
  return pipe(
    mergeMap((bookings: any[]) => {
      // only cluster when needed
      if (bookings.length < maxClusters) return of(bookings)

      return from(bookings).pipe(
        groupBy((booking: any) => booking.pickup?.postalcode.slice(0, length)),
        mergeMap((group: any) =>
          group.pipe(
            toArray(),
            map((bookings: any) => ({ postalcode: group.key, bookings }))
          )
        ),
        map(({ bookings }: any) =>
          bookings.length > 1
            ? {
                ...bookings[0], // pick the first booking in the cluster
                groupedBookings: bookings, // add the rest as grouped bookings so we can handle them later
              }
            : bookings[0]
        ),
        toArray()
      )
    })
  )
}

function chunkBookingsForVroom(
  bookings: any[],
  maxChunkSize = 200,
  useGeographicClustering = true
): any[][] {
  if (bookings.length <= maxChunkSize) {
    return [bookings]
  }

  if (useGeographicClustering) {
    const sortedBookings = [...bookings].sort((a, b) => {
      const postalA = a.pickup?.postalcode || ''
      const postalB = b.pickup?.postalcode || ''
      return postalA.localeCompare(postalB)
    })

    const chunks: any[][] = []
    for (let i = 0; i < sortedBookings.length; i += maxChunkSize) {
      chunks.push(sortedBookings.slice(i, i + maxChunkSize))
    }
    return chunks
  } else {
    const chunks: any[][] = []
    for (let i = 0; i < bookings.length; i += maxChunkSize) {
      chunks.push(bookings.slice(i, i + maxChunkSize))
    }
    return chunks
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

function mergeVroomChunkResults(chunkResults: any[], vehicles: any[]): any {
  const mergedRoutes: any[] = []
  const allUnassigned: any[] = []
  let totalCost = 0
  let totalDuration = 0

  vehicles.forEach((_, vehicleIndex) => {
    mergedRoutes[vehicleIndex] = {
      vehicle: vehicleIndex,
      cost: 0,
      duration: 0,
      steps: [],
    }
  })

  chunkResults.forEach(({ result, chunkIndex, bookings }) => {
    if (!result) {
      bookings.forEach((_: any, i: number) => {
        allUnassigned.push({ id: i + chunkIndex * 200 })
      })
      return
    }

    result.routes?.forEach((route: any) => {
      const vehicleIndex = route.vehicle
      if (mergedRoutes[vehicleIndex]) {
        mergedRoutes[vehicleIndex].cost += route.cost || 0
        mergedRoutes[vehicleIndex].duration += route.duration || 0

        const adjustedSteps =
          route.steps?.map((step: any) => ({
            ...step,
            id: step.id !== undefined ? step.id + chunkIndex * 200 : step.id,
          })) || []

        mergedRoutes[vehicleIndex].steps.push(...adjustedSteps)
      }
    })

    result.unassigned?.forEach((unassigned: any) => {
      allUnassigned.push({
        ...unassigned,
        id: unassigned.id + chunkIndex * 200,
      })
    })

    totalCost += result.cost || 0
    totalDuration += result.duration || 0
  })

  return {
    code: 0,
    summary: {
      cost: totalCost,
      duration: totalDuration,
      unassigned: allUnassigned.length,
    },
    unassigned: allUnassigned,
    routes: mergedRoutes.filter((route) => route.steps.length > 0),
  }
}

function convertToVroomCompatibleFormat() {
  return pipe(
    mergeMap(async ([bookings, cars]: any) => {
      const jobs = bookings.map((booking: any, i: number) =>
        bookingToJob(booking, i)
      )
      const vehicles = cars.map((truck: any, i: number) =>
        truckToVehicle(truck, i)
      )
      return { bookings, cars, jobs, vehicles }
    })
  )
}

function generatePlanId(bookings: any[], cars: any[]): string {
  return randomUUID().replace(/-/g, '')
}

async function loadPlanFromElastic(planId: string): Promise<any | null> {
  if (!planId) return null

  try {
    const searchResult = await search({
      index: 'vroom-fleet-plans',
      body: {
        query: {
          term: { planId: planId },
        },
      },
    })

    if (searchResult?.body?.hits?.hits?.length > 0) {
      info(`Loaded plan from Elasticsearch with planId: ${planId}`)
      return searchResult.body.hits.hits[0]._source.vroomResponse
    }

    return null
  } catch (err) {
    error(`Error loading plan from Elasticsearch: ${err}`)
    return null
  }
}

async function loadPlanForExperiment(experimentId: string, fleet: string) {
  try {
    const res = await search({
      index: 'vroom-fleet-plans',
      body: {
        size: 1,
        query: {
          bool: {
            must: [
              {
                match: {
                  experiment: experimentId,
                },
              },
              {
                match: {
                  fleet: fleet,
                },
              },
            ],
          },
        },
        sort: [{ timestamp: { order: 'desc' } }],
      },
    })

    const result = res?.body?.hits?.hits?.[0]?._source?.vroomResponse || null
    if (result) {
      info(
        `Loaded plan from Elasticsearch for experiment: ${experimentId}, fleet: ${fleet}`
      )
    } else {
      info(`No plan found for experiment: ${experimentId}, fleet: ${fleet}`)
    }
    return result
  } catch (e) {
    error(`Error loading plan: ${e}`)
    return null
  }
}

async function savePlanToElastic(
  experimentId: string,
  fleet: string,
  vroomResponse: any
): Promise<void> {
  try {
    const planId = randomUUID().replace(/-/g, '')

    await save(
      {
        planId: planId,
        experiment: experimentId,
        fleet: fleet,
        vroomResponse: vroomResponse,
        timestamp: new Date().toISOString(),
      },
      planId,
      'vroom-fleet-plans'
    )
    info(
      `Saved fleet plan to Elasticsearch with planId: ${planId}, experiment: ${experimentId}`
    )
  } catch (err) {
    error(`Error saving plan to Elasticsearch: ${err}`)
  }
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

      if (!isReplay) {
        await savePlanToElastic(experimentId, fleet, vroomResponse)
      }

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
  loadPlanForExperiment,
  chunkBookingsForVroom,
  planWithVroomChunked,
  mergeVroomChunkResults,
}
