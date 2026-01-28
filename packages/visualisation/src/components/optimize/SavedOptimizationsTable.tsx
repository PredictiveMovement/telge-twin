import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trash2, Pencil, ArrowUpDown, ChevronUp, ChevronDown, Clock, Loader2 } from 'lucide-react';

export interface OptimizationVersion {
  id: string;           // experimentId
  timestamp: string;    // createdAt
  label?: string;       // namn/beskrivning
  vehicleCount?: number;  // Antal fordon med planer (0 = optimerar)
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
  vehicleCount?: number;  // Antal fordon med planer (0 = optimerar)
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
            const isExpanded = expandedHistoryId === opt.id;
            const isOptimizing = opt.vehicleCount === 0;

            return (
              <React.Fragment key={opt.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onOpen(opt)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpen(opt);
                    }
                  }}
                >
                  <TableCell className="font-medium w-[35%] max-w-[520px] md:max-w-[640px] truncate">
                    <div className="flex items-center gap-2">
                      <span>{opt.name}</span>
                      {isOptimizing && (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Beräknar...</span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground w-[35%] max-w-[520px] md:max-w-[640px] truncate">
                    {opt.description || '—'}
                  </TableCell>
                  <TableCell className="w-[140px] whitespace-nowrap">
                    {new Date(opt.createdAt).toLocaleDateString('sv-SE')}
                  </TableCell>
                  <TableCell className="w-[144px]">
                    <div className="flex items-center justify-end gap-2">
                      {onShowHistory && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`rounded-full h-8 w-8 p-0 hover:bg-[#E5E5E5] ${isExpanded ? 'bg-[#E5E5E5]' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onShowHistory(opt);
                          }}
                          aria-label={`Visa versionshistorik för ${opt.name}`}
                          title="Visa versionshistorik"
                        >
                          <Clock size={14} />
                        </Button>
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
                {/* Version history expansion row */}
                {isExpanded && opt.versions && opt.versions.length > 0 && onLoadVersion && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={4} className="py-3 px-4">
                      <div className="ml-4 space-y-1">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Versionshistorik ({opt.versions!.length} versioner)
                        </div>
                        {opt.versions!.map((version, index) => {
                          const isCurrentVersion = version.id === opt.experimentId;
                          const versionIsOptimizing = version.vehicleCount === 0;
                          return (
                            <div
                              key={version.id}
                              className={`flex items-center justify-between py-2 px-3 rounded-md cursor-pointer transition-colors ${
                                isCurrentVersion
                                  ? 'bg-primary/10 border border-primary/20'
                                  : 'hover:bg-muted/50'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onLoadVersion(opt, version);
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-8">
                                  v{opt.versions!.length - index}
                                </span>
                                <span className="text-sm">
                                  {version.label || 'Version'}
                                </span>
                                {versionIsOptimizing && (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Beräknar...</span>
                                  </>
                                )}
                                {isCurrentVersion && (
                                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                    Aktuell
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {new Date(version.timestamp).toLocaleDateString('sv-SE', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          );
                        })}
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
