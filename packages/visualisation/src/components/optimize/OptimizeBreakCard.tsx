
import React from 'react';
import { Button } from '@/components/ui/button';
import { GripVertical, Plus, Minus } from 'lucide-react';

interface Stop {
  id: string;
  type: 'regular' | 'break' | 'lunch' | 'tipping';
  duration?: number;
}

interface OptimizeBreakCardProps {
  stop: Stop;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onUpdateDuration: (stopId: string, change: number) => void;
}

const OptimizeBreakCard = ({ stop, onDragStart, onUpdateDuration }: OptimizeBreakCardProps) => {
  const isLunch = stop.type === 'lunch';
  const cardSize = isLunch ? "p-4" : "p-3";
  
  return (
    <div
      key={stop.id}
      draggable
      onDragStart={(e) => onDragStart(e, stop.id)}
      className={`bg-orange-50 border-2 border-dashed border-orange-200 rounded-md ${cardSize} cursor-move hover:bg-orange-100 transition-colors flex items-center gap-3`}
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

export default OptimizeBreakCard;
