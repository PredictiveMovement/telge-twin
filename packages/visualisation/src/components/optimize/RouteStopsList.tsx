import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GripVertical, Plus, Minus } from 'lucide-react';

interface Stop {
  id: string;
  type: 'regular' | 'break' | 'lunch' | 'tipping';
  address?: string;
  wasteTypes?: string[];
  vehicle?: string;
  routeNumber?: string;
  duration?: number;
}

interface RouteStopsListProps {
  stops: Stop[];
  draggedItem: string | null;
  dragOverIndex: number | null;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetIndex: number) => void;
  onUpdateDuration: (stopId: string, change: number) => void;
}

const RouteStopsList = ({
  stops,
  draggedItem,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onUpdateDuration
}: RouteStopsListProps) => {

  const renderBreakCard = (stop: Stop) => {
    const isLunch = stop.type === 'lunch';
    const isDragging = draggedItem === stop.id;
    
    return (
      <div
        key={stop.id}
        draggable
        onDragStart={(e) => onDragStart(e, stop.id)}
        className={`bg-orange-50 border-2 border-dashed border-orange-200 rounded-md p-3 cursor-move flex items-center gap-3 h-[80px] ${
          isDragging 
            ? 'opacity-60 transform transition-none' 
            : 'hover:bg-orange-100 transform transition-all duration-100 ease-out hover:scale-[1.02]'
        }`}
      >
        <div className="flex items-center justify-between flex-1">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-gray-400" />
            <span className="text-lg">{isLunch ? '🍔' : '☕'}</span>
            <span className={`font-medium text-orange-700 ${isLunch ? 'text-base' : 'text-sm'}`}>
              {isLunch ? 'Lunch' : 'Kafferast'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => onUpdateDuration(stop.id, -5)}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-sm font-medium text-orange-700 min-w-[40px] text-center">
              {stop.duration || (isLunch ? 30 : 15)} min
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => onUpdateDuration(stop.id, 5)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderStopCard = (stop: Stop) => {
    if (stop.type === 'break' || stop.type === 'lunch') {
      return renderBreakCard(stop);
    }

    const isDragging = draggedItem === stop.id;

    return (
      <div
        key={stop.id}
        draggable
        onDragStart={(e) => onDragStart(e, stop.id)}
        className={`bg-white border border-[#d9d9d9] rounded-md p-3 cursor-move flex items-center gap-2 h-[80px] ${
          isDragging 
            ? 'opacity-60 transform transition-none' 
            : 'hover:shadow-md transform transition-all duration-100 ease-out hover:scale-[1.02]'
        }`}
      >
        <GripVertical className="h-4 w-4 text-gray-400" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-900 truncate">{stop.address}</p>
            <Badge variant="outline" className="text-xs">TurID: {stop.routeNumber}</Badge>
          </div>
          
          <div className="space-y-2">
            {stop.wasteTypes && (
              <div className="flex flex-wrap gap-1">
                {stop.wasteTypes.map((wasteType) => (
                  <Badge key={wasteType} variant="secondary" className="text-xs">
                    {wasteType}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!stops || stops.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Inga stopp att visa</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 h-full overflow-y-auto">
      {stops.map((stop, index) => {
        return (
          <div key={stop.id} className="relative">
            {/* Drop zone indicator before each item when dragging */}
            {draggedItem && dragOverIndex === index && (
              <div className="w-full h-1 bg-accent rounded-full mb-2 shadow-lg animate-pulse" style={{ height: '4px' }} />
            )}
            
            <div
              className={`min-h-[80px] ${draggedItem === stop.id ? 'transform transition-none' : 'transform transition-all duration-150 ease-out'}`}
              onDragOver={(e) => onDragOver(e, index)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, index)}
            >
              {renderStopCard(stop)}
            </div>
          </div>
        );
      })}
      
      {/* Drop zone indicator at the end when dragging */}
      {draggedItem && dragOverIndex === stops.length && (
        <div className="w-full h-1 bg-accent rounded-full mt-2 shadow-lg animate-pulse" style={{ height: '4px' }} />
      )}
      
      {/* Drop zone for end of list */}
      {draggedItem && (
        <div
          className="h-8"
          onDragOver={(e) => onDragOver(e, stops.length)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, stops.length)}
        />
      )}
    </div>
  );
};

export default RouteStopsList;
