import fs from 'fs'
import XLSX from 'xlsx'

export function readXlsx(path: string, sheet: string): any[] {
  const buf = fs.readFileSync(path)
  const wb = XLSX.read(buf, { type: 'buffer' })
  return XLSX.utils.sheet_to_json(wb.Sheets[sheet])
}

export default { readXlsx }

// CJS fallback
// @ts-ignore
if (typeof module !== 'undefined') module.exports = { readXlsx }
