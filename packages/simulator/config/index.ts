import path from 'path'
import fs from 'fs'

const dataDir = process.env.CACHE_DIR || path.join(__dirname, '..', 'config')
const paramsFileName = 'parameters.json'

export interface Parameters {
  emitters?: string[]
  fleets?: Record<string, any>
  [key: string]: any
}

export function save(value: Parameters): Parameters {
  const file = path.join(dataDir, paramsFileName)
  fs.writeFileSync(file, JSON.stringify(value, null, 2))
  return value
}

export function read(): Parameters {
  const file = path.join(dataDir, paramsFileName)
  try {
    const result = JSON.parse(fs.readFileSync(file, 'utf8'))
    return result
  } catch (e) {
    const defaultConfig = {
      emitters: ['bookings', 'cars'],
      fleets: {
        'Södertälje kommun': {
          settings: { optimizedRoutes: true },
          fleets: [],
        },
      },
    }
    return save(defaultConfig)
  }
}

export const emitters = (): string[] => read().emitters || []
export const municipalities = (): string[] => Object.keys(read().fleets || {})

export default { emitters, municipalities, read, save }

// CJS fallback
// @ts-ignore
if (typeof module !== 'undefined')
  module.exports = { emitters, municipalities, read, save }
