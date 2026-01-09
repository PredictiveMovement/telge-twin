
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft } from 'lucide-react';

const OptimizeMapHeader = () => {
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleBackClick = () => {
    setIsNavigating(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          navigate('/optimize');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setIsNavigating(false);
          setProgress(0);
          return 100;
        }
        return prev + 20;
      });
    }, 100);
  };

  return (
    <>
      {isNavigating && (
        <Progress 
          value={progress} 
          className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-telge-ljusgra rounded-none"
        />
      )}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 left-4 md:left-[110px] z-[70] bg-white shadow-lg hover:bg-muted hover:text-muted-foreground"
        onClick={handleBackClick}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
    </>
  );
};

export default OptimizeMapHeader;
