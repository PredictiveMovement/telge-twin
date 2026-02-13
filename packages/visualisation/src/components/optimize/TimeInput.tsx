import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minHour?: number;
  maxHour?: number;
  className?: string;
  style?: React.CSSProperties;
}

const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  disabled = false,
  minHour = 5,
  maxHour = 18,
  className = '',
  style = {}
}) => {
  // Parse the time value (e.g., "06:00" -> hour: "06", minute: "00")
  const parseTime = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(':')) {
      return { hour: '', minute: '' };
    }
    const [hour, minute] = timeStr.split(':');
    return { hour, minute };
  };

  const { hour, minute } = parseTime(value);

  // Generate hour options (05-18)
  const hourOptions = Array.from({ length: maxHour - minHour + 1 }, (_, i) => {
    const h = minHour + i;
    return h.toString().padStart(2, '0');
  });

  // Generate minute options (00, 05, 10, ..., 55)
  const minuteOptions = Array.from({ length: 12 }, (_, i) => {
    const m = i * 5;
    return m.toString().padStart(2, '0');
  });

  // Handle hour change
  const handleHourChange = (newHour: string) => {
    const currentMinute = minute || '00';
    onChange(`${newHour}:${currentMinute}`);
  };

  // Handle minute change
  const handleMinuteChange = (newMinute: string) => {
    const currentHour = hour || hourOptions[0];
    onChange(`${currentHour}:${newMinute}`);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Hour dropdown */}
      <Select value={hour} onValueChange={handleHourChange} disabled={disabled}>
        <SelectTrigger 
          className="w-16 h-8 text-sm bg-white border focus:ring-2 focus:ring-primary focus:ring-offset-2"
          style={style}
        >
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="bg-white z-50">
          {hourOptions.map((h) => (
            <SelectItem key={h} value={h} className="text-sm">
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Colon separator */}
      <span className="text-sm font-medium">:</span>

      {/* Minute dropdown */}
      <Select value={minute} onValueChange={handleMinuteChange} disabled={disabled}>
        <SelectTrigger 
          className="w-16 h-8 text-sm bg-white border focus:ring-2 focus:ring-primary focus:ring-offset-2"
          style={style}
        >
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="bg-white z-50">
          {minuteOptions.map((m) => (
            <SelectItem key={m} value={m} className="text-sm">
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default TimeInput;
