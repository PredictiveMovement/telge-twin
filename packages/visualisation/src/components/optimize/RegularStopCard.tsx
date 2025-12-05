import React, { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Clock, Calendar, Key, Footprints, Timer, User, Building2, Trash2, ParkingCircle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Stop } from '@/types/stops';
import { extractVehicleNumber, getVehicleLabel } from '@/lib/vehicleUtils';

interface RegularStopCardProps {
  stop: Stop;
  index: number;
  listType: 'current' | 'optimized';
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDeleteRegularStop?: (stopId: string) => void;
  onParkStop?: (stopId: string) => void;
  currentStops?: Stop[];
  startTime?: string;
  stopIndex?: number;
  showVehicleBadge?: boolean;
}

const RegularStopCard = ({
  stop,
  index,
  listType,
  isDragging = false,
  onDragStart,
  onDeleteRegularStop,
  onParkStop,
  currentStops = [],
  startTime = "06:00",
  stopIndex = 0,
  showVehicleBadge = false
}: RegularStopCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isParkConfirming, setIsParkConfirming] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const parkButtonRef = useRef<HTMLButtonElement>(null);
  const isEditable = listType === 'optimized';

  const calculateEstimatedTime = () => {
    if (!startTime) return "12:00";
    if (stop.estimatedTime) return stop.estimatedTime;

    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    // Assume ~10 minutes per stop
    const estimatedMinutes = startMinutes + (stopIndex * 10);
    const estimatedHours = Math.floor(estimatedMinutes / 60) % 24;
    const remainingMinutes = estimatedMinutes % 60;
    return `${estimatedHours.toString().padStart(2, '0')}:${remainingMinutes.toString().padStart(2, '0')}`;
  };

  // Handle click outside to reset delete and park confirmation
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deleteButtonRef.current && !deleteButtonRef.current.contains(event.target as Node)) {
        setIsDeleteConfirming(false);
      }
      if (parkButtonRef.current && !parkButtonRef.current.contains(event.target as Node)) {
        setIsParkConfirming(false);
      }
    };

    if (isDeleteConfirming || isParkConfirming) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDeleteConfirming, isParkConfirming]);

  const estimatedTime = calculateEstimatedTime();
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

  const handleDeleteClick = () => {
    if (!isDeleteConfirming) {
      setIsDeleteConfirming(true);
    } else {
      if (onDeleteRegularStop) {
        onDeleteRegularStop(stop.id);
      }
      setIsDeleteConfirming(false);
    }
  };

  const handleParkClick = () => {
    if (!isParkConfirming) {
      setIsParkConfirming(true);
    } else {
      if (onParkStop) {
        onParkStop(stop.id);
      }
      setIsParkConfirming(false);
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
        className={`${backgroundColor} border border-[#d9d9d9] rounded-md ${
          isEditable ? 'shadow-md hover:shadow-lg' : ''
        } cursor-default transition-all duration-200 flex flex-col ${
          isDragging ? 'opacity-50 scale-95 shadow-xl' : ''
        }`}
      >
        {/* Main card content */}
        <CollapsibleTrigger asChild>
          <div className="p-3 flex items-center gap-2 min-h-[80px] cursor-pointer">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 mb-3 py-1">
                <div className="flex items-center gap-3">
                  {/* Position indicator for moved cards - shows to the left of address */}
                  {hasMoved ? (
                    <div className="bg-accent text-telge-morkgron rounded-full px-3 py-1 text-xs font-medium flex items-center flex-shrink-0">
                      {(currentPositionInLeftColumn || 0) + 1}
                      <ChevronRight className="h-3 w-3 mx-1" />
                      {index + 1}
                    </div>
                  ) : (
                    /* Turn number badge - only visible when card hasn't moved */
                    <div className={`bg-telge-ljusgra50 rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 ${
                      (index + 1) < 10 ? 'w-6 h-6' : 'px-2 py-1'
                    }`} style={{ color: 'hsl(var(--text-secondary))' }}>
                      {index + 1}
                    </div>
                  )}
                  <p className="text-base font-medium text-gray-900 truncate">{stop.address}</p>
                </div>

                {/* Clock time display - top right corner, same line as address */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Clock className="h-3 w-3" style={{ color: 'hsl(var(--text-secondary))' }} />
                  <span className="font-medium text-sm" style={{ color: 'hsl(var(--text-secondary))' }}>{estimatedTime}</span>
                </div>
              </div>

              <div className="space-y-3">
                {/* Waste Types and Container Type on same line */}
                <div className="flex flex-wrap gap-1 items-center">
                  {/* Waste Types */}
                  {getWasteTypes().map(wasteType => (
                    <Badge key={wasteType} variant="wasteType" className="text-xs">
                      {wasteType}
                    </Badge>
                  ))}

                  {/* Vehicle Badge (blue) - only shown when multiple vehicles exist in list */}
                  {showVehicleBadge && stop.vehicle && (
                    <Badge variant="vehicle" className="text-xs">
                      {getVehicleLabel(extractVehicleNumber(stop.vehicle))}
                    </Badge>
                  )}

                  {/* Container Type Badge (pink) with total count when collapsed */}
                  {getTotalContainerText() && (
                    <Badge variant="container" className="text-xs">
                      {getTotalContainerText()}
                    </Badge>
                  )}
                </div>

                {/* Walking Distance, Time Per Stop, and Chevron on same row */}
                {(stop.walkingDistance !== undefined || stop.timePerStop !== undefined || getWasteTypes().length > 0) && (
                  <div className="flex gap-3 items-center text-sm justify-between" style={{ color: 'hsl(var(--text-secondary))' }}>
                    {/* Left side: Walking distance and time */}
                    <div className="flex gap-3 items-center">
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

                    {/* Right side: Chevron */}
                    {getWasteTypes().length > 0 && (
                      <div className="flex items-center group">
                        <span className="flex items-center justify-center p-1 rounded group-hover:bg-gray-100 transition-colors">
                          <ChevronDown
                            className={`h-4 w-4 text-black transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Expanded content */}
        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          <div className="px-3 pb-3 space-y-4 border-t border-[#d9d9d9]">

            {/* Customer and Property Information */}
            <div className="space-y-2 mt-3">
              <h4 className="text-xs font-medium uppercase tracking-wide" style={{ color: 'hsl(var(--text-secondary))' }}>Kundinformation</h4>
              <div className="space-y-2">
                {stop.customerName && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3 w-3 text-gray-500" />
                    <span className="min-w-[100px]" style={{ color: 'hsl(var(--text-secondary))' }}>Abonnentnr:</span>
                    <span className="font-medium">{stop.customerName}</span>
                  </div>
                )}
                {stop.propertyDesignation && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-3 w-3 text-gray-500" />
                    <span className="min-w-[100px]" style={{ color: 'hsl(var(--text-secondary))' }}>Fastighet:</span>
                    <span className="font-medium">{stop.propertyDesignation}</span>
                  </div>
                )}
                {stop.frequency && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-3 w-3 text-gray-500" />
                    <span className="min-w-[100px]" style={{ color: 'hsl(var(--text-secondary))' }}>Frekvens:</span>
                    <span className="font-medium">{stop.frequency}</span>
                  </div>
                )}
                {stop.accessKey && (
                  <div className="flex items-center gap-2 text-sm">
                    <Key className="h-3 w-3 text-gray-500" />
                    <span className="min-w-[100px]" style={{ color: 'hsl(var(--text-secondary))' }}>Nyckel:</span>
                    <span className="font-medium">{stop.accessKey}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Vehicle Compartments - 2x2 Grid Layout */}
            {stop.compartments && stop.compartments.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wide" style={{ color: 'hsl(var(--text-secondary))' }}>Fordonsfack</h4>
                <div className="grid grid-cols-2 gap-2">
                  {stop.compartments.map((compartment) => (
                     <div key={compartment.number} className={`${backgroundColor} border border-[#d9d9d9] rounded p-3 flex flex-col items-start text-left space-y-2`}>
                       <div className="text-sm font-medium text-gray-800">Fack {compartment.number}</div>
                        <div className="flex flex-wrap gap-x-3 text-sm" style={{ color: 'hsl(var(--text-secondary))' }}>
                          <span>Volym: {compartment.volume} kbm</span>
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
                  <h4 className="text-xs font-medium uppercase tracking-wide" style={{ color: 'hsl(var(--text-secondary))' }}>Avfallstyper & Behållare</h4>
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

            {/* Delete Button - Only visible when editable */}
            {isEditable && onDeleteRegularStop && (
              <div className="pt-4 mt-4 border-t border-[#d9d9d9] flex justify-between items-center">
                <Button
                  ref={deleteButtonRef}
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {isDeleteConfirming ? 'Klicka igen för att ta bort' : 'Ta bort stopp'}
                </Button>
                {onParkStop && (
                  <Button
                    ref={parkButtonRef}
                    variant="outline"
                    size="sm"
                    onClick={handleParkClick}
                  >
                    <ParkingCircle className="h-4 w-4 mr-1" />
                    {isParkConfirming ? 'Klicka igen för parkera' : 'Parkera'}
                  </Button>
                )}
              </div>
            )}

          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default RegularStopCard;
