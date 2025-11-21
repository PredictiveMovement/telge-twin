import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { GripVertical, ChevronDown, Calendar, Key, Footprints, Timer, User, Building2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import PositionIndicator from './PositionIndicator';
import { Stop } from '@/types/stops';
import EditRegularStopModal from './EditRegularStopModal';

interface RegularStopCardProps {
  stop: Stop;
  index: number;
  listType: 'current' | 'optimized';
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDeleteRegularStop?: (stopId: string) => void;
  currentStops?: Stop[];
}

const RegularStopCard = ({
  stop,
  index,
  listType,
  isDragging = false,
  onDragStart,
  onDeleteRegularStop,
  currentStops = []
}: RegularStopCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const isEditable = listType === 'optimized';
  const backgroundColor = listType === 'current' ? 'bg-[#FBFBFB]' : 'bg-white';
  
  // Find the current position of this stop in the current (left) column
  const currentPositionInLeftColumn = currentStops.findIndex(s => s.id === stop.id);
  const hasMoved = listType === 'optimized' && currentPositionInLeftColumn !== -1 && currentPositionInLeftColumn !== index;
  // Extract unique waste types from compartments, fallback to stop.wasteTypes
  const getWasteTypes = () => {
    if (stop.compartments && stop.compartments.length > 0) {
      const uniqueWasteTypes = [...new Set(stop.compartments.map(c => c.wasteType))];
      return uniqueWasteTypes;
    }
    return stop.wasteTypes || [];
  };
  
  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Only handle clicks if it's the main card area and not dragging
    if (isEditable && onDeleteRegularStop && !isDragging) {
      // Prevent multiple rapid clicks
      e.stopPropagation();
      setTimeout(() => {
        setIsEditModalOpen(true);
      }, 0);
    }
  };

  const getTotalContainerText = () => {
    if (!stop.containerType || !stop.containerCount) return null;
    return `Kärl ${stop.containerType}: ${stop.containerCount}`;
  };

  const getDetailedContainerInfo = () => {
    if (!stop.containerDetails) return [];
    return stop.containerDetails;
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        draggable={isEditable}
        onDragStart={isEditable && onDragStart ? e => onDragStart(e, stop.id) : undefined}
        onClick={handleCardClick}
        className={`${backgroundColor} border border-[#d9d9d9] rounded-md ${
          isEditable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
        } transition-all duration-200 flex flex-col ${
          isDragging ? 'opacity-50 scale-95 shadow-lg' : ''
        }`}
      >
        {/* Main card content */}
        <div className="p-3 flex items-center gap-2 min-h-[80px] relative">
          {/* Turn number badge - only visible when card hasn't moved */}
          {!hasMoved && (
            <div className={`absolute top-2 right-2 bg-telge-ljusgra50 text-gray-600 rounded-full text-xs font-medium flex items-center justify-center ${
              (index + 1) < 10 ? 'w-6 h-6' : 'px-2 py-1'
            }`}>
              {index + 1}
            </div>
          )}
          
          {/* Position indicator for moved cards */}
          <PositionIndicator 
            hasMoved={hasMoved}
            originalPosition={currentPositionInLeftColumn}
            currentIndex={index}
          />
          
          {isEditable && <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2 py-1">
              <p className="text-sm font-medium text-gray-900 truncate pr-12">{stop.address}</p>
            </div>
            
            <div className="space-y-2">
              {/* Waste Types and Container Type on same line */}
              <div className="flex flex-wrap gap-1 items-center">
                {/* Waste Types */}
                {getWasteTypes().map(wasteType => (
                  <Badge key={wasteType} variant="wasteType" className="text-xs">
                    {wasteType}
                  </Badge>
                ))}
                
                {/* Container Type Badge (pink) with total count when collapsed */}
                {getTotalContainerText() && (
                  <Badge variant="container" className="text-xs">
                    {getTotalContainerText()}
                  </Badge>
                )}
              </div>
              
              {/* Walking Distance and Time Per Stop */}
              {(stop.walkingDistance !== undefined || stop.timePerStop !== undefined) && (
                 <div className="flex gap-3 items-center text-sm text-gray-600">
                   {stop.walkingDistance !== undefined && (
                     <div className="flex items-center gap-1">
                       <Footprints className="h-4 w-4" />
                       <span>{stop.walkingDistance}m</span>
                     </div>
                   )}
                   {stop.timePerStop !== undefined && (
                     <div className="flex items-center gap-1">
                       <Timer className="h-4 w-4" />
                       <span>{stop.timePerStop}min</span>
                     </div>
                   )}
                 </div>
              )}
            </div>
          </div>

          {/* Chevron positioned relative to main content area */}
          {getWasteTypes().length > 0 && (
            <CollapsibleTrigger asChild>
              <button
                onClick={handleChevronClick}
                className="absolute bottom-2 right-2 p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronDown 
                  className={`h-4 w-4 text-black transition-transform duration-200 ${
                    isExpanded ? 'rotate-180' : ''
                  }`} 
                />
              </button>
            </CollapsibleTrigger>
          )}
        </div>

        {/* Expanded content */}
        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          <div className="px-3 pb-3 space-y-4 border-t border-[#d9d9d9]">
            
            {/* Customer and Property Information */}
            <div className="space-y-2 mt-3">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Kundinformation</h4>
              <div className="space-y-2">
                {stop.customerName && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3 w-3 text-gray-500" />
                    <span className="text-gray-600 min-w-[100px]">Abonnentnr:</span>
                    <span className="font-medium">{stop.customerName}</span>
                  </div>
                )}
                {stop.propertyDesignation && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-3 w-3 text-gray-500" />
                    <span className="text-gray-600 min-w-[100px]">Fastighet:</span>
                    <span className="font-medium">{stop.propertyDesignation}</span>
                  </div>
                )}
                {stop.frequency && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-3 w-3 text-gray-500" />
                    <span className="text-gray-600 min-w-[100px]">Frekvens:</span>
                    <span className="font-medium">{stop.frequency}</span>
                  </div>
                )}
                {stop.accessKey && (
                  <div className="flex items-center gap-2 text-sm">
                    <Key className="h-3 w-3 text-gray-500" />
                    <span className="text-gray-600 min-w-[100px]">Nyckel:</span>
                    <span className="font-medium">{stop.accessKey}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Vehicle Compartments - 2x2 Grid Layout */}
            {stop.compartments && stop.compartments.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Fordonsfack</h4>
                <div className="grid grid-cols-2 gap-2">
                  {stop.compartments.map((compartment) => (
                     <div key={compartment.number} className={`${backgroundColor} border border-[#d9d9d9] rounded p-3 flex flex-col items-start text-left space-y-2`}>
                       <div className="text-sm font-medium text-gray-800">Fack {compartment.number}</div>
                        <div className="flex flex-wrap gap-x-3 text-sm text-gray-600">
                          <span>Volym: {compartment.volume}L</span>
                          <span>Viktgräns: {compartment.weightLimit}kg</span>
                        </div>
                         <div className="flex flex-wrap gap-1">
                           <Badge variant="wasteType" className="text-xs">
                             {compartment.wasteType}
                           </Badge>
                         </div>
                     </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Fallback to original Waste Types & Containers display */
              getDetailedContainerInfo().length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Avfallstyper & Behållare</h4>
                  <div className="space-y-2">
                    {getDetailedContainerInfo().map((detail, detailIndex) => (
                      <div key={`${detail.wasteType}-${detail.containerType}-${detailIndex}`} className={`${backgroundColor} border border-[#d9d9d9] rounded p-2 flex items-center gap-2`}>
                        <Badge variant="wasteType" className="text-xs">
                          {detail.wasteType}
                        </Badge>
                        <Badge variant="container" className="text-xs">
                          Kärl {detail.containerType}: {detail.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

          </div>
        </CollapsibleContent>
      </div>

      {isEditable && onDeleteRegularStop && (
        <EditRegularStopModal
          stop={stop}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onDeleteRegularStop={onDeleteRegularStop}
        />
      )}
    </Collapsible>
  );
};

export default RegularStopCard;
