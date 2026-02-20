
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { useForm } from 'react-hook-form';
import WorkerSettingsSection from './WorkerSettingsSection';
import BreaksSection from './BreaksSection';
import ProjectDetailsSection from './ProjectDetailsSection';
import FeasibilityIndicator from './FeasibilityIndicator';
import { getRouteDatasets } from '@/api/simulator';
import type { RouteEstimate } from '@/api/simulator';
import { computeFeasibility } from '@/utils/feasibilityEstimate';

interface SaveOptimizationFormProps {
  onSave: (optimization: any) => void;
  selectedRoutes?: string[];
  filters?: any;
  viewMode?: 'turid' | 'flottor';
  selectedItems?: any[];
  onFormDirtyChange?: (isDirty: boolean) => void;
  routeEstimates?: RouteEstimate[];
  estimatesLoading?: boolean;
}

interface BreakConfig {
  id: string;
  name: string;
  duration: number;
  enabled: boolean;
  desiredTime?: string;
}

const SaveOptimizationForm: React.FC<SaveOptimizationFormProps> = ({
  onSave,
  selectedRoutes = [],
  filters = {},
  viewMode,
  selectedItems = [],
  onFormDirtyChange,
  routeEstimates,
  estimatesLoading,
}) => {
  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      startTime: '06:00',
      endTime: '15:00'
    }
  });

  const [breaks, setBreaks] = useState<BreakConfig[]>([{
    id: 'morning',
    name: 'Förmiddagsrast',
    duration: 15,
    enabled: true,
    desiredTime: '08:00'
  }, {
    id: 'lunch',
    name: 'Lunch',
    duration: 45,
    enabled: true,
    desiredTime: '10:00'
  }, {
    id: 'afternoon',
    name: 'Eftermiddagsrast',
    duration: 15,
    enabled: true,
    desiredTime: '13:00'
  }]);

  const [extraBreaks, setExtraBreaks] = useState<BreakConfig[]>([]);

  const [isNameAutofilled, setIsNameAutofilled] = useState(false);
  const [isDescriptionAutofilled, setIsDescriptionAutofilled] = useState(false);

  // Generate time options for dropdown
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 6; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

const timeOptions = generateTimeOptions();

// Generate next auto-increment name: "Optimering 01", "Optimering 02", ...
const getNextOptimizationName = useCallback(async (): Promise<string> => {
  try {
    const saved = await getRouteDatasets();
    const nums = saved
      .map((o) => (typeof o?.name === 'string' ? o.name.match(/^Optimering\s(\d{2})$/) : null))
      .filter(Boolean)
      .map((m: RegExpMatchArray) => parseInt(m[1], 10));
    const max = nums.length ? Math.max(...nums) : 0;
    const next = (isFinite(max) ? max + 1 : 1).toString().padStart(2, '0');
    return `Optimering ${next}`;
  } catch {
    return 'Optimering 01';
  }
}, []);

// Build automatic description from selected items
const buildAutoDescription = useCallback((): string => {
  const items = Array.isArray(selectedItems) ? selectedItems : [];
  if ((viewMode === 'turid' || viewMode === 'flottor') && items.length > 0) {
    if (viewMode === 'turid') {
      const names = items.map((i: any) => i?.name || i?.id).filter(Boolean);
      const vehicles = Array.from(
        new Set(items.map((i: any) => i?.fordon).filter(Boolean))
      );
      const title = names.length ? `TurID: ${names.join(', ')}` : '';
      const vehiclePart = vehicles.length ? `Fordon: ${vehicles.join(', ')}` : '';
      return [title, vehiclePart].filter(Boolean).join('. ');
    }

    const names = items.map((i: any) => i?.name || i?.id).filter(Boolean);
    const allVehicles = Array.from(
      new Set(
        items.flatMap((i: any) =>
          Array.isArray(i?.vehicleNumbers) ? i.vehicleNumbers : []
        ).filter(Boolean)
      )
    );
    const title = names.length ? `Flotta: ${names.join(', ')}` : '';
    const vehiclePart = allVehicles.length ? `Fordon: ${allVehicles.join(', ')}` : '';
    return [title, vehiclePart].filter(Boolean).join('. ');
  }

  if (selectedRoutes && selectedRoutes.length > 0) {
    return viewMode === 'flottor'
      ? `Flotta: ${selectedRoutes.length} vald`
      : `TurID: ${selectedRoutes.join(', ')}`;
  }
  return '';
}, [selectedItems, selectedRoutes, viewMode]);

// Extract unique vehicles from selection for downstream optimize UI
const getVehiclesFromSelection = useCallback((): string[] => {
  const items = Array.isArray(selectedItems) ? selectedItems : [];
  if (viewMode === 'turid') {
    return Array.from(new Set(items.map((i: any) => i?.fordon).filter(Boolean))).map(String);
  }
  if (viewMode === 'flottor') {
    return Array.from(
      new Set(
        items.flatMap((i: any) =>
          Array.isArray(i?.vehicleNumbers) ? i.vehicleNumbers : []
        ).filter(Boolean)
      )
    ).map(String);
  }
  return [];
}, [selectedItems, viewMode]);

// Prefill form values on mount/update if empty
useEffect(() => {
  const prefillForm = async () => {
    const currentName = form.getValues('name');
    if (!currentName || !currentName.trim()) {
      const nextName = await getNextOptimizationName();
      form.setValue('name', nextName);
      setIsNameAutofilled(true);
    }
    const currentDesc = form.getValues('description');
    if (!currentDesc || !currentDesc.trim()) {
      const auto = buildAutoDescription();
      if (auto) {
        form.setValue('description', auto);
        setIsDescriptionAutofilled(true);
      }
    }
  };
  prefillForm();
}, [form, getNextOptimizationName, buildAutoDescription]);

// Track form dirty state and breaks changes
useEffect(() => {
  const subscription = form.watch((values) => {
    if (onFormDirtyChange) {
      // Check if any form field has been manually edited (not autofilled)
      const hasManualChanges = 
        !isNameAutofilled ||
        !isDescriptionAutofilled ||
        values.startTime !== '06:00' ||
        values.endTime !== '15:00';
      
      onFormDirtyChange(hasManualChanges);
    }
  });
  
  return () => subscription.unsubscribe();
}, [
  form,
  onFormDirtyChange,
  isNameAutofilled,
  isDescriptionAutofilled,
]);

// Track breaks changes
useEffect(() => {
  if (onFormDirtyChange) {
    const hasBreakChanges = 
      breaks.some(b => !b.enabled || b.desiredTime !== '08:00' && b.id === 'morning' || b.desiredTime !== '10:00' && b.id === 'lunch' || b.desiredTime !== '13:00' && b.id === 'afternoon') ||
      extraBreaks.length > 0;
    
    onFormDirtyChange(hasBreakChanges);
  }
}, [breaks, extraBreaks, onFormDirtyChange]);

const startTime = form.watch('startTime');
const endTime = form.watch('endTime');

const feasibilityResult = useMemo(() => {
  if (!routeEstimates?.length) return null;
  return computeFeasibility(routeEstimates, startTime, endTime, breaks, extraBreaks);
}, [routeEstimates, startTime, endTime, breaks, extraBreaks]);

const onSubmit = async (data: any) => {
  const ensuredName = data?.name && data.name.trim() ? data.name.trim() : await getNextOptimizationName();

  const vehicles = getVehiclesFromSelection();

  const optimization = {
    id: Date.now().toString(),
    name: ensuredName,
    description: data.description,
    
    workingHours: {
      start: data.startTime,
      end: data.endTime
    },
    breaks: breaks.filter(b => b.enabled),
    extraBreaks: extraBreaks.filter(b => b.enabled),
    selectedRoutes,
    filters,
    vehicles,
    createdAt: new Date().toISOString()
  };
  onSave(optimization);
};

  return (
    <div className="space-y-8 bg-white rounded-lg p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <ProjectDetailsSection 
            form={form} 
            isNameAutofilled={isNameAutofilled}
            isDescriptionAutofilled={isDescriptionAutofilled}
            onNameUserEdit={() => setIsNameAutofilled(false)}
            onDescriptionUserEdit={() => setIsDescriptionAutofilled(false)}
          />

          <Separator />

          <WorkerSettingsSection form={form} timeOptions={timeOptions} />


          <BreaksSection
            breaks={breaks}
            extraBreaks={extraBreaks}
            timeOptions={timeOptions}
            onBreaksChange={setBreaks}
            onExtraBreaksChange={setExtraBreaks}
            disableHover
          />

          <FeasibilityIndicator
            result={feasibilityResult}
            loading={estimatesLoading}
          />

          <div className="flex gap-2 justify-end pt-6">
            <Button type="submit" className="bg-[#BBD197] hover:bg-[#BBD197]/90">
              Spara och fortsätt
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default SaveOptimizationForm;
