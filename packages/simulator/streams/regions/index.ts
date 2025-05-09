import { from, share } from 'rxjs'
import stockholm from './stockholm'
import { read as readMunicipalities } from '../municipalities'
import type { ReadArgs } from '../municipalities'

const regionsMap = {
  stockholm,
}

function createRegions(savedParams: unknown) {
  const municipalitiesStream = readMunicipalities(
    savedParams as unknown as ReadArgs
  )

  const includedRegions = Object.entries(regionsMap)
    .filter(
      ([regionKey]) =>
        process.env.REGIONS?.includes(regionKey) ||
        process.env.REGIONS === '*' ||
        !process.env.REGIONS
    )
    .map(([, regionFactory]) => regionFactory)

  return from(
    includedRegions.map((factory) =>
      factory(
        municipalitiesStream as unknown as import('rxjs').Observable<{
          name: string
          [key: string]: unknown
        }>
      )
    )
  ).pipe(share())
}

// Export as CJS and TS module
export = createRegions

// CommonJS fallback for non-TS environments
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = createRegions
