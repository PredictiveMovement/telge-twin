import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('sv-SE').replace(/-/g, '.');
}

export function formatDateTime(date: Date | string): { date: string; time: string } {
  const d = typeof date === 'string' ? new Date(date) : date;
  return {
    date: d.toLocaleDateString('sv-SE').replace(/-/g, '.'),
    time: d.toLocaleTimeString('sv-SE')
  };
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
