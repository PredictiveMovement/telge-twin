/**
 * Shared types for capacity calculation and compartment management
 */

/**
 * Represents the estimated volume and weight of a booking or load
 */
export interface LoadEstimate {
  volumeLiters: number
  weightKg: number | null
}

/**
 * Represents a single compartment (fack) in a vehicle
 */
export interface Compartment {
  fackNumber: number
  allowedWasteTypes: string[]
  capacityLiters: number | null
  capacityKg: number | null
  fillLiters: number
  fillKg: number
}

/**
 * Details about waste types allowed in a compartment
 */
export interface FackWasteType {
  avftyp: string
  volymvikt?: number | null
  fyllnadsgrad?: number | null
}

/**
 * Full specification of a compartment with allowed waste types.
 * All fields are optional as createCompartments will use defaults for missing values:
 * - fackNumber defaults to array index + 1
 * - avfallstyper defaults to allowing all waste types
 */
export interface FackDetail {
  fackNumber?: number
  avfallstyper?: FackWasteType[]
  volym?: number | null // capacity in m³
  vikt?: number | null // capacity in kg
}

/**
 * Vehicle specification with compartment details
 */
export interface VehicleSpec {
  originalId: string
  type: string
  description?: string
  fackDetails?: FackDetail[]
  parcelCapacity?: number
}

/**
 * Booking-like object for capacity estimation
 */
export interface BookingLike {
  recyclingType?: string
  originalRecord?: any
  originalData?: any
}

/**
 * Standard pickup volume constant used across capacity calculations
 */
export const STANDARD_PICKUP_VOLUME_LITERS = 140
export const STANDARD_FILL_PERCENT = 100

