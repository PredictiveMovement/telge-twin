import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, ChevronRight, Play } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import DatePicker from '@/components/statistics/DatePicker'
import FilterPanel from '@/components/FilterPanel'
import mockData from '@/data/routeMockData.json'
import { startSimulation } from '@/api/simulator'

interface FetchExistingRoutesProps {
  socket: any
  onSimulationStart: () => void
}

const FetchExistingRoutes: React.FC<FetchExistingRoutesProps> = ({
  socket,
  onSimulationStart,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [showFilters, setShowFilters] = useState(false)
  const [groupedRoutes, setGroupedRoutes] = useState<any[]>([])
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const [searchFilters, setSearchFilters] = useState({
    avfallstyp: [],
    fordonstyp: [],
    fordonsnummer: '',
    tjanstetyp: [],
    veckodag: [],
    frekvens: [],
  })

  const groupRoutesByTurid = (routeData: any[]) => {
    const grouped = routeData.reduce((acc, booking) => {
      const turid = booking.Turid
      if (!acc[turid]) {
        acc[turid] = {
          turid,
          bil: booking.Bil,
          datum: booking.Datum,
          bokningar: [],
          antalBokningar: 0,
          avfallstyper: new Set(),
          tjanstetyper: new Set(),
        }
      }
      acc[turid].bokningar.push(booking)
      acc[turid].antalBokningar++
      acc[turid].avfallstyper.add(booking.Avftyp)
      acc[turid].tjanstetyper.add(booking.Tjtyp)
      return acc
    }, {})

    return Object.values(grouped).map((route: any) => ({
      ...route,
      avfallstyper: Array.from(route.avfallstyper),
      tjanstetyper: Array.from(route.tjanstetyper),
    }))
  }

  const filterRouteData = (routeData: any[]) => {
    let filteredData = [...routeData]

    if (searchFilters.avfallstyp.length > 0) {
      filteredData = filteredData.filter((item) =>
        searchFilters.avfallstyp.includes(item.Avftyp)
      )
    }

    if (searchFilters.fordonstyp.length > 0) {
      filteredData = filteredData.filter((item) =>
        searchFilters.fordonstyp.includes(item.Bil)
      )
    }

    if (searchFilters.tjanstetyp.length > 0) {
      filteredData = filteredData.filter((item) =>
        searchFilters.tjanstetyp.includes(item.Tjtyp)
      )
    }

    return filteredData
  }

  const frekvenser = ['V1V', 'V2V1', 'V2V2', 'V4V1', 'V4V2', 'BUD']

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    setShowFilters(!!date)
    setGroupedRoutes([])
    setHasSearched(false)
  }

  const handleSearchFilterArrayChange = (filterName: string, value: string) => {
    setSearchFilters((prev) => {
      const currentValues = [...prev[filterName]]
      const index = currentValues.indexOf(value)
      if (index === -1) {
        return {
          ...prev,
          [filterName]: [...currentValues, value],
        }
      } else {
        currentValues.splice(index, 1)
        return {
          ...prev,
          [filterName]: currentValues,
        }
      }
    })
  }

  const handleSearchFilterChange = (filterName: string, value: string) => {
    setSearchFilters((prev) => ({
      ...prev,
      [filterName]: value,
    }))
  }

  const clearAllSearchFilters = () => {
    setSearchFilters({
      avfallstyp: [],
      fordonstyp: [],
      fordonsnummer: '',
      tjanstetyp: [],
      veckodag: [],
      frekvens: [],
    })
    setGroupedRoutes([])
    setSelectedRoutes([])
    setHasSearched(false)
  }

  const handleSearch = () => {
    if (!mockData || !mockData.routeData) {
      setGroupedRoutes([])
      setHasSearched(true)
      return
    }

    const filteredData = filterRouteData(mockData.routeData)
    const grouped = groupRoutesByTurid(filteredData)
    setGroupedRoutes(grouped)
    setSelectedRoutes([])
    setHasSearched(true)
  }

  const handleRouteSelect = (turid: string) => {
    setSelectedRoutes((prev) => {
      if (prev.includes(turid)) {
        return prev.filter((id) => id !== turid)
      } else {
        return [...prev, turid]
      }
    })
  }

  const handleStartSimulation = () => {
    if (selectedRoutes.length === 0) {
      return
    }

    const selectedRouteData = groupedRoutes.filter((route) =>
      selectedRoutes.includes(route.turid)
    )

    if (socket) {
      startSimulation(socket, {
        routes: selectedRouteData,
        selectedDate: selectedDate?.toISOString(),
        filters: searchFilters,
      })
    }

    onSimulationStart()
  }

  const filterPanelFilters = {
    wasteTypes: searchFilters.avfallstyp,
    serviceTypes: searchFilters.tjanstetyp,
    vehicles: searchFilters.fordonstyp,
    customerNumber: searchFilters.fordonsnummer || '',
  }

  const handleFilterPanelChange = (filterName: string, values: any) => {
    switch (filterName) {
      case 'wasteTypes':
        setSearchFilters((prev) => ({ ...prev, avfallstyp: values }))
        break
      case 'serviceTypes':
        setSearchFilters((prev) => ({ ...prev, tjanstetyp: values }))
        break
      case 'vehicles':
        setSearchFilters((prev) => ({ ...prev, fordonstyp: values }))
        break
      case 'customerNumber':
        setSearchFilters((prev) => ({ ...prev, fordonsnummer: values }))
        break
    }
  }

  const getFilterPanelActiveCount = () => {
    let count = 0
    if (filterPanelFilters.wasteTypes.length > 0) count++
    if (filterPanelFilters.serviceTypes.length > 0) count++
    if (filterPanelFilters.vehicles.length > 0) count++
    if (filterPanelFilters.customerNumber.trim()) count++
    return count
  }

  const renderDateSelection = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-normal">
          Välj datum för körturer
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Börja med att välja ett datum för att se tillgängliga körturer
        </p>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="w-full max-w-sm">
          <DatePicker date={selectedDate} onDateChange={handleDateSelect} />
        </div>
        {selectedDate && (
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Datum valt: {selectedDate.toLocaleDateString('sv-SE')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const renderFiltersAndResults = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-normal">
            Filtrera körturer för {selectedDate?.toLocaleDateString('sv-SE')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Filtrera körturer baserat på dina önskemål. Välj ett eller flera
            alternativ
          </p>
        </CardHeader>
        <CardContent>
          <FilterPanel
            data={mockData}
            filters={filterPanelFilters}
            onFilterChange={handleFilterPanelChange}
            onClearFilters={clearAllSearchFilters}
            activeFilterCount={getFilterPanelActiveCount()}
            filteredItemCount={groupedRoutes.length}
            totalItemCount={mockData?.routeData?.length || 0}
            hideHeader={true}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="frekvens">Frekvens</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                {frekvenser.map((freq) => (
                  <div key={freq} className="flex items-center gap-2">
                    <Checkbox
                      id={`frekvens-${freq}`}
                      checked={searchFilters.frekvens.includes(freq)}
                      onCheckedChange={() =>
                        handleSearchFilterArrayChange('frekvens', freq)
                      }
                    />
                    <Label htmlFor={`frekvens-${freq}`} className="text-sm">
                      {freq}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fordonsnummer">Fordonsnummer</Label>
              <Input
                id="fordonsnummer"
                placeholder="Ange fordonsnummer"
                value={searchFilters.fordonsnummer}
                onChange={(e) =>
                  handleSearchFilterChange('fordonsnummer', e.target.value)
                }
              />
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button
              onClick={handleSearch}
              className="bg-[#BBD197] hover:bg-[#BBD197]/90"
            >
              <Search size={16} className="mr-2" />
              Hämta körturer
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-normal">
              Körturer ({groupedRoutes.length} körturer hittades)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Välj körturer som ska inkluderas i simuleringen.{' '}
              {selectedRoutes.length} valda.
            </p>
          </CardHeader>
          <CardContent>
            {groupedRoutes.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="w-10 py-2 px-2">
                          <span className="sr-only">Välj</span>
                        </th>
                        <th className="text-left font-medium py-2 px-2">
                          Körtur ID
                        </th>
                        <th className="text-left font-medium py-2 px-2">
                          Fordon
                        </th>
                        <th className="text-left font-medium py-2 px-2">
                          Antal bokningar
                        </th>
                        <th className="text-left font-medium py-2 px-2">
                          Avfallstyper
                        </th>
                        <th className="text-left font-medium py-2 px-2">
                          Tjänstetyper
                        </th>
                        <th className="w-10 py-2 px-2">
                          <span className="sr-only">Chevron</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedRoutes.map((route) => (
                        <tr
                          key={route.turid}
                          className="border-b hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 px-2">
                            <Checkbox
                              checked={selectedRoutes.includes(route.turid)}
                              onCheckedChange={() =>
                                handleRouteSelect(route.turid)
                              }
                            />
                          </td>
                          <td className="py-3 px-2 font-medium">
                            {route.turid}
                          </td>
                          <td className="py-3 px-2">{route.bil}</td>
                          <td className="py-3 px-2">{route.antalBokningar}</td>
                          <td className="py-3 px-2">
                            <span className="text-sm">
                              {route.avfallstyper.slice(0, 2).join(', ')}
                              {route.avfallstyper.length > 2 && '...'}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <span className="text-sm">
                              {route.tjanstetyper.slice(0, 2).join(', ')}
                              {route.tjanstetyper.length > 2 && '...'}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <ChevronRight
                              size={16}
                              className="text-muted-foreground"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedRoutes.length > 0 && (
                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={handleStartSimulation}
                      className="bg-[#BBD197] hover:bg-[#BBD197]/90"
                    >
                      <Play size={16} className="mr-2" />
                      Starta simulering ({selectedRoutes.length} körturer)
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Inga körturer hittades med de valda kriterierna.</p>
                <p className="text-sm mt-2">
                  Prova att justera dina sökfilter och sök igen.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {!selectedDate && renderDateSelection()}
      {showFilters && renderFiltersAndResults()}
    </div>
  )
}

export default FetchExistingRoutes
