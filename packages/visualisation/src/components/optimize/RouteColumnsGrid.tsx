import React, { useRef } from 'react';
import RouteColumnHeader from './RouteColumnHeader';
import RouteStopsColumn from './RouteStopsColumn';
import { Stop } from '@/types/stops';

interface RouteColumnsGridProps {
  currentStops: Stop[];
  optimizedStops: Stop[];
  startTime?: string;
  draggedItem?: string | null;
  dragOverIndex?: number | null;
  onDragStart: (e: React.DragEvent, id: string, source?: 'optimized' | 'parked') => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetIndex: number) => void;
  onUpdateDuration: (stopId: string, change: number) => void;
  onUpdateBreak: (stopId: string, updates: { duration?: number, estimatedTime?: string, address?: string }) => void;
  onUpdateTipping: (stopId: string, updates: { duration?: number, estimatedTime?: string, address?: string }) => void;
  onDeleteBreak: (stopId: string) => void;
  onDeleteTipping: (stopId: string) => void;
  onDeleteRegularStop: (stopId: string) => void;
  onParkStop: (stopId: string) => void;
  showHeaders?: boolean;
}

const RouteColumnsGrid: React.FC<RouteColumnsGridProps> = ({
  currentStops,
  optimizedStops,
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
  onParkStop,
  showHeaders = true
}) => {
  const currentListRef = useRef<HTMLDivElement | null>(null);
  const optimizedListRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="flex flex-col">
      {/* Headers */}
      {showHeaders && (
        <div className="grid grid-cols-[3fr_3fr_auto] gap-3 mb-4">
          <div>
            <RouteColumnHeader
              title="Ursprunglig ordning"
              subtitle="Körturordning hämtad från Thor. Denna går inte att ändra på"
              listType="current"
              showActions={false}
              existingStops={currentStops}
            />
          </div>
          <div>
            <RouteColumnHeader
              title="Optimerad körtur"
              subtitle="Ändra ordningen manuellt genom att dra korten till önskad plats"
              listType="optimized"
              showActions={false}
              existingStops={optimizedStops}
            />
          </div>
          <div className="w-8 mr-6">
            {/* Empty space to align with actions column below */}
          </div>
        </div>
      )}

      {/* Columns Grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <RouteStopsColumn
            stops={currentStops}
            listType="current"
            startTime={startTime}
            currentStops={currentStops}
            innerListRef={currentListRef}
          />
        </div>
        <div>
          <RouteStopsColumn
            stops={optimizedStops}
            listType="optimized"
            startTime={startTime}
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
            onParkStop={onParkStop}
            currentStops={currentStops}
            innerListRef={optimizedListRef}
          />
        </div>
      </div>
    </div>
  );
};

export default RouteColumnsGrid;
