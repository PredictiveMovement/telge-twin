import { useCallback } from 'react';
import type { BreakConfig } from '@/types/breaks';

interface UseBreaksOperationsProps {
  breaks: BreakConfig[];
  extraBreaks: BreakConfig[];
  onBreaksChange: (breaks: BreakConfig[]) => void;
  onExtraBreaksChange: (extraBreaks: BreakConfig[]) => void;
  saveToHistory: (newBreaks: BreakConfig[], newExtraBreaks: BreakConfig[]) => void;
}

export const useBreaksOperations = ({
  breaks,
  extraBreaks,
  onBreaksChange,
  onExtraBreaksChange,
  saveToHistory
}: UseBreaksOperationsProps) => {

  const updateBreakDuration = useCallback((id: string, change: number, isExtra = false) => {
    const update = (b: BreakConfig) =>
      b.id === id ? { ...b, duration: Math.max(5, b.duration + change) } : b;
    const newBreaks = isExtra ? breaks : breaks.map(update);
    const newExtraBreaks = isExtra ? extraBreaks.map(update) : extraBreaks;
    saveToHistory(newBreaks, newExtraBreaks);
    if (isExtra) {
      onExtraBreaksChange(newExtraBreaks);
    } else {
      onBreaksChange(newBreaks);
    }
  }, [breaks, extraBreaks, onBreaksChange, onExtraBreaksChange, saveToHistory]);

  const updateBreakName = useCallback((id: string, newName: string, isExtra = false) => {
    const update = (b: BreakConfig) =>
      b.id === id ? { ...b, name: newName } : b;
    const newBreaks = isExtra ? breaks : breaks.map(update);
    const newExtraBreaks = isExtra ? extraBreaks.map(update) : extraBreaks;
    saveToHistory(newBreaks, newExtraBreaks);
    if (isExtra) {
      onExtraBreaksChange(newExtraBreaks);
    } else {
      onBreaksChange(newBreaks);
    }
  }, [breaks, extraBreaks, onBreaksChange, onExtraBreaksChange, saveToHistory]);

  const updateBreakTime = useCallback((id: string, newTime: string, isExtra = false) => {
    const update = (b: BreakConfig) =>
      b.id === id ? { ...b, desiredTime: newTime } : b;
    const newBreaks = isExtra ? breaks : breaks.map(update);
    const newExtraBreaks = isExtra ? extraBreaks.map(update) : extraBreaks;
    saveToHistory(newBreaks, newExtraBreaks);
    if (isExtra) {
      onExtraBreaksChange(newExtraBreaks);
    } else {
      onBreaksChange(newBreaks);
    }
  }, [breaks, extraBreaks, onBreaksChange, onExtraBreaksChange, saveToHistory]);

  const updateBreakLocation = useCallback((id: string, newLocation: string, isExtra = false, coordinates?: { lat: number; lng: number }) => {
    const update = (b: BreakConfig) =>
      b.id === id ? { ...b, location: newLocation, locationCoordinates: coordinates ?? undefined } : b;
    const newBreaks = isExtra ? breaks : breaks.map(update);
    const newExtraBreaks = isExtra ? extraBreaks.map(update) : extraBreaks;
    saveToHistory(newBreaks, newExtraBreaks);
    if (isExtra) {
      onExtraBreaksChange(newExtraBreaks);
    } else {
      onBreaksChange(newBreaks);
    }
  }, [breaks, extraBreaks, onBreaksChange, onExtraBreaksChange, saveToHistory]);

  const deleteBreak = useCallback((id: string, isExtra = false) => {
    const newBreaks = isExtra ? breaks : breaks.filter(b => b.id !== id);
    const newExtraBreaks = isExtra ? extraBreaks.filter(b => b.id !== id) : extraBreaks;
    saveToHistory(newBreaks, newExtraBreaks);
    if (isExtra) {
      onExtraBreaksChange(newExtraBreaks);
    } else {
      onBreaksChange(newBreaks);
    }
  }, [breaks, extraBreaks, onBreaksChange, onExtraBreaksChange, saveToHistory]);

  const addExtraBreak = useCallback(() => {
    const newBreak: BreakConfig = {
      id: `extra-${Date.now()}`,
      name: 'Kort rast',
      duration: 15,
      enabled: true,
      desiredTime: '10:00'
    };
    const newExtraBreaks = [...extraBreaks, newBreak];
    saveToHistory(breaks, newExtraBreaks);
    onExtraBreaksChange(newExtraBreaks);

    setTimeout(() => {
      const newBreakElement = document.getElementById(`break-${newBreak.id}`);
      if (newBreakElement) {
        newBreakElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
  }, [breaks, extraBreaks, onExtraBreaksChange, saveToHistory]);

  return {
    updateBreakDuration,
    updateBreakName,
    updateBreakTime,
    updateBreakLocation,
    deleteBreak,
    addExtraBreak
  };
};
