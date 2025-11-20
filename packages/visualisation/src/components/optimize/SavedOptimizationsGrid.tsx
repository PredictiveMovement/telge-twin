import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Trash2, Pencil, Play } from 'lucide-react';

export interface SavedOptimization {
  id: string;
  name: string;
  description?: string;
  selectedRoutes: string[];
  filters: any;
  createdAt: string;
  archived?: boolean;
}

interface SavedOptimizationsGridProps {
  optimizations: SavedOptimization[];
  onOpen: (optimization: SavedOptimization) => void;
  onDelete: (id: string) => void;
  onEditName: (optimization: SavedOptimization) => void;
}

const SavedOptimizationsGrid: React.FC<SavedOptimizationsGridProps> = ({
  optimizations,
  onOpen,
  onDelete,
  onEditName,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {optimizations.map((opt) => (
        <Card
          key={opt.id}
          className="h-full"
        >
          <CardContent className="p-4 h-full flex flex-col">
            <div className="flex-1">
              <h4 className="font-medium leading-snug line-clamp-2">{opt.name}</h4>
              {opt.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                  {opt.description}
                </p>
              )}

              <div className="flex items-center gap-4 mt-3 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar size={14} />
                  <span className="text-sm">
                    {new Date(opt.createdAt).toLocaleDateString('sv-SE')}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpen(opt)}
                aria-label={`Starta ${opt.name}`}
                title="Starta simulering"
              >
                <Play size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
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
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(opt.id);
                }}
                aria-label={`Ta bort ${opt.name}`}
                title="Ta bort"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SavedOptimizationsGrid;
