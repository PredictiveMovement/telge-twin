
import React, { useState, useRef } from 'react';
import { GripVertical, Clock } from 'lucide-react';
import EditBreakModal from './EditBreakModal';

interface Stop {
  id: string;
  type: 'regular' | 'break' | 'lunch' | 'tipping';
  duration?: number;
  address?: string;
  estimatedTime?: string;
}

interface BreakStopCardProps {
  stop: Stop;
  listType: 'current' | 'optimized';
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onUpdateBreak?: (stopId: string, updates: { duration?: number, estimatedTime?: string, address?: string }) => void;
  onDeleteBreak?: (stopId: string) => void;
  onParkStop?: (stopId: string) => void;
  startTime?: string;
  stopIndex?: number;
}

const BreakStopCard = ({
  stop,
  listType,
  isDragging = false,
  onDragStart,
  onUpdateBreak,
  onDeleteBreak,
  onParkStop,
  startTime = "06:00",
  stopIndex = 0
}: BreakStopCardProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const justClosedRef = useRef(false);
  const isEditable = listType === 'optimized';
  const isLunch = stop.type === 'lunch';
  
  // Hardcoded break times
  const getBreakTime = () => {
    if (isLunch) return "10:00";
    // For coffee breaks, determine if it's morning or afternoon based on index
    return stopIndex < 20 ? "08:00" : "13:00"; // Rough estimate: morning vs afternoon
  };
  
  const estimatedTime = stop.estimatedTime || getBreakTime();
  
  const handleCardClick = (e: React.MouseEvent) => {
    // Only handle clicks if it's the main card area and not dragging
    if (isEditable && onUpdateBreak && !isDragging && !justClosedRef.current) {
      e.stopPropagation();
      setTimeout(() => {
        setIsEditModalOpen(true);
      }, 0);
    }
  };

  const handleModalClose = () => {
    setIsEditModalOpen(false);
    justClosedRef.current = true;
    setTimeout(() => {
      justClosedRef.current = false;
    }, 100);
  };

  return (
    <div 
      draggable={isEditable} 
      onDragStart={isEditable && onDragStart ? e => onDragStart(e, stop.id) : undefined} 
      onClick={handleCardClick}
      className={`bg-orange-50 border border-orange-200 rounded-md p-3 ${
        isEditable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
      } transition-all flex items-center gap-3 min-h-[80px] ${
        isDragging ? 'opacity-50 scale-95 shadow-lg' : ''
      }`}
    >
      <div className="flex items-center justify-between flex-1">
        <div className="flex items-center gap-2">
          {isEditable && <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />}
          <span className="text-lg">{isLunch ? '🍔' : '☕'}</span>
          <div className="flex flex-col">
            <span className="font-medium text-orange-700 text-sm">
              {isLunch ? 'Lunch' : 'Kafferast'}
            </span>
            {stop.address && (
              <span className="text-sm text-orange-600">{stop.address}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            {/* Clock time row */}
            <div className="flex items-center gap-1 justify-end">
              <Clock className="h-3 w-3 text-orange-500" />
              <span className="font-medium text-orange-700 text-sm">{estimatedTime}</span>
            </div>
            
            {/* Duration row */}
            <div className="flex items-center justify-end">
              <span className="text-orange-600 text-sm">
                {stop.duration || (isLunch ? 30 : 15)} min
              </span>
            </div>
          </div>
          
        </div>
      </div>
      
      {isEditable && onUpdateBreak && (
        <EditBreakModal
          stop={stop}
          isOpen={isEditModalOpen}
          onClose={handleModalClose}
          onUpdateBreak={onUpdateBreak}
          onDeleteBreak={onDeleteBreak}
          onParkStop={onParkStop}
        />
      )}
    </div>
  );
};

export default BreakStopCard;
