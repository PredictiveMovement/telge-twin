export interface OriginalBookingData {
  originalTurid?: string
  originalKundnr?: number
  originalHsnr?: number
  originalTjnr?: number
  originalAvftyp?: string
  originalTjtyp?: string
  originalFrekvens?: string
  originalDatum?: string
  originalBil?: string
  originalSchemalagd?: number
  originalDec?: string
  originalTurordningsnr?: number
  originalHsadress?: string
  originalNyckelkod?: string
  originalRouteRecord?: any
}

/**
 * Extracts original booking data from a source object.
 * @param source - The source object to extract original booking data from.
 * @returns The original booking data.
 */

export function extractOriginalData(source: any): OriginalBookingData {
  if (!source) return {}

  return {
    originalTurid: source.originalTurid || source.Turid,
    originalKundnr: source.originalKundnr || source.Kundnr,
    originalHsnr: source.originalHsnr || source.Hsnr,
    originalTjnr: source.originalTjnr || source.Tjnr,
    originalAvftyp: source.originalAvftyp || source.Avftyp,
    originalTjtyp: source.originalTjtyp || source.Tjtyp,
    originalFrekvens: source.originalFrekvens || source.Frekvens,
    originalDatum: source.originalDatum || source.Datum,
    originalBil: source.originalBil || source.Bil,
    originalSchemalagd: source.originalSchemalagd || source.Schemalagd,
    originalDec: source.originalDec || source.Dec,
    originalTurordningsnr: source.originalTurordningsnr || source.Turordningsnr,
    originalHsadress: source.originalHsadress || source.Hsadress,
    originalNyckelkod: source.originalNyckelkod || source.Nyckelkod,
    originalRouteRecord:
      source.originalRecord ||
      source.originalRouteRecord ||
      (source.Turid ? source : undefined),
  }
}
