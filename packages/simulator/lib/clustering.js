const { from, pipe, of } = require('rxjs')
const { map, mergeMap, groupBy, toArray } = require('rxjs/operators')
const { plan, truckToVehicle, bookingToJob } = require('./vroom')
const { info } = require('./log')

// Calculate the center of each cluster of bookings
function calculateCenters(groups) {
  return from(groups).pipe(
    map(({ postalCode, bookings }) => {
      const total = bookings.length
      const sumPosition = bookings.reduce(
        (acc, booking) => {
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
    mergeMap((bookings) => {
      if (bookings.length < maxClusters) return of(bookings)
      info(`Clustering ${bookings.length} bookings by postal code`)

      return from(bookings).pipe(
        groupBy((booking) => booking.pickup?.postalcode.slice(0, length)),
        mergeMap((group) =>
          group.pipe(
            toArray(),
            map((bookings) => ({ postalcode: group.key, bookings }))
          )
        ),
        map(({ bookings }) =>
          bookings.length > 1
            ? {
                ...bookings[0],
                groupedBookings: bookings,
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
    mergeMap(async ([bookings, cars]) => {
      let jobId = 0
      const jobs = []
      const jobToBookingMap = new Map()

      bookings.forEach((booking) => {
        const clusterSize = booking.groupedBookings?.length || 1
        const maxJobSize = 200

        if (clusterSize <= maxJobSize) {
          const job = {
            id: jobId,
            location: [
              booking.pickup.position.lon,
              booking.pickup.position.lat,
            ],
            pickup: [clusterSize],
          }
          jobs.push(job)
          jobToBookingMap.set(jobId, booking)
          jobId++
        } else {
          const numSubJobs = Math.ceil(clusterSize / maxJobSize)
          info(
            `Splitting large cluster of ${clusterSize} bookings into ${numSubJobs} sub-jobs`
          )

          for (let i = 0; i < numSubJobs; i++) {
            const subJobSize =
              i === numSubJobs - 1 ? clusterSize - i * maxJobSize : maxJobSize

            const job = {
              id: jobId,
              location: [
                booking.pickup.position.lon,
                booking.pickup.position.lat,
              ],
              pickup: [subJobSize],
            }
            jobs.push(job)
            jobToBookingMap.set(jobId, booking)
            jobId++
          }
        }
      })

      const vehicles = cars.map((truck, i) => truckToVehicle(truck, i))
      return { bookings, cars, jobs, vehicles, jobToBookingMap }
    })
  )
}

function planWithVroom() {
  return pipe(
    mergeMap(async ({ bookings, cars, jobs, vehicles, jobToBookingMap }) => {
      const vroomResponse = await plan({ jobs, vehicles })
      return { vroomResponse, cars, bookings, jobToBookingMap }
    })
  )
}

function convertBackToBookings() {
  return pipe(
    mergeMap(({ vroomResponse, cars, bookings, jobToBookingMap }) =>
      from(vroomResponse.routes).pipe(
        map((route) => {
          const car = cars[route.vehicle]
          const uniqueBookings = [
            ...new Set(
              route.steps
                .filter(({ type }) => type === 'job')
                .map(({ id }) => jobToBookingMap.get(id))
                .filter(Boolean)
            ),
          ]
          return { car, bookings: uniqueBookings }
        }),
        map(({ car, bookings }) => ({
          car,
          bookings: bookings.flatMap(
            (booking) => booking?.groupedBookings || [booking]
          ),
        })),
        mergeMap(({ car, bookings }) =>
          from(bookings.map((booking) => ({ car, booking })))
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
}
