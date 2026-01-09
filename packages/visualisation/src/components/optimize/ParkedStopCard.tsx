import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Stop } from '@/types/stops';
import { cn } from '@/lib/utils';

interface ParkedStopCardProps {
  stop: Stop;
  isSelected?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
}

const ParkedStopCard = ({ stop, isSelected, onClick, onDragStart }: ParkedStopCardProps) => {
  const getStopTitle = () => {
    if (stop.type === 'break') return '☕ Kafferast';
    if (stop.type === 'lunch') return '🍔 Lunch';
    if (stop.type === 'tipping') return '🚛 Tippning';
    return stop.address || 'Stopp';
  };

  const getWasteTypes = () => {
    if (stop.containerDetails && stop.containerDetails.length > 0) {
      return [...new Set(stop.containerDetails.map(c => c.wasteType))];
    }
    return stop.wasteTypes || [];
  };

  const getContainerInfo = () => {
    if (!stop.containerDetails || stop.containerDetails.length === 0) return [];

    // Group containers by size and count total
    const grouped = stop.containerDetails.reduce((acc, c) => {
      const size = c.containerType;
      acc[size] = (acc[size] || 0) + (c.count || 1);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([size, count]) => `${size}: ${count}`);
  };

  const wasteTypes = getWasteTypes();
  const containerInfo = getContainerInfo();

  // Combine all badges (show all without limit)
  const allBadges = [
    ...wasteTypes.map(type => ({ label: type, variant: 'wasteType' as const })),
    ...containerInfo.map(info => ({ label: info, variant: 'container' as const }))
  ];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "bg-card rounded-lg p-3 transition-all cursor-grab active:cursor-grabbing",
        "relative z-20",
        "ring-2",
        isSelected ? "ring-secondary" : "ring-transparent border",
        !isSelected && "hover:border-primary/50",
        "hover:shadow-sm"
      )}
    >
      <div className="space-y-2">
        <div className="font-medium text-sm text-foreground truncate">
          {getStopTitle()}
        </div>

        {allBadges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allBadges.map((badge, i) => (
              <Badge key={i} variant={badge.variant} className="text-xs px-1.5 py-0">
                {badge.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParkedStopCard;
