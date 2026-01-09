
import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface ProjectDetailsSectionProps {
  form: any;
  isNameAutofilled?: boolean;
  isDescriptionAutofilled?: boolean;
  onNameUserEdit?: () => void;
  onDescriptionUserEdit?: () => void;
}

const ProjectDetailsSection: React.FC<ProjectDetailsSectionProps> = ({ form, isNameAutofilled, isDescriptionAutofilled, onNameUserEdit, onDescriptionUserEdit }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Projektdetaljer</h3>
      
      <FormField 
        control={form.control} 
        name="name" 
        render={({ field }) => (
          <FormItem>
            <FormLabel>Namn på optimering</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Ange namn på optimering..." className={isNameAutofilled ? 'text-muted-foreground' : undefined} onChange={(e) => { field.onChange(e); onNameUserEdit?.(); }} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} 
      />
      
      <FormField 
        control={form.control} 
        name="description" 
        render={({ field }) => (
          <FormItem>
            <FormLabel>Beskrivning</FormLabel>
            <FormControl>
              <Textarea {...field} placeholder="Ange beskrivning av optimeringen..." className={`min-h-[80px] ${isDescriptionAutofilled ? 'text-muted-foreground' : ''}`} onChange={(e) => { field.onChange(e); onDescriptionUserEdit?.(); }} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} 
      />
    </div>
  );
};

export default ProjectDetailsSection;
