import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Stop {
  id: string;
  type: 'regular' | 'break' | 'lunch' | 'tipping';
  address?: string;
}

interface EditRegularStopModalProps {
  stop: Stop;
  isOpen: boolean;
  onClose: () => void;
  onDeleteRegularStop?: (stopId: string) => void;
}

const EditRegularStopModal: React.FC<EditRegularStopModalProps> = ({
  stop,
  isOpen,
  onClose,
  onDeleteRegularStop,
}) => {
  const handleDelete = () => {
    if (onDeleteRegularStop) {
      onDeleteRegularStop(stop.id);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">Redigera stopp</DialogTitle>
          {stop.address && (
            <p className="text-sm text-gray-600 font-medium">{stop.address}</p>
          )}
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-base text-gray-700">
            Vill du ta bort detta stopp från rutten?
          </p>
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <DialogClose asChild>
            <Button variant="outline">Avbryt</Button>
          </DialogClose>
          {onDeleteRegularStop && (
            <Button 
              variant="destructive" 
              onClick={handleDelete}
            >
              Ta bort stopp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditRegularStopModal;