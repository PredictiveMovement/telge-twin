import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDesc, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LayoutGrid, Table as TableIcon } from 'lucide-react';
import SavedOptimizationsTable, { SavedOptimization, OptimizationVersion } from '@/components/optimize/SavedOptimizationsTable';
import SavedOptimizationsGrid from '@/components/optimize/SavedOptimizationsGrid';
import BreaksSection from '@/components/optimize/BreaksSection';
import {
  RouteDataset,
  getRouteDatasets,
  deleteRouteDataset,
  getExperiments,
  copyExperiment,
  deleteExperiment,
  Experiment,
} from '@/api/simulator';
import { toast } from '@/hooks/use-toast';
import { useMapSocket } from '@/hooks/useMapSocket';
import { useOptimizationContext } from '@/contexts/OptimizationContext';
import { isExperimentOptimizing, isExperimentComplete } from '@/utils/optimization';

interface ExperimentWithDocId extends Experiment {
  documentId: string;
}

export default function SavedDatasetsTab() {
  const navigate = useNavigate();
  const { socket } = useMapSocket();
  const { runningOptimizations, completedOptimizations, markAsViewed } = useOptimizationContext();
  const [datasets, setDatasets] = useState<RouteDataset[]>([]);
  const [experiments, setExperiments] = useState<ExperimentWithDocId[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    const stored = localStorage.getItem('savedDatasetsView');
    return stored === 'grid' || stored === 'table' ? stored as 'table' | 'grid' : 'table';
  });
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'description' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [editingExperiment, setEditingExperiment] = useState<ExperimentWithDocId | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editStartTime, setEditStartTime] = useState('06:00');
  const [editEndTime, setEditEndTime] = useState('15:00');
  const [editBreaks, setEditBreaks] = useState<any[]>([]);
  const [editExtraBreaks, setEditExtraBreaks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  // Generate time options for dropdowns (same as WorkerSettingsSection)
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

  const restartAnimation = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsAnimating(false);
    requestAnimationFrame(() => {
      setIsAnimating(true);
      timeoutRef.current = window.setTimeout(() => {
        setIsAnimating(false);
        timeoutRef.current = null;
      }, 4100);
    });
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  // Listen for simulation events to reload datasets
  useEffect(() => {
    if (!socket) return;

    const handleSimulationStarted = () => {
      // Reload to get the new experiment in the list
      loadDatasets();
    };

    const handlePlanSaved = (data: { sourceDatasetId?: string }) => {
      // Only reload for other clients (not the one who started the optimization)
      // The starting client handles completion via OptimizationContext
      if (data.sourceDatasetId && !runningOptimizations.has(data.sourceDatasetId)) {
        loadDatasets();
      }
    };

    // Request current simulation status when socket connects
    socket.emit('joinMap');

    socket.on('simulationStarted', handleSimulationStarted);
    socket.on('planSaved', handlePlanSaved);

    return () => {
      socket.off('simulationStarted', handleSimulationStarted);
      socket.off('planSaved', handlePlanSaved);
    };
  }, [socket, runningOptimizations]);

  const loadDatasets = async () => {
    try {
      const [datasetsData, experimentsData] = await Promise.all([
        getRouteDatasets(),
        getExperiments(),
      ]);
      setDatasets(datasetsData);
      setExperiments(experimentsData as ExperimentWithDocId[]);
    } catch {
      toast.error('Fel vid hämtning av data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (opt: SavedOptimization) => {
    // Find the experiment by its experimentId (latestExperimentId)
    const experiment = experiments.find(e => e.documentId === opt.experimentId);
    if (!experiment) return;

    // Also get dataset for fallback settings
    const dataset = datasets.find(d => d.datasetId === experiment.sourceDatasetId);

    setEditingExperiment(experiment);
    setEditName(experiment.name || experiment.datasetName || dataset?.name || '');
    setEditDescription(experiment.description || dataset?.description || '');

    // Load working hours from experiment or fall back to dataset
    const workingHours = experiment.optimizationSettings?.workingHours || dataset?.optimizationSettings?.workingHours;
    setEditStartTime(workingHours?.start || '06:00');
    setEditEndTime(workingHours?.end || '15:00');
    
    const breaks = experiment.optimizationSettings?.breaks || dataset?.optimizationSettings?.breaks || [{
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
    }];
    setEditBreaks(breaks);
    
    const extraBreaks = experiment.optimizationSettings?.extraBreaks || dataset?.optimizationSettings?.extraBreaks || [];
    setEditExtraBreaks(extraBreaks);
  };

  const handleCloseEdit = () => setEditingExperiment(null);

  const handleSaveEdit = async () => {
    const name = editName.trim();
    const description = editDescription.trim();
    if (!name || !editingExperiment) return;

    try {
      // Create a copy of the experiment with updated settings
      const result = await copyExperiment(editingExperiment.documentId, {
        name,
        description,
        optimizationSettings: {
          ...editingExperiment.optimizationSettings,
          workingHours: {
            start: editStartTime,
            end: editEndTime
          },
          breaks: editBreaks.filter(b => b.enabled),
          extraBreaks: editExtraBreaks.filter(b => b.enabled)
        }
      });

      if (result.success && result.experimentId) {
        toast.success('Ny version skapad');
        await loadDatasets();
        setEditingExperiment(null);
      } else {
        toast.error(`Fel vid skapande av ny version: ${result.error}`);
      }
    } catch {
      toast.error('Fel vid skapande av ny version');
    }
  };

  const handleOpen = (opt: SavedOptimization) => {
    // Use experimentId directly since each row is now an experiment
    const experimentId = opt.experimentId || opt.latestExperimentId;
    if (!experimentId) return;

    setNavigatingId(opt.id);

    // Pass experiment data via navigation state to avoid redundant API call
    const experiment = experiments.find(e => e.documentId === experimentId);
    navigate(`/optimize/${experimentId}`, {
      state: { experiment }
    });
  };

  const handleDelete = async (datasetId: string) => {
    const dataset = datasets.find(d => d.datasetId === datasetId);
    if (!dataset) return;

    try {
      const result = await deleteRouteDataset(datasetId);
      if (result.success) {
        toast.success('Dataset borttagen');
        await loadDatasets();
      } else {
        toast.error(`Fel vid borttagning: ${result.error}`);
      }
    } catch {
      toast.error('Fel vid borttagning av dataset');
    }
  };

  const handleRequestDelete = (datasetId: string) => {
    const dataset = datasets.find(d => d.datasetId === datasetId);
    const opt = optimizations.find(o => o.sourceDatasetId === datasetId);
    setConfirmDeleteTarget({
      id: datasetId,
      name: opt?.name || dataset?.name || ''
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTarget) return;
    await handleDelete(confirmDeleteTarget.id);
    // Close edit dialog if we deleted the dataset being edited
    if (editingExperiment?.sourceDatasetId === confirmDeleteTarget.id) setEditingExperiment(null);
    setConfirmDeleteTarget(null);
  };

  const handleRequestSort = (key: 'name' | 'description' | 'createdAt') => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleShowHistory = (opt: SavedOptimization) => {
    setExpandedHistoryId(expandedHistoryId === opt.id ? null : opt.id);
  };

  const handleLoadVersion = (opt: SavedOptimization, version: OptimizationVersion) => {
    navigate(`/optimize/${version.id}`);
  };

  // Convert datasets to SavedOptimization format, showing one row per dataset
  // with a reference to the latest experiment for that dataset
  const optimizations: SavedOptimization[] = useMemo(() => {
    // Group experiments by sourceDatasetId and find the latest one for each
    const latestExperimentByDataset = new Map<string, ExperimentWithDocId>();
    const experimentCountByDataset = new Map<string, number>();
    const experimentsByDataset = new Map<string, ExperimentWithDocId[]>();

    experiments.forEach(exp => {
      const datasetId = exp.sourceDatasetId;
      if (!datasetId) return;

      // Count experiments per dataset
      experimentCountByDataset.set(datasetId, (experimentCountByDataset.get(datasetId) || 0) + 1);

      // Collect all experiments per dataset
      const list = experimentsByDataset.get(datasetId) || [];
      list.push(exp);
      experimentsByDataset.set(datasetId, list);

      // Track the latest experiment (by createdAt)
      const current = latestExperimentByDataset.get(datasetId);
      if (!current) {
        latestExperimentByDataset.set(datasetId, exp);
      } else {
        const currentDate = new Date(current.createdAt || current.startDate || 0).getTime();
        const expDate = new Date(exp.createdAt || exp.startDate || 0).getTime();
        if (expDate > currentDate) {
          latestExperimentByDataset.set(datasetId, exp);
        }
      }
    });

    // Create one row per dataset with experiment that has VROOM plans
    const result: SavedOptimization[] = [];

    latestExperimentByDataset.forEach((latestExp, datasetId) => {
      const dataset = datasets.find(d => d.datasetId === datasetId);

      // Calculate expected vehicle count from dataset's fleetConfiguration
      const expectedVehicleCount = dataset?.fleetConfiguration?.reduce(
        (sum, fleet) => sum + (fleet.vehicles?.length || 0), 0
      ) || 0;

      // Skip experiments that are still optimizing, unless this client started it
      const isOwnOptimization = runningOptimizations.has(datasetId);
      if (isExperimentOptimizing(latestExp) && !isOwnOptimization) {
        return; // Don't show to other clients until optimization is complete
      }

      // Check if all vehicles are complete
      const isComplete = isExperimentComplete(latestExp, expectedVehicleCount);

      // If not complete AND not our own optimization, don't show
      if (!isComplete && !isOwnOptimization) {
        return;
      }
      const experimentCount = experimentCountByDataset.get(datasetId) || 1;

      // Build versions array from all experiments for this dataset
      const versions: OptimizationVersion[] = experimentsByDataset.get(datasetId)
        ?.sort((a, b) => new Date(b.createdAt || b.startDate || 0).getTime() - new Date(a.createdAt || a.startDate || 0).getTime())
        .map(exp => {
          // Count enabled breaks from optimization settings
          const breaks = exp.optimizationSettings?.breaks || [];
          const extraBreaks = exp.optimizationSettings?.extraBreaks || [];
          const enabledBreakCount = [...breaks, ...extraBreaks].filter(b => b.enabled).length;

          return {
            id: exp.documentId,
            timestamp: exp.createdAt || exp.startDate || '',
            label: exp.name || exp.datasetName || 'Version',
            vehicleCount: exp.vroomTruckPlanIds?.length || 0,
            isOptimizing: isExperimentOptimizing(exp),
            bookingCount: exp.baselineStatistics?.bookingCount,
            breakCount: enabledBreakCount > 0 ? enabledBreakCount : undefined,
          };
        }) || [];

      result.push({
        id: datasetId,
        name: latestExp.name || latestExp.datasetName || dataset?.name || 'Unnamed',
        description: latestExp.description || dataset?.description,
        selectedRoutes: [],
        filters: dataset?.filterCriteria,
        createdAt: latestExp.createdAt || latestExp.startDate,
        archived: false,
        breaks: latestExp.optimizationSettings?.breaks || dataset?.optimizationSettings?.breaks,
        extraBreaks: latestExp.optimizationSettings?.extraBreaks || dataset?.optimizationSettings?.extraBreaks,
        vehicles: latestExp.emitters || [],
        latestExperimentId: latestExp.documentId,
        experimentCount,
        experimentId: latestExp.documentId,
        sourceDatasetId: datasetId,
        isLatestVersion: true,
        versions,
        vehicleCount: latestExp.vroomTruckPlanIds?.length || 0,
        // Only show loading for the client that started the optimization
        isOptimizing: runningOptimizations.has(datasetId),
      });
    });

    return result;
  }, [datasets, experiments, runningOptimizations]);

  // Find the currently optimizing optimization (if any)
  const currentOptimizationId = useMemo(() => {
    const optimizing = optimizations.find(opt => opt.isOptimizing === true);
    return optimizing?.id;
  }, [optimizations]);

  // Cancel an ongoing optimization by deleting the experiment
  const handleCancelOptimization = async (id: string) => {
    const opt = optimizations.find(o => o.id === id);
    if (!opt?.experimentId) return;

    try {
      const result = await deleteExperiment(opt.experimentId);
      if (result.success) {
        toast.success('Optimering avbruten');
        loadDatasets();
      } else {
        toast.error(result.error || 'Kunde inte avbryta optimeringen');
      }
    } catch {
      toast.error('Kunde inte avbryta optimeringen');
    }
  };

  // Reload datasets when an optimization completes (detected by OptimizationContext)
  // This runs in the background without blocking the UI
  useEffect(() => {
    if (completedOptimizations.size === 0) return;

    const completedIds = Array.from(completedOptimizations.keys());

    const loadWithRetry = async (retriesLeft: number, delay: number) => {
      try {
        const [datasetsData, experimentsData] = await Promise.all([
          getRouteDatasets(),
          getExperiments(),
        ]);

        // Verifiera att alla slutförda experiment har färsk data
        const allFresh = completedIds.every(datasetId => {
          const dataset = datasetsData.find(d => d.datasetId === datasetId);
          const expectedVehicleCount = dataset?.fleetConfiguration?.reduce(
            (sum, fleet) => sum + (fleet.vehicles?.length || 0), 0
          ) || 0;

          const latestExp = (experimentsData as ExperimentWithDocId[])
            .filter(e => e.sourceDatasetId === datasetId)
            .sort((a, b) =>
              new Date(b.createdAt || b.startDate || 0).getTime() -
              new Date(a.createdAt || a.startDate || 0).getTime()
            )[0];

          return isExperimentComplete(latestExp, expectedVehicleCount);
        });

        if (!allFresh && retriesLeft > 0) {
          // Data inte färsk ännu, försök igen efter delay
          await new Promise(resolve => setTimeout(resolve, delay));
          return loadWithRetry(retriesLeft - 1, delay * 2);
        }

        // Uppdatera state med färsk data
        setDatasets(datasetsData);
        setExperiments(experimentsData as ExperimentWithDocId[]);

        // Markera som visad först efter färsk data
        completedIds.forEach(id => markAsViewed(id));
      } catch {
        // Silently fail for background refresh
      }
    };

    loadWithRetry(3, 500);
  }, [completedOptimizations, markAsViewed]);


  const query = search.trim().toLowerCase();
  const filtered = optimizations.filter(o => {
    if (o.archived === true) return false;
    if (!query) return true;
    const name = o.name?.toLowerCase() || '';
    const desc = o.description?.toLowerCase() || '';
    return name.includes(query) || desc.includes(query);
  });

  const visibleOptimizations = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'createdAt') {
      const ad = new Date(a.createdAt).getTime();
      const bd = new Date(b.createdAt).getTime();
      return (ad - bd) * dir;
    }
    const av = (a[sortKey] || '').toString();
    const bv = (b[sortKey] || '').toString();
    return av.localeCompare(bv, 'sv', {
      sensitivity: 'base'
    }) * dir;
  });

  const hasItems = optimizations.some(o => o.archived !== true);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Laddar optimeringar...</p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-2xl font-normal">Sparade optimeringar</CardTitle>
          <div className="flex items-center gap-2">
            <Input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Sök..." 
              className="h-9 w-[200px] sm:w-[260px]" 
              aria-label="Sök sparade optimeringar" 
            />
            <ToggleGroup 
              type="single" 
              value={viewMode} 
              onValueChange={val => {
                if (val === 'table' || val === 'grid') {
                  setViewMode(val);
                  localStorage.setItem('savedDatasetsView', val);
                }
              }} 
              variant="outline" 
              size="sm" 
              aria-label="Välj visningsläge"
            >
              <ToggleGroupItem value="table" aria-label="Visa som tabell">
                <TableIcon className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="grid" aria-label="Visa som grid">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasItems ? (
          <div className="px-6 py-12 sm:px-8 sm:py-16">
            <div className="min-h-[220px] sm:min-h-[260px] lg:min-h-[300px] flex flex-col items-center justify-center text-center space-y-4 sm:space-y-5">
              <div className="cursor-pointer" onMouseEnter={restartAnimation}>
                <svg id="epundSciBLx1" className={`h-24 w-24 ${isAnimating ? 'animating' : ''}`} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 45 45" shapeRendering="geometricPrecision" textRendering="geometricPrecision">
                  <title>Formulärikon</title>
                  <style>{`
                    #epundSciBLx1 * {animation: none}
                    #epundSciBLx1.animating #epundSciBLx2_to {animation: epundSciBLx2_to__to 4000ms linear 1 forwards}
                    @keyframes epundSciBLx2_to__to { 0% {transform: translate(24.494028px,22.75px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 25% {transform: translate(24.494028px,22px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 50% {transform: translate(24.494028px,22.75px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 75% {transform: translate(24.494028px,22px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 100% {transform: translate(24.494028px,22.75px)}}
                    #epundSciBLx1.animating #epundSciBLx3_to {animation: epundSciBLx3_to__to 4000ms linear 1 forwards}
                    @keyframes epundSciBLx3_to__to { 0% {transform: translate(20.700001px,35.800001px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 10% {transform: translate(10.211945px,34.000001px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 20% {transform: translate(12.852286px,32.456992px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 30% {transform: translate(14.263224px,35.336498px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 40% {transform: translate(15.704784px,32.211426px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 50% {transform: translate(17.41px,35.470889px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 60% {transform: translate(19.07px,32.316876px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 70% {transform: translate(20.2px,35.576742px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 80% {transform: translate(21.57px,33.663683px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 92.5% {transform: translate(20.700001px,35.800001px)} 100% {transform: translate(20.700001px,35.800001px)}}
                    #epundSciBLx1.animating #epundSciBLx3_tr {animation: epundSciBLx3_tr__tr 4000ms linear 1 forwards}
                    @keyframes epundSciBLx3_tr__tr { 0% {transform: rotate(0deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 10% {transform: rotate(2.249643deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 20% {transform: rotate(6.499893deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 30% {transform: rotate(-0.360917deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 40% {transform: rotate(7.38431deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 50% {transform: rotate(-6.099067deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 60% {transform: rotate(2.463685deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 70% {transform: rotate(-2.719139deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 80% {transform: rotate(4.395867deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 92.5% {transform: rotate(0deg)} 100% {transform: rotate(0deg)}}
                    #epundSciBLx1.animating #epundSciBLx10 {animation: epundSciBLx10_s_do 4000ms linear 1 forwards}
                    @keyframes epundSciBLx10_s_do { 0% {stroke-dashoffset: 0;animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 7.5% {stroke-dashoffset: 10;animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 15% {stroke-dashoffset: 10;animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 100% {stroke-dashoffset: 0}}
                    #epundSciBLx1.animating #epundSciBLx20_to {animation: epundSciBLx20_to__to 4000ms linear 1 forwards}
                    @keyframes epundSciBLx20_to__to { 0% {transform: translate(20.700001px,35.800001px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 10% {transform: translate(10.211945px,34.000001px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 20% {transform: translate(12.85px,32.46px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 30% {transform: translate(14.26px,35.336498px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 40% {transform: translate(15.7px,32.21px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 50% {transform: translate(17.729278px,35.47px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 60% {transform: translate(19.201224px,32.32px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 70% {transform: translate(20.786097px,35.58px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 80% {transform: translate(21.194263px,33.66px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 92.5% {transform: translate(20.700001px,35.800001px)} 100% {transform: translate(20.700001px,35.800001px)}}
                    #epundSciBLx1.animating #epundSciBLx20_tr {animation: epundSciBLx20_tr__tr 4000ms linear 1 forwards}
                    @keyframes epundSciBLx20_tr__tr { 0% {transform: rotate(0deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 10% {transform: rotate(2.249643deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 20% {transform: rotate(6.499893deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 30% {transform: rotate(-0.360917deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 40% {transform: rotate(7.38431deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 50% {transform: rotate(-6.099067deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 60% {transform: rotate(2.463685deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 70% {transform: rotate(-2.719139deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 80% {transform: rotate(4.395867deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 92.5% {transform: rotate(0deg)} 100% {transform: rotate(0deg)}}
                  `}</style>
                  <g id="epundSciBLx2_to" transform="translate(24.494028,22.75)"><g id="epundSciBLx2" transform="translate(-24.494028,-22.75)"><g id="epundSciBLx3_to" transform="translate(20.700001,35.800001)"><g id="epundSciBLx3_tr" transform="rotate(0)"><g id="epundSciBLx3" transform="translate(-20.699997,-35.8)"><path id="epundSciBLx4" d="M25.4,34.1L20.7,35.8L22.4,31.1L36.8,16.7C37.7,15.8,39.1,15.8,39.9,16.6L39.9,16.6C40.7,17.4,40.7,18.8,39.8,19.7L25.4,34.1Z" fill="none" stroke="rgb(34,34,34)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="1"/><path id="epundSciBLx5" d="M36.469474,17.360784L39.3,20.1" fill="none" stroke="rgb(34,34,34)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="1"/><path id="epundSciBLx6" d="M35.376777,18.376777L38.2,21.2" fill="none" stroke="rgb(34,34,34)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="1"/><path id="epundSciBLx7" d="M23.076777,30.676778L25.9,33.5" fill="none" stroke="rgb(34,34,34)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="1"/></g></g></g><g id="epundSciBLx8" mask="url(#epundSciBLx19)"><g id="epundSciBLx9"><path id="epundSciBLx10" d="M12,34.100001L21.560604,34.100001" fill="none" stroke="rgb(34,34,34)" strokeWidth="1" strokeMiterlimit="1" strokeDasharray="10"/><line id="epundSciBLx11" x1="12" y1="11" x2="30" y2="11" fill="none" stroke="rgb(34,34,34)" strokeWidth="1" strokeLinejoin="round" strokeMiterlimit="1"/><line id="epundSciBLx12" x1="12" y1="15" x2="30" y2="15" fill="none" stroke="rgb(34,34,34)" strokeWidth="1" strokeLinejoin="round" strokeMiterlimit="1"/><line id="epundSciBLx13" x1="12" y1="19" x2="30" y2="19" fill="none" stroke="rgb(34,34,34)" strokeWidth="1" strokeLinejoin="round" strokeMiterlimit="1"/><line id="epundSciBLx14" x1="12" y1="23" x2="25" y2="23" fill="none" stroke="rgb(34,34,34)" strokeWidth="1" strokeLinejoin="round" strokeMiterlimit="1"/><line id="epundSciBLx15" x1="12" y1="27" x2="21" y2="27" fill="none" stroke="rgb(34,34,34)" strokeWidth="1" strokeLinejoin="round" strokeMiterlimit="1"/><line id="epundSciBLx16" display="none" x1="12" y1="34" x2="23" y2="34" fill="none" stroke="rgb(34,34,34)" strokeWidth="1" strokeLinejoin="round" strokeMiterlimit="1" strokeDashoffset="11"/><polyline id="epundSciBLx17" points="33.5,27.000001 33.5,6.5 8.5,6.5 8.5,39" fill="none" stroke="rgb(34,34,34)" strokeWidth="1" strokeMiterlimit="1"/><path id="epundSciBLx18" d="M13,38.5L28.5,38.5C31.3,38.5,33.5,36.2,33.5,33.5L33.5,26" fill="none" stroke="rgb(34,34,34)" strokeWidth="1" strokeMiterlimit="1"/></g><mask id="epundSciBLx19"><g id="epundSciBLx20_to" transform="translate(20.700001,35.800001)"><g id="epundSciBLx20_tr" transform="rotate(0)"><path id="epundSciBLx20" d="M-0.00317,0.0039L45.00317,0.0039L45.00317,44.9961L-0.00317,44.9961L-0.00317,0.0039ZM25.4,34C34.3098,25.16284,39.14313,20.39617,39.9,19.7C41.0353,18.65575,40.48745,17.67771,39.9,16.6C39.50837,15.88153,38.62886,15.68571,37.26149,16.01255L22.4,30.5L20.7,35.8L25.4,34Z" transform="translate(-20.700004,-35.800001)" fill="rgb(255,255,255)" stroke="none" strokeWidth="0" strokeMiterlimit="1"/></g></g></mask></g></g></g>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium">Inga sparade optimeringar</h3>
                <p className="text-muted-foreground">När du sparat din första optimering hittar du den här</p>
              </div>
            </div>
          </div>
        ) : visibleOptimizations.length === 0 ? (
          <div className="px-6 py-12 sm:px-8 sm:py-16">
            <div className="min-h-[220px] sm:min-h-[260px] lg:min-h-[300px] flex flex-col items-center justify-center text-center space-y-4 sm:space-y-5">
              <div>
                <h3 className="text-lg font-medium">Inga träffar</h3>
                <p className="text-muted-foreground">Justera din sökning för att se resultat</p>
              </div>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <SavedOptimizationsTable
            optimizations={visibleOptimizations}
            onOpen={handleOpen}
            onDelete={handleRequestDelete}
            onEditName={handleOpenEdit}
            sortKey={sortKey}
            sortDir={sortDir}
            onRequestSort={handleRequestSort}
            loadingId={navigatingId}
            expandedHistoryId={expandedHistoryId}
            onShowHistory={handleShowHistory}
            onLoadVersion={handleLoadVersion}
            currentOptimizationId={currentOptimizationId}
            onCancelOptimization={handleCancelOptimization}
          />
        ) : (
          <SavedOptimizationsGrid
            optimizations={visibleOptimizations}
            onOpen={handleOpen}
            onDelete={handleRequestDelete}
            onEditName={handleOpenEdit}
            loadingId={navigatingId}
            expandedHistoryId={expandedHistoryId}
            onShowHistory={handleShowHistory}
            onLoadVersion={handleLoadVersion}
            currentOptimizationId={currentOptimizationId}
            onCancelOptimization={handleCancelOptimization}
          />
        )}

        <Dialog open={!!editingExperiment} onOpenChange={open => {
          if (!open) handleCloseEdit();
        }}>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-normal">Redigera optimering</DialogTitle>
              <DialogDescription>
                Ändra inställningar för denna optimering. En ny version sparas med de nya inställningarna.
              </DialogDescription>
            </DialogHeader>
            
            {editingExperiment && (
              <div className="space-y-8">
                  {/* Optimeringdetaljer */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Optimeringsdetaljer</h3>
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Namn</Label>
                      <Input 
                        id="edit-name" 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        autoFocus 
                        aria-label="Namn"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-description">Beskrivning</Label>
                      <Textarea 
                        id="edit-description" 
                        value={editDescription} 
                        onChange={e => setEditDescription(e.target.value)} 
                        aria-label="Beskrivning" 
                        className="min-h-[80px]" 
                      />
                    </div>
                  </div>

                  {/* Arbetsinställningar */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Arbetsinställningar</h3>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Starttid</Label>
                        <Select value={editStartTime} onValueChange={setEditStartTime}>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj starttid" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto">
                            {startTimeOptions.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Sluttid</Label>
                        <Select value={editEndTime} onValueChange={setEditEndTime}>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj sluttid" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto">
                            {endTimeOptions.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground pt-2">
                      Dessa tider anger arbetsdagen för fordonen.
                    </p>
                  </div>

                  {/* Raster */}
                  <BreaksSection
                    breaks={editBreaks}
                    extraBreaks={editExtraBreaks}
                    timeOptions={[]}
                    onBreaksChange={setEditBreaks}
                    onExtraBreaksChange={setEditExtraBreaks}
                    disableHover
                  />
                </div>
            )}
            
            <DialogFooter>
              <div className="flex items-center gap-2 mr-auto">
                <Button 
                  variant="secondary-destructive" 
                  onClick={() => {
                    if (!editingExperiment) return;
                    setConfirmDeleteTarget({
                      id: editingExperiment.documentId,
                      name: editName.trim() || editingExperiment.name || editingExperiment.datasetName || ''
                    });
                  }}
                >
                  Radera
                </Button>
              </div>
              
              <Button onClick={handleSaveEdit} disabled={!editName.trim()}>Spara som ny version</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!confirmDeleteTarget} onOpenChange={open => {
          if (!open) setConfirmDeleteTarget(null);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-normal">Ta bort dataset?</AlertDialogTitle>
              <AlertDesc>
                Detta kommer att permanent ta bort "{confirmDeleteTarget?.name || 'detta dataset'}". Detta går inte att ångra.
              </AlertDesc>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction 
                className={buttonVariants({ variant: 'destructive' })} 
                onClick={handleConfirmDelete}
              >
                Radera
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
