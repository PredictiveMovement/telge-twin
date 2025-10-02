import React from 'react';
import { Button } from '@/components/ui/button';
import { Map } from 'lucide-react';
import { Stop } from '@/types/stops';

interface OptimizeActionsProps {
  onSendToThor?: () => void;
  onViewMap?: () => void;
  isMapLoading?: boolean;
  mapData?: {
    optimizedStops: Stop[];
    selectedVehicle: string;
  } | null;
}

const OptimizeActions: React.FC<OptimizeActionsProps> = ({
  onSendToThor,
  onViewMap,
  isMapLoading = false,
  mapData
}) => {
  const handleMapClick = () => {
    if (mapData && !isMapLoading && onViewMap) {
      onViewMap();
    }
  };

  return (
    <div className="flex justify-end gap-4">
      <Button 
        variant="secondary" 
        size="lg"
        onClick={onSendToThor}
      >
        Skicka till Thor
      </Button>
      <Button 
        onClick={handleMapClick}
        disabled={isMapLoading || !mapData}
        className="flex items-center gap-2 min-w-[130px]"
        size="lg"
      >
        <Map className="h-4 w-4" />
        {isMapLoading ? 'Sparar...' : 'Se i karta'}
      </Button>
    </div>
  );
};

export default OptimizeActions;