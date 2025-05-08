/**
 * TODO: Describe the stream that this file exports and what its data means
 */
const { from } = require('rxjs')
const { map, filter, mergeMap, share } = require('rxjs/operators')
const Municipality = require('../lib/municipality')
const data = require('../data/municipalities.json')
const Pelias = require('../lib/pelias')
const { municipalities } = require('../config/index')
const { info } = require('../lib/log')

const activeMunicipalities = municipalities()

const bookingFactories = {
  'Södertälje kommun': require('./orders/telge.js'),
}

// function read() {
function read({ fleets }) {
  return from(data).pipe(
    filter(({ namn }) =>
      activeMunicipalities.some((name) => namn.startsWith(name))
    ),
    map((municipality) => {
      const municipalityName = municipality.namn
      return {
        ...municipality,
        fleets: fleets[municipalityName]?.fleets || [],
        settings: fleets[municipalityName]?.settings || {},
      }
    }),
    mergeMap(
      async ({ geometry, namn: name, address, kod, fleets, settings }) => {
        const searchQuery = address || name.split(' ')[0]

        const searchResult = await Pelias.searchOne(searchQuery)
        if (!searchQuery || !searchResult || !searchResult.position) {
          throw new Error(
            `No valid address or name found for municipality: ${name}. Please check parameters.json and add address or position for this municipality. ${searchQuery}`
          )
        }
        const { position: center } = searchResult
        info(`creating municipality ${name}`)
        const municipality = new Municipality({
          geometry,
          name,
          id: kod,
          fleetsConfig: fleets,
          bookings: bookingFactories[name](),
          center,
          settings,
        })
        return municipality
      }
    ),
    share()
  )
}

module.exports = { read }
