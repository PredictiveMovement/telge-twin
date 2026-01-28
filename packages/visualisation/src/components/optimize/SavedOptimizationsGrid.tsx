import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Trash2, Pencil, Clock, Loader2 } from 'lucide-react';
import { SavedOptimization, OptimizationVersion } from './SavedOptimizationsTable';

export type { SavedOptimization, OptimizationVersion };

interface SavedOptimizationsGridProps {
  optimizations: SavedOptimization[];
  onOpen: (optimization: SavedOptimization) => void;
  onDelete: (id: string) => void;
  onEditName: (optimization: SavedOptimization) => void;
  loadingId?: string | null;
  expandedHistoryId?: string | null;
  onShowHistory?: (optimization: SavedOptimization) => void;
  onLoadVersion?: (optimization: SavedOptimization, version: OptimizationVersion) => void;
}

const SavedOptimizationsGrid: React.FC<SavedOptimizationsGridProps> = ({
  optimizations,
  onOpen,
  onDelete,
  onEditName,
  loadingId,
  expandedHistoryId,
  onShowHistory,
  onLoadVersion,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {optimizations.map((opt) => {
        const isExpanded = expandedHistoryId === opt.id;
        const isOptimizing = opt.vehicleCount === 0;

        return (
          <Card
            key={opt.id}
            className="h-full hover:bg-muted/50 transition-colors"
          >
            <CardContent className="p-4 h-full flex flex-col">
              <div
                className="flex-1 cursor-pointer"
                onClick={() => onOpen(opt)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(opt);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <h4 className="font-medium leading-snug line-clamp-2">{opt.name}</h4>
                  {isOptimizing && (
                    <>
                      <Loader2 size={14} className="animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Beräknar...</span>
                    </>
                  )}
                </div>
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

              <div className="mt-4 flex justify-between">
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
                <div className="flex gap-2">
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
                </div>
              </div>

              {/* Version history expansion */}
              {isExpanded && opt.versions && opt.versions.length > 0 && onLoadVersion && (
                <div className="mt-4 pt-4 border-t space-y-1">
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            v{opt.versions!.length - index}
                          </span>
                          {versionIsOptimizing && (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Beräknar...</span>
                            </>
                          )}
                          {isCurrentVersion && (
                            <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                              Aktuell
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(version.timestamp).toLocaleDateString('sv-SE')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default SavedOptimizationsGrid;
