import React, { useState } from 'react';
import { Stop } from '@/types/stops';
import ParkedStopCard from './ParkedStopCard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface ParkingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parkedStops: Stop[];
  onDragStart: (e: React.DragEvent, stopId: string) => void;
  onAutoPlace?: (stopIds: string[]) => void;
}

const ParkingSheet = ({
  open,
  onOpenChange,
  parkedStops,
  onDragStart,
  onAutoPlace
}: ParkingSheetProps) => {
  const [selectedStopIds, setSelectedStopIds] = useState<string[]>([]);

  const handleCardClick = (e: React.MouseEvent, stopId: string) => {
    // Prevent click during drag
    if (e.defaultPrevented) return;

    setSelectedStopIds(prev =>
      prev.includes(stopId)
        ? prev.filter(id => id !== stopId)
        : [...prev, stopId]
    );
  };

  const handleAutoPlace = () => {
    if (onAutoPlace && selectedStopIds.length > 0) {
      onAutoPlace(selectedStopIds);
      toast.success(`${selectedStopIds.length} stopp placerade ut automatiskt`);
      setSelectedStopIds([]);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="left"
        className="w-[400px] sm:w-[400px]"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="pr-10">
          <SheetTitle className="text-2xl font-medium text-foreground">
            {selectedStopIds.length > 0
              ? `${selectedStopIds.length} valda stopp`
              : 'Parkerade stopp'
            }
          </SheetTitle>
          {parkedStops.length > 0 && (
            <SheetDescription className="text-sm text-muted-foreground">
              Dra kort direkt till optimerad körtur, eller markera de du vill ska placeras ut automatiskt där det passar bäst i körturordningen.
            </SheetDescription>
          )}
        </SheetHeader>

        {parkedStops.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-center">
            <p className="text-sm text-muted-foreground">
              Parkerade stopp kommer visas här
            </p>
          </div>
        ) : (
          <>
            <div className="h-[calc(100vh-120px)] mt-6 overflow-y-auto -m-2 p-2">
              <div className="space-y-3">
                {parkedStops.map((stop) => (
                  <ParkedStopCard
                    key={stop.id}
                    stop={stop}
                    isSelected={selectedStopIds.includes(stop.id)}
                    onClick={(e) => handleCardClick(e, stop.id)}
                    onDragStart={(e) => {
                      onDragStart(e, stop.id);
                      // Clear selection when starting to drag
                      setSelectedStopIds([]);
                    }}
                  />
                ))}
              </div>
            </div>

            {selectedStopIds.length > 0 && (
              <div className="sticky bottom-0 -mx-6 bg-background border-t border-border px-6 py-4 mt-4 shadow-lg">
                <Button
                  className="w-full bg-[#BBD197] hover:bg-[#BBD197]/90"
                  onClick={handleAutoPlace}
                >
                  Placera ut {selectedStopIds.length} stopp automatiskt
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ParkingSheet;
