import React from 'react';
import BreakCard from './BreakCard';
import BreaksHeader from './BreaksHeader';
import { useBreaksHistory } from '@/hooks/useBreaksHistory';
import { useBreaksOperations } from '@/hooks/useBreaksOperations';

interface BreakConfig {
  id: string;
  name: string;
  duration: number;
  enabled: boolean;
  desiredTime?: string;
}

interface BreaksSectionProps {
  breaks: BreakConfig[];
  extraBreaks: BreakConfig[];
  timeOptions: string[];
  onBreaksChange: (breaks: BreakConfig[]) => void;
  onExtraBreaksChange: (extraBreaks: BreakConfig[]) => void;
  disableHover?: boolean;
}

const BreaksSection: React.FC<BreaksSectionProps> = ({
  breaks,
  extraBreaks,
  timeOptions,
  onBreaksChange,
  onExtraBreaksChange,
  disableHover
}) => {
  // History management for breaks
  const { handleUndo, handleRedo, handleClear, canUndo, canRedo } = useBreaksHistory(
    breaks,
    extraBreaks,
    onBreaksChange,
    onExtraBreaksChange
  );

  // Break operations
  const {
    updateBreakDuration,
    updateBreakName,
    updateBreakTime,
    deleteBreak,
    addExtraBreak
  } = useBreaksOperations({
    breaks,
    extraBreaks,
    onBreaksChange,
    onExtraBreaksChange
  });

  return (
    <div className="space-y-4">
      <BreaksHeader
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onAdd={addExtraBreak}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      
      <div className="space-y-2">
        {breaks.map(breakItem => (
          <div key={breakItem.id} id={`break-${breakItem.id}`}>
            <BreakCard 
              breakItem={breakItem} 
              isExtra={false} 
              timeOptions={timeOptions} 
              onUpdateDuration={updateBreakDuration} 
              onUpdateName={updateBreakName} 
              onUpdateTime={updateBreakTime} 
              onDelete={deleteBreak} 
              disableHover={disableHover} 
            />
          </div>
        ))}
        
        {extraBreaks.map(breakItem => (
          <div key={breakItem.id} id={`break-${breakItem.id}`}>
            <BreakCard 
              breakItem={breakItem} 
              isExtra={true} 
              timeOptions={timeOptions} 
              onUpdateDuration={updateBreakDuration} 
              onUpdateName={updateBreakName} 
              onUpdateTime={updateBreakTime} 
              onDelete={deleteBreak} 
              disableHover={disableHover} 
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default BreaksSection;
