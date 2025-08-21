import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function upsertListById<T extends { id: string | number }>(
  previousList: T[],
  incoming: T | T[],
  mapper: (item: T) => T
): T[] {
  const list = Array.isArray(incoming) ? incoming : [incoming]
  const next = [...previousList]
  list.forEach((raw) => {
    const item = mapper(raw)
    const index = next.findIndex((x) => x.id === item.id)
    if (index >= 0) {
      next[index] = item
    } else {
      next.push(item)
    }
  })
  return next
}
