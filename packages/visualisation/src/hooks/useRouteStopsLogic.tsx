import type React from 'react';
import { useState, useCallback } from 'react';
import { Stop } from '@/types/stops';

export const useRouteStopsLogic = () => {
  const [currentStops] = useState<Stop[]>([]);
  const [optimizedStops, setOptimizedStops] = useState<Stop[]>([]);

  // History states for undo/redo functionality (only for optimized column)
  const [optimizedHistory, setOptimizedHistory] = useState<Stop[][]>([]);
  const [optimizedHistoryIndex, setOptimizedHistoryIndex] = useState(-1);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragListType, setDragListType] = useState<'optimized' | null>(null);

  // Vehicle selection state
  const [selectedVehicle, setSelectedVehicle] = useState("401");

  // Save state to history before making changes (only for optimized column)
  const saveToHistory = useCallback((newStops: Stop[]) => {
    const newHistory = optimizedHistory.slice(0, optimizedHistoryIndex + 1);
    newHistory.push([...optimizedStops]);
    setOptimizedHistory(newHistory);
    setOptimizedHistoryIndex(newHistory.length - 1);
    setOptimizedStops(newStops);
  }, [optimizedStops, optimizedHistory, optimizedHistoryIndex]);

  // Undo functionality (only for optimized column)
  const handleUndo = () => {
    if (optimizedHistoryIndex >= 0) {
      setOptimizedStops(optimizedHistory[optimizedHistoryIndex]);
      setOptimizedHistoryIndex(optimizedHistoryIndex - 1);
    }
  };

  // Redo functionality (only for optimized column)
  const handleRedo = () => {
    if (optimizedHistoryIndex < optimizedHistory.length - 1) {
      const nextIndex = optimizedHistoryIndex + 1;
      setOptimizedStops(optimizedHistory[nextIndex]);
      setOptimizedHistoryIndex(nextIndex);
    }
  };

  // Reset to factory defaults - resets to initial data
  const resetToDefaults = () => {
    setOptimizedStops([]);
    setSelectedVehicle("401");
    setOptimizedHistory([]);
    setOptimizedHistoryIndex(-1);
  };

  // Drag and drop functions
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(`optimized-${id}`);
    setDragListType('optimized');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragListType === 'optimized') {
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedItem || dragListType !== 'optimized') {
      setDragOverIndex(null);
      return;
    }
    const [, sourceId] = draggedItem.split('-');
    const draggedIndex = optimizedStops.findIndex(stop => stop.id === sourceId);
    if (draggedIndex === -1) return;
    
    const newStops = [...optimizedStops];
    const [draggedStop] = newStops.splice(draggedIndex, 1);
    const insertIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;
    
    // Calculate new estimated time for the moved stop based on its new position
    const newEstimatedTime = calculateTimeForPosition(insertIndex, newStops);
    const updatedDraggedStop = { ...draggedStop, estimatedTime: newEstimatedTime };
    
    newStops.splice(insertIndex, 0, updatedDraggedStop);
    saveToHistory(newStops);
    setDraggedItem(null);
    setDragOverIndex(null);
    setDragListType(null);
  };

  const updateStopDuration = (stopId: string, change: number) => {
    const newStops = optimizedStops.map(stop => 
      stop.id === stopId 
        ? { ...stop, duration: Math.max(5, (stop.duration || 15) + change) }
        : stop
    );
    saveToHistory(newStops);
  };

  // Helper function to convert time string to minutes since start (06:00)
  const timeToMinutes = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return (hours - 6) * 60 + minutes;
  };

  // Helper function to convert minutes since start back to time string
  const minutesToTime = (minutes: number): string => {
    const totalMinutes = minutes + (6 * 60); // Add start time offset
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Helper function to calculate estimated time for a position
  const calculateTimeForPosition = (position: number, stops: Stop[]): string => {
    let cumulativeTime = 0; // Minutes since 06:00
    
    for (let i = 0; i < position; i++) {
      if (i < stops.length) {
        const stop = stops[i];
        cumulativeTime += stop.duration || 15;
      }
    }
    
    return minutesToTime(cumulativeTime);
  };

  // Helper function to find correct position for a time-based insertion
  const findPositionForTime = (estimatedTime: string, stops: Stop[]): number => {
    const targetMinutes = timeToMinutes(estimatedTime);
    let cumulativeTime = 0;
    
    for (let i = 0; i < stops.length; i++) {
      if (cumulativeTime >= targetMinutes) {
        return i;
      }
      cumulativeTime += stops[i].duration || 15;
    }
    
    return stops.length; // Insert at the end if no suitable position found
  };

  const updateBreak = (stopId: string, updates: { duration?: number, estimatedTime?: string, address?: string }) => {
    const newStops = optimizedStops.map(stop => 
      stop.id === stopId 
        ? { ...stop, ...updates }
        : stop
    );
    saveToHistory(newStops);
  };

  const updateTipping = (stopId: string, updates: { duration?: number, estimatedTime?: string, address?: string }) => {
    const newStops = optimizedStops.map(stop => 
      stop.id === stopId 
        ? { ...stop, ...updates }
        : stop
    );
    saveToHistory(newStops);
  };

  const deleteBreak = (stopId: string) => {
    const newStops = optimizedStops.filter(stop => stop.id !== stopId);
    saveToHistory(newStops);
  };

  const deleteTipping = (stopId: string) => {
    const newStops = optimizedStops.filter(stop => stop.id !== stopId);
    saveToHistory(newStops);
  };

  const deleteRegularStop = (stopId: string) => {
    const newStops = optimizedStops.filter(stop => stop.id !== stopId);
    saveToHistory(newStops);
  };

  // Check if optimized stops differ from current stops
  const hasChangesFromOriginal = () => {
    if (optimizedStops.length !== currentStops.length) {
      return true;
    }
    
    // Compare stops by ID, order, and key properties
    for (let i = 0; i < optimizedStops.length; i++) {
      const optimizedStop = optimizedStops[i];
      const currentStop = currentStops[i];
      
      if (optimizedStop.id !== currentStop.id || 
          optimizedStop.duration !== currentStop.duration ||
          optimizedStop.address !== currentStop.address) {
        return true;
      }
    }
    
    return false;
  };

  return {
    currentStops,
    optimizedStops,
    selectedVehicle,
    setSelectedVehicle,
    draggedItem,
    dragOverIndex,
    handleUndo,
    handleRedo,
    resetToDefaults,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  updateStopDuration,
  updateBreak,
  updateTipping,
  deleteBreak,
  deleteTipping,
  deleteRegularStop,
    addNewStop: (type: 'break' | 'tipping', position: number, address: string, duration: number, estimatedTime?: string) => {
      const newStop: Stop = {
        id: Date.now().toString(),
        type,
        address: address || (type === 'break' ? 'Rast' : 'Tippning'),
        duration,
        estimatedTime,
        originalPosition: position
      };
      
      const newStops = [...optimizedStops];
      
      // If estimatedTime is provided, find correct position based on time order
      let insertPosition = position;
      if (estimatedTime) {
        insertPosition = findPositionForTime(estimatedTime, newStops);
      } else {
        // If no time specified, calculate estimated time for the given position
        newStop.estimatedTime = calculateTimeForPosition(position, newStops);
      }
      
      newStops.splice(insertPosition, 0, newStop);
      saveToHistory(newStops);
    },
    canUndo: optimizedHistoryIndex >= 0,
    canRedo: optimizedHistoryIndex < optimizedHistory.length - 1,
    hasChangesFromOriginal: hasChangesFromOriginal()
  };
};
