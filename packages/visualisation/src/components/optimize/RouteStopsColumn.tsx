
import React from 'react';
import RouteStopCard from './RouteStopCard';
import { Stop } from '@/types/stops';

interface RouteStopsColumnProps {
  stops: Stop[];
  listType: 'current' | 'optimized';
  draggedItem?: string | null;
  dragOverIndex?: number | null;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, targetIndex: number) => void;
  onUpdateDuration?: (stopId: string, change: number) => void;
  onUpdateBreak?: (stopId: string, updates: { duration?: number, estimatedTime?: string, address?: string }) => void;
  onUpdateTipping?: (stopId: string, updates: { duration?: number, estimatedTime?: string, address?: string }) => void;
  onDeleteBreak?: (stopId: string) => void;
  onDeleteTipping?: (stopId: string) => void;
  onDeleteRegularStop?: (stopId: string) => void;
  onParkStop?: (stopId: string) => void;
  startTime?: string;
  currentStops?: Stop[];
  innerListRef?: React.Ref<HTMLDivElement>;
}

const RouteStopsColumn = ({
  stops,
  listType,
  draggedItem,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onUpdateDuration,
  onUpdateBreak,
  onUpdateTipping,
  onDeleteBreak,
  onDeleteTipping,
  onDeleteRegularStop,
  onParkStop,
  startTime,
  currentStops = [],
  innerListRef
}: RouteStopsColumnProps) => {
  const isEditable = listType === 'optimized';
  const filteredStops = stops; // Show all stops in both columns

  // Calculate if there are multiple different vehicles in the list
  const uniqueVehicles = new Set(
    stops
      .filter(stop => stop.vehicle)
      .map(stop => stop.vehicle)
  );
  const hasMultipleVehicles = uniqueVehicles.size > 1;

  return (
    <div ref={innerListRef} className="space-y-2 pr-2">
      {filteredStops.map((stop, index) => (
        <div key={stop.id} className="relative" data-stop-card>
          {/* Drop zone indicator before each item (only for optimized column when dragging) */}
          {isEditable && draggedItem && dragOverIndex === index && (
            <div
              className="w-full h-1 bg-secondary rounded-full mb-2 shadow-lg animate-pulse"
              style={{ height: '4px' }}
            />
          )}

          <div
            onDragOver={isEditable && onDragOver ? (e) => onDragOver(e, index) : undefined}
            onDragLeave={isEditable ? onDragLeave : undefined}
            onDrop={isEditable && onDrop ? (e) => onDrop(e, index) : undefined}
            className={draggedItem === stop.id ? 'transform transition-none' : 'transform transition-all duration-150 ease-out'}
          >
            <RouteStopCard
              stop={stop}
              index={index}
              listType={listType}
              isDragging={draggedItem === stop.id}
              onDragStart={onDragStart}
              onUpdateDuration={onUpdateDuration}
              onUpdateBreak={onUpdateBreak}
              onUpdateTipping={onUpdateTipping}
              onDeleteBreak={onDeleteBreak}
              onDeleteTipping={onDeleteTipping}
              onDeleteRegularStop={onDeleteRegularStop}
              onParkStop={onParkStop}
              startTime={startTime}
              currentStops={currentStops}
              showVehicleBadge={hasMultipleVehicles}
            />
          </div>
        </div>
      ))}
      
      {/* Drop zone indicator at the end (only for optimized column when dragging) */}
      {isEditable && draggedItem && dragOverIndex === filteredStops.length && (
        <div
          className="w-full h-1 bg-secondary rounded-full mt-2 shadow-lg animate-pulse"
          style={{ height: '4px' }}
        />
      )}
      
      {/* Drop zone for end of list (only for optimized column) */}
      {isEditable && draggedItem && (
        <div 
          className="h-8" 
          onDragOver={onDragOver ? (e) => onDragOver(e, filteredStops.length) : undefined}
          onDragLeave={onDragLeave} 
          onDrop={onDrop ? (e) => onDrop(e, filteredStops.length) : undefined}
        />
      )}
    </div>
  );
};

export default RouteStopsColumn;
