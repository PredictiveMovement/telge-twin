import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const cacheDir = path.join(__dirname, '../.cache')

// Ensure cache directory exists
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir)
}

function createHash(object: unknown): string {
  const hash = crypto.createHash('sha1')
  hash.update(JSON.stringify(object))
  return hash.digest('hex')
}

export async function getFromCache<T = unknown>(
  object: unknown
): Promise<T | null> {
  const hash = createHash(object)
  const filePath = path.join(cacheDir, hash)

  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          resolve(null)
        } else {
          reject(err)
        }
      } else {
        resolve(JSON.parse(data) as T)
      }
    })
  })
}

export async function updateCache<T = unknown>(
  object: unknown,
  result: T
): Promise<T> {
  const hash = createHash(object)
  const filePath = path.join(cacheDir, hash)

  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, JSON.stringify(result), 'utf8', (err) => {
      if (err) {
        reject(err)
      } else {
        resolve(result)
      }
    })
  })
}

export default {
  getFromCache,
  updateCache,
}

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = {
    getFromCache,
    updateCache,
  }
}
