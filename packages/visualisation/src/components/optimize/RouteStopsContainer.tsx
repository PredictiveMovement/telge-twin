
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import RouteStopsHeader from './RouteStopsHeader';
import RouteColumn from './RouteColumn';

import { useRouteStopsLogic } from '@/hooks/useRouteStopsLogic';

interface RouteStopsContainerProps {
  vehicles?: string[];
  startTime?: string;
  selectedRoutes?: string[];
  onHasChangesChange?: (hasChanges: boolean) => void;
  onMapDataChange?: (data: { optimizedStops: any[], selectedVehicle: string }) => void;
  onHeaderMapClick?: (optimizedStops: any[], selectedVehicle: string) => void;
}

const RouteStopsContainer: React.FC<RouteStopsContainerProps> = ({ vehicles, startTime, selectedRoutes, onHasChangesChange, onMapDataChange, onHeaderMapClick }) => {
  const {
    currentStops,
    optimizedStops,
    selectedVehicle,
    setSelectedVehicle,
    draggedItem,
    dragOverIndex,
    handleUndo,
    handleRedo,
    resetToDefaults,
    addNewStop,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    updateStopDuration,
    updateBreak,
    updateTipping,
    deleteBreak,
    deleteTipping,
    deleteRegularStop,
    canUndo,
    canRedo,
    hasChangesFromOriginal
  } = useRouteStopsLogic();

  // Convert vehicles array to segmented control options with fallback
  const vehicleOptions = React.useMemo(() => {
    const fallbackVehicles = ['401', '402', '403'];
    const availableVehicles = vehicles && vehicles.length > 0 ? vehicles : fallbackVehicles;
    return availableVehicles.map(vehicle => ({
      value: vehicle,
      label: `Fordon ${vehicle}`
    }));
  }, [vehicles]);

  // Set default vehicle if none selected but vehicles exist
  React.useEffect(() => {
    const availableVehicles = vehicles && vehicles.length > 0 ? vehicles : ['401', '402', '403'];
    if (vehicleOptions.length > 0 && (!selectedVehicle || !availableVehicles.includes(selectedVehicle))) {
      setSelectedVehicle(vehicleOptions[0].value);
    }
  }, [vehicleOptions, selectedVehicle, setSelectedVehicle, vehicles]);

  // Notify parent about changes
  React.useEffect(() => {
    if (onHasChangesChange) {
      onHasChangesChange(hasChangesFromOriginal);
    }
  }, [hasChangesFromOriginal, onHasChangesChange]);

  // Notify parent about map data
  React.useEffect(() => {
    if (onMapDataChange) {
      onMapDataChange({ optimizedStops, selectedVehicle });
    }
  }, [optimizedStops, selectedVehicle, onMapDataChange]);

  return (
    <Card className="flex flex-col shadow-none" data-route-order>
      <CardHeader className="space-y-4">
        <RouteStopsHeader 
          optimizedStops={optimizedStops} 
          selectedVehicle={selectedVehicle}
          selectedRoutes={selectedRoutes}
          hasChanges={hasChangesFromOriginal}
          onMapClick={onHeaderMapClick || (() => {})}
        />
        <SegmentedControl
          options={vehicleOptions}
          value={selectedVehicle}
          onValueChange={setSelectedVehicle}
          className="w-full"
        />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="grid grid-cols-6 gap-6">
          <RouteColumn
            title="Nuvarande ordning"
            subtitle=""
            stops={currentStops}
            listType="current"
            startTime={startTime}
            currentStops={currentStops}
          />

          <RouteColumn
            title="Optimerad körtur"
            subtitle=""
            stops={optimizedStops}
            listType="optimized"
            startTime={startTime}
            draggedItem={draggedItem}
            dragOverIndex={dragOverIndex}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onUpdateDuration={updateStopDuration}
            onUpdateBreak={updateBreak}
            onUpdateTipping={updateTipping}
            onDeleteBreak={deleteBreak}
            onDeleteTipping={deleteTipping}
            onDeleteRegularStop={deleteRegularStop}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={resetToDefaults}
            onAdd={addNewStop}
            canUndo={canUndo}
            canRedo={canRedo}
            hasChanges={hasChangesFromOriginal}
            currentStops={currentStops}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default RouteStopsContainer;
