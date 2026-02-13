const cancelledExperimentIds = new Set<string>()
const loggedCancellationExperimentIds = new Set<string>()

export function markExperimentCancelled(experimentId?: string | null): void {
  if (typeof experimentId !== 'string' || !experimentId) return
  cancelledExperimentIds.add(experimentId)
}

export function clearExperimentCancelled(experimentId?: string | null): void {
  if (typeof experimentId !== 'string' || !experimentId) return
  cancelledExperimentIds.delete(experimentId)
  loggedCancellationExperimentIds.delete(experimentId)
}

export function isExperimentCancelled(experimentId?: string | null): boolean {
  if (typeof experimentId !== 'string' || !experimentId) return false
  return cancelledExperimentIds.has(experimentId)
}

export function resetCancelledExperiments(): void {
  cancelledExperimentIds.clear()
  loggedCancellationExperimentIds.clear()
}

export function shouldLogExperimentCancellation(
  experimentId?: string | null
): boolean {
  if (typeof experimentId !== 'string' || !experimentId) return true
  if (loggedCancellationExperimentIds.has(experimentId)) {
    return false
  }
  loggedCancellationExperimentIds.add(experimentId)
  return true
}

export default {
  markExperimentCancelled,
  clearExperimentCancelled,
  isExperimentCancelled,
  resetCancelledExperiments,
  shouldLogExperimentCancellation,
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
    shouldLogExperimentCancellation,
  }
}
