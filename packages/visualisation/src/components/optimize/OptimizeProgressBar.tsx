import React from 'react';
import { Progress } from '@/components/ui/progress';

interface OptimizeProgressBarProps {
  isVisible: boolean;
  progress: number;
}

const OptimizeProgressBar: React.FC<OptimizeProgressBarProps> = ({ isVisible, progress }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-telge-ljusgra">
      <Progress 
        value={progress} 
        className="h-full rounded-none bg-transparent"
        style={{
          '--progress-background': 'hsl(var(--secondary))',
        } as React.CSSProperties}
      />
    </div>
  );
};

export default OptimizeProgressBar;