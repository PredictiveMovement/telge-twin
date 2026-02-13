import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface OptimizationStatusIndicatorProps {
  isOptimizing?: boolean;
  isFailed?: boolean;
  versionCount?: number; // Number of versions for this optimization
}

const OptimizationStatusIndicator: React.FC<OptimizationStatusIndicatorProps> = ({
  isOptimizing = false,
  isFailed = false,
  versionCount = 1,
}) => {
  const [showSpinner, setShowSpinner] = useState(true);
  const hasMultipleVersions = versionCount > 1;

  // Blinking spinner effect - visible 70% of time, hidden 30%
  useEffect(() => {
    if (!isOptimizing) return;

    const interval = setInterval(() => {
      setShowSpinner(prev => !prev);
    }, 800);

    return () => clearInterval(interval);
  }, [isOptimizing]);

  if (isFailed) {
    return (
      <Badge
        variant="secondary"
        className="ml-2 text-xs"
      >
        Fel
      </Badge>
    );
  }

  if (isOptimizing) {
    return (
      <span className={`inline-flex items-center transition-opacity duration-200 ml-5 ${showSpinner ? 'opacity-100' : 'opacity-30'}`}>
        <Loader2 className="h-5 w-5 animate-spin text-secondary" />
      </span>
    );
  }

  // Show badge for completed optimizations
  return (
    <Badge
      variant="default"
      className={`ml-2 text-xs ${
        hasMultipleVersions
          ? 'bg-muted hover:bg-muted text-muted-foreground'
          : 'bg-primary hover:bg-primary text-primary-foreground'
      }`}
    >
      {hasMultipleVersions ? 'Uppdaterad' : 'Klar'}
    </Badge>
  );
};

export default OptimizationStatusIndicator;
