
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { GripVertical } from 'lucide-react';

interface Stop {
  id: string;
  type: 'regular' | 'break' | 'lunch' | 'tipping';
  address?: string;
  wasteTypes?: string[];
  routeNumber?: string;
  customerName?: string;
  accessKey?: string;
  walkingDistance?: number;
  timePerStop?: number;
}

interface OptimizeStopCardProps {
  stop: Stop;
  onDragStart: (e: React.DragEvent, id: string) => void;
}

const OptimizeStopCard = ({ stop, onDragStart }: OptimizeStopCardProps) => {
  return (
    <div
      key={stop.id}
      draggable
      onDragStart={(e) => onDragStart(e, stop.id)}
      className="bg-white border border-[#d9d9d9] rounded-md p-3 cursor-move hover:shadow-md transition-shadow flex items-start gap-2"
    >
      <GripVertical className="h-4 w-4 text-gray-400 mt-1" />
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

export default OptimizeStopCard;
