import React, { useState, useRef } from 'react';
import { GripVertical } from 'lucide-react';
import EditTippingModal from './EditTippingModal';

interface Stop {
  id: string;
  type: 'regular' | 'break' | 'lunch' | 'tipping';
  address?: string;
  duration?: number;
  estimatedTime?: string;
}

interface TippingStopCardProps {
  stop: Stop;
  listType: 'current' | 'optimized';
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onUpdateTipping?: (stopId: string, updates: { duration?: number, estimatedTime?: string, address?: string }) => void;
  onDeleteTipping?: (stopId: string) => void;
  onParkStop?: (stopId: string) => void;
  startTime?: string;
  stopIndex?: number;
}

const TippingStopCard = ({
  stop,
  listType,
  isDragging = false,
  onDragStart,
  onUpdateTipping,
  onDeleteTipping,
  onParkStop,
  startTime = "06:00",
  stopIndex = 0
}: TippingStopCardProps) => {
  const isEditable = listType === 'optimized';
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const justClosedRef = useRef(false);
  
  const handleCardClick = (e: React.MouseEvent) => {
    // Only handle clicks if it's the main card area and not dragging
    if (isEditable && onUpdateTipping && !isDragging && !justClosedRef.current) {
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
      className={`bg-telge-ljusbla25 border border-telge-ljusbla rounded-md p-3 ${
        isEditable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
      } transition-all flex items-center gap-3 min-h-[80px] ${
        isDragging ? 'opacity-50 scale-95 shadow-lg' : ''
      }`}
    >
      <div className="flex items-center justify-between flex-1">
        <div className="flex items-center gap-2">
          {isEditable && <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />}
          <span className="text-lg">🚛</span>
          <div className="flex flex-col">
            <span className="font-medium text-telge-telgebla text-sm">
              Tippning
            </span>
            {stop.address && (
              <span className="text-sm text-telge-morkbla">{stop.address}</span>
            )}
          </div>
        </div>
        <span className="text-sm text-telge-morkbla">
          {stop.duration || 20} min
        </span>
      </div>
      
      {onUpdateTipping && (
        <EditTippingModal
          stop={stop}
          isOpen={isEditModalOpen}
          onClose={handleModalClose}
          onUpdateTipping={onUpdateTipping}
          onDeleteTipping={onDeleteTipping}
          onParkStop={onParkStop}
        />
      )}
    </div>
  );
};

export default TippingStopCard;