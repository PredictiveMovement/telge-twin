import { useState } from 'react';

interface UseOptimizeProgressOptions {
  onComplete?: () => void;
  duration?: number;
}

export const useOptimizeProgress = ({ onComplete, duration = 2000 }: UseOptimizeProgressOptions = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const startProgress = () => {
    setIsLoading(true);
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

    setTimeout(() => {
      onComplete?.();
      setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 100);
    }, duration);
  };

  const reset = () => {
    setIsLoading(false);
    setProgress(0);
  };

  return {
    isLoading,
    progress,
    startProgress,
    reset
  };
};