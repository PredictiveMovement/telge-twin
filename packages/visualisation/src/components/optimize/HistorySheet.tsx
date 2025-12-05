import React from 'react';
import { Clock } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

export interface VersionSnapshot {
  id: string;
  timestamp: Date;
  stopCount: number;
  description?: string;
}

interface HistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: VersionSnapshot[];
  onRestoreVersion: (versionId: string) => void;
}

const HistorySheet = ({
  open,
  onOpenChange,
  versions,
  onRestoreVersion
}: HistorySheetProps) => {
  const handleRestore = (versionId: string) => {
    onRestoreVersion(versionId);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="left"
        className="w-[400px] sm:w-[400px]"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="pr-10">
          <SheetTitle className="text-2xl font-medium text-foreground">
            Versionshistorik
          </SheetTitle>
          {versions.length > 0 && (
            <SheetDescription className="text-sm text-muted-foreground">
              Välj en tidigare version att återställa till
            </SheetDescription>
          )}
        </SheetHeader>

        {versions.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-center">
            <p className="text-sm text-muted-foreground">
              Inga tidigare versioner sparade ännu
            </p>
          </div>
        ) : (
          <div className="h-[calc(100vh-120px)] mt-6 overflow-y-auto -m-2 p-2">
            <div className="space-y-3">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium text-foreground">
                          Version {versions.length - index}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {formatDistanceToNow(new Date(version.timestamp), {
                          addSuffix: true,
                          locale: sv
                        })}
                      </p>
                      <p className="text-sm text-foreground">
                        {version.stopCount} stopp
                      </p>
                      {version.description && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {version.description}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestore(version.id)}
                      className="flex-shrink-0"
                    >
                      Återställ
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default HistorySheet;
