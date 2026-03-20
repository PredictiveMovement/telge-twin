import { useState, useCallback } from 'react';
import type { BreakConfig } from '@/types/breaks';

export const useBreaksHistory = (
  breaks: BreakConfig[],
  extraBreaks: BreakConfig[],
  onBreaksChange: (breaks: BreakConfig[]) => void,
  onExtraBreaksChange: (extraBreaks: BreakConfig[]) => void,
  defaultBreaks: BreakConfig[],
  defaultExtraBreaks?: BreakConfig[]
) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [index, setIndex] = useState(-1);
  const initialBreaksRef = useRef(defaultBreaks);
  const initialExtraBreaksRef = useRef(defaultExtraBreaks ?? []);

  const saveToHistory = useCallback((newBreaks: BreakConfig[], newExtraBreaks: BreakConfig[]) => {
    const trimmed = snapshots.slice(0, index + 1);
    if (trimmed.length === 0) {
      trimmed.push({ breaks: [...breaks], extraBreaks: [...extraBreaks] });
    }
    trimmed.push({ breaks: [...newBreaks], extraBreaks: [...newExtraBreaks] });
    setSnapshots(trimmed);
    setIndex(trimmed.length - 1);
  }, [breaks, extraBreaks, snapshots, index]);

  const handleUndo = useCallback(() => {
    if (index > 0) {
      const prev = snapshots[index - 1];
      onBreaksChange(prev.breaks.map(b => ({ ...b })));
      onExtraBreaksChange(prev.extraBreaks.map(b => ({ ...b })));
      setIndex(index - 1);
    }
  }, [index, snapshots, onBreaksChange, onExtraBreaksChange]);

  const handleRedo = useCallback(() => {
    if (index < snapshots.length - 1) {
      const next = snapshots[index + 1];
      onBreaksChange(next.breaks.map(b => ({ ...b })));
      onExtraBreaksChange(next.extraBreaks.map(b => ({ ...b })));
      setIndex(index + 1);
    }
  }, [index, snapshots, onBreaksChange, onExtraBreaksChange]);

  const handleClear = useCallback(() => {
    onBreaksChange(initialBreaksRef.current.map(b => ({ ...b })));
    onExtraBreaksChange(initialExtraBreaksRef.current.map(b => ({ ...b })));
    setSnapshots([]);
    setIndex(-1);
  }, [onBreaksChange, onExtraBreaksChange]);

  const canUndo = index > 0;
  const canRedo = index < snapshots.length - 1;

  return {
    saveToHistory,
    handleUndo,
    handleRedo,
    handleClear,
    canUndo,
    canRedo
  };
};
