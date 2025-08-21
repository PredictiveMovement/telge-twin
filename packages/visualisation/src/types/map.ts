export interface Car {
  id: string
  position: [number, number]
  status: string
  fleet?: string
  destination?: [number, number]
}

export interface Booking {
  id: string
  pickup: [number, number] | null
  destination: [number, number] | null
  status: 'New' | 'Assigned' | 'Queued' | 'Picked up' | 'Delivered'
  recyclingType?: string
  carId?: string
  type?: string
  turordningsnr?: number
  cost?: number
  co2?: number
  distance?: number
  deliveryTime?: number
  pickupDateTime?: number
  assigned?: number
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
