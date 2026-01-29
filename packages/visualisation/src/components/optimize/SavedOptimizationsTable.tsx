import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trash2, Pencil, ArrowUpDown, ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import OptimizationStatusIndicator from './OptimizationStatusIndicator';
import { formatDate } from '@/lib/utils';

export interface OptimizationVersion {
  id: string;           // experimentId
  timestamp: string;    // createdAt
  label?: string;       // namn/beskrivning
  vehicleCount?: number;  // Antal fordon med planer
  isOptimizing?: boolean; // True om optimering pågår (vroomTruckPlanIds är tom array)
  bookingCount?: number;  // Antal stopp
  breakCount?: number;    // Antal raster
}

export interface SavedOptimization {
  id: string;
  name: string;
  description?: string;
  selectedRoutes: string[];
  filters: any;
  createdAt: string;
  archived?: boolean;
  breaks?: Array<{
    id: string;
    name: string;
    duration: number;
    enabled: boolean;
    desiredTime?: string;
  }>;
  extraBreaks?: Array<{
    id: string;
    name: string;
    duration: number;
    enabled: boolean;
    desiredTime?: string;
  }>;
  vehicles?: string[];
  latestExperimentId?: string;
  experimentCount?: number;
  experimentId?: string;
  sourceDatasetId?: string;
  isLatestVersion?: boolean;
  versions?: OptimizationVersion[];
  vehicleCount?: number;  // Antal fordon med planer
  isOptimizing?: boolean; // True om optimering pågår (vroomTruckPlanIds är tom array)
}

interface SavedOptimizationsTableProps {
  optimizations: SavedOptimization[];
  onOpen: (optimization: SavedOptimization) => void;
  onDelete: (id: string) => void;
  onEditName: (optimization: SavedOptimization) => void;
  sortKey: 'name' | 'description' | 'createdAt';
  sortDir: 'asc' | 'desc';
  onRequestSort: (key: 'name' | 'description' | 'createdAt') => void;
  loadingId?: string | null;
  expandedHistoryId?: string | null;
  onShowHistory?: (optimization: SavedOptimization) => void;
  onLoadVersion?: (optimization: SavedOptimization, version: OptimizationVersion) => void;
  currentOptimizationId?: string;
  onCancelOptimization?: (id: string) => void;
}

const SavedOptimizationsTable: React.FC<SavedOptimizationsTableProps> = ({
  optimizations,
  onOpen,
  onDelete,
  onEditName,
  sortKey,
  sortDir,
  onRequestSort,
  loadingId,
  expandedHistoryId,
  onShowHistory,
  onLoadVersion,
  currentOptimizationId,
  onCancelOptimization,
}) => {
  const getAriaSort = (key: 'name' | 'description' | 'createdAt') =>
    sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';

  const renderSortIcon = (key: 'name' | 'description' | 'createdAt') => {
    if (sortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" />
    );
  };

  return (
    <div className="w-full overflow-hidden rounded-md border">
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]" aria-sort={getAriaSort('name')}>
              <button
                type="button"
                className="inline-flex items-center gap-1"
                onClick={() => onRequestSort('name')}
                aria-label="Sortera efter namn"
              >
                Namn {renderSortIcon('name')}
              </button>
            </TableHead>
            <TableHead className="w-[35%]" aria-sort={getAriaSort('description')}>
              <button
                type="button"
                className="inline-flex items-center gap-1"
                onClick={() => onRequestSort('description')}
                aria-label="Sortera efter beskrivning"
              >
                Beskrivning {renderSortIcon('description')}
              </button>
            </TableHead>
            <TableHead className="w-[140px] whitespace-nowrap" aria-sort={getAriaSort('createdAt')}>
              <button
                type="button"
                className="inline-flex items-center gap-1"
                onClick={() => onRequestSort('createdAt')}
                aria-label="Sortera efter datum"
              >
                Skapad {renderSortIcon('createdAt')}
              </button>
            </TableHead>
            <TableHead className="w-[144px] whitespace-nowrap">
              <div className="flex items-center justify-end gap-2 -mr-4">
                <span className="h-8 w-8" />
                <span className="h-8 w-8 flex items-center justify-center">Åtgärder</span>
                <span className="h-8 w-8" />
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {optimizations.map((opt) => {
            const isOptimizing = opt.isOptimizing === true;

            return (
              <React.Fragment key={opt.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => onOpen(opt)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpen(opt);
                    }
                  }}
                >
                  <TableCell className="font-medium w-[35%] max-w-[520px] md:max-w-[640px]">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{opt.name}</span>
                      <OptimizationStatusIndicator
                        isOptimizing={isOptimizing}
                        versionCount={opt.versions?.length || 1}
                      />
                      {currentOptimizationId === opt.id && onCancelOptimization && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancelOptimization(opt.id);
                          }}
                          className="h-6 px-2 text-xs ml-3"
                        >
                          Avbryt
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground w-[35%] max-w-[520px] md:max-w-[640px] truncate">
                    {opt.description || '—'}
                  </TableCell>
                  <TableCell className="w-[140px] whitespace-nowrap">{formatDate(opt.createdAt)}</TableCell>
                  <TableCell className="w-[144px]">
                    <div className="flex items-center justify-end gap-2">
                      {onShowHistory && opt.versions && opt.versions.length > 1 ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full h-8 w-8 p-0 hover:bg-[#E5E5E5]"
                          onClick={(e) => {
                            e.stopPropagation();
                            onShowHistory(opt);
                          }}
                          aria-label={`Visa historik för ${opt.name}`}
                          title="Visa versionshistorik"
                        >
                          <Clock size={14} />
                        </Button>
                      ) : (
                        <div className="h-8 w-8" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-8 w-8 p-0 hover:bg-[#E5E5E5]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditName(opt);
                        }}
                        aria-label={`Redigera ${opt.name}`}
                        title="Redigera namn och beskrivning"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-8 w-8 p-0 hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(opt.id);
                        }}
                        aria-label={`Ta bort ${opt.name}`}
                        title="Ta bort"
                      >
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expandedHistoryId === opt.id && opt.versions && opt.versions.length > 1 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="bg-muted/30 p-4">
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Versionshistorik</h4>
                        <div className="space-y-2">
                          {opt.versions.map((version) => {
                            const versionDate = new Date(version.timestamp);
                            const formattedDate = format(versionDate, 'MMM d', { locale: sv });
                            const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
                            const formattedTime = format(versionDate, 'HH:mm');

                            return (
                              <div
                                key={version.id}
                                className="flex items-center justify-between p-2 bg-background rounded border cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => onLoadVersion?.(opt, version)}
                              >
                                <span className="text-sm">
                                  {capitalizedDate} {formattedTime}
                                </span>
                                <span className="text-sm font-normal text-muted-foreground">
                                  {[
                                    version.bookingCount !== undefined && `${version.bookingCount} stopp`,
                                    version.breakCount !== undefined && `${version.breakCount} ${version.breakCount === 1 ? 'rast' : 'raster'}`,
                                  ].filter(Boolean).join(' · ')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default SavedOptimizationsTable;
