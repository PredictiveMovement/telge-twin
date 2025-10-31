/**
 * Shared utilities for capacity calculations
 */

/**
 * Builds indexes from settings for faster lookups.
 * Extracted to avoid duplication across capacity functions.
 * 
 * @param settings - Dataset settings containing avftyper and tjtyper
 * @returns Object with avfIndex and tjIndex
 */
export function buildSettingsIndexes(settings: any) {
  const avfIndex: Record<string, { ID: string; BESKRIVNING?: string; VOLYMVIKT?: number }> =
    Object.fromEntries((settings?.avftyper || []).map((a: any) => [a.ID, a]))
  
  const tjIndex: Record<string, { ID: string; VOLYM?: number; FYLLNADSGRAD?: number }> =
    Object.fromEntries((settings?.tjtyper || []).map((t: any) => [t.ID, t]))
  
  return { avfIndex, tjIndex }
}

