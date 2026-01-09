import React from 'react';
import { Stop } from '@/types/stops';

interface RouteColumnHeaderProps {
  title: string;
  subtitle: string;
  listType: 'current' | 'optimized';
  showActions: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  onAdd?: (type: 'break' | 'tipping', position: number, address: string, duration: number, estimatedTime?: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  hasChanges?: boolean;
  existingStops: Stop[];
}

const RouteColumnHeader: React.FC<RouteColumnHeaderProps> = ({
  title,
  subtitle,
}) => {
  return (
    <div>
      <h3 className="text-lg font-medium">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
};

export default RouteColumnHeader;
