
import React from 'react';
import RegularStopCard from './RegularStopCard';
import BreakStopCard from './BreakStopCard';
import TippingStopCard from './TippingStopCard';

interface Stop {
  id: string;
  type: 'regular' | 'break' | 'lunch' | 'tipping';
  address?: string;
  wasteTypes?: string[];
  vehicle?: string;
  routeNumber?: string;
  duration?: number;
  originalPosition?: number;
  containerType?: string;
  containerCount?: number;
  serviceType?: string;
  propertyDesignation?: string;
  frequency?: string;
  customerName?: string;
  accessKey?: string;
  walkingDistance?: number;
  timePerStop?: number;
}

interface RouteStopCardProps {
  stop: Stop;
  index: number;
  listType: 'current' | 'optimized';
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onUpdateDuration?: (stopId: string, change: number) => void;
  onUpdateBreak?: (stopId: string, updates: { duration?: number, estimatedTime?: string, address?: string }) => void;
  onUpdateTipping?: (stopId: string, updates: { duration?: number, estimatedTime?: string, address?: string }) => void;
  onDeleteBreak?: (stopId: string) => void;
  onDeleteTipping?: (stopId: string) => void;
  onDeleteRegularStop?: (stopId: string) => void;
  onParkStop?: (stopId: string) => void;
  startTime?: string;
  currentStops?: Stop[];
  showVehicleBadge?: boolean;
}

const RouteStopCard = ({
  stop,
  index,
  listType,
  isDragging = false,
  onDragStart,
  onUpdateDuration,
  onUpdateBreak,
  onUpdateTipping,
  onDeleteBreak,
  onDeleteTipping,
  onDeleteRegularStop,
  onParkStop,
  startTime,
  currentStops = [],
  showVehicleBadge = false
}: RouteStopCardProps) => {
  if (stop.type === 'break' || stop.type === 'lunch') {
    return (
      <BreakStopCard
        stop={stop}
        listType={listType}
        isDragging={isDragging}
        onDragStart={onDragStart}
        onUpdateBreak={onUpdateBreak}
        onDeleteBreak={onDeleteBreak}
        onParkStop={onParkStop}
        startTime={startTime}
        stopIndex={index}
      />
    );
  }

  if (stop.type === 'tipping') {
    return (
      <TippingStopCard
        stop={stop}
        listType={listType}
        isDragging={isDragging}
        onDragStart={onDragStart}
        onUpdateTipping={onUpdateTipping}
        onDeleteTipping={onDeleteTipping}
        onParkStop={onParkStop}
        startTime={startTime}
        stopIndex={index}
      />
    );
  }

  return (
    <RegularStopCard
      stop={stop}
      index={index}
      listType={listType}
      isDragging={isDragging}
      onDragStart={onDragStart}
      onDeleteRegularStop={onDeleteRegularStop}
      onParkStop={onParkStop}
      currentStops={currentStops}
      startTime={startTime}
      stopIndex={index}
      showVehicleBadge={showVehicleBadge}
    />
  );
};

export default RouteStopCard;
