import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useOptimizationContext } from '@/contexts/OptimizationContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const GlobalOptimizationProgress: React.FC = () => {
  const location = useLocation();
  const { getCurrentOptimization, cancelOptimization } = useOptimizationContext();
  const { toast, dismiss } = useToast();
  const [toastId, setToastId] = useState<string | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [lastOptimizationId, setLastOptimizationId] = useState<string | null>(null);

  const currentOptimization = getCurrentOptimization();
  const isOnSavePage = location.pathname === '/optimize/save';

  // Show immediately when optimization exists, or during fade-out
  const shouldShow = currentOptimization !== null || isFadingOut;

  useEffect(() => {
    if (currentOptimization) {
      setIsFadingOut(false);
      setLastOptimizationId(currentOptimization.id);

      // Show/update toast only if NOT on save page
      if (!isOnSavePage) {
        // Use constant message for updates, phase name for new optimizations
        const toastTitle = currentOptimization.isUpdate
          ? 'Uppdaterar ändringar'
          : currentOptimization.phase;

        if (!toastId) {
          const { id } = toast({
            title: toastTitle,
            duration: Infinity,
          });
          setToastId(id);
        } else {
          dismiss(toastId);
          const { id } = toast({
            title: toastTitle,
            duration: Infinity,
          });
          setToastId(id);
        }
      } else if (toastId) {
        // Dismiss toast if we're on save page
        dismiss(toastId);
        setToastId(null);
      }
    } else if (lastOptimizationId && !currentOptimization) {
      // Optimization completed - fade out
      setIsFadingOut(true);

      // Dismiss toast
      if (toastId) {
        dismiss(toastId);
        setToastId(null);
      }

      // Hide progress bar after fade animation
      const timer = setTimeout(() => {
        setIsFadingOut(false);
        setLastOptimizationId(null);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [currentOptimization?.phase, currentOptimization?.id, isOnSavePage]);

  // Cleanup toast on unmount
  useEffect(() => {
    return () => {
      if (toastId) {
        dismiss(toastId);
      }
    };
  }, []);

  if (!shouldShow) return null;

  const progress = currentOptimization?.progress ?? 100;
  const isOnRoutesPage = location.pathname === '/routes';

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="h-1 bg-muted/80">
        <div
          className="h-full bg-secondary"
          style={{ width: `${progress}%` }}
        />
      </div>
      {currentOptimization && !isOnRoutesPage && !isOnSavePage && (
        <div className="absolute top-2 right-4 md:right-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => cancelOptimization(currentOptimization.id)}
            className="h-8 gap-2"
          >
            <X className="h-3 w-3" />
            Avbryt
          </Button>
        </div>
      )}
    </div>
  );
};

export default GlobalOptimizationProgress;
