
import React from 'react';

export interface FilterConfiguration {
  avftyper: Array<{ ID: string; BESKRIVNING: string }>;
  bilar: Array<{ ID: string; BESKRIVNING: string }>;
  tjtyper: Array<{ ID: string; BESKRIVNING: string }>;
  veckodagar: Array<{ ID: string; BESKRIVNING: string }>;
  frekvenser: Array<{ ID: string; BESKRIVNING: string }>;
  vehicleTypes: Array<{ ID: string; BESKRIVNING: string }>;
}

interface FilterConfigurationProviderProps {
  avfallstyper: string[];
  vehicleOptions: Array<{ id: string; display: string }>;
  tjanstetyper: string[];
  veckodagar: string[];
  frekvenser: string[];
  children: (config: FilterConfiguration) => React.ReactNode;
}

const FilterConfigurationProvider: React.FC<FilterConfigurationProviderProps> = ({
  avfallstyper,
  vehicleOptions,
  tjanstetyper,
  veckodagar,
  frekvenser,
  children
}) => {
  const configuration: FilterConfiguration = {
    avftyper: avfallstyper.map((type) => ({
      ID: type,
      BESKRIVNING: type
    })),
    bilar: vehicleOptions.map(vehicle => ({
      ID: vehicle.id,
      BESKRIVNING: vehicle.display
    })),
    tjtyper: tjanstetyper.map((type, index) => ({
      ID: (index + 1).toString(),
      BESKRIVNING: type
    })),
    veckodagar: veckodagar.map((day, index) => ({
      ID: (index + 1).toString(),
      BESKRIVNING: day
    })),
    frekvenser: frekvenser.map((freq, index) => ({
      ID: (index + 1).toString(),
      BESKRIVNING: freq
    })),
    vehicleTypes: Array.from(new Set(vehicleOptions.map(vehicle => {
       const parts = vehicle.display.split(' ');
       const desc = parts.slice(1).join(' ').trim();
       const tokens = desc.split(' ');
       return tokens[tokens.length - 1] || desc;
     }))).sort().map(type => ({ ID: type, BESKRIVNING: type }))

  };

  return <>{children(configuration)}</>;
};

export default FilterConfigurationProvider;
