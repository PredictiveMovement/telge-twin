export interface Car {
  id: string
  position: [number, number]
  status: string
  fleet?: string
  destination?: [number, number]
}

export interface Booking {
  id: string
  pickup: [number, number]
  destination: [number, number]
  status: 'Assigned' | 'Queued' | 'Picked up' | 'Delivered'
  recyclingType: string
  carId?: string
  type?: string
}

export interface MapState {
  bearing: number
  pitch: number
  latitude: number
  longitude: number
  zoom: number
}

export interface SimulationData {
  running: boolean
  data: any
  experimentId: string | null
}
