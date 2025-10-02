
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Undo, Redo, RotateCcw, Plus } from 'lucide-react';
import AddStopModal from './AddStopModal';
import { Stop } from '@/types/stops';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface RouteStopsActionsProps {
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onAdd: (type: 'break' | 'tipping', position: number, address: string, duration: number, estimatedTime?: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasChanges: boolean;
  existingStops: Stop[];
}

const RouteStopsActions = ({ onUndo, onRedo, onClear, onAdd, canUndo, canRedo, hasChanges, existingStops }: RouteStopsActionsProps) => {
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAddStop = (type: 'break' | 'tipping', position: number, address: string, duration: number, estimatedTime?: string) => {
    onAdd(type, position, address, duration, estimatedTime);
  };

  return (
    <div className="flex items-center gap-4">
      <TooltipProvider delayDuration={1000}>
        <div className="flex items-center gap-1">
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

        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 hover:bg-muted hover:text-muted-foreground"
                    disabled={!hasChanges}
                    aria-label="Börja om"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
              </span>
            </TooltipTrigger>
            <TooltipContent>Börja om</TooltipContent>
          </Tooltip>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-normal">Börja om från början?</AlertDialogTitle>
              <AlertDialogDescription className="text-base text-gray-700">
                Detta kommer ta bort dina ändringar och rensa all sparad data. Åtgärden kan inte återskapas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction 
                onClick={onClear}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Börja om
              </AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </div>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="secondary" size="icon" className="h-8 w-8" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Lägg till stopp</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AddStopModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddStop={handleAddStop}
        existingStops={existingStops}
      />
    </div>
  );
};

export default RouteStopsActions;
