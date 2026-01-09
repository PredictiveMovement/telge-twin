

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Minus, Trash2, Pen } from 'lucide-react';

interface BreakConfig {
  id: string;
  name: string;
  duration: number;
  enabled: boolean;
  desiredTime?: string;
}

interface BreakCardProps {
  breakItem: BreakConfig;
  isExtra?: boolean;
  timeOptions: string[];
  onUpdateDuration: (id: string, change: number, isExtra: boolean) => void;
  onUpdateName: (id: string, newName: string, isExtra: boolean) => void;
  onUpdateTime: (id: string, newTime: string, isExtra: boolean) => void;
  onDelete: (id: string, isExtra: boolean) => void;
  disableHover?: boolean;
}

const BreakCard: React.FC<BreakCardProps> = ({
  breakItem,
  isExtra = false,
  timeOptions,
  onUpdateDuration,
  onUpdateName,
  onUpdateTime,
  onDelete,
  disableHover = false
}) => {
  const [editingBreak, setEditingBreak] = useState<string | null>(null);
  const isLunch = breakItem.id === 'lunch';
  const isEditing = editingBreak === breakItem.id;

  const handleEditBreak = (id: string) => {
    setEditingBreak(id);
  };

  const handleSaveBreakName = (id: string, newName: string, isExtra: boolean) => {
    onUpdateName(id, newName, isExtra);
    setEditingBreak(null);
  };

  return (
    <div key={breakItem.id} className={`border border-orange-200 bg-orange-50 rounded-md p-3 space-y-3 ${disableHover ? '' : 'hover:bg-orange-100 transition-colors'}`}>
      <div className="flex items-center gap-3 h-[50px]">
        <div className="flex items-center justify-between flex-1">
          <div className="flex items-center gap-2">
            <div className="w-7 flex justify-center">
              <span className="text-lg">{isLunch ? '🍔' : '☕'}</span>
            </div>
            {isEditing ? (
              <Input 
                defaultValue={breakItem.name} 
                autoFocus 
                onBlur={e => handleSaveBreakName(breakItem.id, e.target.value, isExtra)} 
                onKeyPress={e => {
                  if (e.key === 'Enter') {
                    handleSaveBreakName(breakItem.id, e.currentTarget.value, isExtra);
                  }
                }} 
                className="text-sm font-medium bg-white border border-orange-300 h-8 min-w-[120px]" 
                style={{color: '#CB4522'}} 
              />
            ) : (
              <span 
                className="text-sm font-medium min-w-[120px] cursor-pointer hover:underline" 
                onClick={() => handleEditBreak(breakItem.id)} 
                style={{color: '#CB4522'}}
              >
                {breakItem.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white border border-gray-200 hover:bg-gray-50" onClick={() => handleEditBreak(breakItem.id)}>
              <Pen className="h-4 w-4" style={{color: '#222222'}} />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white border border-gray-200 hover:bg-red-50" onClick={() => onDelete(breakItem.id, isExtra)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm min-w-[120px]" style={{color: '#CB4522'}}>Önskat klockslag:</label>
          <Select value={breakItem.desiredTime || ''} onValueChange={value => onUpdateTime(breakItem.id, value, isExtra)}>
            <SelectTrigger 
              className="text-sm bg-white border border-orange-300 h-8 w-24 focus:ring-2 focus:ring-offset-2"
              style={{
                '--tw-ring-color': '#FFC9AD',
                borderColor: '#FFC9AD'
              } as React.CSSProperties}
            >
              <SelectValue placeholder="--:--" />
            </SelectTrigger>
            <SelectContent className="bg-white z-50">
              {timeOptions.map(time => (
                <SelectItem key={time} value={time} className="text-sm">
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            type="button" 
            variant="outline" 
            size="icon" 
            className="h-6 w-6 hover:bg-orange-100" 
            onClick={() => onUpdateDuration(breakItem.id, -5, isExtra)}
            style={{borderColor: '#FFC9AD'}}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-sm font-medium min-w-[40px] text-center" style={{color: '#CB4522'}}>
            {breakItem.duration} min
          </span>
          <Button 
            type="button" 
            variant="outline" 
            size="icon" 
            className="h-6 w-6 hover:bg-orange-100" 
            onClick={() => onUpdateDuration(breakItem.id, 5, isExtra)}
            style={{borderColor: '#FFC9AD'}}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BreakCard;

