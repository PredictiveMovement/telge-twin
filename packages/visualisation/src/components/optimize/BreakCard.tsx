

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Minus, Trash2, Pen } from 'lucide-react';
import TimeInput from './TimeInput';

interface PeliasResult {
  label: string;
  lat: number;
  lng: number;
}

interface BreakCardProps {
  breakItem: BreakConfig;
  isExtra?: boolean;
  onUpdateDuration: (id: string, change: number, isExtra: boolean) => void;
  onUpdateName: (id: string, newName: string, isExtra: boolean) => void;
  onUpdateTime: (id: string, newTime: string, isExtra: boolean) => void;
  onUpdateLocation: (id: string, newLocation: string, isExtra: boolean, coordinates?: { lat: number; lng: number }) => void;
  onDelete: (id: string, isExtra: boolean) => void;
  disableHover?: boolean;
  bookingCoordinates?: { lat: number; lng: number }[];
  otherBreakCoordinates?: { lat: number; lng: number }[];
}

const BreakCard: React.FC<BreakCardProps> = ({
  breakItem,
  isExtra = false,
  onUpdateDuration,
  onUpdateName,
  onUpdateTime,
  onUpdateLocation,
  onDelete,
  disableHover = false,
  bookingCoordinates,
  otherBreakCoordinates
}) => {
  const [editingBreak, setEditingBreak] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [suggestions, setSuggestions] = useState<PeliasResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localLocation, setLocalLocation] = useState(breakItem.location || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLunch = breakItem.id === 'lunch';
  const isEditing = editingBreak === breakItem.id;

  // Sync local state when parent value changes (e.g. map modal save)
  useEffect(() => {
    setLocalLocation(breakItem.location || '');
  }, [breakItem.location]);

  const handleEditBreak = (id: string) => {
    setEditingBreak(id);
  };

  const handleSaveBreakName = (id: string, newName: string, isExtra: boolean) => {
    onUpdateName(id, newName, isExtra);
    setEditingBreak(null);
  };

  const fetchPelias = useCallback(async (query: string, endpoint: 'autocomplete' | 'search', signal: AbortSignal): Promise<PeliasResult[]> => {
    const res = await fetch(`${PELIAS_URL}/v1/${endpoint}?text=${encodeURIComponent(query)}&size=5&layers=address,venue`, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any) => ({
      label: f.properties?.label || f.properties?.name || '',
      lat: f.geometry?.coordinates?.[1],
      lng: f.geometry?.coordinates?.[0],
    })).filter((r: PeliasResult) => r.lat && r.lng);
  }, []);

  const searchPelias = useCallback(async (query: string) => {
    if (query.length < 2) { setSuggestions([]); return; }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let results = await fetchPelias(query, 'autocomplete', controller.signal);
      if (results.length === 0) {
        results = await fetchPelias(query, 'search', controller.signal);
      }
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch { /* ignore — includes AbortError */ }
  }, [fetchPelias]);

  const handleLocationInput = (value: string) => {
    setLocalLocation(value);
    if (!value) {
      onUpdateLocation(breakItem.id, '', isExtra);
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPelias(value), 300);
  };

  const handleSelectSuggestion = (result: PeliasResult) => {
    setLocalLocation(result.label);
    onUpdateLocation(breakItem.id, result.label, isExtra, { lat: result.lat, lng: result.lng });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Clean up debounce timer and abort in-flight request on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
                className="text-base font-medium bg-white border border-orange-300 h-8 min-w-[120px]" 
                style={{color: '#CB4522'}} 
              />
            ) : (
              <span 
                className="text-base font-medium min-w-[120px] cursor-pointer hover:underline" 
                onClick={() => handleEditBreak(breakItem.id)} 
                style={{color: '#CB4522'}}
              >
                {breakItem.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white border border-gray-200 hover:bg-orange-100" onClick={() => handleEditBreak(breakItem.id)}>
              <Pen className="h-4 w-4" style={{color: '#222222'}} />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white border border-gray-200 hover:bg-orange-100" onClick={() => onDelete(breakItem.id, isExtra)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <label className="text-sm min-w-[120px]" style={{color: '#CB4522'}}>Plats:</label>
        <div ref={containerRef} className="relative max-w-[400px] flex-1">
          <Input
            value={localLocation}
            placeholder="Sök adress..."
            onChange={e => handleLocationInput(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            className="text-sm h-8 bg-white"
            style={{borderColor: '#FFC9AD'}}
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-[160px] overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-orange-50 truncate"
                  onClick={() => handleSelectSuggestion(s)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowLocationModal(true)}
          className="flex-shrink-0 cursor-pointer hover:opacity-70 transition-opacity"
        >
          <MapPin className="h-4 w-4" style={{color: '#CB4522'}} />
        </button>
      </div>

      {showLocationModal && (
        <BreakLocationModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onSave={(address, lat, lng) => {
            onUpdateLocation(breakItem.id, address, isExtra, { lat, lng });
          }}
          currentLocation={breakItem.location}
          currentCoordinates={breakItem.locationCoordinates}
          bookingCoordinates={bookingCoordinates}
          otherBreakCoordinates={otherBreakCoordinates}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm min-w-[120px]" style={{color: '#CB4522'}}>Önskat klockslag:</label>
          <TimeInput
            value={breakItem.desiredTime || ''}
            onChange={value => onUpdateTime(breakItem.id, value, isExtra)}
            className="text-sm"
            style={{
              '--tw-ring-color': '#FFC9AD',
              borderColor: '#FFC9AD'
            } as React.CSSProperties}
          />
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

