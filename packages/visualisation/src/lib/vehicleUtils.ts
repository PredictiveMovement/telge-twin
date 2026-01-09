/**
 * Vehicle utility functions for mapping vehicle numbers to types
 */

/**
 * Maps vehicle number to its type
 * @param vehicleNumber - The vehicle number as a string (e.g., "20")
 * @returns The vehicle type (e.g., "4-fack", "2-fack", "Lastbil")
 */
export const getVehicleType = (vehicleNumber: string): string => {
  const num = vehicleNumber.trim();

  // 4-fack vehicles (Hushåll)
  if (['20', '21', '22', '23'].includes(num)) {
    return '4-fack';
  }

  // 2-fack vehicles (Högservice)
  if (['40', '41'].includes(num)) {
    return '2-fack';
  }

  // Default
  return 'Lastbil';
};

/**
 * Extracts vehicle number from vehicle string
 * @param vehicle - The vehicle string (e.g., "Lastbil 20")
 * @returns The vehicle number (e.g., "20")
 */
export const extractVehicleNumber = (vehicle: string): string => {
  // Extract number from strings like "Lastbil 20" or just "20"
  const match = vehicle.match(/\d+/);
  return match ? match[0] : vehicle;
};

/**
 * Generates a formatted label for vehicle badge
 * @param vehicleNumber - The vehicle number as a string
 * @returns Formatted label (e.g., "20 – 4-fack")
 */
export const getVehicleLabel = (vehicleNumber: string): string => {
  const num = vehicleNumber.trim();
  const type = getVehicleType(num);
  return `${num} (${type})`;
};
