
import React from 'react';
import { ChevronRight } from 'lucide-react';

interface PositionIndicatorProps {
  hasMoved: boolean;
  originalPosition?: number;
  currentIndex: number;
}

const PositionIndicator = ({
  hasMoved,
  originalPosition,
  currentIndex
}: PositionIndicatorProps) => {
  if (!hasMoved) return null;
  
  return (
    <div className="flex items-center flex-shrink-0 ml-2 absolute top-2 right-2">
      <div className="bg-accent text-telge-morkgron rounded-full px-3 py-1 text-xs font-medium flex items-center">
        {(originalPosition || 0) + 1}
        <ChevronRight className="h-3 w-3 mx-1" />
        {currentIndex + 1}
      </div>
    </div>
  );
};

export default PositionIndicator;
