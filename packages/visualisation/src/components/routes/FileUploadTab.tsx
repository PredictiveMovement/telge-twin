// components/FileUploadTab.tsx
// Uppladdning högst upp. Ingen filter-UI (kommer senare).
// "Hämta körtur" genererar resultatlistan (TurID / Flottor).
// TurID-kort visar fack-spec för dominant fordon i turen.
// "Optimera valda ..." skickar vidare till spara-sida där dataset skapas.

import React, { useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search } from 'lucide-react'

import { RouteCard } from '@/components/design-system/RouteCard'
import { SegmentedControl } from '@/components/design-system/SegmentedControl'

import { getSettingsForPreview, processUploadedFile, type RouteRecord } from './FileUpload'
import { byId, pickDominant, buildFackInfo, type BilSpec } from '@/utils/shared'

import {
  generateFleetCardsFromConfig,
  type FleetConfig,
  type Settings,
} from '@/utils/fleetGenerator'

// ---------------------------------------------------------
// KONFIG: grupper för visning i "Flottor"-tabben (optional)
// ---------------------------------------------------------
const FLEET_CONFIG: FleetConfig = {
  groups: [
    {
      id: 'HUSH',
      label: 'Flotta – Hushåll',
      wasteIds: ['HUSHSORT', 'HEMSORT'],
    },
    { id: 'MAT', label: 'Flotta – Matavfall', wasteIds: ['MATAVF'] },
    {
      id: 'GLAS',
      label: 'Flotta – Glas',
      wasteIds: ['BGLOF', 'BGLFÄ', 'GLOF', 'GLFÄ', 'FGLOF', 'FGLFÄ'],
    },
    {
      id: 'FORP',
      label: 'Flotta – Förpackningar',
      wasteIds: [
        'PAPPFÖRP',
        'PLASTFÖRP',
        'METFÖRP',
        'BPAPPFÖRP',
        'BPLASTFÖRP',
        'BMETFÖRP',
      ],
    },
  ],
  fallbackTopN: 3,
}

// ---------------------------------------------------------
// Komponent
// ---------------------------------------------------------
export default function FileUploadTab() {
  const navigate = useNavigate()
  // Upload-state
  const [uploadedData, setUploadedData] = useState<RouteRecord[]>([])
  const [originalFilename, setOriginalFilename] = useState<string>('')

  // Resultat-UI
  const [turCards, setTurCards] = useState<any[]>([])
  const [fleetCards, setFleetCards] = useState<any[]>([])
  const [selectedResults, setSelectedResults] = useState<string[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [viewMode, setViewMode] = useState<'turid' | 'flottor'>('turid')
  const [searchQuery, setSearchQuery] = useState('')
  const resultsRef = useRef<HTMLDivElement>(null)

  // Settings (för visningsnamn etc.)
  const previewSettings: Settings = useMemo(() => {
    return getSettingsForPreview(uploadedData, originalFilename) as any
  }, [uploadedData, originalFilename])

  // ------------------ Upload ------------------
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        const data = processUploadedFile(parsed, file.name)
        setUploadedData(data)
        setOriginalFilename(file.name)
        toast.success(`Fil laddad: ${file.name} (${data.length} records)`)
      } catch {
        toast.error(
          'Fel vid läsning av fil. Kontrollera att det är en giltig JSON fil.'
        )
      }
    }
    reader.readAsText(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    maxFiles: 1,
  })

  // ------------------ Hämta körtur (generera kort) ------------------
  const handleSearch = () => {
    if (!uploadedData.length) {
      setTurCards([])
      setFleetCards([])
      setHasSearched(true)
      return
    }

    // TurID-kort: gruppera bookings per Turid, räkna waste, hämta dominant bil och dess fack
    const bilIndex: Record<string, BilSpec> = byId(previewSettings?.bilar || [])
    const avfIndex: Record<string, { ID: string; BESKRIVNING?: string }> = byId(
      previewSettings?.avftyper || []
    )
    const freqIndex: Record<string, { ID: string; BESKRIVNING?: string }> =
      byId(previewSettings?.frekvenser || [])

    const byTur = new Map<string, RouteRecord[]>()
    for (const r of uploadedData) {
      if (!r?.Turid) continue
      if (!byTur.has(r.Turid)) byTur.set(r.Turid, [])
      byTur.get(r.Turid)!.push(r)
    }

    // Helper: strict match of booking type to any allowed waste type in fack list
    const matchesFack = (
      avftyp: string | undefined,
      fack: Array<{ number: number; allowedWasteTypes: string[] }>
    ) => {
      if (!avftyp) return false
      if (!Array.isArray(fack) || fack.length === 0) return false
      for (const fx of fack) {
        if (Array.isArray(fx.allowedWasteTypes) && fx.allowedWasteTypes.includes(avftyp)) {
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
        const matched = bookings.filter((b) => matchesFack(b.Avftyp, fack)).length

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
      uploadedData,
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

  const viewOptions = [
    { value: 'turid', label: 'TurID' },
    { value: 'flottor', label: 'Flottor' },
  ]

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

  const getFilteredResults = () => {
    const q = searchQuery.trim().toLowerCase()
    const list = viewMode === 'turid' ? turCards : fleetCards
    if (!q) return list

    if (viewMode === 'turid') {
      return list.filter(
        (r: any) =>
          r.name.toLowerCase().includes(q) ||
          String(r.fordon).toLowerCase().includes(q) ||
          (r.avfallstypList || []).some((t: string) =>
            t.toLowerCase().includes(q)
          )
      )
    } else {
      return list.filter(
        (f: any) =>
          f.name.toLowerCase().includes(q) ||
          f.vehicleNumbers.some((n: string) => n.toLowerCase().includes(q)) ||
          f.wasteTypes.some((w: string) => w.toLowerCase().includes(q))
      )
    }
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
      toast.info('Flottor är förhandsvisning just nu – spara/optimering kommer senare.')
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

    const selectedItems = turCards.filter((c: any) =>
      selectedResults.includes(c.id)
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
      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Ladda upp Route Data</CardTitle>
          <CardDescription>
            Ladda upp en JSON-fil med <code>settings</code> och{' '}
            <code>routeData</code>. Växla mellan <b>TurID</b> och <b>Flottor</b>{' '}
            i resultatet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <div className="space-y-2">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-gray-600">
                {isDragActive ? (
                  <p>Släpp filen här...</p>
                ) : (
                  <p>
                    Dra och släpp en JSON-fil här, eller klicka för att välja
                  </p>
                )}
              </div>
              {originalFilename && (
                <Badge variant="secondary">
                  Laddad: {originalFilename} ({uploadedData.length} records)
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* “Välj preferenser” – utan filter, bara knappen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-normal">
            Välj en eller flera preferenser
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            (Filtrering kommer senare här.) Klicka på <b>Hämta körtur</b> för
            att visa data nedan.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mt-6">
            <Button
              onClick={handleSearch}
              className="bg-[#BBD197] hover:bg-[#BBD197]/90"
            >
              <Search size={16} className="mr-2" />
              Hämta körtur
            </Button>
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
                  disabled={selectedResults.length === 0 || viewMode === 'flottor'}
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
                ? filteredResults.map((route: any) => (
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
                : filteredResults.map((fleet: any) => (
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
                          fleet.frequencies?.length
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
                disabled={selectedResults.length === 0 || viewMode === 'flottor'}
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
