const { stops } = require('../publicTransport')('sl')
const { filter, shareReplay } = require('rxjs')
const Region = require('../../lib/region')

const includedMunicipalities = ['Södertälje municipality']

const stockholm = (municipalitiesStream) => {
  const municipalities = municipalitiesStream.pipe(
    filter((municipality) =>
      includedMunicipalities.includes(municipality.name)
    ),
    shareReplay()
  )

  return new Region({
    id: 'stockholm',
    name: 'Stockholm',
    municipalities: municipalities,
    stops,
  })
}

module.exports = stockholm
