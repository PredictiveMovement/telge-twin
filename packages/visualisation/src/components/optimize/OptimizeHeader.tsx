
import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
    description: string;
  };
  hasChanges?: boolean;
  onSaveChanges?: () => void;
}

const OptimizeHeader = ({ savedProject, hasChanges, onSaveChanges }: OptimizeHeaderProps) => {
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

    // Simulate navigation process with progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 5;
      });
    }, 100);

    // Wait for progress to complete
    setTimeout(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      navigateToRoutes();
      
      // Reset state after navigation
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 100);
    }, 2000);
  };

  const handleSaveAndBack = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    setShowBackConfirmation(false);
    setIsProcessing(true);
    setProgress(0);
    
    // Save changes first
    if (onSaveChanges) {
      onSaveChanges();
    }
    
    // Show toast only if there are changes
    const toastId = hasChanges
      ? toast('Sparar optimering', { duration: 2000 })
      : null;

    // Simulate saving process with progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 5;
      });
    }, 100);

    // Wait for progress to complete
    setTimeout(async () => {
      if (toastId) toast.dismiss(toastId);
      await new Promise((resolve) => setTimeout(resolve, 300));
      navigateToRoutes();
      
      // Reset state after navigation
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 100);
    }, 2000);
  };

  return (
    <>
      {/* Progress Bar */}
      {isProcessing && (
        <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-telge-ljusgra">
          <Progress 
            value={progress} 
            className="h-full rounded-none bg-transparent"
            style={{
              '--progress-background': 'hsl(var(--secondary))',
            } as React.CSSProperties}
          />
        </div>
      )}
      
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
