export interface BreakConfig {
  id: string
  name: string
  duration: number
  enabled: boolean
  desiredTime?: string
  location?: string
  locationCoordinates?: { lat: number; lng: number }
}
