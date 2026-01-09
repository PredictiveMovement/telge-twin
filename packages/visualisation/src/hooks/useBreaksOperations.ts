import { useCallback } from 'react';

interface BreakConfig {
  id: string;
  name: string;
  duration: number;
  enabled: boolean;
  desiredTime?: string;
}

interface UseBreaksOperationsProps {
  breaks: BreakConfig[];
  extraBreaks: BreakConfig[];
  onBreaksChange: (breaks: BreakConfig[]) => void;
  onExtraBreaksChange: (extraBreaks: BreakConfig[]) => void;
}

export const useBreaksOperations = ({
  breaks,
  extraBreaks,
  onBreaksChange,
  onExtraBreaksChange
}: UseBreaksOperationsProps) => {
  
  const updateBreakDuration = useCallback((id: string, change: number, isExtra = false) => {
    if (isExtra) {
      onExtraBreaksChange(extraBreaks.map(breakItem => 
        breakItem.id === id ? {
          ...breakItem,
          duration: Math.max(5, breakItem.duration + change)
        } : breakItem
      ));
    } else {
      onBreaksChange(breaks.map(breakItem => 
        breakItem.id === id ? {
          ...breakItem,
          duration: Math.max(5, breakItem.duration + change)
        } : breakItem
      ));
    }
  }, [breaks, extraBreaks, onBreaksChange, onExtraBreaksChange]);

  const updateBreakName = useCallback((id: string, newName: string, isExtra = false) => {
    if (isExtra) {
      onExtraBreaksChange(extraBreaks.map(breakItem => 
        breakItem.id === id ? {
          ...breakItem,
          name: newName
        } : breakItem
      ));
    } else {
      onBreaksChange(breaks.map(breakItem => 
        breakItem.id === id ? {
          ...breakItem,
          name: newName
        } : breakItem
      ));
    }
  }, [breaks, extraBreaks, onBreaksChange, onExtraBreaksChange]);

  const updateBreakTime = useCallback((id: string, newTime: string, isExtra = false) => {
    if (isExtra) {
      onExtraBreaksChange(extraBreaks.map(breakItem => 
        breakItem.id === id ? {
          ...breakItem,
          desiredTime: newTime
        } : breakItem
      ));
    } else {
      onBreaksChange(breaks.map(breakItem => 
        breakItem.id === id ? {
          ...breakItem,
          desiredTime: newTime
        } : breakItem
      ));
    }
  }, [breaks, extraBreaks, onBreaksChange, onExtraBreaksChange]);

  const deleteBreak = useCallback((id: string, isExtra = false) => {
    if (isExtra) {
      onExtraBreaksChange(extraBreaks.filter(breakItem => breakItem.id !== id));
    } else {
      onBreaksChange(breaks.filter(breakItem => breakItem.id !== id));
    }
  }, [breaks, extraBreaks, onBreaksChange, onExtraBreaksChange]);

  const addExtraBreak = useCallback(() => {
    const newBreak: BreakConfig = {
      id: `extra-${Date.now()}`,
      name: 'Kort rast',
      duration: 15,
      enabled: true,
      desiredTime: '10:00'
    };
    onExtraBreaksChange([...extraBreaks, newBreak]);
    
    // Scroll to the newly added break
    setTimeout(() => {
      const newBreakElement = document.getElementById(`break-${newBreak.id}`);
      if (newBreakElement) {
        newBreakElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 200);
  }, [extraBreaks, onExtraBreaksChange]);

  return {
    updateBreakDuration,
    updateBreakName,
    updateBreakTime,
    deleteBreak,
    addExtraBreak
  };
};