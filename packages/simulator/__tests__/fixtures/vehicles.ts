import { sodertaljeCoordinates } from './coordinates'
import { testSettings } from './settings'

export const twoCompartmentTruck = {
  id: 'truck-101',
  position: sodertaljeCoordinates.depot1,
  startPosition: sodertaljeCoordinates.depot1,
  parcelCapacity: 50,
  fackDetails: testSettings.bilar[0].FACK,
  recyclingTypes: ['HUSHSORT', 'MATAVF', 'PAPPFÖRP', 'PLASTFÖRP'],
}

export const threeCompartmentTruck = {
  id: 'truck-102',
  position: sodertaljeCoordinates.depot1,
  startPosition: sodertaljeCoordinates.depot1,
  parcelCapacity: 50,
  fackDetails: testSettings.bilar[1].FACK,
  recyclingTypes: ['HUSHSORT', 'MATAVF', 'PAPPFÖRP'],
}

export const noCompartmentTruck = {
  id: 'truck-201',
  position: sodertaljeCoordinates.depot1,
  startPosition: sodertaljeCoordinates.depot1,
  parcelCapacity: 20,
  fackDetails: [],
  recyclingTypes: ['HUSHSORT'],
}

export const truckWithBreaks = {
  id: 'truck-breaks',
  position: sodertaljeCoordinates.depot1,
  startPosition: sodertaljeCoordinates.depot1,
  parcelCapacity: 50,
  fackDetails: testSettings.bilar[0].FACK,
  recyclingTypes: ['HUSHSORT', 'MATAVF'],
  fleet: {
    settings: {
      breaks: testSettings.breaks,
      workday: testSettings.workday,
      optimizationSettings: testSettings.optimizationSettings,
    },
  },
}

export function createTruckConfig(overrides: any = {}) {
  return {
    id: `truck-${Math.random().toString(36).substr(2, 9)}`,
    position: sodertaljeCoordinates.depot1,
    startPosition: sodertaljeCoordinates.depot1,
    parcelCapacity: 50,
    fackDetails: [],
    recyclingTypes: ['HUSHSORT'],
    ...overrides,
  }
}
