import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Minus } from 'lucide-react';

interface Stop {
  id: string;
  type: 'regular' | 'break' | 'lunch' | 'tipping';
  duration?: number;
  address?: string;
  estimatedTime?: string;
}

interface EditTippingModalProps {
  stop: Stop;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTipping: (stopId: string, updates: { duration?: number, estimatedTime?: string, address?: string }) => void;
  onDeleteTipping?: (stopId: string) => void;
}

const EditTippingModal: React.FC<EditTippingModalProps> = ({ stop, isOpen, onClose, onUpdateTipping, onDeleteTipping }) => {
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 6; hour <= 16; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

  const [duration, setDuration] = useState(stop.duration || 20);
  const [estimatedTime, setEstimatedTime] = useState(stop.estimatedTime || '');
  const [address, setAddress] = useState(stop.address || '');

  const handleSave = () => {
    onUpdateTipping(stop.id, {
      duration,
      estimatedTime,
      address: address.trim() || undefined
    });
    onClose();
  };

  const handleDelete = () => {
    if (onDeleteTipping) {
      onDeleteTipping(stop.id);
    }
    onClose();
  };

  const handleDurationChange = (change: number) => {
    const newDuration = Math.max(5, duration + change);
    setDuration(newDuration);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal flex items-center gap-2">
            <span className="text-lg">🚛</span>
            Redigera Tippning
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Desired Time and Duration */}
          <div className="flex gap-4">
            {/* Önskat klockslag container */}
            <div className="flex-1 space-y-2">
              <Label htmlFor="desired-time">Önskat klockslag</Label>
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

            {/* Längd container */}
            <div className="flex-1 space-y-2">
              <Label>Längd</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDurationChange(-5)}
                  disabled={duration <= 5}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="font-medium min-w-[60px] text-center">
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
              placeholder="Ange adress för tippning"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center">
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={!onDeleteTipping}
            className="mr-auto"
          >
            Ta bort
          </Button>
          <Button onClick={handleSave}>
            Spara ändringar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditTippingModal;