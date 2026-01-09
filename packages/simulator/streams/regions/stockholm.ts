import { filter, shareReplay } from 'rxjs'
import Region = require('../../lib/region')

const includedMunicipalities = ['Södertälje kommun']

function stockholm(
  municipalitiesStream: import('rxjs').Observable<{
    name: string
    [key: string]: unknown
  }>
): Region {
  const municipalities = municipalitiesStream.pipe(
    filter((municipality) =>
      includedMunicipalities.includes(municipality.name)
    ),
    shareReplay()
  )

  return new Region({
    id: 'stockholm',
    name: 'Stockholm',
    municipalities,
  })
}

// Export compatibility
export = stockholm
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = stockholm
