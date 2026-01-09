import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trash2, Pencil, ArrowUpDown, ChevronUp, ChevronDown, Play, Loader2 } from 'lucide-react';

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
            <TableHead className="w-[40%]" aria-sort={getAriaSort('name')}>
              <button
                type="button"
                className="inline-flex items-center gap-1"
                onClick={() => onRequestSort('name')}
                aria-label="Sortera efter namn"
              >
                Namn {renderSortIcon('name')}
              </button>
            </TableHead>
            <TableHead className="w-[40%]" aria-sort={getAriaSort('description')}>
              <button
                type="button"
                className="inline-flex items-center gap-1"
                onClick={() => onRequestSort('description')}
                aria-label="Sortera efter beskrivning"
              >
                Beskrivning {renderSortIcon('description')}
              </button>
            </TableHead>
            <TableHead className="w-[160px] whitespace-nowrap" aria-sort={getAriaSort('createdAt')}>
              <button
                type="button"
                className="inline-flex items-center gap-1"
                onClick={() => onRequestSort('createdAt')}
                aria-label="Sortera efter datum"
              >
                Skapad {renderSortIcon('createdAt')}
              </button>
            </TableHead>
            <TableHead className="w-[128px] whitespace-nowrap text-center">Åtgärder</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {optimizations.map((opt) => (
            <TableRow
              key={opt.id}
            >
              <TableCell className="font-medium w-[40%] max-w-[520px] md:max-w-[640px] truncate">{opt.name}</TableCell>
              <TableCell className="text-muted-foreground w-[40%] max-w-[520px] md:max-w-[640px] truncate">
                {opt.description || '—'}
              </TableCell>
              <TableCell className="w-[160px] whitespace-nowrap">{new Date(opt.createdAt).toLocaleDateString('sv-SE')}</TableCell>
              <TableCell className="w-[128px] text-center">
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-[#E5E5E5]"
                    onClick={() => onOpen(opt)}
                    aria-label={`Starta ${opt.name}`}
                    title="Starta simulering"
                    disabled={loadingId === opt.id}
                  >
                    {loadingId === opt.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-[#E5E5E5]"
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
                    className="hover:bg-destructive/10"
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default SavedOptimizationsTable;
