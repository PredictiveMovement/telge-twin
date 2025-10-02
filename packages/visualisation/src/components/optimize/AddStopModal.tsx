import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SegmentedControl, SegmentedControlOption } from '@/components/ui/segmented-control';
import { Plus, Minus } from 'lucide-react';
import { Stop } from '@/types/stops';

interface AddStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStop: (type: 'break' | 'tipping', position: number, address: string, duration: number, estimatedTime?: string) => void;
  existingStops: Stop[];
}

const AddStopModal: React.FC<AddStopModalProps> = ({ isOpen, onClose, onAddStop, existingStops }) => {
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
    onClose();
  };

  const handleDurationChange = (change: number) => {
    const minDuration = stopType === 'break' ? 5 : 10;
    const newDuration = Math.max(minDuration, duration + change);
    setDuration(newDuration);
  };

  const getPositionOptions = () => {
    const options = [];
    
    // Add option for beginning
    options.push({ value: 0, label: 'I början' });
    
    // Add options for after each existing stop
    existingStops.forEach((stop, index) => {
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
    
    return options;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal flex items-center gap-2">
            <Plus className="h-5 w-5 text-[#222222]" />
            Lägg till stopp
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
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
            />
          </div>

          {/* Position Selection */}
          <div className="space-y-2">
            <Label htmlFor="position">Position i körordningen</Label>
            <Select value={position.toString()} onValueChange={(value) => setPosition(parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Välj position" />
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

          {/* Time and Duration - Side by side */}
          <div className="flex gap-4">
            {/* Time Selection */}
            <div className="flex-1 space-y-2">
              <Label htmlFor="desired-time">Önskat klockslag (valfritt)</Label>
              <Select value={estimatedTime} onValueChange={setEstimatedTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj tid" />
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
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Adress (valfritt)</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={stopType === 'break' ? "Ange adress för rasten" : "Ange adress för tippningen"}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Avbryt
          </Button>
          <Button onClick={handleSave}>
            Lägg till
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddStopModal;