import React, { useState, useRef } from 'react';
import { GripVertical, Clock } from 'lucide-react';
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
  
  // Calculate estimated time based on startTime and stopIndex
  const calculateEstimatedTime = () => {
    if (!startTime) return "12:00";
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    // Estimate roughly 10 minutes per stop before this tipping
    const estimatedMinutes = startMinutes + (stopIndex * 10);
    const estimatedHours = Math.floor(estimatedMinutes / 60);
    const remainingMinutes = estimatedMinutes % 60;
    
    return `${estimatedHours.toString().padStart(2, '0')}:${remainingMinutes.toString().padStart(2, '0')}`;
  };
  
  const estimatedTime = stop.estimatedTime || calculateEstimatedTime();
  
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
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            {/* Clock time row */}
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-telge-telgebla" />
              <span className="font-medium text-telge-telgebla text-sm">{estimatedTime}</span>
            </div>
            
            {/* Duration row */}
            <div className="flex items-center">
              <span className="text-sm text-telge-morkbla min-w-[40px] text-center">
                {stop.duration || 20} min
              </span>
            </div>
          </div>
          
        </div>
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