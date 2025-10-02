export interface Car {
  id: string
  position: [number, number]
  status: string
  fleet?: string
  destination?: [number, number]
  // Optional runtime metrics
  co2?: number
  distance?: number
  vehicleType?: string
  recyclingTypes?: string[]
  parcelCapacity?: number
  cargo?: number
  queue?: number
  // Compartments (fack) – emitted by backend if available
  compartments?: Array<{
    fackNumber: number
    allowedWasteTypes: string[]
    capacityLiters: number | null
    capacityKg: number | null
    fillLiters: number
    fillKg: number
  }>
}

export interface Booking {
  id: string
  pickup: [number, number] | null
  destination: [number, number] | null
  status: 'New' | 'Assigned' | 'Queued' | 'Picked up' | 'Delivered' | 'Unreachable'
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
