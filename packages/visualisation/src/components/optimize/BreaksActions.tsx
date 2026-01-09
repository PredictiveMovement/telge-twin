import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Undo, Redo, RotateCcw } from 'lucide-react';
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

interface BreaksActionsProps {
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onAdd: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const BreaksActions: React.FC<BreaksActionsProps> = ({
  onUndo,
  onRedo,
  onClear,
  onAdd,
  canUndo,
  canRedo
}) => {
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
                <AlertDialogTitle className="text-2xl font-normal">Börja om från början?</AlertDialogTitle>
                <AlertDialogDescription>
                  Detta kommer ta bort alla extra raster och återställa till standardinställningar.
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
            <Button type="button" variant="secondary" size="icon" className="h-8 w-8" onClick={onAdd}>
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Lägg till rast</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default BreaksActions;