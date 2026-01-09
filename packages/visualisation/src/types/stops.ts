export interface VehicleCompartment {
  number: number;
  wasteType: string;
  volume: number;
  weightLimit: number;
  containerType: string;
  count?: number;
}

export interface Stop {
  id: string;
  type: 'regular' | 'break' | 'lunch' | 'tipping';
  address?: string;
  wasteTypes?: string[];
  vehicle?: string;
  routeNumber?: string;
  duration?: number;
  estimatedTime?: string;
  originalPosition?: number;
  containerType?: string;
  containerCount?: number;
  containerDetails?: { wasteType: string; containerType: string; count: number }[];
  serviceType?: string;
  propertyDesignation?: string;
  frequency?: string;
  customerName?: string;
  accessKey?: string;
  walkingDistance?: number;
  timePerStop?: number;
  compartments?: VehicleCompartment[];
}