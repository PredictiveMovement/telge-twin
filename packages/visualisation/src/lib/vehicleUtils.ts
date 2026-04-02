/**
 * Vehicle utility functions for mapping vehicle numbers to types
 */

import telgeSettings from '@/config/telge-settings.json'

const bilSettings: Array<{ ID: string; BESKRIVNING: string }> =
  (telgeSettings as any).settings?.bilar || []

const bilLookup = new Map(bilSettings.map(b => [b.ID, b.BESKRIVNING]))

/**
 * Maps vehicle number to its type via telge-settings.json
 * @param vehicleNumber - The vehicle number as a string (e.g., "20")
 * @returns The vehicle type (e.g., "Hushåll 4-fack", "Högservice 2-fack")
 */
export const getVehicleType = (vehicleNumber: string): string => {
  const num = vehicleNumber.trim();
  return bilLookup.get(num) || 'Okänd';
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
 * @returns Formatted label (e.g., "20 (Hushåll 4-fack)")
 */
export const getVehicleLabel = (vehicleNumber: string): string => {
  const num = vehicleNumber.trim();
  const type = getVehicleType(num);
  return `${num} (${type})`;
};
