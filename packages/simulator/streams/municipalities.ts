import { from, Observable } from 'rxjs'
import { map, filter, mergeMap, share } from 'rxjs/operators'
import Municipality = require('../lib/municipality')
import Pelias = require('../lib/pelias')
import data from '../data/municipalities.json'
import { municipalities as configuredMunicipalities } from '../config'
import { info } from '../lib/log'
import createTelgeBookingStream from './orders/telge'
import { ObservableInput } from 'rxjs'

// --------------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------------

export interface FleetConfig {
  fleets: unknown[]
  settings?: Record<string, unknown>
}

export interface ReadArgs {
  fleets: Record<string, FleetConfig>
}

// Map of municipality name to function that returns a booking stream
const bookingFactories: Record<string, () => ObservableInput<unknown>> = {
  'Södertälje kommun': createTelgeBookingStream,
}

const activeMunicipalities: string[] = configuredMunicipalities()

/**
 * Create an observable stream of Municipality instances, enriched with centre
 * coordinates fetched from Pelias.
 */
export function read({ fleets }: ReadArgs): Observable<Municipality> {
  return from(data).pipe(
    // Only include municipalities that are configured as active
    filter(({ namn }: { namn: string }) =>
      activeMunicipalities.some((name) => namn.startsWith(name))
    ),

    // Attach fleet configuration to each municipality
    map((municipality: any) => {
      const municipalityName = municipality.namn as string
      const fleetConfig = fleets[municipalityName] ?? {
        fleets: [],
        settings: {},
      }
      return {
        ...municipality,
        fleets: fleetConfig.fleets,
        settings: fleetConfig.settings,
      }
    }),

    // Resolve centre point for each municipality via Pelias
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

        return new Municipality({
          geometry,
          name,
          id: kod,
          fleetsConfig: fleets,
          bookings: bookingFactories[name]?.() ?? createTelgeBookingStream(),
          center,
          settings,
        })
      }
    ),
    share()
  )
}

export default { read }
