import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, ParkingCircle } from 'lucide-react';

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
  onParkStop?: (stopId: string) => void;
}

const EditRegularStopModal: React.FC<EditRegularStopModalProps> = ({
  stop,
  isOpen,
  onClose,
  onDeleteRegularStop,
  onParkStop,
}) => {
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  // Reset delete confirmation when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsDeleteConfirming(false);
    }
  }, [isOpen]);

  // Handle click outside to reset delete confirmation
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deleteButtonRef.current && !deleteButtonRef.current.contains(event.target as Node)) {
        setIsDeleteConfirming(false);
      }
    };

    if (isDeleteConfirming) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDeleteConfirming]);

  const handleDelete = () => {
    if (!isDeleteConfirming) {
      setIsDeleteConfirming(true);
    } else {
      if (onDeleteRegularStop) {
        onDeleteRegularStop(stop.id);
      }
      setIsDeleteConfirming(false);
      onClose();
    }
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

        <DialogFooter className="flex flex-row items-center justify-between w-full sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            {onDeleteRegularStop && (
              <Button
                ref={deleteButtonRef}
                variant="secondary-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                {isDeleteConfirming ? 'Klicka igen för att ta bort' : 'Ta bort'}
              </Button>
            )}
            {onParkStop && (
              <Button
                variant="secondary"
                onClick={() => {
                  onParkStop(stop.id);
                  onClose();
                }}
              >
                <ParkingCircle className="h-4 w-4 mr-1" />
                Parkera
              </Button>
            )}
          </div>
          <DialogClose asChild>
            <Button variant="outline">Stäng</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditRegularStopModal;