import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelRightClose } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/segmented-control';
import RouteColumn from './RouteColumn';

interface Stop {
  id: string;
  type: 'regular' | 'break' | 'lunch' | 'tipping';
  address?: string;
  wasteTypes?: string[];
  vehicle?: string;
  routeNumber?: string;
  duration?: number;
}

interface OptimizeMapPanelProps {
  optimizedStops: Stop[];
  selectedVehicle: string;
  onVehicleChange: (vehicle: string) => void;
  vehicles?: string[];
  draggedItem: string | null;
  dragOverIndex: number | null;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetIndex: number) => void;
  onUpdateDuration: (stopId: string, change: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onAdd: (type: 'break' | 'tipping', position: number, address: string, duration: number, estimatedTime?: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onTogglePanel: () => void;
  onSave: () => void;
  onSendToThor: () => void;
}

const OptimizeMapPanel = ({
  optimizedStops,
  selectedVehicle,
  onVehicleChange,
  vehicles,
  draggedItem,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onUpdateDuration,
  onUndo,
  onRedo,
  onClear,
  onAdd,
  canUndo,
  canRedo,
  onTogglePanel,
  onSave,
  onSendToThor
}: OptimizeMapPanelProps) => {
  const vehicleOptions = useMemo(() => {
    const fallbackVehicles = ['401', '402', '403'];
    const availableVehicles = vehicles && vehicles.length > 0 ? vehicles : fallbackVehicles;
    return availableVehicles.map(vehicle => ({
      value: vehicle,
      label: `Fordon ${vehicle}`
    }));
  }, [vehicles]);


  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-screen">
      <Card className="h-full flex flex-col border-0 rounded-none">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="font-normal">Körturordning</CardTitle>
            <Button 
              variant="ghost"
              size="icon"
              onClick={onTogglePanel}
              className="h-8 w-8"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-4 overflow-hidden pb-0">
          {/* Vehicle Selection */}
          <div className="mb-4">
            <SegmentedControl
              options={vehicleOptions}
              value={selectedVehicle}
              onValueChange={onVehicleChange}
              className="w-full"
            />
          </div>

          <div className="flex-1 min-h-0 mb-4">
            <RouteColumn
              title="Optimerad körtur"
              subtitle=""
              stops={optimizedStops}
              listType="optimized"
              draggedItem={draggedItem}
              dragOverIndex={dragOverIndex}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onUpdateDuration={onUpdateDuration}
              onUndo={onUndo}
              onRedo={onRedo}
              onClear={onClear}
              onAdd={onAdd}
              canUndo={canUndo}
              canRedo={canRedo}
              hasChanges={canUndo}
              currentStops={[]}
            />
          </div>
          
          {/* Docked Action Panel */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-between gap-4">
            <Button 
              variant="outline"
              size="lg"
              onClick={onSendToThor}
              className="flex-1"
            >
              Skicka till Thor
            </Button>
            <Button 
              size="lg"
              onClick={onSave}
              className="flex-1"
            >
              Spara
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OptimizeMapPanel;
