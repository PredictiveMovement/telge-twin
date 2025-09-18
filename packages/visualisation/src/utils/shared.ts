// Common helpers shared across UI modules

export const byId = <T extends { ID: string }>(arr: T[] = []) =>
  Object.fromEntries(arr.map((x) => [x.ID, x])) as Record<string, T>

export function pickDominant<T>(items: T[]): T | undefined {
  if (!items?.length) return undefined
  const counts = new Map<T, number>()
  for (const it of items) counts.set(it, (counts.get(it) || 0) + 1)
  let best = items[0]
  let max = 0
  counts.forEach((c, k) => {
    if (c > max) {
      max = c
      best = k
    }
  })
  return best
}

export type BilSpec = {
  ID: string
  BESKRIVNING?: string
  FACK1_VOLYM?: number
  FACK2_VOLYM?: number
  FACK3_VOLYM?: number
  FACK4_VOLYM?: number
  FACK1_VIKT?: number
  FACK2_VIKT?: number
  FACK3_VIKT?: number
  FACK4_VIKT?: number
  FACK?: { FACK: number; AVFTYP: string }[]
}

// Build simplified compartment info for UI cards
export function buildFackInfo(bil?: BilSpec | null) {
  if (!bil) return [] as Array<{
    number: number
    volume: number | null
    weight: number | null
    allowedWasteTypes: string[]
  }>
  const vol = (n: number) => (bil as any)[`FACK${n}_VOLYM`] ?? null
  const wgt = (n: number) => (bil as any)[`FACK${n}_VIKT`] ?? null
  const byFack = new Map<number, string[]>()
  for (const f of bil.FACK || []) {
    if (!byFack.has(f.FACK)) byFack.set(f.FACK, [])
    byFack.get(f.FACK)!.push(f.AVFTYP)
  }
  const present = [1, 2, 3, 4].filter(
    (n) => (vol(n) || 0) > 0 || (wgt(n) || 0) > 0 || byFack.has(n)
  )
  return present.map((n) => ({
    number: n,
    volume: vol(n) as number | null,
    weight: wgt(n) as number | null,
    allowedWasteTypes: byFack.get(n) || [],
  }))
}

