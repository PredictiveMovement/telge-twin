import fs from 'fs'
import parse from 'csv-parse/lib/sync'

export function readCsv(path: string): Record<string, string>[] {
  const input = fs.readFileSync(path)
  return parse(input, {
    columns: true,
    skip_empty_lines: true,
  })
}

export default { readCsv }

// CJS fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = { readCsv }
