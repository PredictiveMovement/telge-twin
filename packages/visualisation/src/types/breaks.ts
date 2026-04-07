export interface BreakConfig {
  id: string
  name: string
  duration: number
  enabled: boolean
  desiredTime?: string
  location?: string
  locationCoordinates?: { lat: number; lng: number }
}

export const DEFAULT_BREAKS: BreakConfig[] = [
  { id: 'morning', name: 'Förmiddagsrast', duration: 15, enabled: true, desiredTime: '08:00' },
  { id: 'lunch', name: 'Lunch', duration: 45, enabled: true, desiredTime: '10:00' },
  { id: 'afternoon', name: 'Eftermiddagsrast', duration: 15, enabled: true, desiredTime: '13:00' },
]
