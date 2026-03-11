const cancelledExperimentIds = new Set<string>()

export function markExperimentCancelled(experimentId?: string | null): void {
  if (typeof experimentId !== 'string' || !experimentId) return
  cancelledExperimentIds.add(experimentId)
}

export function clearExperimentCancelled(experimentId?: string | null): void {
  if (typeof experimentId !== 'string' || !experimentId) return
  cancelledExperimentIds.delete(experimentId)
}

export function isExperimentCancelled(experimentId?: string | null): boolean {
  if (typeof experimentId !== 'string' || !experimentId) return false
  return cancelledExperimentIds.has(experimentId)
}

export function resetCancelledExperiments(): void {
  cancelledExperimentIds.clear()
}

export default {
  markExperimentCancelled,
  clearExperimentCancelled,
  isExperimentCancelled,
  resetCancelledExperiments,
}

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = {
    markExperimentCancelled,
    clearExperimentCancelled,
    isExperimentCancelled,
    resetCancelledExperiments,
  }
}
