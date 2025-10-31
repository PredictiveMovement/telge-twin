/**
 * Capacity Module
 * 
 * Provides utilities for:
 * - Load estimation (calculating volume/weight from bookings)
 * - Compartment management (tracking vehicle fack state)
 * - Capacity analysis (estimating theoretical capacity)
 * 
 * Usage:
 *   import { estimateBookingLoad, createCompartments, logVehicleCapacity } from '../capacity'
 */

// Type definitions
export type {
  LoadEstimate,
  Compartment,
  FackWasteType,
  FackDetail,
  VehicleSpec,
  BookingLike,
} from './types'

export {
  STANDARD_PICKUP_VOLUME_LITERS,
  STANDARD_FILL_PERCENT,
} from './types'

// Load estimation
export {
  estimateBookingLoad,
  getCapacityDimensions,
} from './loadEstimator'

// Compartment management
export {
  createCompartments,
  selectBestCompartment,
  isAnyCompartmentFull,
  isCompartmentFull,
  applyLoadToCompartment,
  releaseLoadFromCompartment,
} from './compartments'

// Capacity analysis
export {
  computeVehicleCapacityEstimate,
  logVehicleCapacity,
} from './capacityAnalysis'

// Utilities
export {
  buildSettingsIndexes,
} from './utils'

