import { useMemo } from 'react'
import type { RouteCardData } from './useRouteData'
import type { RouteFilters } from './useRouteFilters'
import { getVehicleType } from '@/lib/vehicleUtils'

export interface DynamicFilterOptions {
  turids: string[]
  avfallstyper: string[]
  vehicleOptions: Array<{ id: string; display: string }>
  fordonstyper: string[]
  tjanstetyper: string[]
}

/** Extract vehicle type (BESKRIVNING) from "ID BESKRIVNING" display string */
const extractVehicleType = (desc: string) => {
  const parts = desc.split(' ')
  return parts.slice(1).join(' ').trim()
}

/**
 * Computes dynamic filter options for RouteSearchTab.
 *
 * For each filter dimension, applies ALL other active filters (excluding that
 * dimension's own) and extracts the unique values from the surviving items.
 * This way each dropdown only shows options that will produce results.
 */
export function useDynamicFilterOptions(
  items: RouteCardData[],
  filters: RouteFilters
): DynamicFilterOptions {
  return useMemo(() => {
    if (!items || items.length === 0) {
      return { turids: [], avfallstyper: [], vehicleOptions: [], fordonstyper: [], tjanstetyper: [] }
    }

    // Predicate per filter dimension (mirrors filteredResults in RouteSearchTab)
    const predicates: Record<string, (item: RouteCardData) => boolean> = {
      turid: (item) => filters.turid.includes(item.name),
      avfallstyp: (item) =>
        item.avfallstypList.some(type =>
          filters.avfallstyp.some(f => f.toLowerCase() === type.toLowerCase())
        ),
      fordonstyp: (item) => {
        const type = extractVehicleType(item.vehicleDescription || '')
        return filters.fordonstyp.includes(type)
      },
      fordonsnummer: (item) => filters.fordonsnummer.includes(item.fordon),
      tjanstetyp: (item) =>
        !!item.tjanstetyp && filters.tjanstetyp.includes(item.tjanstetyp),
    }

    /** Filter items applying all active predicates EXCEPT the excluded keys */
    const filterExcluding = (...excludeKeys: string[]) =>
      items.filter(item => {
        for (const [key, pred] of Object.entries(predicates)) {
          if (excludeKeys.includes(key)) continue
          const val = (filters as any)[key]
          if (Array.isArray(val) && val.length > 0 && !pred(item)) return false
        }
        return true
      })

    const sorted = (set: Set<string>) =>
      Array.from(set).sort((a, b) => a.localeCompare(b, 'sv'))

    // For each dimension, exclude only its OWN filter so other filters narrow it
    const forTurid = filterExcluding('turid')
    const forAvfallstyp = filterExcluding('avfallstyp')
    const forFordonstyp = filterExcluding('fordonstyp')
    const forFordon = filterExcluding('fordonsnummer')
    const forTjanstetyp = filterExcluding('tjanstetyp')

    // Extract unique values — no merge with selected values; pruning handles stale selections
    const turids = sorted(new Set(forTurid.map(i => i.name).filter(Boolean)))
    const avfallstyper = sorted(new Set(forAvfallstyp.flatMap(i => i.avfallstypList).filter(Boolean)))
    const tjanstetyper = sorted(new Set(forTjanstetyp.map(i => i.tjanstetyp).filter(Boolean) as string[]))

    const fordonSet = new Set(forFordon.map(i => i.fordon).filter(Boolean))
    const vehicleOptions = Array.from(fordonSet)
      .filter(Boolean)
      .map(id => {
        const type = getVehicleType(id)
        return { id, display: type !== 'Okänd' ? `${id} ${type}` : id }
      })
      .sort((a, b) => a.display.localeCompare(b.display, 'sv'))

    const fordonstypSet = new Set<string>()
    forFordonstyp.forEach(i => {
      const type = extractVehicleType(i.vehicleDescription || '')
      if (type) fordonstypSet.add(type)
    })
    const fordonstyper = sorted(fordonstypSet)

    return { turids, avfallstyper, vehicleOptions, fordonstyper, tjanstetyper }
  }, [items, filters])
}

/**
 * Prune filter selections that are no longer valid given current dynamic options.
 * Returns null if nothing needs to change, or the pruned filters object.
 */
export function pruneStaleFilters(
  filters: RouteFilters,
  options: DynamicFilterOptions
): RouteFilters | null {
  const validTurids = new Set(options.turids)
  const validAvfallstyper = new Set(options.avfallstyper)
  const validFordon = new Set(options.vehicleOptions.map(v => v.id))
  const validFordonstyper = new Set(options.fordonstyper)
  const validTjanstetyper = new Set(options.tjanstetyper)

  const prunedTurid = filters.turid.filter(v => validTurids.has(v))
  const prunedAvfallstyp = filters.avfallstyp.filter(v => validAvfallstyper.has(v))
  const prunedFordonsnummer = filters.fordonsnummer.filter(v => validFordon.has(v))
  const prunedFordonstyp = filters.fordonstyp.filter(v => validFordonstyper.has(v))
  const prunedTjanstetyp = filters.tjanstetyp.filter(v => validTjanstetyper.has(v))

  const changed =
    prunedTurid.length !== filters.turid.length ||
    prunedAvfallstyp.length !== filters.avfallstyp.length ||
    prunedFordonsnummer.length !== filters.fordonsnummer.length ||
    prunedFordonstyp.length !== filters.fordonstyp.length ||
    prunedTjanstetyp.length !== filters.tjanstetyp.length

  if (!changed) return null

  return {
    ...filters,
    turid: prunedTurid,
    avfallstyp: prunedAvfallstyp,
    fordonsnummer: prunedFordonsnummer,
    fordonstyp: prunedFordonstyp,
    tjanstetyp: prunedTjanstetyp,
  }
}
