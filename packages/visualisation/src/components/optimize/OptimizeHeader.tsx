
import React, { useState } from 'react';
import { ArrowLeft, Map } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Stop } from '@/types/stops';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';

interface OptimizeHeaderProps {
  savedProject?: {
    id: string;
    name: string;
    description?: string;
  };
  hasChanges?: boolean;
  onSaveChanges?: () => Promise<void> | void;
  onSendToThor?: () => void;
  onViewMap?: () => void;
  isMapLoading?: boolean;
  mapData?: {
    optimizedStops: Stop[];
    selectedVehicle: string;
  } | null;
}

const OptimizeHeader = ({
  savedProject,
  hasChanges,
  onSaveChanges,
  onSendToThor,
  onViewMap,
  isMapLoading = false,
  mapData
}: OptimizeHeaderProps) => {
  const navigate = useNavigate();
  const [showBackConfirmation, setShowBackConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleBackClick = () => {
    if (hasChanges) {
      setShowBackConfirmation(true);
    } else {
      navigateToRoutes();
    }
  };

  const navigateToRoutes = () => {
    navigate('/routes');
  };

  const handleConfirmBack = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    setShowBackConfirmation(false);
    setIsProcessing(true);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 5;
      });
    }, 100);

    setTimeout(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      navigateToRoutes();

      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 100);
    }, 2000);
  };

  const handleSave = async () => {
    setIsProcessing(true);
    setProgress(0);

    toast('Sparar körturordning...', { duration: 1500 });

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 5;
      });
    }, 100);

    try {
      if (onSaveChanges) {
        await onSaveChanges();
      }

      setTimeout(() => {
        toast.success('Körturordning sparad');
      }, 1500);
    } catch (error) {
      toast.error('Kunde inte spara körturordning');
    }

    setTimeout(() => {
      setIsProcessing(false);
      setProgress(0);
    }, 2000);
  };

  const handleSaveAndBack = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    setShowBackConfirmation(false);
    setIsProcessing(true);
    setProgress(0);

    if (onSaveChanges) {
      try {
        await onSaveChanges();
      } catch (error) {
        toast.error('Kunde inte spara körturordning');
      }
    }

    const toastId = hasChanges
      ? toast('Sparar optimering', { duration: 2000 })
      : null;

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 5;
      });
    }, 100);

    setTimeout(async () => {
      if (toastId) toast.dismiss(toastId);
      await new Promise((resolve) => setTimeout(resolve, 300));
      navigateToRoutes();

      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 100);
    }, 2000);
  };

  return (
    <>
      {/* Progress Bar */}
      <div
        className={cn(
          "fixed top-0 left-0 right-0 z-50 h-[3px] bg-telge-ljusgra25 transition-opacity duration-200",
          isProcessing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <Progress
          value={progress}
          className="h-full rounded-none bg-transparent"
          style={{
            '--progress-background': 'hsl(var(--secondary))',
          } as React.CSSProperties}
        />
      </div>

      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Button variant="outline" size="icon" onClick={handleBackClick} className="hover:bg-muted hover:text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Tillbaka</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-4xl font-normal break-words hyphens-auto">
              {savedProject?.name || 'Optimera körtur'}
            </h1>
            {savedProject?.description && (
              <p className="text-muted-foreground mt-1">
                {savedProject.description}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 shrink-0">
          <Button
            variant="outline"
            size="lg"
            onClick={handleSave}
            disabled={!hasChanges || isProcessing}
          >
            Uppdatera
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={onSendToThor}
          >
            Skicka till Thor
          </Button>
          <Button
            onClick={() => !isMapLoading && onViewMap?.()}
            disabled={isMapLoading || !mapData}
            className="flex items-center gap-2"
            size="lg"
          >
            <Map className="h-4 w-4" />
            {isMapLoading ? 'Sparar...' : 'Se i karta'}
          </Button>
        </div>
      </div>

      <AlertDialog open={showBackConfirmation} onOpenChange={setShowBackConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogDescription className="text-lg">
              Du har osparade ändringar i körturordningen. Vill du spara dina ändringar innan du går vidare?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <Button variant="outline" onClick={handleConfirmBack}>
              Fortsätt utan att spara
            </Button>
            <Button onClick={handleSaveAndBack}>
              Spara ändringar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default OptimizeHeader;
