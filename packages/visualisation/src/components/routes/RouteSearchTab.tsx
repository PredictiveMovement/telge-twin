import React, { useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import RouteFilterPanel from '@/components/routes/RouteFilterPanel'
import { RouteCard } from '@/components/design-system/RouteCard'
import { SegmentedControl } from '@/components/ui/segmented-control'
import NewCalendarDatePicker from './NewCalendarDatePicker'
import { useNewCalendarSelection } from '@/hooks/useNewCalendarSelection'
import { useRouteData, RouteRecord, RouteCardData } from '@/hooks/useRouteData'
import { useRouteFilters } from '@/hooks/useRouteFilters'
import { getTelgeRouteData } from '@/api/simulator'
import { format, isSameDay } from 'date-fns'
import { sv } from 'date-fns/locale'
import { toast } from 'sonner'
import { getSettingsForPreview, extractInfoFromData } from './FileUpload/utils'
import type { Settings } from '@/utils/fleetGenerator'

const RouteSearchTab: React.FC = () => {
  const navigate = useNavigate()
  
  // Use the new calendar selection hook
  const { 
    mode, 
    setMode,
    selectedDates, 
    dateRange, 
    selectedWeeks,
    disabledDateRange,
    handleDateSelect,
    handleWeekToggle,
    clearAll
  } = useNewCalendarSelection()
  
  // Route data and filters
  const routeDataHook = useRouteData()
  const routeFiltersHook = useRouteFilters()
  
  const [rawSearchResults, setRawSearchResults] = useState<RouteCardData[]>([])
  const [selectedSearchRoutes, setSelectedSearchRoutes] = useState<string[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState("turid")
  const [searchQuery, setSearchQuery] = useState('')
  const resultsRef = useRef<HTMLDivElement>(null)

  const viewOptions = [
    { value: "turid", label: "TurID" },
    { value: "flottor", label: "Flottor" }
  ]

  // Get API call parameters based on selection (uses format() to avoid timezone issues)
  const getApiCallParams = (): Array<{from: string, to: string}> => {
    if (mode === 'range' && dateRange?.from && dateRange?.to) {
      const fromStr = format(dateRange.from, 'yyyy-MM-dd')
      const toStr = format(dateRange.to, 'yyyy-MM-dd')
      return [{ from: fromStr, to: toStr }]
    }
    
    if (mode === 'individual' && selectedDates.length > 0) {
      return selectedDates.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd')
        return { from: dateStr, to: dateStr }
      })
    }
    
    if (selectedWeeks.length > 0) {
      if (mode === 'range' && selectedWeeks.length === 2) {
        const sortedWeeks = [...selectedWeeks].sort((a, b) => a - b)
        if (Math.abs(sortedWeeks[1] - sortedWeeks[0]) === 1) {
          if (dateRange?.from && dateRange?.to) {
            const fromStr = format(dateRange.from, 'yyyy-MM-dd')
            const toStr = format(dateRange.to, 'yyyy-MM-dd')
            return [{ from: fromStr, to: toStr }]
          }
        }
      }
      return selectedDates.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd')
        return { from: dateStr, to: dateStr }
      })
    }
    
    return []
  }

  // Handle search route selection
  const handleSearchRouteSelect = (routeId: string) => {
    setSelectedSearchRoutes(prev => {
      if (prev.includes(routeId)) {
        return prev.filter(id => id !== routeId)
      } else {
        if (viewMode === 'flottor') {
          // For Flottor view, only allow 1 selection
          return [routeId]
        } else {
          // For TurID view, no limit
          return [...prev, routeId]
        }
      }
    })
  }

  // Search function - fetches data from API (NO FILTERING HERE)
  const handleSearch = useCallback(async () => {
    const apiParams = getApiCallParams()
    
    if (apiParams.length === 0) {
      toast.error('Välj minst ett datum först')
      return
    }

    setIsLoading(true)
    setHasSearched(false)
    
    try {
      // Fetch data with from/to parameters
      const allData: RouteRecord[] = []
      
      for (const params of apiParams) {
        const data = await getTelgeRouteData(params.from, params.to)
        if (Array.isArray(data) && data.length > 0) {
          allData.push(...data)
        }
      }
      
      if (allData.length === 0) {
        toast.error('Inga körturer hittades för valda datum')
        setRawSearchResults([])
        routeDataHook.setRouteData([])
        setHasSearched(true)
        return
      }

      // Update route data hook with fetched data
      routeDataHook.setRouteData(allData)
      
      // Group bookings by unique route (Turid + Datum + Bil)
      const routeGroups = new Map<string, RouteRecord[]>()
      
      allData.forEach(item => {
        // Create unique key for each route
        const routeKey = `${item.Turid}_${item.Datum}_${item.Bil}`
        
        if (!routeGroups.has(routeKey)) {
          routeGroups.set(routeKey, [])
        }
        routeGroups.get(routeKey)!.push(item)
      })
      
      // Generate one card per unique route, aggregating bookings
      const generatedRoutes: RouteCardData[] = []
      let index = 0
      
      routeGroups.forEach((bookings, routeKey) => {
        // Use first booking as base data
        const baseBooking = bookings[0]
        
        // Aggregate data from all bookings
        const allAvfallstyper = [...new Set(bookings.map(b => b.Avftyp).filter(Boolean))]
        const allTjanstetyper = [...new Set(bookings.map(b => b.Tjtyp).filter(Boolean))]
        const totalBookings = bookings.length
        
        // Find vehicle description
        const vehicleOption = routeDataHook.vehicleOptions.find(v => v.id === baseBooking.Bil)
        const vehicleDescription = vehicleOption?.display || baseBooking.Bil || 'Okänt'
        
        generatedRoutes.push({
          id: `route_${routeKey}_${index}`,
          name: baseBooking.Turid || `Route_${index}`,
          avfallstyp: allAvfallstyper[0] || 'Okänd',
          avfallstypList: allAvfallstyper,
          fordon: baseBooking.Bil || 'Okänt',
          vehicleDescription,
          frekvens: baseBooking.Frekvens || 'Veckovis',
          veckodag: routeDataHook.getWeekdayFromDate(baseBooking.Datum),
          hamtningar: totalBookings,
          volym: bookings.reduce((sum, b) => sum + (b.Volym || 0), 0),
          vikt: bookings.reduce((sum, b) => sum + (b.Vikt || 0), 0),
          tjanstetyp: allTjanstetyper[0]
        })
        
        index++
      })
      
      setRawSearchResults(generatedRoutes)
      setSelectedSearchRoutes([])
      setHasSearched(true)
      
      toast.success(`${generatedRoutes.length} unika körturer från ${allData.length} bokningar`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunde inte hämta data från API'
      toast.error(message)
      setRawSearchResults([])
      routeDataHook.setRouteData([])
    } finally {
      setIsLoading(false)
    }
  }, [mode, selectedDates, dateRange, selectedWeeks, routeDataHook])

  // Real-time filter function - applies filters to rawSearchResults
  // OPTIMIZED: Use useMemo instead of useCallback to cache the filtered array
  const filteredResults = useMemo(() => {
    if (!hasSearched || rawSearchResults.length === 0) {
      return []
    }
    
    let filtered = rawSearchResults
    const filters = routeFiltersHook.searchFilters
    
    // Apply TurID filter
    if (filters.turid && filters.turid.length > 0) {
      filtered = filtered.filter(item => 
        filters.turid.includes(item.name)  // item.name är TurID
      )
    }
    
    // Apply Avfallstyp filter
    if (filters.avfallstyp.length > 0) {
      filtered = filtered.filter(item =>
        item.avfallstypList.some(type => 
          filters.avfallstyp.some(filterType =>
            filterType.toLowerCase() === type.toLowerCase()
          )
        )
      )
    }
    
    // Apply Fordonstyp filter
    if (filters.fordonstyp.length > 0) {
      filtered = filtered.filter(item => {
        // Extract vehicle type from vehicleDescription
        // Format: "40 Högservice 2-fack" -> extract "2-fack"
        const desc = item.vehicleDescription || ''
        const parts = desc.split(' ')
        const vehicleInfo = parts.slice(1).join(' ')
        const tokens = vehicleInfo.split(' ')
        const vehicleType = tokens[tokens.length - 1]
        
        return filters.fordonstyp.includes(vehicleType)
      })
    }
    
    // Apply Fordonsnummer filter
    if (filters.fordonsnummer.length > 0) {
      filtered = filtered.filter(item =>
        filters.fordonsnummer.includes(item.fordon)
      )
    }
    
    // Apply Tjänstetyp filter
    if (filters.tjanstetyp.length > 0) {
      // Need to check if item has tjanstetyp field
      filtered = filtered.filter(item =>
        item.tjanstetyp && filters.tjanstetyp.includes(item.tjanstetyp)
      )
    }
    
    // Apply search query if exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.fordon.toLowerCase().includes(query) ||
        item.avfallstypList.some(type => type.toLowerCase().includes(query))
      )
    }
    
    return filtered
  }, [rawSearchResults, routeFiltersHook.searchFilters, searchQuery, hasSearched])

  // Handle file upload
  const handleFileUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls,.csv'
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement
      if (target.files && target.files[0]) {
        // Navigate to file upload tab with the file
        navigate('/routes?tab=upload')
        // You could also pass file in state if needed
      }
    }
    input.click()
  }

  // Handle optimization
  const handleOptimizeRoutes = () => {
    if (selectedSearchRoutes.length === 0) {
      toast.error('Välj minst en körtur att optimera')
      return
    }

    const mergeSettingsWithExtracted = (
      base: Settings,
      extracted: Partial<Settings>
    ): Settings => {
      const mergeById = <T extends { ID: string }>(
        primary: T[] = [],
        secondary: T[] = []
      ): T[] => {
        const seen = new Set(primary.map((item) => item.ID))
        const extras = secondary.filter((item) => !seen.has(item.ID))
        return [...primary, ...extras]
      }

      return {
        ...extracted,
        ...base,
        bilar: mergeById(base.bilar, extracted.bilar),
        avftyper: mergeById(base.avftyper, extracted.avftyper),
        tjtyper: mergeById(base.tjtyper, extracted.tjtyper),
        frekvenser: mergeById(base.frekvenser, extracted.frekvenser),
      }
    }

    const selectedItems = filteredResults
      .filter(item => selectedSearchRoutes.includes(item.id))
      .map(item => ({
        id: item.id,
        name: item.name,
        fordon: item.fordon
      }))

    // Extract unique TurIDs from selected items (name is the TurID)
    const selectedTurids = Array.from(
      new Set(selectedItems.map(item => item.name))
    )

    // Generate filename based on date range
    let filename = 'API-körtur'
    if (mode === 'range' && dateRange?.from) {
      const fromStr = format(dateRange.from, 'yyyy-MM-dd')
      const toStr = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : fromStr
      filename = `API-${fromStr}_${toStr}`
    } else if (selectedDates.length > 0) {
      const dateStr = format(selectedDates[0], 'yyyy-MM-dd')
      filename = `API-${dateStr}${selectedDates.length > 1 ? '_multi' : ''}`
    }

    // Get preview settings with data from API
    const baseSettings = getSettingsForPreview()
    const extractedInfo = extractInfoFromData(routeDataHook.routeData as any[])
    
    // Merge base settings with extracted data but keep Telge fackinfo as source of truth
    const previewSettings = mergeSettingsWithExtracted(
      baseSettings,
      extractedInfo
    )

    // Navigate to save optimization page
    navigate('/optimize/save', {
      state: {
        selectedRoutes: selectedTurids,
        filters: routeFiltersHook.searchFilters,
        viewMode: viewMode,
        selectedItems,
        uploadedData: routeDataHook.routeData,
        originalFilename: filename,
        previewSettings
      }
    })
  }

  // Get selection text based on view mode
  const getSelectionText = () => {
    if (viewMode === 'turid') {
      return selectedSearchRoutes.length > 0 
        ? `${selectedSearchRoutes.length} valda` 
        : 'Välj körturer för optimering'
    } else {
      return selectedSearchRoutes.length > 0 
        ? `${selectedSearchRoutes.length}/1 vald` 
        : 'Välj 1 flotta för optimering'
    }
  }
  
  // Format date range for title
  const getDateRangeText = () => {
    // Check if weeks are selected - highest priority
    if (selectedWeeks.length > 0) {
      const sortedWeeks = [...selectedWeeks].sort((a, b) => a - b)
      
      if (sortedWeeks.length === 1) {
        return `v${sortedWeeks[0]}`
      } else if (sortedWeeks.length === 2) {
        return `v${sortedWeeks[0]} och v${sortedWeeks[1]}`
      } else {
        const lastWeek = sortedWeeks[sortedWeeks.length - 1]
        const otherWeeks = sortedWeeks.slice(0, -1).map(w => `v${w}`).join(', ')
        return `${otherWeeks} och v${lastWeek}`
      }
    }
    
    if (mode === 'range') {
      if (!dateRange?.from) return ''
      
      if (!dateRange.to || isSameDay(dateRange.from, dateRange.to)) {
        return format(dateRange.from, 'd MMMM yyyy', { locale: sv })
      } else {
        return `${format(dateRange.from, 'd MMM', { locale: sv })} - ${format(dateRange.to, 'd MMM yyyy', { locale: sv })}`
      }
    } else {
      if (selectedDates.length === 0) return ''
      
      if (selectedDates.length === 1) {
        return format(selectedDates[0], 'd MMMM yyyy', { locale: sv })
      } else if (selectedDates.length <= 3) {
        return selectedDates
          .sort((a, b) => a.getTime() - b.getTime())
          .map(d => format(d, 'd MMM', { locale: sv }))
          .join(', ') + ' ' + format(selectedDates[0], 'yyyy', { locale: sv })
      } else {
        const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime())
        return `${selectedDates.length} datum valda (${format(sorted[0], 'd MMM', { locale: sv })} - ${format(sorted[sorted.length - 1], 'd MMM yyyy', { locale: sv })})`
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="mt-12">
        <h3 className="text-xl font-normal mb-2">
          Välj dag eller period
        </h3>
        <p className="text-sm text-muted-foreground mb-10">
          Du kan välja 1-14 dagar i kalendern, för de körturer du vill hämta. Klicka på veckonummer för att välja specifik vecka.
        </p>
        <NewCalendarDatePicker 
          onSearch={handleSearch} 
          resultsRef={resultsRef}
          mode={mode}
          setMode={setMode}
          selectedDates={selectedDates}
          dateRange={dateRange}
          selectedWeeks={selectedWeeks}
          disabledDateRange={disabledDateRange}
          handleDateSelect={handleDateSelect}
          handleWeekToggle={handleWeekToggle}
          clearAll={clearAll}
          onFileUpload={handleFileUpload}
        />
      </div>

      {/* Search Results Section */}
      {(hasSearched || isLoading) && (
        <Card ref={resultsRef} style={{ marginTop: '56px' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-normal">
                  {isLoading ? 'Laddar körturer...' : `Sökresultat för ${getDateRangeText()}`}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredResults.length} {viewMode === 'turid' ? 'körturer' : 'flottor'} hittades. {getSelectionText()}
                </p>
              </div>
              <Button 
                onClick={handleOptimizeRoutes} 
                className="bg-primary hover:bg-primary/90" 
                disabled={selectedSearchRoutes.length === 0 || isLoading}
              >
                Optimera valda {viewMode === 'turid' ? 'körturer' : 'flottor'} ({selectedSearchRoutes.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!isLoading && (
              <>
                <div className="mb-6">
                  <RouteFilterPanel 
                    searchFilters={routeFiltersHook.searchFilters} 
                    onFilterChange={routeFiltersHook.handleSearchFilterArrayChange} 
                    onClearFilters={routeFiltersHook.clearAllSearchFilters} 
                    activeFilterCount={routeFiltersHook.getActiveFilterCount()} 
                    avfallstyper={routeDataHook.avfallstyper} 
                    vehicleOptions={routeDataHook.vehicleOptions} 
                    tjanstetyper={routeDataHook.tjanstetyper}
                    turids={routeDataHook.getTurids} 
                    hideHeader={true} 
                    onClearAllTurids={routeFiltersHook.clearAllTurids}
                    onClearAllWasteTypes={routeFiltersHook.clearAllWasteTypes}
                    onClearAllVehicles={routeFiltersHook.clearAllVehicles}
                    onClearAllServiceTypes={routeFiltersHook.clearAllServiceTypes}
                  />
                </div>

                <div className="mb-6">
                  <SegmentedControl 
                    options={viewOptions} 
                    value={viewMode} 
                    onValueChange={(newMode) => {
                      setViewMode(newMode)
                      setSelectedSearchRoutes([])
                    }} 
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {viewMode === 'turid' && filteredResults.map(route => (
                    <div 
                      key={route.id} 
                      onClick={() => handleSearchRouteSelect(route.id)} 
                      className="cursor-pointer"
                    >
                      <RouteCard 
                        title={route.name} 
                        vehicleNumber={route.fordon} 
                        wasteTypes={[route.avfallstyp]} 
                        frequency={route.frekvens} 
                        bookingsCount={route.hamtningar} 
                        isSelected={selectedSearchRoutes.includes(route.id)} 
                      />
                    </div>
                  ))}
                </div>

                {filteredResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {hasSearched && routeFiltersHook.getActiveFilterCount() > 0 
                      ? "Inga körturer matchar de valda filtren. Prova att justera filtren eller rensa dem." 
                      : hasSearched 
                      ? "Inga körturer hittades." 
                      : ""}
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <Button 
                    onClick={handleOptimizeRoutes} 
                    className="bg-primary hover:bg-primary/90" 
                    disabled={selectedSearchRoutes.length === 0}
                  >
                    Optimera valda {viewMode === 'turid' ? 'körturer' : 'flottor'} ({selectedSearchRoutes.length})
                  </Button>
                </div>
              </>
            )}
            
            {isLoading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-4 text-muted-foreground">Hämtar körturer från API...</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default RouteSearchTab
