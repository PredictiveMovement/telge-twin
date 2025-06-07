import { useState, useCallback, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { saveRouteDataset } from '@/api/simulator'
import { generateFleetsAndBookings } from '@/utils/fleetGenerator'
import { toast } from 'sonner'

function FleetPreview({
  routeData,
  settings,
}: {
  routeData: any[]
  settings: any
}) {
  const fleets = generateFleetsAndBookings(routeData, settings).fleets

  if (fleets.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
        Inga flottor kunde genereras från den filtrerade datan.
      </div>
    )
  }

  const totalBookings = routeData.length
  const assignedBookings = fleets.reduce(
    (sum, fleet) => sum + fleet.bookingCount,
    0
  )

  return (
    <div className="space-y-4">
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-green-800">
            {fleets.length} Avfallstyp-baserade Fleets
          </span>
          <span className="text-green-600">
            {assignedBookings}/{totalBookings} bokningar täckta
            <Badge
              variant={
                assignedBookings === totalBookings ? 'default' : 'destructive'
              }
              className="ml-2"
            >
              {assignedBookings === totalBookings
                ? '✓ Komplett'
                : '⚠ Ofullständig'}
            </Badge>
          </span>
        </div>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {fleets.map((fleet, index) => (
          <div
            key={index}
            className="p-3 bg-blue-50 rounded-lg border border-blue-200"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs">
                  {fleet.name}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {fleet.source}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-xs">
                  {fleet.bookingCount} bokningar
                </Badge>
              </div>
            </div>

            <div className="text-xs text-gray-600 space-y-2">
              <div className="flex items-start gap-2">
                <span className="font-medium min-w-fit">📦 Avfallstyp:</span>
                <div className="flex gap-1 flex-wrap">
                  {fleet.recyclingTypes.map((type) => (
                    <Badge
                      key={type}
                      variant="outline"
                      className="px-1 py-0 text-xs"
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-medium min-w-fit">
                  🚛 Fordon ({fleet.vehicles.length}):
                </span>
                <div className="flex gap-1 flex-wrap">
                  {fleet.vehicles.slice(0, 4).map((vehicle) => (
                    <Badge
                      key={vehicle.originalId}
                      variant="outline"
                      className="px-1 py-0 text-xs"
                      title={`${vehicle.description} (${vehicle.type})`}
                    >
                      {vehicle.originalId}
                    </Badge>
                  ))}
                  {fleet.vehicles.length > 4 && (
                    <span className="text-xs text-gray-500">
                      +{fleet.vehicles.length - 4} fler
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-blue-200">
                <span className="font-medium">🏗️ Fordonstyper:</span>
                <span className="text-xs">
                  {(() => {
                    const typeCounts: Record<string, number> = {}
                    fleet.vehicles.forEach((vehicle) => {
                      typeCounts[vehicle.type] =
                        (typeCounts[vehicle.type] || 0) + 1
                    })
                    return Object.entries(typeCounts)
                      .map(([type, count]) => `${count}x ${type}`)
                      .join(', ')
                  })()}
                </span>
              </div>

              {fleet.vehicles.length > 0 && (
                <div className="pt-2 border-t border-blue-200">
                  <span className="font-medium text-xs">
                    📋 Fordonsdetaljer:
                  </span>
                  <div className="mt-1 space-y-2">
                    {fleet.vehicles.map((vehicle) => (
                      <div
                        key={vehicle.originalId}
                        className="text-xs text-gray-500 border-l-2 border-gray-200 pl-2"
                      >
                        <div className="font-medium text-gray-700">
                          {vehicle.originalId}: {vehicle.description}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {vehicle.weight > 0 && `Vikt: ${vehicle.weight}kg`}
                          {vehicle.parcelCapacity > 0 &&
                            ` | Kapacitet: ${vehicle.parcelCapacity}`}
                          {vehicle.usageCount > 0 &&
                            ` | Användning: ${vehicle.usageCount} gånger`}
                        </div>

                        {vehicle.fackDetails &&
                          vehicle.fackDetails.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <span className="font-medium text-xs text-gray-600">
                                🗂️ Fackdetaljer:
                              </span>
                              {vehicle.fackDetails.map((fack) => (
                                <div
                                  key={fack.fackNumber}
                                  className="ml-2 p-1 bg-gray-50 rounded text-xs"
                                >
                                  <div className="font-medium">
                                    Fack {fack.fackNumber}
                                  </div>
                                  {fack.volym && (
                                    <div>Volym: {fack.volym}L</div>
                                  )}
                                  {fack.vikt && <div>Vikt: {fack.vikt}kg</div>}
                                  <div className="mt-1">
                                    {fack.avfallstyper.map((waste, idx) => (
                                      <div
                                        key={idx}
                                        className="text-xs text-gray-600"
                                      >
                                        <span className="font-medium">
                                          {waste.avftyp}
                                        </span>
                                        {waste.volymvikt &&
                                          ` (${waste.volymvikt} kg/m³)`}
                                        {waste.fyllnadsgrad &&
                                          ` - ${waste.fyllnadsgrad}% fyllning`}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface RouteRecord {
  Turid: string
  Datum: string
  Tjtyp: string
  Lat: number
  Lng: number
  Bil: string
  Turordningsnr: string
  Avftyp: string
  [key: string]: any
}

interface FilterCriteria {
  selectedBils?: string[]
  selectedAvftyper?: string[]
  selectedFrekvenser?: string[]
  selectedTjtyper?: string[]
}

export default function FileUploadTab() {
  const [uploadedData, setUploadedData] = useState<RouteRecord[]>([])
  const [originalFilename, setOriginalFilename] = useState<string>('')
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({})
  const [datasetName, setDatasetName] = useState<string>('')
  const [datasetDescription, setDatasetDescription] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  const extractVehicleInfo = (data: RouteRecord[]) => {
    const vehicleMap = new Map<string, any>()

    data.forEach((record) => {
      const vehicleId = record.Bil
      if (!vehicleMap.has(vehicleId)) {
        vehicleMap.set(vehicleId, {
          ID: vehicleId,
          BESKRIVNING: `Bil ${vehicleId}`,
          FACK: [],
        })
      }
    })

    return Array.from(vehicleMap.values())
  }

  const extractAvfallstyperInfo = (data: RouteRecord[]) => {
    const avfallstyperSet = new Set(data.map((r) => r.Avftyp))
    return Array.from(avfallstyperSet).map((typ) => ({
      ID: typ,
      BESKRIVNING: typ,
      VOLYMVIKT: 100,
    }))
  }

  const extractTjtyperInfo = (data: RouteRecord[]) => {
    const tjtypersSet = new Set(data.map((r) => r.Tjtyp))
    return Array.from(tjtypersSet).map((typ) => ({
      ID: typ,
      BESKRIVNING: typ,
      VOLYM: 0,
      FYLLNADSGRAD: 100,
    }))
  }

  const getSettingsForPreview = () => {
    try {
      if (uploadedData.length > 0) {
        const fileContent = localStorage.getItem(
          `fileContent_${originalFilename}`
        )
        if (fileContent) {
          const parsed = JSON.parse(fileContent)
          if (parsed.settings) {
            return parsed.settings
          }
        }

        return {
          avftyper: extractAvfallstyperInfo(uploadedData),
          bilar: extractVehicleInfo(uploadedData),
          tjtyper: extractTjtyperInfo(uploadedData),
        }
      }
    } catch (error) {
      console.warn('Could not extract settings for preview:', error)
    }
    return { avftyper: [], bilar: [], tjtyper: [] }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const rawData = JSON.parse(e.target?.result as string)

        let data: any[] = []
        if (Array.isArray(rawData)) {
          data = rawData
        } else if (rawData.routeData && Array.isArray(rawData.routeData)) {
          data = rawData.routeData
          localStorage.setItem(
            `fileContent_${file.name}`,
            e.target?.result as string
          )
        } else {
          throw new Error('Invalid data format')
        }

        setUploadedData(data)
        setOriginalFilename(file.name)
        setDatasetName(file.name.replace('.json', ''))
        toast.success(`Fil laddad: ${file.name} (${data.length} records)`)
      } catch (error) {
        toast.error(
          'Fel vid läsning av fil. Kontrollera att det är en giltig JSON fil.'
        )
      }
    }
    reader.readAsText(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
    },
    maxFiles: 1,
  })

  const uniqueValues = useMemo(() => {
    if (!uploadedData.length) return {}

    return {
      bils: [...new Set(uploadedData.map((r) => r.Bil))].filter(Boolean),
      avftyper: [...new Set(uploadedData.map((r) => r.Avftyp))].filter(Boolean),
      tjtyper: [...new Set(uploadedData.map((r) => r.Tjtyp))].filter(Boolean),
      dates: [...new Set(uploadedData.map((r) => r.Datum))]
        .filter(Boolean)
        .sort(),
    }
  }, [uploadedData])

  const filteredData = useMemo(() => {
    if (!uploadedData.length) return []

    return uploadedData.filter((record) => {
      if (
        filterCriteria.selectedBils?.length &&
        !filterCriteria.selectedBils.includes(record.Bil)
      ) {
        return false
      }

      if (
        filterCriteria.selectedAvftyper?.length &&
        !filterCriteria.selectedAvftyper.includes(record.Avftyp)
      ) {
        return false
      }

      if (
        filterCriteria.selectedTjtyper?.length &&
        !filterCriteria.selectedTjtyper.includes(record.Tjtyp)
      ) {
        return false
      }

      return true
    })
  }, [uploadedData, filterCriteria])

  const filteredTurids = useMemo(() => {
    return [...new Set(filteredData.map((record) => record.Turid))].sort()
  }, [filteredData])

  const toggleArrayFilter = (
    filterType: 'selectedBils' | 'selectedAvftyper' | 'selectedTjtyper',
    value: string
  ) => {
    setFilterCriteria((prev) => {
      const currentArray = prev[filterType] || []
      const newArray = currentArray.includes(value)
        ? currentArray.filter((item) => item !== value)
        : [...currentArray, value]

      return {
        ...prev,
        [filterType]: newArray,
      }
    })
  }

  const saveDataset = async () => {
    if (!datasetName.trim()) {
      toast.error('Dataset namn krävs')
      return
    }

    if (!filteredData.length) {
      toast.error('Ingen data att spara')
      return
    }

    setIsSaving(true)
    try {
      let originalSettings = null

      if (
        originalFilename.includes('routeMockData') ||
        originalFilename.includes('Mock')
      ) {
        try {
          const fileContent = localStorage.getItem(
            `fileContent_${originalFilename}`
          )
          if (fileContent) {
            const parsed = JSON.parse(fileContent)
            originalSettings = parsed.settings
          }
        } catch (e) {
          console.warn('Kunde inte läsa original settings från localStorage')
        }
      }

      if (!originalSettings) {
        originalSettings = {
          bilar: extractVehicleInfo(uploadedData),
          avftyper: extractAvfallstyperInfo(uploadedData),
          tjtyper: extractTjtyperInfo(uploadedData),
        }
      }

      const fleetData = generateFleetsAndBookings(
        filteredData,
        originalSettings
      )
      const fleetConfiguration = fleetData.fleets

      const result = await saveRouteDataset({
        name: datasetName,
        description: datasetDescription,
        originalFilename,
        filterCriteria,
        routeData: filteredData,
        originalRecordCount: uploadedData.length,
        fleetConfiguration,
        originalSettings,
      })

      if (result.success) {
        toast.success(
          `Dataset sparad: ${datasetName} (${fleetConfiguration.length} fleets)`
        )
        setUploadedData([])
        setDatasetName('')
        setDatasetDescription('')
        setFilterCriteria({})
        setOriginalFilename('')
      } else {
        toast.error(`Fel vid sparning: ${result.error}`)
      }
    } catch (error) {
      console.error('Fel vid sparning av dataset:', error)
      toast.error('Fel vid sparning av dataset')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ladda upp Route Data</CardTitle>
          <CardDescription>
            Ladda upp en JSON fil med route data för filtrering och bearbetning
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
                    Dra och släpp en JSON fil här, eller klicka för att välja
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

      {uploadedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Filtrera Data</CardTitle>
            <CardDescription>
              Använd filtren nedan för att välja specifik data för din
              simulering
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Bilar ({uniqueValues.bils?.length || 0})</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {uniqueValues.bils?.map((bil) => (
                  <Badge
                    key={bil}
                    variant={
                      filterCriteria.selectedBils?.includes(bil)
                        ? 'default'
                        : 'outline'
                    }
                    className="cursor-pointer"
                    onClick={() => toggleArrayFilter('selectedBils', bil)}
                  >
                    {bil}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Avfallstyper ({uniqueValues.avftyper?.length || 0})</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {uniqueValues.avftyper?.map((avftyp) => (
                  <Badge
                    key={avftyp}
                    variant={
                      filterCriteria.selectedAvftyper?.includes(avftyp)
                        ? 'default'
                        : 'outline'
                    }
                    className="cursor-pointer"
                    onClick={() =>
                      toggleArrayFilter('selectedAvftyper', avftyp)
                    }
                  >
                    {avftyp}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Tjänstetyper ({uniqueValues.tjtyper?.length || 0})</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {uniqueValues.tjtyper?.map((tjtyp) => (
                  <Badge
                    key={tjtyp}
                    variant={
                      filterCriteria.selectedTjtyper?.includes(tjtyp)
                        ? 'default'
                        : 'outline'
                    }
                    className="cursor-pointer"
                    onClick={() => toggleArrayFilter('selectedTjtyper', tjtyp)}
                  >
                    {tjtyp}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Filtrerad data: <strong>{filteredData.length}</strong> av{' '}
                <strong>{uploadedData.length}</strong> records
              </p>
            </div>

            {filteredTurids.length > 0 && (
              <div className="mt-4 space-y-3">
                <Label className="text-sm font-medium text-gray-700">
                  Filtrerade Turid ({filteredTurids.length})
                </Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredTurids.map((turid) => {
                    const turidBookings = filteredData.filter(
                      (r) => r.Turid === turid
                    )
                    const totalBookings = uploadedData.filter(
                      (r) => r.Turid === turid
                    ).length
                    const uniqueAvftyper = [
                      ...new Set(turidBookings.map((b) => b.Avftyp)),
                    ]
                    const uniqueBilar = [
                      ...new Set(turidBookings.map((b) => b.Bil)),
                    ]

                    return (
                      <div
                        key={turid}
                        className="p-3 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className="px-2 py-1">
                            {turid}
                          </Badge>
                          <span className="text-xs text-gray-600">
                            {turidBookings.length}/{totalBookings} bokningar
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">🚛 Fordon:</span>
                            <div className="flex gap-1">
                              {uniqueBilar.map((bil) => (
                                <Badge
                                  key={bil}
                                  variant="outline"
                                  className="px-1 py-0 text-xs"
                                >
                                  {bil}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">📦 Avfall:</span>
                            <div className="flex gap-1 flex-wrap">
                              {uniqueAvftyper.slice(0, 4).map((typ) => (
                                <Badge
                                  key={typ}
                                  variant="outline"
                                  className="px-1 py-0 text-xs"
                                >
                                  {typ}
                                </Badge>
                              ))}
                              {uniqueAvftyper.length > 4 && (
                                <span className="text-xs text-gray-500">
                                  +{uniqueAvftyper.length - 4} fler
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {filteredData.length > 0 && (
              <div className="mt-6 space-y-3">
                <Label className="text-sm font-medium text-gray-700">
                  Fleet Preview (Genererade Flottor)
                </Label>
                <FleetPreview
                  routeData={filteredData}
                  settings={getSettingsForPreview()}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {filteredData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Spara Dataset</CardTitle>
            <CardDescription>
              Ge din filtrerade dataset ett namn och beskrivning
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="datasetName">Dataset Namn *</Label>
              <Input
                id="datasetName"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="T.ex. 'Telge Routes Augusti 2024'"
              />
            </div>

            <div>
              <Label htmlFor="datasetDescription">Beskrivning</Label>
              <Textarea
                id="datasetDescription"
                value={datasetDescription}
                onChange={(e) => setDatasetDescription(e.target.value)}
                placeholder="Beskrivning av dataset och filter som tillämpats..."
                rows={3}
              />
            </div>

            <Button
              onClick={saveDataset}
              disabled={!datasetName.trim() || isSaving}
              className="w-full"
            >
              {isSaving ? 'Sparar...' : 'Spara Dataset'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
