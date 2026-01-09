import React from 'react';
import telgeSettings from '@/config/telge-settings.json';

export interface FilterConfiguration {
  avftyper: Array<{ ID: string; BESKRIVNING: string }>;
  bilar: Array<{ ID: string; BESKRIVNING: string }>;
  tjtyper: Array<{ ID: string; BESKRIVNING: string }>;
  veckodagar: Array<{ ID: string; BESKRIVNING: string }>;
  frekvenser: Array<{ ID: string; BESKRIVNING: string }>;
  vehicleTypes: Array<{ ID: string; BESKRIVNING: string }>;
  turids: Array<{ ID: string; BESKRIVNING: string }>;
}

// Get settings for translations lookup
const settings = (telgeSettings as { settings?: any }).settings || {};
const avfTypSettings = settings.avftyper || [];
const tjTypSettings = settings.tjtyper || [];

// Helper to find translation (case-insensitive)
const findAvfTyp = (id: string) => 
  avfTypSettings.find((a: any) => a.ID.toLowerCase() === id.toLowerCase());
const findTjTyp = (id: string) => 
  tjTypSettings.find((t: any) => t.ID.toLowerCase() === id.toLowerCase());

interface FilterConfigurationProviderProps {
  avfallstyper: string[];
  vehicleOptions: Array<{ id: string; display: string }>;
  tjanstetyper: string[];
  veckodagar: string[];
  frekvenser: string[];
  turids?: string[];
  children: (config: FilterConfiguration) => React.ReactNode;
}

const FilterConfigurationProvider: React.FC<FilterConfigurationProviderProps> = ({
  avfallstyper = [],
  vehicleOptions = [],
  tjanstetyper = [],
  veckodagar = [],
  frekvenser = [],
  turids = [],
  children
}) => {
  const configuration: FilterConfiguration = {
    avftyper: (avfallstyper || []).map((type) => {
      const existing = findAvfTyp(type);
      return {
        ID: existing?.ID || type,
        BESKRIVNING: existing?.BESKRIVNING || type
      };
    }),
    bilar: (vehicleOptions || []).map(vehicle => ({
      ID: vehicle.id,
      BESKRIVNING: vehicle.display
    })),
    tjtyper: (tjanstetyper || []).map((type) => {
      const existing = findTjTyp(type);
      return {
        ID: existing?.ID || type,
        BESKRIVNING: existing?.BESKRIVNING || type
      };
    }),
    veckodagar: (veckodagar || []).map((day, index) => ({
      ID: (index + 1).toString(),
      BESKRIVNING: day
    })),
    frekvenser: (frekvenser || []).map((freq, index) => ({
      ID: (index + 1).toString(),
      BESKRIVNING: freq
    })),
    vehicleTypes: Array.from(new Set((vehicleOptions || []).map(vehicle => {
       const parts = vehicle.display.split(' ');
       const desc = parts.slice(1).join(' ').trim();
       const tokens = desc.split(' ');
       return tokens[tokens.length - 1] || desc;
     }))).sort().map(type => ({ ID: type, BESKRIVNING: type })),
    turids: (turids || []).map((turid) => ({
      ID: turid,
      BESKRIVNING: turid
    }))

  };

  return <>{children(configuration)}</>;
};

export default FilterConfigurationProvider;
