import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Undo, Redo, Plus, ParkingCircle } from 'lucide-react';
import AddStopSheet from './AddStopSheet';
import ParkingSheet from './ParkingSheet';
import HistorySheet, { VersionSnapshot } from './HistorySheet';
import { Stop } from '@/types/stops';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface RouteStopsActionsProps {
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onAdd: (type: 'break' | 'tipping', position: number, address: string, duration: number, estimatedTime?: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasChanges: boolean;
  existingStops: Stop[];
  parkedStops: Stop[];
  onRestoreParkedStop: (stopId: string, position: number) => void;
  onDragStartFromParking: (e: React.DragEvent, stopId: string) => void;
  onRestoreMultipleParkedStops?: (stopIds: string[]) => void;
  versions: VersionSnapshot[];
  onRestoreVersion: (versionId: string) => void;
}

const RouteStopsActions = ({
  onUndo,
  onRedo,
  onClear,
  onAdd,
  canUndo,
  canRedo,
  hasChanges,
  existingStops,
  parkedStops,
  onRestoreParkedStop,
  onDragStartFromParking,
  onRestoreMultipleParkedStops,
  versions,
  onRestoreVersion
}: RouteStopsActionsProps) => {
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showParkingSheet, setShowParkingSheet] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);

  const handleAddStop = (type: 'break' | 'tipping', position: number, address: string, duration: number, estimatedTime?: string) => {
    onAdd(type, position, address, duration, estimatedTime);
  };

  const handlePreviewDragStart = (e: React.DragEvent, stopType: 'break' | 'tipping', address: string, duration: number, estimatedTime?: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: stopType,
      address: address,
      duration: duration,
      estimatedTime: estimatedTime
    }));
    e.dataTransfer.effectAllowed = 'move';

    // Set draggedItem state via a preview ID
    const previewId = `preview-${Date.now()}`;
    onDragStartFromParking(e, previewId);
  };

  return (
    <div className="flex flex-col gap-2">
      <TooltipProvider delayDuration={1000}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 hover:bg-muted hover:text-muted-foreground relative"
              onClick={() => setShowParkingSheet(prev => !prev)}
              aria-label="Parkering"
            >
              <ParkingCircle className="h-4 w-4" />
              {parkedStops.length > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {parkedStops.length}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Parkering</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 hover:bg-muted hover:text-muted-foreground mb-6"
              onClick={() => setShowAddSheet(prev => !prev)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Lägg till stopp</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 hover:bg-muted hover:text-muted-foreground"
                onClick={onUndo}
                disabled={!canUndo}
                aria-label="Ångra"
              >
                <Undo className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Ångra</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 hover:bg-muted hover:text-muted-foreground"
                onClick={onRedo}
                disabled={!canRedo}
                aria-label="Återställ"
              >
                <Redo className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Återställ</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AddStopSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        onAddStop={handleAddStop}
        existingStops={existingStops}
        onDragStart={handlePreviewDragStart}
      />

      <ParkingSheet
        open={showParkingSheet}
        onOpenChange={setShowParkingSheet}
        parkedStops={parkedStops}
        onDragStart={onDragStartFromParking}
        onAutoPlace={onRestoreMultipleParkedStops}
      />

      <HistorySheet
        open={showHistorySheet}
        onOpenChange={setShowHistorySheet}
        versions={versions}
        onRestoreVersion={onRestoreVersion}
      />
    </div>
  );
};

export default RouteStopsActions;
