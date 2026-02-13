import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Trash2, Pencil, Clock } from 'lucide-react';
import { SavedOptimization, OptimizationVersion } from './SavedOptimizationsTable';
import OptimizationStatusIndicator from './OptimizationStatusIndicator';
import { formatDateTime } from '@/lib/utils';

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
  currentOptimizationId?: string;
  onCancelOptimization?: (id: string) => void;
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
  currentOptimizationId,
  onCancelOptimization,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {optimizations.map((opt) => {
        const isOptimizing = opt.isOptimizing === true;
        const isFailed = opt.isFailed === true;
        const isBlocked = isFailed || isOptimizing;
        const isEditDisabled = isFailed || isOptimizing;
        const isDeleteDisabled = isOptimizing;

        return (
          <Card
            key={opt.id}
            className="h-full"
          >
            <CardContent className="p-4 h-full flex flex-col">
              <div
                className={isBlocked ? 'flex-1 cursor-default' : 'flex-1 cursor-pointer'}
                onClick={() => {
                  if (!isBlocked) onOpen(opt);
                }}
                tabIndex={isBlocked ? -1 : 0}
                role="button"
                aria-disabled={isBlocked ? true : undefined}
                onKeyDown={(e) => {
                  if (isBlocked) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(opt);
                  }
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium leading-snug line-clamp-2">{opt.name}</h4>
                  <OptimizationStatusIndicator
                    isOptimizing={isOptimizing}
                    isFailed={isFailed}
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
                  className="rounded-full h-8 w-8 p-0 hover:bg-destructive/10 disabled:opacity-40 disabled:hover:bg-transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isDeleteDisabled) return;
                    onDelete(opt.id);
                  }}
                  disabled={isDeleteDisabled}
                  aria-label={`Ta bort ${opt.name}`}
                  title={isDeleteDisabled ? 'Kan inte tas bort just nu' : 'Ta bort'}
                >
                  <Trash2
                    size={14}
                    className={isDeleteDisabled ? 'text-muted-foreground' : 'text-destructive'}
                  />
                </Button>
                <div className="flex gap-2">
                  {onShowHistory && opt.versions && opt.versions.length > 1 && (
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
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-8 w-8 p-0 hover:bg-[#E5E5E5]"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEditDisabled) return;
                      onEditName(opt);
                    }}
                    disabled={isEditDisabled}
                    aria-label={`Redigera ${opt.name}`}
                    title="Redigera namn och beskrivning"
                  >
                    <Pencil size={14} />
                  </Button>
                </div>
              </div>

              {expandedHistoryId === opt.id && opt.versions && opt.versions.length > 1 && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <h4 className="text-sm font-medium">Versionshistorik</h4>
                  <div className="space-y-2">
                    {opt.versions.map((version) => (
                      <div
                        key={version.id}
                        className="flex items-center justify-between p-2 bg-muted rounded border cursor-pointer hover:bg-muted/70 transition-colors text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoadVersion?.(opt, version);
                        }}
                      >
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <span className="font-medium truncate">
                            {version.label || 'Ruttger-körning'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(version.timestamp).date}
                            <span className="ml-3">{formatDateTime(version.timestamp).time}</span>
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                          {[
                            version.bookingCount !== undefined && `${version.bookingCount} stopp`,
                            version.breakCount !== undefined && `${version.breakCount} ${version.breakCount === 1 ? 'rast' : 'raster'}`,
                          ].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    ))}
                  </div>
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
