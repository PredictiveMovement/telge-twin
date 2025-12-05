import type React from 'react'
import { useState, useCallback, useEffect, useRef } from 'react'
import { Stop } from '@/types/stops'

interface UseRouteStopsLogicProps {
  initialCurrentStops?: Stop[]
  initialOptimizedStops?: Stop[]
  startTime?: string
}

export const useRouteStopsLogic = (props?: UseRouteStopsLogicProps) => {
  const {
    initialCurrentStops = [],
    initialOptimizedStops = [],
    startTime = '06:00',
  } = props || {}

  const [currentStops] = useState<Stop[]>(initialCurrentStops)
  const [optimizedStops, setOptimizedStops] = useState<Stop[]>(initialOptimizedStops)
  const [parkedStops, setParkedStops] = useState<Stop[]>([])
  const [lastSavedStops, setLastSavedStops] = useState<Stop[]>(initialOptimizedStops)

  // History states for undo/redo functionality (only for optimized column)
  const [optimizedHistory, setOptimizedHistory] = useState<Stop[][]>([])
  const [optimizedHistoryIndex, setOptimizedHistoryIndex] = useState(-1)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragListType, setDragListType] = useState<
    'optimized' | 'parked' | 'preview' | null
  >(null)

  // Vehicle selection state
  const [selectedVehicle, setSelectedVehicle] = useState('401')

  // Track previous initialOptimizedStops to detect actual changes
  const prevInitialStopsRef = useRef<string>('')

  // Sync optimizedStops when initialOptimizedStops prop changes
  useEffect(() => {
    const newIds = initialOptimizedStops.map(s => s.id).join(',')

    // Only update if content actually changed (avoid re-render loops)
    if (newIds !== prevInitialStopsRef.current && initialOptimizedStops.length > 0) {
      prevInitialStopsRef.current = newIds
      setOptimizedStops(initialOptimizedStops)
      setLastSavedStops(initialOptimizedStops)
      // Reset history when data source changes
      setOptimizedHistory([])
      setOptimizedHistoryIndex(-1)
    }
  }, [initialOptimizedStops])

  // Save state to history before making changes (only for optimized column)
  const saveToHistory = useCallback(
    (newStops: Stop[]) => {
      const newHistory = optimizedHistory.slice(0, optimizedHistoryIndex + 1)
      newHistory.push([...optimizedStops])
      setOptimizedHistory(newHistory)
      setOptimizedHistoryIndex(newHistory.length - 1)
      setOptimizedStops(newStops)
    },
    [optimizedStops, optimizedHistory, optimizedHistoryIndex]
  )

  // Undo functionality (only for optimized column)
  const handleUndo = () => {
    if (optimizedHistoryIndex >= 0) {
      setOptimizedStops(optimizedHistory[optimizedHistoryIndex])
      setOptimizedHistoryIndex(optimizedHistoryIndex - 1)
    }
  }

  // Redo functionality (only for optimized column)
  const handleRedo = () => {
    if (optimizedHistoryIndex < optimizedHistory.length - 1) {
      const nextIndex = optimizedHistoryIndex + 1
      setOptimizedStops(optimizedHistory[nextIndex])
      setOptimizedHistoryIndex(nextIndex)
    }
  }

  // Clear/Reset functionality
  const handleClear = () => {
    saveToHistory(currentStops)
  }

  // Reset to factory defaults - resets to initial data
  const resetToDefaults = () => {
    setOptimizedStops(initialOptimizedStops)
    setParkedStops([])
    setSelectedVehicle('401')
    setOptimizedHistory([])
    setOptimizedHistoryIndex(-1)
  }

  // Helper function to convert time string to minutes since start
  const timeToMinutes = (timeString: string): number => {
    const [startHours] = startTime.split(':').map(Number)
    const [hours, minutes] = timeString.split(':').map(Number)
    return (hours - startHours) * 60 + minutes
  }

  // Helper function to convert minutes since start back to time string
  const minutesToTime = (minutes: number): string => {
    const [startHours] = startTime.split(':').map(Number)
    const totalMinutes = minutes + startHours * 60
    const hours = Math.floor(totalMinutes / 60)
    const mins = totalMinutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  // Helper function to calculate estimated time for a position
  const calculateTimeForPosition = (position: number, stops: Stop[]): string => {
    let cumulativeTime = 0 // Minutes since start

    for (let i = 0; i < position; i++) {
      if (i < stops.length) {
        const stop = stops[i]
        cumulativeTime += stop.duration || 15
      }
    }

    return minutesToTime(cumulativeTime)
  }

  // Helper function to find correct position for a time-based insertion
  const findPositionForTime = (estimatedTime: string, stops: Stop[]): number => {
    const targetMinutes = timeToMinutes(estimatedTime)
    let cumulativeTime = 0

    for (let i = 0; i < stops.length; i++) {
      if (cumulativeTime >= targetMinutes) {
        return i
      }
      cumulativeTime += stops[i].duration || 15
    }

    return stops.length // Insert at the end if no suitable position found
  }

  // Drag and drop functions
  const handleDragStart = (
    e: React.DragEvent,
    id: string,
    source: 'optimized' | 'parked' | 'preview' = 'optimized'
  ) => {
    setDraggedItem(`${source}-${id}`)
    setDragListType(source)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (
      dragListType === 'optimized' ||
      dragListType === 'parked' ||
      dragListType === 'preview'
    ) {
      e.dataTransfer.dropEffect = 'move'
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (!draggedItem || !dragListType) {
      setDragOverIndex(null)
      return
    }

    const [sourceListType, sourceId] = draggedItem.split('-')

    if (sourceListType === 'preview') {
      // Handle preview data from dataTransfer
      const previewDataStr = e.dataTransfer.getData('text/plain')
      if (previewDataStr) {
        try {
          const previewData = JSON.parse(previewDataStr)
          const newStop: Stop = {
            id: Date.now().toString(),
            type: previewData.type,
            address: previewData.address || '',
            duration: previewData.duration || 0,
            estimatedTime:
              previewData.estimatedTime ||
              calculateTimeForPosition(targetIndex, optimizedStops),
            originalPosition: targetIndex,
          }

          const newOptimizedStops = [...optimizedStops]
          newOptimizedStops.splice(targetIndex, 0, newStop)
          saveToHistory(newOptimizedStops)
        } catch (error) {
          console.error('Failed to parse preview data:', error)
        }
      }
    } else if (sourceListType === 'parked') {
      // Drag from parked stops to optimized
      const parkedStop = parkedStops.find((stop) => stop.id === sourceId)
      if (!parkedStop) {
        setDraggedItem(null)
        setDragOverIndex(null)
        setDragListType(null)
        return
      }

      const newParkedStops = parkedStops.filter((stop) => stop.id !== sourceId)
      setParkedStops(newParkedStops)

      const newOptimizedStops = [...optimizedStops]
      const newEstimatedTime = calculateTimeForPosition(targetIndex, newOptimizedStops)
      const updatedStop = { ...parkedStop, estimatedTime: newEstimatedTime }
      newOptimizedStops.splice(targetIndex, 0, updatedStop)

      saveToHistory(newOptimizedStops)
    } else if (sourceListType === 'optimized') {
      // Move within optimized stops
      const draggedIndex = optimizedStops.findIndex((stop) => stop.id === sourceId)
      if (draggedIndex === -1) {
        setDraggedItem(null)
        setDragOverIndex(null)
        setDragListType(null)
        return
      }

      const newStops = [...optimizedStops]
      const [draggedStop] = newStops.splice(draggedIndex, 1)
      const insertIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex

      // Calculate new estimated time for the moved stop based on its new position
      const newEstimatedTime = calculateTimeForPosition(insertIndex, newStops)
      const updatedDraggedStop = { ...draggedStop, estimatedTime: newEstimatedTime }

      newStops.splice(insertIndex, 0, updatedDraggedStop)
      saveToHistory(newStops)
    }

    setDraggedItem(null)
    setDragOverIndex(null)
    setDragListType(null)
  }

  const updateStopDuration = (stopId: string, change: number) => {
    const newStops = optimizedStops.map((stop) =>
      stop.id === stopId
        ? { ...stop, duration: Math.max(5, (stop.duration || 15) + change) }
        : stop
    )
    saveToHistory(newStops)
  }

  const updateBreak = (
    stopId: string,
    updates: { duration?: number; estimatedTime?: string; address?: string }
  ) => {
    const newStops = optimizedStops.map((stop) =>
      stop.id === stopId ? { ...stop, ...updates } : stop
    )
    saveToHistory(newStops)
  }

  const updateTipping = (
    stopId: string,
    updates: { duration?: number; estimatedTime?: string; address?: string }
  ) => {
    const newStops = optimizedStops.map((stop) =>
      stop.id === stopId ? { ...stop, ...updates } : stop
    )
    saveToHistory(newStops)
  }

  const deleteBreak = (stopId: string) => {
    const newStops = optimizedStops.filter((stop) => stop.id !== stopId)
    saveToHistory(newStops)
  }

  const deleteTipping = (stopId: string) => {
    const newStops = optimizedStops.filter((stop) => stop.id !== stopId)
    saveToHistory(newStops)
  }

  const deleteRegularStop = (stopId: string) => {
    const newStops = optimizedStops.filter((stop) => stop.id !== stopId)
    saveToHistory(newStops)
  }

  // Check if optimized stops differ from last saved state
  const hasChangesFromOriginal = () => {
    if (optimizedStops.length !== lastSavedStops.length) {
      return true
    }

    // Compare stops by ID, order, and key properties
    for (let i = 0; i < optimizedStops.length; i++) {
      const optimizedStop = optimizedStops[i]
      const savedStop = lastSavedStops[i]

      if (
        optimizedStop.id !== savedStop.id ||
        optimizedStop.duration !== savedStop.duration ||
        optimizedStop.address !== savedStop.address
      ) {
        return true
      }
    }

    return false
  }

  // Park a stop
  const parkStop = useCallback(
    (stopId: string) => {
      const stopIndex = optimizedStops.findIndex((stop) => stop.id === stopId)
      if (stopIndex === -1) return

      const stop = optimizedStops[stopIndex]
      const newOptimizedStops = optimizedStops.filter((s) => s.id !== stopId)
      const newParkedStops = [...parkedStops, stop]

      setParkedStops(newParkedStops)
      saveToHistory(newOptimizedStops)
    },
    [optimizedStops, parkedStops, saveToHistory]
  )

  // Restore a parked stop
  const restoreParkedStop = useCallback(
    (stopId: string, position: number) => {
      const parkedStop = parkedStops.find((stop) => stop.id === stopId)
      if (!parkedStop) return

      const newParkedStops = parkedStops.filter((stop) => stop.id !== stopId)
      const newOptimizedStops = [...optimizedStops]
      newOptimizedStops.splice(position, 0, parkedStop)

      setParkedStops(newParkedStops)
      saveToHistory(newOptimizedStops)
    },
    [parkedStops, optimizedStops, saveToHistory]
  )

  // Restore multiple parked stops at once
  const restoreMultipleParkedStops = useCallback(
    (stopIds: string[]) => {
      const stopsToRestore = parkedStops.filter((stop) => stopIds.includes(stop.id))

      if (stopsToRestore.length === 0) return

      saveToHistory([...optimizedStops, ...stopsToRestore])

      const newParkedStops = parkedStops.filter((stop) => !stopIds.includes(stop.id))
      setParkedStops(newParkedStops)
    },
    [parkedStops, optimizedStops, saveToHistory]
  )

  // Mark as saved
  const markAsSaved = useCallback(() => {
    setLastSavedStops([...optimizedStops])
  }, [optimizedStops])

  return {
    currentStops,
    optimizedStops,
    parkedStops,
    selectedVehicle,
    setSelectedVehicle,
    draggedItem,
    dragOverIndex,
    handleUndo,
    handleRedo,
    handleClear,
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
    parkStop,
    restoreParkedStop,
    restoreMultipleParkedStops,
    markAsSaved,
    addNewStop: (
      type: 'break' | 'tipping' | 'lunch',
      position: number,
      address: string,
      duration: number,
      estimatedTime?: string
    ) => {
      const newStop: Stop = {
        id: Date.now().toString(),
        type,
        address: address || (type === 'break' ? 'Rast' : 'Tippning'),
        duration,
        estimatedTime,
        originalPosition: position,
      }

      const newStops = [...optimizedStops]

      // If estimatedTime is provided, find correct position based on time order
      let insertPosition = position
      if (estimatedTime) {
        insertPosition = findPositionForTime(estimatedTime, newStops)
      } else {
        // If no time specified, calculate estimated time for the given position
        newStop.estimatedTime = calculateTimeForPosition(position, newStops)
      }

      newStops.splice(insertPosition, 0, newStop)
      saveToHistory(newStops)
    },
    canUndo: optimizedHistoryIndex >= 0,
    canRedo: optimizedHistoryIndex < optimizedHistory.length - 1,
    hasChangesFromOriginal: hasChangesFromOriginal(),
  }
}
