import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { SegmentedControl, SegmentedControlOption } from '@/components/ui/segmented-control';
import { Plus, Minus, Clock } from 'lucide-react';
import { Stop } from '@/types/stops';

interface AddStopSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddStop: (type: 'break' | 'tipping', position: number, address: string, duration: number, estimatedTime?: string) => void;
  existingStops: Stop[];
  onDragStart?: (e: React.DragEvent, stopType: 'break' | 'tipping', address: string, duration: number, estimatedTime?: string) => void;
}

const AddStopSheet: React.FC<AddStopSheetProps> = ({ open, onOpenChange, onAddStop, existingStops, onDragStart }) => {
  const [stopType, setStopType] = useState<'break' | 'tipping'>('break');
  const [position, setPosition] = useState<number>(existingStops.length);
  const [address, setAddress] = useState('');
  const [duration, setDuration] = useState(15);
  const [estimatedTime, setEstimatedTime] = useState('');

  const stopTypeOptions: SegmentedControlOption[] = [
    { value: 'break', label: '☕ Rast' },
    { value: 'tipping', label: '🚛 Tippning' }
  ];

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 6; hour <= 16; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

  const handleSave = () => {
    onAddStop(stopType, position, address.trim(), duration, estimatedTime || undefined);
    handleClose();
  };

  const handleClose = () => {
    // Reset form
    setStopType('break');
    setPosition(existingStops.length);
    setAddress('');
    setDuration(15);
    setEstimatedTime('');
    onOpenChange(false);
  };

  const handleDurationChange = (change: number) => {
    const minDuration = stopType === 'break' ? 5 : 10;
    const newDuration = Math.max(minDuration, duration + change);
    setDuration(newDuration);
  };

  const getPositionOptions = () => {
    const options = [];

    // Add option for beginning
    options.push({ value: 0, label: 'Först i turordningen' });

    // Add options for after each existing stop (except the last one)
    existingStops.forEach((stop, index) => {
      // Skip the last stop - we'll add "Sist i turordningen" instead
      if (index === existingStops.length - 1) return;

      let stopDescription = '';
      if (stop.type === 'break') {
        stopDescription = 'Rast';
      } else if (stop.type === 'lunch') {
        stopDescription = 'Lunch';
      } else if (stop.type === 'tipping') {
        stopDescription = 'Tippning';
      } else if (stop.address) {
        stopDescription = stop.address.length > 30 ? `${stop.address.substring(0, 30)}...` : stop.address;
      } else {
        stopDescription = `Stopp ${index + 1}`;
      }

      options.push({
        value: index + 1,
        label: `Efter ${stopDescription}`
      });
    });

    // Add option for last position
    options.push({ value: existingStops.length, label: 'Sist i turordningen' });

    return options;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="left"
        className="w-[400px] flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="pr-10">
          <SheetTitle className="text-2xl font-medium text-foreground">
            Lägg till stopp
          </SheetTitle>
          <SheetDescription>
            Välj typ, position och tid för stoppet
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Stop Type Selection */}
          <div className="space-y-3">
            <Label>Typ av stopp</Label>
            <SegmentedControl
              options={stopTypeOptions}
              value={stopType}
              onValueChange={(value: string) => {
                const newStopType = value as 'break' | 'tipping';
                setStopType(newStopType);
                setDuration(newStopType === 'break' ? 15 : 20);
              }}
              flexible
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Längd</Label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDurationChange(-5)}
                disabled={duration <= (stopType === 'break' ? 5 : 10)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="font-normal min-w-[60px] text-center">
                {duration} min
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDurationChange(5)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <Label htmlFor="desired-time">Önskat klockslag (valfritt)</Label>
            <Select value={estimatedTime} onValueChange={setEstimatedTime}>
              <SelectTrigger>
                <SelectValue placeholder="Välj i listan" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {generateTimeOptions().map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Adress (valfritt)</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={
                stopType === 'break' ? "Ange adress för rasten" : "Ange adress för tippningen"
              }
            />
          </div>

          {/* Position Selection */}
          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Select value={position.toString()} onValueChange={(value) => setPosition(parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Välj i listan" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {getPositionOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Help text for drag-and-drop */}
          <p className="text-sm text-muted-foreground text-center py-2">
            eller dra kortet till önskad plats
          </p>

          {/* Card Preview Section */}
          <div className="mt-2 space-y-2">
            {/* Preview Card - dynamically based on stopType */}
            {stopType === 'break' ? (
              <div
                draggable
                onDragStart={(e) => onDragStart?.(e, stopType, address, duration, estimatedTime)}
                className="bg-orange-50 border border-orange-200 rounded-md p-3 cursor-grab
                              transition-all flex items-center gap-3 min-h-[80px] shadow-md hover:shadow-lg">
                <div className="flex items-center justify-between flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">☕</span>
                    <div className="flex flex-col">
                      <span className="font-medium text-telge-morkrod text-base">Kafferast</span>
                      {address && <span className="text-sm text-telge-morkrod">{address}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {estimatedTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-telge-morkrod" />
                        <span className="font-medium text-telge-morkrod text-sm">{estimatedTime}</span>
                      </div>
                    )}
                    <span className="text-telge-morkrod text-sm">{duration} min</span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                draggable
                onDragStart={(e) => onDragStart?.(e, stopType, address, duration, estimatedTime)}
                className="bg-telge-ljusbla25 border border-telge-ljusbla rounded-md p-3 cursor-grab
                              transition-all flex items-center gap-3 min-h-[80px] shadow-md hover:shadow-lg">
                <div className="flex items-center justify-between flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🚛</span>
                    <div className="flex flex-col">
                      <span className="font-medium text-telge-morkbla text-base">Tippning</span>
                      {address && <span className="text-sm text-telge-morkbla">{address}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {estimatedTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-telge-morkbla" />
                        <span className="font-medium text-telge-morkbla text-sm">{estimatedTime}</span>
                      </div>
                    )}
                    <span className="text-telge-morkbla text-sm">{duration} min</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="sticky bottom-0 bg-background pt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Avbryt
          </Button>
          <Button onClick={handleSave}>
            Lägg till
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddStopSheet;
