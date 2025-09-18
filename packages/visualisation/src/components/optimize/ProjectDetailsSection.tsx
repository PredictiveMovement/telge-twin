import React from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'

interface ProjectDetailsSectionProps {
  form: any
  isNameAutofilled?: boolean
  isDescriptionAutofilled?: boolean
  onNameUserEdit?: () => void
  onDescriptionUserEdit?: () => void
}

const ProjectDetailsSection: React.FC<ProjectDetailsSectionProps> = ({
  form,
  isNameAutofilled,
  isDescriptionAutofilled,
  onNameUserEdit,
  onDescriptionUserEdit,
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Projekt</h3>

      <div className="grid grid-cols-1 gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Namn</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Ange namn på optimeringen"
                  onChange={(e) => {
                    field.onChange(e)
                    onNameUserEdit?.()
                  }}
                />
              </FormControl>
              {isNameAutofilled && (
                <p className="text-xs text-muted-foreground">
                  Förifyllt namn, ändra vid behov
                </p>
              )}
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
                <Textarea
                  {...field}
                  placeholder="Kort beskrivning"
                  onChange={(e) => {
                    field.onChange(e)
                    onDescriptionUserEdit?.()
                  }}
                />
              </FormControl>
              {isDescriptionAutofilled && (
                <p className="text-xs text-muted-foreground">
                  Förifylld baserat på ditt urval
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}

export default ProjectDetailsSection

