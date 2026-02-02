import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useMapSocket } from '@/hooks/useMapSocket';

// Phase 1: Save phase (shown on save page)
const SAVE_PHASE = 'Projektet sparas';
const SAVE_DURATION_MS = 1500;

// Phase 2: Optimization phases (shown on sparade optimeringar)
const OPTIMIZATION_PHASES = [
  'Ser över fordon',
  'Skapar kluster över hämtområden',
  'Schemalägger raster',
  'Planerar upphämtningar',
  'Optimerar körtur',
];
const OPTIMIZATION_DURATION_MS = 13000;

// Sounds for optimization
const SUCCESS_SOUND_URL = '/sounds/optimization-success.mp3';

export interface RunningOptimization {
  id: string;
  name: string;
  progress: number;
  phase: string;
  phaseIndex: number;
  isSavePhase: boolean;
  isUpdate: boolean;
  expectedVehicleCount: number;
  savedPlanCount: number;
}

interface StartOptimizationOptions {
  onNavigate?: () => void;
  onComplete?: () => void;
  isUpdate?: boolean;
  expectedVehicleCount?: number;
}

interface CompletionInfo {
  isUpdate: boolean;
}

interface OptimizationContextType {
  runningOptimizations: Map<string, RunningOptimization>;
  completedOptimizations: Map<string, CompletionInfo>;
  startOptimization: (id: string, name: string, options?: StartOptimizationOptions) => void;
  cancelOptimization: (id: string) => void;
  completeOptimization: (id: string) => void;
  markAsViewed: (id: string) => void;
  isOptimizing: (id: string) => boolean;
  isCompleted: (id: string) => boolean;
  hasAnyCompleted: () => boolean;
  getCurrentOptimization: () => RunningOptimization | null;
  getCompletionInfo: (id: string) => CompletionInfo | null;
}

const createNoopContext = (): OptimizationContextType => ({
  runningOptimizations: new Map(),
  completedOptimizations: new Map(),
  startOptimization: () => {},
  cancelOptimization: () => {},
  completeOptimization: () => {},
  markAsViewed: () => {},
  isOptimizing: () => false,
  isCompleted: () => false,
  hasAnyCompleted: () => false,
  getCurrentOptimization: () => null,
  getCompletionInfo: () => null,
});

// Provide a safe default to avoid hard-crashes if provider mounting glitches (e.g. during HMR).
const OptimizationContext = createContext<OptimizationContextType>(createNoopContext());

export const useOptimizationContext = () => {
  return useContext(OptimizationContext);
};

export const OptimizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket } = useMapSocket();
  const [runningOptimizations, setRunningOptimizations] = useState<Map<string, RunningOptimization>>(new Map());
  const [completedOptimizations, setCompletedOptimizations] = useState<Map<string, CompletionInfo>>(new Map());
  const isUpdateRef = useRef<Map<string, boolean>>(new Map());
  const animationFramesRef = useRef<Map<string, number>>(new Map());
  const startTimesRef = useRef<Map<string, number>>(new Map());
  const onCompleteCallbacksRef = useRef<Map<string, () => void>>(new Map());
  const onNavigateCallbacksRef = useRef<Map<string, () => void>>(new Map());
  const hasNavigatedRef = useRef<Set<string>>(new Set());
  const completingRef = useRef<Set<string>>(new Set()); // Track IDs being completed to prevent double-calls
  const completionAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    completionAudioRef.current = new Audio(SUCCESS_SOUND_URL);
    completionAudioRef.current.volume = 0.5;
  }, []);

  const playCompletionSound = useCallback(() => {
    if (completionAudioRef.current) {
      completionAudioRef.current.currentTime = 0;
      completionAudioRef.current.play().catch(console.error);
    }
  }, []);

  const startOptimization = useCallback((id: string, name: string, options?: StartOptimizationOptions) => {
    if (options?.onComplete) {
      onCompleteCallbacksRef.current.set(id, options.onComplete);
    }
    if (options?.onNavigate) {
      onNavigateCallbacksRef.current.set(id, options.onNavigate);
    }
    isUpdateRef.current.set(id, options?.isUpdate ?? false);
    hasNavigatedRef.current.delete(id);
    completingRef.current.delete(id); // Säkerställ rent tillstånd för re-runs

    const isUpdate = options?.isUpdate ?? false;
    const expectedVehicleCount = options?.expectedVehicleCount ?? 1;

    // Start with save phase
    setRunningOptimizations(prev => {
      const next = new Map(prev);
      next.set(id, {
        id,
        name,
        progress: 0,
        phase: SAVE_PHASE,
        phaseIndex: 0,
        isSavePhase: true,
        isUpdate,
        expectedVehicleCount,
        savedPlanCount: 0,
      });
      return next;
    });

    let savePhaseComplete = false;
    let optimizationStartTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTimesRef.current.has(id)) {
        startTimesRef.current.set(id, timestamp);
      }

      const startTime = startTimesRef.current.get(id)!;
      const elapsed = timestamp - startTime;

      // Phase 1: Save phase
      if (!savePhaseComplete) {
        const linearProgress = Math.min(1, elapsed / SAVE_DURATION_MS);
        // Ease-in quadratic: starts slow, accelerates toward the end
        const easedProgress = linearProgress * linearProgress;
        const progress = Math.round(easedProgress * 100);

        setRunningOptimizations(prev => {
          const next = new Map(prev);
          const current = next.get(id);
          if (current) {
            next.set(id, {
              ...current,
              progress,
              phase: SAVE_PHASE,
              phaseIndex: 0,
              isSavePhase: true,
              isUpdate: current.isUpdate,
            });
          }
          return next;
        });

        if (linearProgress >= 1) {
          savePhaseComplete = true;

          // Navigate after save phase completes
          if (!hasNavigatedRef.current.has(id)) {
            hasNavigatedRef.current.add(id);
            const navigateCallback = onNavigateCallbacksRef.current.get(id);
            if (navigateCallback) {
              navigateCallback();
              onNavigateCallbacksRef.current.delete(id);
            }
          }

          // Reset progress for optimization phase
          optimizationStartTime = timestamp;
          setRunningOptimizations(prev => {
            const next = new Map(prev);
            const current = next.get(id);
            if (current) {
              next.set(id, {
                ...current,
                progress: 0,
                phase: OPTIMIZATION_PHASES[0],
                phaseIndex: 0,
                isSavePhase: false,
                isUpdate: current.isUpdate,
              });
            }
            return next;
          });
        }

        const frameId = requestAnimationFrame(animate);
        animationFramesRef.current.set(id, frameId);
        return;
      }

      // Phase 2: Optimization phase - loops continuously until completeOptimization() is called
      if (optimizationStartTime === null) {
        optimizationStartTime = timestamp;
      }

      const optimizationElapsed = timestamp - optimizationStartTime;
      // Loop the progress using modulo instead of capping at 1
      const cycleProgress = (optimizationElapsed % OPTIMIZATION_DURATION_MS) / OPTIMIZATION_DURATION_MS;
      const progress = Math.round(cycleProgress * 100);
      const phaseIndex = Math.floor(cycleProgress * OPTIMIZATION_PHASES.length) % OPTIMIZATION_PHASES.length;

      setRunningOptimizations(prev => {
        const next = new Map(prev);
        const current = next.get(id);
        if (current) {
          next.set(id, {
            ...current,
            progress,
            phase: OPTIMIZATION_PHASES[phaseIndex],
            phaseIndex,
            isSavePhase: false,
            isUpdate: current.isUpdate,
          });
        }
        return next;
      });

      // Always continue looping - only completeOptimization() can stop the animation
      const frameId = requestAnimationFrame(animate);
      animationFramesRef.current.set(id, frameId);
    };

    const frameId = requestAnimationFrame(animate);
    animationFramesRef.current.set(id, frameId);
  }, [playCompletionSound]);

  const cancelOptimization = useCallback((id: string) => {
    const frameId = animationFramesRef.current.get(id);
    if (frameId) {
      cancelAnimationFrame(frameId);
      animationFramesRef.current.delete(id);
    }
    startTimesRef.current.delete(id);
    onCompleteCallbacksRef.current.delete(id);
    onNavigateCallbacksRef.current.delete(id);
    hasNavigatedRef.current.delete(id);
    completingRef.current.delete(id);

    setRunningOptimizations(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const completeOptimization = useCallback((id: string) => {
    // Prevent multiple calls for the same ID (can happen due to async state updates)
    if (completingRef.current.has(id)) {
      return;
    }
    completingRef.current.add(id);

    // Stop animation
    const frameId = animationFramesRef.current.get(id);
    if (frameId) {
      cancelAnimationFrame(frameId);
      animationFramesRef.current.delete(id);
    }

    // Get isUpdate flag before cleanup
    const isUpdate = isUpdateRef.current.get(id) ?? false;

    // Move to completed
    setRunningOptimizations(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setCompletedOptimizations(prev => {
      const next = new Map(prev);
      next.set(id, { isUpdate });
      return next;
    });

    // Cleanup refs (note: completingRef is NOT cleared here - it prevents duplicate calls during async state updates)
    startTimesRef.current.delete(id);
    hasNavigatedRef.current.delete(id);
    isUpdateRef.current.delete(id);

    // Play completion sound
    playCompletionSound();

    // Call completion callback
    const callback = onCompleteCallbacksRef.current.get(id);
    if (callback) {
      callback();
      onCompleteCallbacksRef.current.delete(id);
    }
  }, [playCompletionSound]);

  const markAsViewed = useCallback((id: string) => {
    setCompletedOptimizations(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    // Rensa completingRef här - naturlig slutpunkt för completion-cykeln
    completingRef.current.delete(id);
  }, []);

  const isOptimizing = useCallback((id: string) => {
    return runningOptimizations.has(id);
  }, [runningOptimizations]);

  const isCompleted = useCallback((id: string) => {
    return completedOptimizations.has(id);
  }, [completedOptimizations]);

  const hasAnyCompleted = useCallback(() => {
    return completedOptimizations.size > 0;
  }, [completedOptimizations]);

  const getCurrentOptimization = useCallback((): RunningOptimization | null => {
    const entries = Array.from(runningOptimizations.values());
    return entries.length > 0 ? entries[0] : null;
  }, [runningOptimizations]);

  const getCompletionInfo = useCallback((id: string): CompletionInfo | null => {
    return completedOptimizations.get(id) ?? null;
  }, [completedOptimizations]);

  // Listen for planSaved socket events to detect optimization completion
  // This replaces polling with real-time notifications from the backend
  useEffect(() => {
    if (!socket) return;

    const handlePlanSaved = (data: { experimentId: string; planId: string; sourceDatasetId?: string }) => {
      // Find the running optimization that matches this sourceDatasetId
      const datasetId = data.sourceDatasetId;
      if (!datasetId) return;

      const runningOpt = runningOptimizations.get(datasetId);
      if (runningOpt && !runningOpt.isSavePhase) {
        const newSavedCount = runningOpt.savedPlanCount + 1;

        // Check if all expected vehicles have saved their plans
        if (newSavedCount >= runningOpt.expectedVehicleCount) {
          completeOptimization(datasetId);
        } else {
          // Update the saved plan count
          setRunningOptimizations(prev => {
            const next = new Map(prev);
            const current = next.get(datasetId);
            if (current) {
              next.set(datasetId, {
                ...current,
                savedPlanCount: newSavedCount,
              });
            }
            return next;
          });
        }
      }
    };

    socket.on('planSaved', handlePlanSaved);

    return () => {
      socket.off('planSaved', handlePlanSaved);
    };
  }, [socket, runningOptimizations, completeOptimization]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      animationFramesRef.current.forEach(frameId => cancelAnimationFrame(frameId));
    };
  }, []);

  return (
    <OptimizationContext.Provider
      value={{
        runningOptimizations,
        completedOptimizations,
        startOptimization,
        cancelOptimization,
        completeOptimization,
        markAsViewed,
        isOptimizing,
        isCompleted,
        hasAnyCompleted,
        getCurrentOptimization,
        getCompletionInfo,
      }}
    >
      {children}
    </OptimizationContext.Provider>
  );
};
