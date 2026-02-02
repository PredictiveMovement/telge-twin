/**
 * Centralized utilities for optimization status detection.
 * These functions check the vroomTruckPlanIds array to determine optimization state.
 */

interface ExperimentLike {
  vroomTruckPlanIds?: string[];
}

/**
 * Checks if an experiment is currently optimizing (running but not complete).
 * An experiment is optimizing if vroomTruckPlanIds exists as an array but is empty.
 */
export function isExperimentOptimizing(experiment?: ExperimentLike): boolean {
  return (
    Array.isArray(experiment?.vroomTruckPlanIds) &&
    experiment.vroomTruckPlanIds.length === 0
  );
}

/**
 * Checks if an experiment optimization is complete.
 * @param experiment - The experiment object
 * @param expectedVehicleCount - Expected number of vehicles (from dataset fleetConfiguration)
 */
export function isExperimentComplete(
  experiment?: ExperimentLike,
  expectedVehicleCount?: number
): boolean {
  if (!Array.isArray(experiment?.vroomTruckPlanIds)) return false;

  const actualCount = experiment.vroomTruckPlanIds.length;

  // If expectedVehicleCount is provided, require all vehicles to be complete
  if (expectedVehicleCount && expectedVehicleCount > 0) {
    return actualCount >= expectedVehicleCount;
  }

  // Fallback for older data: complete if at least one plan exists
  return actualCount > 0;
}
