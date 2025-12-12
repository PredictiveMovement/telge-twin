import { useState, useMemo, useCallback } from 'react'

export interface RouteRecord {
  Turid?: string
  Bil?: string
  Avftyp?: string
  Tjtyp?: string
  Datum?: string
  Frekvens?: string
  Volym?: number
  Vikt?: number
  Hsadress?: string
  Nyckelkod?: string
  [key: string]: any
}

export interface RouteCardData {
  id: string
  name: string
  avfallstyp: string
  avfallstypList: string[]
  fordon: string
  vehicleDescription: string
  frekvens: string
  veckodag: string
  hamtningar: number
  volym: number
  vikt: number
  tjanstetyp?: string
}

export interface VehicleOption {
  id: string
  display: string
}

export const useRouteData = () => {
  // Route data from API
  const [routeData, setRouteData] = useState<RouteRecord[]>([])
  
  // Helper function to get weekday from date
  const getWeekdayFromDate = (dateString?: string) => {
    if (!dateString) return 'Okänd'
    const date = new Date(dateString)
    const weekdays = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']
    return weekdays[date.getDay()]
  }

  // Extract unique values from route data for filter options
  const getUniqueValues = (field: string): string[] => {
    if (!routeData || routeData.length === 0) {
      return []
    }
    const uniqueValues = [...new Set(routeData.map(item => item[field]))]
      .filter(value => value && value !== '--')
      .map(v => String(v))
    return uniqueValues.sort()
  }

  // Get vehicle data with type descriptions - MEMOIZED
  const vehicleOptions = useMemo((): VehicleOption[] => {
    if (!routeData || routeData.length === 0) {
      return []
    }
    
    // Extract unique vehicle IDs
    const vehicles = [...new Set(routeData.map(item => item.Bil))]
      .filter(bil => bil && bil !== '--')
      .map(bil => ({
        id: String(bil),
        display: String(bil)
      }))
    
    return vehicles.sort((a, b) => a.display.localeCompare(b.display))
  }, [routeData])

  // Get avfallstyper - MEMOIZED
  const avfallstyper = useMemo((): string[] => {
    if (!routeData || routeData.length === 0) {
      return []
    }
    const uniqueValues = [...new Set(routeData.map(item => item.Avftyp))]
      .filter(value => value && value !== '--')
      .map(v => String(v))
    return uniqueValues.sort()
  }, [routeData])

  // Get tjanstetyper - MEMOIZED
  const tjanstetyper = useMemo(() => getUniqueValues('Tjtyp'), [routeData])

  // Get unique vehicle types from vehicle options
  const getVehicleTypes = useMemo(() => {
    if (!vehicleOptions || vehicleOptions.length === 0) {
      return []
    }
    
    const types = new Set<string>()
    vehicleOptions.forEach(v => {
      // Extract vehicle type from display string
      // Format: "40 Högservice 2-fack" -> extract "2-fack"
      const parts = v.display.split(' ')
      const desc = parts.slice(1).join(' ')
      const tokens = desc.split(' ')
      const type = tokens[tokens.length - 1]
      if (type) types.add(type)
    })
    
    return Array.from(types).sort()
  }, [vehicleOptions])

  // For frequency, extract from the data or use predefined values - MEMOIZED
  const frekvenser = useMemo((): string[] => {
    const fromData = getUniqueValues('Frekvens')
    if (fromData.length > 0) return fromData
    
    // Fallback to common frequencies
    return [
      'Varje vecka', 
      'Varannan vecka jämn', 
      'Varannan vecka udda', 
      'Var 4e vecka', 
      'Var 6e vecka', 
      'Var 8e vecka', 
      'Kvartalsvis'
    ]
  }, [routeData])
  
  const veckodagar = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag']

  // Get unique TurIDs - MEMOIZED
  const getTurids = useMemo((): string[] => {
    if (!routeData || routeData.length === 0) {
      return []
    }
    const uniqueTurids = [...new Set(routeData.map(item => item.Turid))]
      .filter(value => value && value !== '--')
      .map(v => String(v))
    return uniqueTurids.sort()
  }, [routeData])

  // Generate route card data from route record - MEMOIZED CALLBACK
  const generateRouteFromData = useCallback((item: RouteRecord, index: number): RouteCardData => {
    // Use the actual TurID from data as the primary name
    const routeName = item.Turid || `Route_${index}`
    
    // Use random pickup count (can be replaced with actual data if available)
    const pickupCount = Math.floor(Math.random() * 5) + 18
    
    // Find vehicle description from vehicleOptions
    const vehicleOption = vehicleOptions.find(v => v.id === item.Bil)
    const vehicleDescription = vehicleOption?.display || item.Bil || 'Okänt'
    
    // Get waste type as array
    const avfallstypList = item.Avftyp ? [item.Avftyp] : ['Okänd']
    
    return {
      id: `route_${item.Turid}_${item.Datum}_${index}`,
      name: routeName,
      avfallstyp: item.Avftyp || 'Okänd',
      avfallstypList,
      fordon: item.Bil || 'Okänt',
      vehicleDescription,
      frekvens: item.Frekvens || 'Veckovis',
      veckodag: getWeekdayFromDate(item.Datum),
      hamtningar: pickupCount,
      volym: item.Volym || 0,
      vikt: item.Vikt || 0,
      tjanstetyp: item.Tjtyp
    }
  }, [vehicleOptions])

  return {
    routeData,
    setRouteData,
    avfallstyper,
    vehicleOptions,
    tjanstetyper,
    frekvenser,
    veckodagar,
    getTurids,
    getWeekdayFromDate,
    generateRouteFromData,
    getVehicleTypes,
  }
}

