import { useState, useCallback } from 'react';

interface BreakConfig {
  id: string;
  name: string;
  duration: number;
  enabled: boolean;
  desiredTime?: string;
}

export const useBreaksHistory = (
  breaks: BreakConfig[],
  extraBreaks: BreakConfig[],
  onBreaksChange: (breaks: BreakConfig[]) => void,
  onExtraBreaksChange: (extraBreaks: BreakConfig[]) => void
) => {
  const [history, setHistory] = useState<{ breaks: BreakConfig[]; extraBreaks: BreakConfig[]; }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Save state to history before making changes
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ breaks: [...breaks], extraBreaks: [...extraBreaks] });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [breaks, extraBreaks, history, historyIndex]);

  const handleUndo = () => {
    if (historyIndex >= 0) {
      const previousState = history[historyIndex];
      onBreaksChange(previousState.breaks);
      onExtraBreaksChange(previousState.extraBreaks);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextState = history[nextIndex];
      onBreaksChange(nextState.breaks);
      onExtraBreaksChange(nextState.extraBreaks);
      setHistoryIndex(nextIndex);
    }
  };

  const handleClear = () => {
    saveToHistory();
    onBreaksChange([...breaks]);
    onExtraBreaksChange([]);
  };

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  return {
    saveToHistory,
    handleUndo,
    handleRedo,
    handleClear,
    canUndo,
    canRedo
  };
};