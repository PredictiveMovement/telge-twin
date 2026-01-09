import React from 'react';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WorkerSettingsSectionProps {
  form: any;
}

const WorkerSettingsSection: React.FC<WorkerSettingsSectionProps> = ({ form }) => {
  const generateTimeOptions = (minHour: number, maxHour: number, includeMaxMinutes: boolean = true) => {
    const options = [];
    for (let hour = minHour; hour <= maxHour; hour++) {
      const maxMinute = (hour === maxHour && !includeMaxMinutes) ? 0 : 59;
      for (let minute = 0; minute <= maxMinute; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

  const startTimeOptions = generateTimeOptions(5, 10);
  const endTimeOptions = generateTimeOptions(13, 19, false);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Arbetsinställningar</h3>
      
      <div className="grid grid-cols-2 gap-6">
        <FormField
          control={form.control}
          name="startTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Starttid</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj starttid" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-[200px] overflow-y-auto">
                  {startTimeOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="endTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sluttid</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj sluttid" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-[200px] overflow-y-auto">
                  {endTimeOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      </div>
      <p className="text-sm text-muted-foreground pt-2">
        Dessa tider anger arbetsdagen för fordonen.
      </p>
    </div>
  );
};

export default WorkerSettingsSection;
