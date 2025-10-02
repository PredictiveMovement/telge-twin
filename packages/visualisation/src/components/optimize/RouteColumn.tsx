import React from 'react';
import RouteStopsColumn from './RouteStopsColumn';
import RouteStopsActions from './RouteStopsActions';
import { Stop } from '@/types/stops';

interface RouteColumnProps {
  title: string;
  subtitle: string;
  stops: Stop[];
  listType: 'current' | 'optimized';
  startTime?: string;
  // Drag and drop props (only for optimized column)
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
  // Actions (only for optimized column)
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  onAdd?: (type: 'break' | 'tipping', position: number, address: string, duration: number, estimatedTime?: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  hasChanges?: boolean;
  currentStops?: Stop[];
}

const RouteColumn: React.FC<RouteColumnProps> = ({
  title,
  subtitle,
  stops,
  listType,
  startTime,
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
  onUndo,
  onRedo,
  onClear,
  onAdd,
  canUndo,
  canRedo,
  hasChanges,
  currentStops = []
}) => {
  const showActions = listType === 'optimized' && (onUndo || onRedo || onClear);

  return (
    <div className="col-span-3 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 h-10 flex-shrink-0">
        <div>
          <h3 className="text-lg font-medium">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        {showActions && onAdd && (
          <RouteStopsActions
            onUndo={onUndo!}
            onRedo={onRedo!}
            onClear={onClear!}
            onAdd={onAdd}
            canUndo={canUndo || false}
            canRedo={canRedo || false}
            hasChanges={hasChanges || false}
            existingStops={stops}
          />
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <RouteStopsColumn
          stops={stops}
          listType={listType}
          draggedItem={draggedItem}
          dragOverIndex={dragOverIndex}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onUpdateDuration={onUpdateDuration}
          onUpdateBreak={onUpdateBreak}
          onUpdateTipping={onUpdateTipping}
          onDeleteBreak={onDeleteBreak}
          onDeleteTipping={onDeleteTipping}
          onDeleteRegularStop={onDeleteRegularStop}
          startTime={startTime}
          currentStops={currentStops}
        />
      </div>
    </div>
  );
};

export default RouteColumn;