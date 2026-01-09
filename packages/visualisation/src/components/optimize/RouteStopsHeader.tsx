
import React from 'react';
import { Button } from '@/components/ui/button';
import { Map } from 'lucide-react';
import { Stop } from '@/types/stops';

interface RouteStopsHeaderProps {
  optimizedStops: Stop[];
  selectedVehicle: string;
  selectedRoutes?: string[];
  onMapClick: (optimizedStops: Stop[], selectedVehicle: string) => void;
}

const RouteStopsHeader = ({ optimizedStops, selectedVehicle, selectedRoutes, onMapClick }: RouteStopsHeaderProps) => {
  const handleMapClick = () => {
    onMapClick(optimizedStops, selectedVehicle);
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="font-normal text-2xl">Körturordning</h2>
        {selectedRoutes && selectedRoutes.length > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            TurID: {selectedRoutes.join(', ')}
          </p>
        )}
      </div>
      <Button 
        onClick={handleMapClick} 
        className="flex items-center gap-2"
      >
        <Map className="h-4 w-4" />
        Se i karta
      </Button>
    </div>
  );
};

export default RouteStopsHeader;
