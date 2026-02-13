import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/use-toast'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

import { RouteCard } from '@/components/design-system/RouteCard'
import { SegmentedControl } from '@/components/design-system/SegmentedControl'

import {
  getSettingsForPreview,
  processUploadedFile,
  type RouteRecord,
} from './FileUpload'
import { byId, pickDominant, buildFackInfo, type BilSpec } from '@/utils/shared'
import RouteFilterPanel from './RouteFilterPanel'
import {
  buildUploadFilterOptions,
  formatWeekdayLabel,
  type UploadFilterOptions,
} from './FileUpload/filterOptions'

import {
  generateFleetCardsFromConfig,
  type FleetCard,
  type Settings,
} from '@/utils/fleetGenerator'
import { FLEET_CONFIG } from '@/config/fleet'
import { getTelgeRouteData } from '@/api/simulator'

// ---------------------------------------------------------
// Komponent
// ---------------------------------------------------------
type SearchFilters = {
  avfallstyp: string[]
  fordonstyp: string[]
  fordonsnummer: string[]
  tjanstetyp: string[]
  veckodag: string[]
  frekvens: string[]
  datum: string
}

type ArrayFilterKey = Exclude<keyof SearchFilters, 'datum'>

const createEmptyFilters = (): SearchFilters => ({
  avfallstyp: [],
  fordonstyp: [],
  fordonsnummer: [],
  tjanstetyp: [],
  veckodag: [],
  frekvens: [],
  datum: '',
})

const getVehicleTypeFromDisplay = (display: string) => {
  const parts = display.split(' ')
  const desc = parts.slice(1).join(' ').trim()
  if (!desc) return ''
  const tokens = desc.split(' ')
  return tokens[tokens.length - 1] || desc
}

type RouteSummaryCard = {
  id: string
  name: string
  fordon: string
  vehicleDescription?: string
  avfallstypList: string[]
  frekvens?: string
  hamtningar: number
  hamtningarMatched: number
  hamtningarTotal: number
  fack: ReturnType<typeof buildFackInfo>
}

export default function FileUploadTab() {
  const navigate = useNavigate()
  // Upload-state
  const [uploadedData, setUploadedData] = useState<RouteRecord[]>([])
  const [originalFilename, setOriginalFilename] = useState<string>('')

  // Resultat-UI
  const [turCards, setTurCards] = useState<RouteSummaryCard[]>([])
  const [fleetCards, setFleetCards] = useState<FleetCard[]>([])
  const [selectedResults, setSelectedResults] = useState<string[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [viewMode, setViewMode] = useState<'turid' | 'flottor'>('turid')
  const [searchQuery, setSearchQuery] = useState('')
  const resultsRef = useRef<HTMLDivElement>(null)
  const [searchFilters, setSearchFilters] =
    useState<SearchFilters>(createEmptyFilters)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [filterOptions, setFilterOptions] = useState<UploadFilterOptions>({
    avfallstyper: [],
    vehicleOptions: [],
    tjanstetyper: [],
    veckodagar: [],
    frekvenser: [],
    frequencyLookup: {},
  })
  const [apiLoading, setApiLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const vehicleTypeById = useMemo(() => {
    const map: Record<string, string> = {}
    filterOptions.vehicleOptions.forEach((option) => {
      if (!option?.id) return
      const type = getVehicleTypeFromDisplay(option.display)
      if (type) {
        map[option.id] = type
      }
    })
    return map
  }, [filterOptions.vehicleOptions])

  const activeFilterCount = useMemo(() => {
    const arrayCount =
      searchFilters.avfallstyp.length +
      searchFilters.fordonstyp.length +
      searchFilters.fordonsnummer.length +
      searchFilters.tjanstetyp.length +
      searchFilters.veckodag.length +
      searchFilters.frekvens.length

    return arrayCount + (searchFilters.datum ? 1 : 0)
  }, [searchFilters])

  // Settings (för visningsnamn etc.)
  const previewSettings = useMemo<Settings>(() => {
    return getSettingsForPreview()
  }, [])

  useEffect(() => {
    if (!uploadedData.length) {
      setFilterOptions({
        avfallstyper: [],
        vehicleOptions: [],
        tjanstetyper: [],
        veckodagar: [],
        frekvenser: [],
        frequencyLookup: {},
      })
      setSearchFilters(createEmptyFilters())
      setSelectedDate(undefined)
      return
    }

    const options = buildUploadFilterOptions(uploadedData, previewSettings)
    setFilterOptions(options)
    setSearchFilters(createEmptyFilters())
    setSelectedDate(undefined)
  }, [uploadedData, previewSettings])

  // ------------------ File load (via button) ------------------
  const handleOpenFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string)
          const data = processUploadedFile(parsed, file.name)
          setUploadedData(data)
          setOriginalFilename(file.name)
          setTurCards([])
          setFleetCards([])
          setSelectedResults([])
          setHasSearched(false)
          setSearchQuery('')
          toast.success(`Fil laddad: ${file.name} (${data.length} records)`)
        } catch {
          toast.error(
            'Fel vid läsning av fil. Kontrollera att det är en giltig JSON fil.'
          )
        }
      }
      reader.readAsText(file)
      // reset input so selecting same file again re-triggers change
      e.target.value = ''
    },
    []
  )

  const handleLoadFromApi = useCallback(async () => {
    try {
      if (!selectedDate) {
        toast.error('Välj ett datum först')
        return
      }
      setApiLoading(true)
      const dateStr = selectedDate.toISOString().split('T')[0]
      const data = await getTelgeRouteData(dateStr, dateStr)
      if (!Array.isArray(data) || data.length === 0) {
        toast.error('Inga körturer hämtades för valt datum')
        return
      }

      setUploadedData(data as RouteRecord[])
      setOriginalFilename(`API-${dateStr}`)
      setTurCards([])
      setFleetCards([])
      setSelectedResults([])
      setHasSearched(false)
      setSearchQuery('')
      toast.success(`API-data laddad: ${data.length} records`)
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Kunde inte läsa in data från API'
      toast.error(message)
    } finally {
      setApiLoading(false)
    }
  }, [selectedDate])

  const updateFilterArray = useCallback(
    (key: ArrayFilterKey, updater: (current: string[]) => string[]) => {
      setSearchFilters((prev) => {
        const current = prev[key]
        const next = updater(current)
        // Avoid unnecessary state updates
        if (
          next.length === current.length &&
          next.every((v, idx) => v === current[idx])
        ) {
          return prev
        }
        return {
          ...prev,
          [key]: next,
        }
      })
    },
    []
  )

  const handleFilterChange = useCallback(
    (filterName: string, value: string) => {
      if (filterName === 'datum') return
      const key = filterName as ArrayFilterKey
      updateFilterArray(key, (current) => {
        if (current.includes(value)) {
          return current.filter((item) => item !== value)
        }
        return [...current, value]
      })
    },
    [updateFilterArray]
  )

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setSelectedDate(date)
    setSearchFilters((prev) => {
      const formatted = date ? date.toISOString().split('T')[0] : ''
      if (prev.datum === formatted) return prev
      return {
        ...prev,
        datum: formatted,
      }
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    setSearchFilters(createEmptyFilters())
    setSelectedDate(undefined)
  }, [])

  const clearAllWasteTypes = useCallback(() => {
    updateFilterArray('avfallstyp', () => [])
  }, [updateFilterArray])

  const clearAllVehicles = useCallback(() => {
    updateFilterArray('fordonsnummer', () => [])
  }, [updateFilterArray])

  const clearAllVehicleTypes = useCallback(() => {
    setSearchFilters((prev) => {
      if (prev.fordonstyp.length === 0) return prev
      const typeSet = new Set(prev.fordonstyp)
      const remainingVehicles = prev.fordonsnummer.filter((id) => {
        const type = vehicleTypeById[id]
        return !typeSet.has(type)
      })
      return {
        ...prev,
        fordonstyp: [],
        fordonsnummer: remainingVehicles,
      }
    })
  }, [vehicleTypeById])

  const clearAllServiceTypes = useCallback(() => {
    updateFilterArray('tjanstetyp', () => [])
  }, [updateFilterArray])

  const clearAllWeekdays = useCallback(() => {
    updateFilterArray('veckodag', () => [])
  }, [updateFilterArray])

  const clearAllFrequencies = useCallback(() => {
    updateFilterArray('frekvens', () => [])
  }, [updateFilterArray])

  const applyFilters = useCallback(
    (data: RouteRecord[]) => {
      if (!data.length) return []

      const activeFrequencyIds = searchFilters.frekvens.map(
        (label) => filterOptions.frequencyLookup[label] || label
      )
      const activeWeekdays = new Set(searchFilters.veckodag)
      const filterByWeekday = activeWeekdays.size > 0
      const filterByDate = Boolean(searchFilters.datum)
      const filterByVehicleType = searchFilters.fordonstyp.length > 0

      return data.filter((record) => {
        if (searchFilters.avfallstyp.length) {
          const value = record?.Avftyp || ''
          if (!value || !searchFilters.avfallstyp.includes(value)) return false
        }

        if (searchFilters.fordonsnummer.length) {
          const value = record?.Bil || ''
          if (!value || !searchFilters.fordonsnummer.includes(value))
            return false
        }

        if (filterByVehicleType) {
          const type = vehicleTypeById[record?.Bil || '']
          if (!type || !searchFilters.fordonstyp.includes(type)) return false
        }

        if (searchFilters.tjanstetyp.length) {
          const value = record?.Tjtyp || ''
          if (!value || !searchFilters.tjanstetyp.includes(value)) return false
        }

        if (activeFrequencyIds.length) {
          const value = record?.Frekvens || ''
          if (!value || !activeFrequencyIds.includes(value)) return false
        }

        if (filterByDate) {
          const dateValue = record?.Datum ? record.Datum.split('T')[0] : ''
          if (!dateValue || dateValue !== searchFilters.datum) return false
        } else if (filterByWeekday) {
          const weekdayLabel = formatWeekdayLabel(record?.Datum)
          if (!weekdayLabel || !activeWeekdays.has(weekdayLabel)) return false
        }

        return true
      })
    },
    [filterOptions.frequencyLookup, searchFilters, vehicleTypeById]
  )

  // ------------------ Hämta körtur (generera kort) ------------------
  const handleSearch = () => {
    if (!uploadedData.length) {
      setTurCards([])
      setFleetCards([])
      setHasSearched(true)
      return
    }

    const filteredData = applyFilters(uploadedData)

    // TurID-kort: gruppera bookings per Turid, räkna waste, hämta dominant bil och dess fack
    const bilIndex: Record<string, BilSpec> = byId(previewSettings?.bilar || [])
    const avfIndex: Record<string, { ID: string; BESKRIVNING?: string }> = byId(
      previewSettings?.avftyper || []
    )
    const freqIndex: Record<string, { ID: string; BESKRIVNING?: string }> =
      byId(previewSettings?.frekvenser || [])

    const byTur = new Map<string, RouteRecord[]>()
    for (const r of filteredData) {
      if (!r?.Turid) continue
      if (!byTur.has(r.Turid)) byTur.set(r.Turid, [])
      byTur.get(r.Turid)!.push(r)
    }

    // Helper: strict match of booking type to any allowed waste type in fack list
    const matchesFack = (
      avftyp: string | undefined,
      fack: RouteSummaryCard['fack']
    ) => {
      if (!avftyp) return false
      if (!Array.isArray(fack) || fack.length === 0) return false
      for (const fx of fack) {
        if (
          Array.isArray(fx.allowedWasteTypes) &&
          fx.allowedWasteTypes.includes(avftyp)
        ) {
          return true
        }
      }
      return false
    }

    const turCardsData = Array.from(byTur.entries())
      .map(([turid, bookings]) => {
        const dominantBil =
          pickDominant(bookings.map((b) => b.Bil)) || bookings[0].Bil
        const bil = bilIndex[dominantBil] || null
        const fack = buildFackInfo(bil)

        // Count matched vs total for display
        const total = bookings.length
        const matched = bookings.filter((b) =>
          matchesFack(b.Avftyp, fack)
        ).length

        // waste badges (topp 3)
        const wc = new Map<string, number>()
        for (const b of bookings) {
          if (!b.Avftyp) continue
          wc.set(b.Avftyp, (wc.get(b.Avftyp) || 0) + 1)
        }
        const wasteNames = Array.from(wc.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id]) => avfIndex[id]?.BESKRIVNING || id)

        const dominantFreqId =
          pickDominant(bookings.map((b) => b.Frekvens || '').filter(Boolean)) ||
          ''
        const freqLabel = dominantFreqId
          ? freqIndex[dominantFreqId]?.BESKRIVNING || dominantFreqId
          : undefined

        return {
          id: `route-${turid}`,
          name: turid,
          fordon: dominantBil,
          vehicleDescription: bil?.BESKRIVNING || `Bil ${dominantBil}`,
          avfallstypList: wasteNames,
          frekvens: freqLabel,
          hamtningar: bookings.length,
          hamtningarMatched: matched,
          hamtningarTotal: total,
          fack,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    // Flotta-kort (visning)
    const fleetCardsData = generateFleetCardsFromConfig(
      filteredData,
      previewSettings,
      FLEET_CONFIG
    )

    setTurCards(turCardsData)
    setFleetCards(fleetCardsData)
    setSelectedResults([])
    setHasSearched(true)

    // Scroll till resultat
    setTimeout(() => {
      if (resultsRef.current) {
        const rect = resultsRef.current.getBoundingClientRect()
        const top = rect.top + window.scrollY - 80
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      }
    }, 100)
  }

  const handleSelect = (id: string) => {
    setSelectedResults((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      return viewMode === 'flottor' ? [id] : [...prev, id]
    })
  }

  const getSelectionText = () => {
    if (viewMode === 'turid') {
      return selectedResults.length > 0
        ? `${selectedResults.length} valda.`
        : 'Välj körturer för optimering.'
    } else {
      return selectedResults.length > 0
        ? `${selectedResults.length}/1 vald.`
        : 'Välj 1 flotta för optimering.'
    }
  }

  const getFilteredResults = (): RouteSummaryCard[] | FleetCard[] => {
    const q = searchQuery.trim().toLowerCase()
    if (viewMode === 'turid') {
      if (!q) return turCards
      return turCards.filter((route) => {
        const nameMatch = route.name.toLowerCase().includes(q)
        const vehicleMatch = route.fordon.toLowerCase().includes(q)
        const wasteMatch = route.avfallstypList.some((type) =>
          type.toLowerCase().includes(q)
        )
        return nameMatch || vehicleMatch || wasteMatch
      })
    }

    if (!q) return fleetCards
    return fleetCards.filter((fleet) => {
      const nameMatch = fleet.name.toLowerCase().includes(q)
      const vehicleMatch = fleet.vehicleNumbers.some((number) =>
        number.toLowerCase().includes(q)
      )
      const wasteMatch = fleet.wasteTypes.some((type) =>
        type.toLowerCase().includes(q)
      )
      return nameMatch || vehicleMatch || wasteMatch
    })
  }

  const filteredResults = getFilteredResults()

  // ------------------ OPTIMERA = GÅ TILL SPARA-SIDA ------------------
  const optimizeAndSave = async () => {
    if (!uploadedData.length) {
      toast.error('Ingen data uppladdad.')
      return
    }
    if (selectedResults.length === 0) {
      toast.error('Välj minst en körtur eller 1 flotta.')
      return
    }

    if (viewMode === 'flottor') {
      toast.info(
        'Flottor är förhandsvisning just nu – spara/optimering kommer senare.'
      )
      return
    }
    // Bygg state för spar-sidan
    const selectedTurids = Array.from(
      new Set(selectedResults.map((id) => id.replace(/^route-/, '')))
    )

    const selectionMeta: Record<string, unknown> = {
      mode: viewMode,
      turids: selectedTurids,
    }

    const selectedItems = turCards.filter((card) =>
      selectedResults.includes(card.id)
    )

    navigate('/optimize/save', {
      state: {
        selectedRoutes: selectedTurids,
        filters: selectionMeta,
        viewMode,
        selectedItems,
        uploadedData,
        originalFilename,
        previewSettings,
      },
    })
  }

  // ------------------ UI ------------------
  return (
    <div className="space-y-6">
      {/* Filtersektion */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-normal">
            Välj en eller flera preferenser
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Filtrera körturerna med alternativen nedan och klicka på
            <b> Hämta körtur</b> för att se resultatet.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <RouteFilterPanel
              searchFilters={searchFilters}
              onFilterChange={handleFilterChange}
              activeFilterCount={activeFilterCount}
              avfallstyper={filterOptions.avfallstyper}
              vehicleOptions={filterOptions.vehicleOptions}
              tjanstetyper={filterOptions.tjanstetyper}
              selectedDate={selectedDate}
              onDateChange={handleDateSelect}
              hideHeader={true}
              onClearAllWasteTypes={clearAllWasteTypes}
              onClearAllVehicles={clearAllVehicles}
              onClearAllVehicleTypes={clearAllVehicleTypes}
              onClearAllServiceTypes={clearAllServiceTypes}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                onClick={clearAllFilters}
                className="w-full sm:w-auto"
                disabled={activeFilterCount === 0}
              >
                Rensa alla filter
              </Button>
              <div className="flex flex-col w-full sm:w-auto sm:flex-row sm:items-center gap-2 sm:ml-auto">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  onClick={handleOpenFilePicker}
                  className="w-full sm:w-auto"
                  variant="secondary"
                >
                  Ladda in via fil
                </Button>
                <Button
                  onClick={handleLoadFromApi}
                  className="w-full sm:w-auto"
                  disabled={!selectedDate || apiLoading}
                  variant="secondary"
                  title={
                    !selectedDate ? 'Välj datum i filterpanelen' : undefined
                  }
                >
                  {apiLoading ? 'Laddar…' : 'Ladda via API'}
                </Button>
                <Button
                  onClick={handleSearch}
                  className="w-full sm:w-auto bg-[#BBD197] hover:bg-[#BBD197]/90"
                  disabled={uploadedData.length === 0}
                >
                  <Search size={16} className="mr-2" />
                  Hämta körtur
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultatsektion */}
      {hasSearched && (
        <Card ref={resultsRef}>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-xl font-normal">
                  Sökresultat ({filteredResults.length}{' '}
                  {viewMode === 'turid' ? 'körturer' : 'flottor'} hittades)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {getSelectionText()}
                </p>
              </div>
              <div className="flex flex-col w-full gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                <div className="relative w-full sm:w-64">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                    size={16}
                  />
                  <Input
                    placeholder="Sök..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
                <Button
                  className="w-full sm:w-auto bg-[#BBD197] hover:bg-[#BBD197]/90"
                  disabled={
                    selectedResults.length === 0 || viewMode === 'flottor'
                  }
                  title={
                    viewMode === 'flottor'
                      ? 'Endast visning just nu'
                      : undefined
                  }
                  onClick={optimizeAndSave}
                >
                  Optimera valda {viewMode === 'turid' ? 'körturer' : 'flottor'}{' '}
                  ({selectedResults.length})
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="mb-6">
              <SegmentedControl
                options={[
                  { value: 'turid', label: 'TurID' },
                  { value: 'flottor', label: 'Flottor' },
                ]}
                value={viewMode}
                onValueChange={(v) => {
                  setViewMode(v as 'turid' | 'flottor')
                  setSelectedResults([])
                }}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {viewMode === 'turid'
                ? (filteredResults as RouteSummaryCard[]).map((route) => (
                    <div
                      key={route.id}
                      onClick={() => handleSelect(route.id)}
                      className="cursor-pointer"
                    >
                      <RouteCard
                        title={route.name}
                        vehicleNumber={route.fordon}
                        wasteTypes={route.avfallstypList}
                        frequency={route.frekvens}
                        bookingsCount={route.hamtningar}
                        bookingsMatched={route.hamtningarMatched}
                        bookingsTotal={route.hamtningarTotal}
                        isSelected={selectedResults.includes(route.id)}
                        vehicleDescription={route.vehicleDescription}
                        fack={route.fack}
                      />
                    </div>
                  ))
                : (filteredResults as FleetCard[]).map((fleet) => (
                    <div
                      key={fleet.id}
                      onClick={() => handleSelect(fleet.id)}
                      className="cursor-pointer"
                    >
                      <RouteCard
                        title={fleet.name}
                        vehicleNumbers={fleet.vehicleNumbers}
                        vehicleTypes={fleet.vehicleTypes}
                        wasteTypes={fleet.wasteTypes}
                        frequency={
                          fleet.frequencies.length
                            ? fleet.frequencies.join(', ')
                            : undefined
                        }
                        bookingsCount={fleet.bookingsCount}
                        isSelected={selectedResults.includes(fleet.id)}
                      />
                    </div>
                  ))}
            </div>

            {filteredResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery.trim()
                  ? `Inga resultat hittades för "${searchQuery}"`
                  : 'Inga körturer hittades.'}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                className="bg-[#BBD197] hover:bg-[#BBD197]/90"
                disabled={
                  selectedResults.length === 0 || viewMode === 'flottor'
                }
                title={
                  viewMode === 'flottor' ? 'Endast visning just nu' : undefined
                }
                onClick={optimizeAndSave}
              >
                Optimera valda {viewMode === 'turid' ? 'körturer' : 'flottor'} (
                {selectedResults.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
