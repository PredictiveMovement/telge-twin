import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { useForm } from 'react-hook-form';
import WorkerSettingsSection from './WorkerSettingsSection';
import BreaksSection from './BreaksSection';
import ProjectDetailsSection from './ProjectDetailsSection';
import FeasibilityIndicator from './FeasibilityIndicator';
import {
  estimateOptimizationFeasibility,
  getRouteDatasets,
} from '@/api/simulator';
import type { RouteEstimate } from '@/api/simulator';
import { computeFeasibility } from '@/utils/feasibilityEstimate';
import type { BreakConfig } from '@/types/breaks';
import { buildOptimizationStartDate } from '@/utils/optimizationPreparation';

interface SaveOptimizationFormProps {
  onSave: (optimization: any) => void;
  selectedRoutes?: string[];
  filters?: any;
  viewMode?: 'turid' | 'flottor';
  selectedItems?: any[];
  estimateInputBase?: {
    routeData: Record<string, unknown>[];
    fleetConfiguration: Record<string, unknown>[];
    originalSettings?: Record<string, unknown> | null;
  };
}

const SaveOptimizationForm: React.FC<SaveOptimizationFormProps> = ({
  onSave,
  selectedRoutes = [],
  filters = {},
  viewMode,
  selectedItems = [],
  estimateInputBase,
}) => {
  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      startTime: '06:00',
      endTime: '15:00'
    }
  });

  const [breaks, setBreaks] = useState<BreakConfig[]>(DEFAULT_BREAKS.map(b => ({ ...b })));

  const [extraBreaks, setExtraBreaks] = useState<BreakConfig[]>([]);

  const [isNameAutofilled, setIsNameAutofilled] = useState(false);
  const [isDescriptionAutofilled, setIsDescriptionAutofilled] = useState(false);

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

const bookingCoordinates = useMemo(() => {
  const data = estimateInputBase?.routeData;
  if (!data?.length) return [];
  return data
    .filter((r: any) => typeof r.Lat === 'number' && typeof r.Lng === 'number' && r.Lat !== 0 && r.Lng !== 0)
    .map((r: any) => ({ lat: r.Lat as number, lng: r.Lng as number }));
}, [estimateInputBase?.routeData]);

const startTime = form.watch('startTime');
const endTime = form.watch('endTime');
const [routeEstimates, setRouteEstimates] = useState<RouteEstimate[]>([]);
const [estimatesLoading, setEstimatesLoading] = useState(false);
const estimateStartDate = useMemo(
  () => buildOptimizationStartDate(filters, { start: startTime }),
  [filters?.dateRange?.from, startTime]
);

useEffect(() => {
  if (!estimateInputBase?.fleetConfiguration?.length) {
    setRouteEstimates([]);
    setEstimatesLoading(false);
    return;
  }

  let cancelled = false;
  const controller = new AbortController();
  const debounceId = window.setTimeout(() => {
    setEstimatesLoading(true);

    estimateOptimizationFeasibility(
      {
        ...estimateInputBase,
        optimizationSettings: {
          workingHours: {
            start: startTime,
            end: endTime,
          },
          breaks: breaks.filter((breakItem) => breakItem.enabled),
          extraBreaks: extraBreaks.filter((breakItem) => breakItem.enabled),
        },
        startDate: estimateStartDate,
      },
      {
        signal: controller.signal,
        timeoutMs: 30000,
      }
    )
      .then(({ estimates }) => {
        if (!cancelled) {
          setRouteEstimates(estimates);
        }
      })
      .catch((err) => {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
          return;
        }

        console.warn('Optimization feasibility estimation failed:', err);
        if (!cancelled) {
          setRouteEstimates([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setEstimatesLoading(false);
        }
      });
  }, 600);

  return () => {
    cancelled = true;
    window.clearTimeout(debounceId);
    controller.abort();
  };
}, [estimateInputBase, startTime, endTime, breaks, extraBreaks, estimateStartDate]);

const feasibilityResult = useMemo(() => {
  if (!routeEstimates?.length) return null;
  return computeFeasibility(routeEstimates, startTime, endTime);
}, [routeEstimates, startTime, endTime]);

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

          <WorkerSettingsSection form={form} />

          <BreaksSection
            breaks={breaks}
            extraBreaks={extraBreaks}
            onBreaksChange={setBreaks}
            onExtraBreaksChange={setExtraBreaks}
            disableHover
            bookingCoordinates={bookingCoordinates}
          />

          <FeasibilityIndicator
            result={feasibilityResult}
            loading={estimatesLoading}
          />

          <div className="flex gap-2 justify-end pt-6 pb-6">
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
