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

function clusterByPostalCode(maxClusters = 200, length = 4) {
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
                term: {
                  planId: experimentId,
                },
              },
            ],
          },
        },
        sort: [{ timestamp: { order: 'desc' } }],
      },
    })
    return res?.body?.hits?.hits?.[0]?._source?.vroomResponse || null
  } catch (e) {
    error(`Error loading plan: ${e}`)
    return null
  }
}

async function savePlanToElastic(
  planId: string,
  fleet: string,
  vroomResponse: any
): Promise<void> {
  try {
    await save(
      {
        planId: planId,
        fleet: fleet,
        vroomResponse: vroomResponse,
        timestamp: new Date().toISOString(),
      },
      planId,
      'vroom-fleet-plans'
    )
    info(`Saved fleet plan to Elasticsearch with planId: ${planId}`)
  } catch (err) {
    error(`Error saving plan to Elasticsearch: ${err}`)
  }
}

function planWithVroom(experimentId: string, fleet: string) {
  return pipe(
    mergeMap(async ({ bookings, cars, jobs, vehicles }: any) => {
      info(`Calculating routes with VROOM`)
      const vroomResponse = await plan({ jobs, vehicles })

      await savePlanToElastic(experimentId, fleet, vroomResponse)

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
}
