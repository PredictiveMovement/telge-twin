import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDesc, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LayoutGrid, Table as TableIcon, Play } from 'lucide-react';
import SavedOptimizationsTable, { SavedOptimization } from '@/components/optimize/SavedOptimizationsTable';
import SavedOptimizationsGrid from '@/components/optimize/SavedOptimizationsGrid';
import BreaksSection from '@/components/optimize/BreaksSection';
import {
  RouteDataset,
  getRouteDatasets,
  deleteRouteDataset,
  updateRouteDataset,
  startSimulationFromDataset,
} from '@/api/simulator';
import { useMapSocket } from '@/hooks/useMapSocket';
import { toast } from 'sonner';

export default function SavedDatasetsTab() {
  const { socket } = useMapSocket();
  const [datasets, setDatasets] = useState<RouteDataset[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    const stored = localStorage.getItem('savedDatasetsView');
    return stored === 'grid' || stored === 'table' ? stored as 'table' | 'grid' : 'table';
  });
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'description' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [editing, setEditing] = useState<RouteDataset | null>(null);
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
  const [startingSimulation, setStartingSimulation] = useState<string | null>(null);

  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<number | null>(null);

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

  const loadDatasets = async () => {
    try {
      const datasetsData = await getRouteDatasets();
      setDatasets(datasetsData);
    } catch {
      toast.error('Fel vid hämtning av data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (opt: SavedOptimization) => {
    const dataset = datasets.find(d => d.id === opt.id);
    if (!dataset) return;

    setEditing(dataset);
    setEditName(dataset.name || '');
    setEditDescription(dataset.description || '');

    // Load working hours
    const workingHours = dataset.optimizationSettings?.workingHours;
    setEditStartTime(workingHours?.start || '06:00');
    setEditEndTime(workingHours?.end || '15:00');
    setEditBreaks(dataset.optimizationSettings?.breaks || [{
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
    setEditExtraBreaks(dataset.optimizationSettings?.extraBreaks || []);
  };

  const handleCloseEdit = () => setEditing(null);

  const handleSaveEdit = async () => {
    const name = editName.trim();
    const description = editDescription.trim();
    if (!name || !editing) return;

    try {
      const result = await updateRouteDataset(editing.datasetId, {
        name,
        description,
        optimizationSettings: {
          ...editing.optimizationSettings,
          workingHours: {
            start: editStartTime,
            end: editEndTime
          },
          breaks: editBreaks.filter(b => b.enabled),
          extraBreaks: editExtraBreaks.filter(b => b.enabled)
        }
      });

      if (result.success) {
        toast.success('Dataset uppdaterad');
        await loadDatasets();
        setEditing(null);
      } else {
        toast.error(`Fel vid uppdatering: ${result.error}`);
      }
    } catch {
      toast.error('Fel vid uppdatering av dataset');
    }
  };

  const handleOpen = async (opt: SavedOptimization) => {
    const dataset = datasets.find(d => d.id === opt.id);
    if (!dataset) return;

    setStartingSimulation(dataset.id);
    try {
      // Determine start time from settings
      let startHour = 6;
      let startMinute = 0;
      
      const workingHoursStart = dataset.optimizationSettings?.workingHours?.start;
                               
      if (workingHoursStart) {
        const parts = workingHoursStart.split(':');
        if (parts.length >= 2) {
          startHour = parseInt(parts[0], 10);
          startMinute = parseInt(parts[1], 10);
        }
      }

      // Determine date from filter criteria or default to today
      let startDate = new Date();
      if (dataset.filterCriteria?.dateRange?.from) {
        startDate = new Date(dataset.filterCriteria.dateRange.from);
      }
      
      // Set the time in local timezone - toISOString() will convert to UTC automatically
      startDate.setHours(startHour, startMinute, 0, 0);

      const parameters = { 
        experimentType: 'vroom' as const,
        startDate: startDate.toISOString()
      };

      await startSimulationFromDataset(
        socket,
        dataset.datasetId,
        dataset.name,
        parameters
      );

      toast.success(`VROOM-optimerad simulering startad för: ${dataset.name}`);
    } catch {
      toast.error('Fel vid start av simulering');
    } finally {
      setStartingSimulation(null);
    }
  };

  const handleDelete = async (id: string) => {
    const dataset = datasets.find(d => d.id === id);
    if (!dataset) return;

    try {
      const result = await deleteRouteDataset(dataset.datasetId);
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

  const handleRequestDelete = (id: string) => {
    const dataset = datasets.find(d => d.id === id);
    setConfirmDeleteTarget({
      id,
      name: dataset?.name || ''
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTarget) return;
    await handleDelete(confirmDeleteTarget.id);
    if (editing?.id === confirmDeleteTarget.id) setEditing(null);
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

  // Convert RouteDataset to SavedOptimization format
  const optimizations: SavedOptimization[] = useMemo(() => {
    return datasets.map(dataset => ({
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      selectedRoutes: [], // Not applicable for datasets
      filters: dataset.filterCriteria,
      createdAt: dataset.uploadTimestamp,
      archived: false,
      breaks: dataset.optimizationSettings?.breaks,
      extraBreaks: dataset.optimizationSettings?.extraBreaks,
      vehicles: []
    }));
  }, [datasets]);

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
          <p className="mt-2 text-gray-600">Laddar datasets...</p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-2xl font-normal">Sparade Datasets</CardTitle>
          <div className="flex items-center gap-2">
            <Input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Sök..." 
              className="h-9 w-[200px] sm:w-[260px]" 
              aria-label="Sök sparade datasets" 
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
                <h3 className="text-lg font-medium">Inga sparade datasets</h3>
                <p className="text-muted-foreground">När du sparat ditt första dataset hittar du det här</p>
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
          />
        ) : (
          <SavedOptimizationsGrid 
            optimizations={visibleOptimizations} 
            onOpen={handleOpen} 
            onDelete={handleRequestDelete} 
            onEditName={handleOpenEdit} 
          />
        )}

        <Dialog open={!!editing} onOpenChange={open => {
          if (!open) handleCloseEdit();
        }}>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-normal">Redigera dataset</DialogTitle>
              <DialogDescription>Uppdatera inställningar för datasetet.</DialogDescription>
            </DialogHeader>
            
            {editing && (
              <div className="space-y-8">
                  {/* Datasetdetaljer */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Datasetdetaljer</h3>
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Datasetnamn</Label>
                      <Input 
                        id="edit-name" 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        autoFocus 
                        aria-label="Datasetnamn"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-description">Beskrivning</Label>
                      <Textarea 
                        id="edit-description" 
                        value={editDescription} 
                        onChange={e => setEditDescription(e.target.value)} 
                        aria-label="Datasetbeskrivning" 
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
                        <Input
                          type="time"
                          value={editStartTime}
                          onChange={(e) => setEditStartTime(e.target.value)}
                          min="05:00"
                          max="10:00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Sluttid</Label>
                        <Input
                          type="time"
                          value={editEndTime}
                          onChange={(e) => setEditEndTime(e.target.value)}
                          min="13:00"
                          max="18:00"
                        />
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
                    if (!editing) return;
                    setConfirmDeleteTarget({
                      id: editing.id,
                      name: editName.trim() || editing.name
                    });
                  }}
                >
                  Radera
                </Button>
              </div>
              
              <Button onClick={handleSaveEdit} disabled={!editName.trim()}>Spara</Button>
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
