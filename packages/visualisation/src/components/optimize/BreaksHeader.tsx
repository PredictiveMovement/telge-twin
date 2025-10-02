import React from 'react';
import { Label } from '@/components/ui/label';
import BreaksActions from './BreaksActions';

interface BreaksHeaderProps {
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onAdd: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const BreaksHeader: React.FC<BreaksHeaderProps> = ({
  onUndo,
  onRedo,
  onClear,
  onAdd,
  canUndo,
  canRedo
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label>Raster</Label>
        <p className="text-muted-foreground mt-1 text-sm">
          Önskat klockslag är ungefärlig och planeras in där det passar i körturen
        </p>
      </div>
      <BreaksActions
        onUndo={onUndo}
        onRedo={onRedo}
        onClear={onClear}
        onAdd={onAdd}
        canUndo={canUndo}
        canRedo={canRedo}
      />
    </div>
  );
};

export default BreaksHeader;