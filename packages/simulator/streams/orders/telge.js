const { from } = require('rxjs')
const {
  map,
  mergeMap,
  catchError,
  filter,
  shareReplay,
  tap,
} = require('rxjs/operators')
const Position = require('../../lib/models/position')
const Booking = require('../../lib/models/booking')
const { error, info } = require('../../lib/log')
const { nearest } = require('../../lib/pelias')
const fs = require('fs')
const path = require('path')
const LERHAGA_POSITION = new Position({ lat: 59.135449, lon: 17.571239 })
const { read: readConfig } = require('../../config')

function createBookingStream() {
  const parameters = readConfig()
  const dataFile = parameters.selectedDataFile || 'ruttdata_2024-09-03.json'

  const processData = (source) => {
    return source.pipe(
      map(
        ({
          Turid: id,
          Datum: pickupDate,
          Tjtyp: serviceType,
          Lat: lat,
          Lng: lon,
          Bil: carId,
          Turordningsnr: order,
          Avftyp: recyclingType,
        }) => ({
          id,
          pickup: {
            name: serviceType,
            date: pickupDate,
            position: new Position({ lat, lon }),
          },
          weight: 10,
          sender: 'TELGE',
          serviceType,
          carId: carId.trim(),
          order,
          recyclingType,
          destination: {
            name: 'LERHAGA 50, 151 66 Södertälje',
            position: LERHAGA_POSITION,
          },
        })
      ),
      filter(({ pickup }) => pickup.position.isValid()),
      mergeMap(async (row) => {
        try {
          const pickup = await nearest(row.pickup.position, 'address')
          return {
            ...row,
            pickup: {
              ...row.pickup,
              postalcode: pickup?.postalcode || '',
            },
          }
        } catch (err) {
          error(`Error fetching nearest address for row ${row.id}:`, err)
          return row
        }
      })
    )
  }

  const loadData = () => {
    const uploadsPath = path.join(__dirname, '../../uploads', dataFile)
    const defaultPath = path.join(__dirname, '../../data/telge', dataFile)
    const fallbackPath = path.join(
      __dirname,
      '../../data/telge',
      'ruttdata_2024-09-03.json'
    )

    let dataFilePath = fs.existsSync(uploadsPath) ? uploadsPath : defaultPath

    try {
      info(`Loading data from ${dataFilePath}`)
      const jsonData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'))
      return processData(
        from(jsonData).pipe(
          tap(() =>
            info(
              `Processing data from ${dataFile}. This might take a few minutes...`
            )
          )
        )
      )
    } catch (err) {
      error(`Failed to load data file ${dataFile}: ${err.message}`)

      try {
        info(`Falling back to default data file at ${fallbackPath}`)
        const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'))
        return processData(
          from(fallbackData).pipe(
            tap(() =>
              info(
                'Processing fallback data file. This might take a few minutes...'
              )
            )
          )
        )
      } catch (fallbackErr) {
        error(`Failed to load fallback data file: ${fallbackErr.message}`)
        return from([])
      }
    }
  }

  return loadData().pipe(
    map((row, i) => new Booking({ type: 'recycle', ...row, bookingId: i })),
    shareReplay(),
    catchError((err) => {
      error('TELGE -> Error processing data:', err)
      return from([])
    })
  )
}

module.exports = createBookingStream
