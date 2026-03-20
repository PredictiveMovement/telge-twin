import React, { useMemo } from 'react';
import BreakCard from './BreakCard';
import BreaksHeader from './BreaksHeader';
import { useBreaksHistory } from '@/hooks/useBreaksHistory';
import { useBreaksOperations } from '@/hooks/useBreaksOperations';
import type { BreakConfig } from '@/types/breaks';

interface BreaksSectionProps {
  breaks: BreakConfig[];
  extraBreaks: BreakConfig[];
  onBreaksChange: (breaks: BreakConfig[]) => void;
  onExtraBreaksChange: (extraBreaks: BreakConfig[]) => void;
  disableHover?: boolean;
  bookingCoordinates?: { lat: number; lng: number }[];
}

const BreaksSection: React.FC<BreaksSectionProps> = ({
  breaks,
  extraBreaks,
  onBreaksChange,
  onExtraBreaksChange,
  disableHover,
  bookingCoordinates
}) => {
  // History management for breaks
  const { saveToHistory, handleUndo, handleRedo, handleClear, canUndo, canRedo } = useBreaksHistory(
    breaks,
    extraBreaks,
    onBreaksChange,
    onExtraBreaksChange,
    defaultBreaks,
    defaultExtraBreaks
  );

  // Break operations
  const {
    updateBreakDuration,
    updateBreakName,
    updateBreakTime,
    updateBreakLocation,
    deleteBreak,
    addExtraBreak
  } = useBreaksOperations({
    breaks,
    extraBreaks,
    onBreaksChange,
    onExtraBreaksChange,
    saveToHistory
  });

  const allBreaks = useMemo(() => [...breaks, ...extraBreaks], [breaks, extraBreaks]);

  const otherBreakCoordinatesFor = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }[]>();
    for (const b of allBreaks) {
      map.set(
        b.id,
        allBreaks
          .filter(other => other.id !== b.id && other.locationCoordinates)
          .map(other => other.locationCoordinates!)
      );
    }
    return map;
  }, [allBreaks]);

  return (
    <div className="space-y-4">
      <BreaksHeader
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onAdd={addExtraBreak}
        canUndo={canUndo && hasChanges}
        canRedo={canRedo}
        canClear={hasChanges}
      />
      
      <div className="space-y-2">
        {breaks.map(breakItem => (
          <div key={breakItem.id} id={`break-${breakItem.id}`}>
            <BreakCard
              breakItem={breakItem}
              isExtra={false}
              onUpdateDuration={updateBreakDuration}
              onUpdateName={updateBreakName}
              onUpdateTime={updateBreakTime}
              onUpdateLocation={updateBreakLocation}
              onDelete={deleteBreak}
              disableHover={disableHover}
              bookingCoordinates={bookingCoordinates}
              otherBreakCoordinates={otherBreakCoordinatesFor.get(breakItem.id)}
            />
          </div>
        ))}

        {extraBreaks.map(breakItem => (
          <div key={breakItem.id} id={`break-${breakItem.id}`}>
            <BreakCard
              breakItem={breakItem}
              isExtra={true}
              onUpdateDuration={updateBreakDuration}
              onUpdateName={updateBreakName}
              onUpdateTime={updateBreakTime}
              onUpdateLocation={updateBreakLocation}
              onDelete={deleteBreak}
              disableHover={disableHover}
              bookingCoordinates={bookingCoordinates}
              otherBreakCoordinates={otherBreakCoordinatesFor.get(breakItem.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default BreaksSection;
