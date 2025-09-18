import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

interface WorkerSettingsSectionProps {
  form: any
  timeOptions: string[]
}

const WorkerSettingsSection: React.FC<WorkerSettingsSectionProps> = ({
  form,
  timeOptions,
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Arbetsinställningar</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="startTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start på arbetsdagen</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:border-accent">
                    <SelectValue placeholder="Välj starttid" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {timeOptions
                      .filter((time) => time >= '05:00' && time <= '10:00')
                      .map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="endTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slut på arbetsdagen</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:border-accent">
                    <SelectValue placeholder="Välj sluttid" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {timeOptions
                      .filter((time) => time >= '14:00' && time <= '18:00')
                      .map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}

export default WorkerSettingsSection
