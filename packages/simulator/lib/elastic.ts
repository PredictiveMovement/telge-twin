export {}

const elastic = require('@elastic/elasticsearch')
const fs = require('fs')
const path = require('path')

// Resolve mappings file both in source tree and compiled dist (no copy step needed)
const mappingCandidates = [
  path.resolve(__dirname, '..', 'data', 'elasticsearch_mappings.json'),
  path.resolve(process.cwd(), 'data', 'elasticsearch_mappings.json'),
  path.resolve(process.cwd(), 'packages', 'simulator', 'data', 'elasticsearch_mappings.json'),
]
const mappingsPath = mappingCandidates.find((p) => fs.existsSync(p))
if (!mappingsPath) {
  throw new Error('Cannot locate elasticsearch_mappings.json')
}
const mappings = require(mappingsPath)
const { error, info } = require('./log')

const host = process.env.ELASTICSEARCH_URL

let save: any = () => undefined
let createIndices: any = () => undefined
let search: any = () => undefined
let update: any = () => undefined

if (!host) {
  info('No elasticsearch url provided, skipping statistics collection')
  const noOp = (name: string) => () => {
    // info(`noOp: ${name}`)
  }
  save = noOp('save')
  createIndices = noOp('createIndices')
  search = noOp('search')
  update = noOp('update')
} else {
  info(`Elasticsearch url provided, collecting statistics to ${host}`)
  const client = new elastic.Client({ node: host, log: 'error' })

  createIndices = () =>
    Promise.all(
      Object.keys(mappings).map((index) => {
        return client.indices
          .create({
            index,
            body: mappings[index],
          })
          .catch((err: any) => {
            const errorType = err?.meta?.body?.error?.type
            if (errorType === 'resource_already_exists_exception') {
              info(`Index ${index} already exists, skipping creation`)
              return
            }
            error('>>>= Cannot create indices, Unknown Elasticsearch Error', err)
          })
      })
    )

  save = async (
    document: any,
    id: any,
    index: any,
    versionInfo?: number | { seqNo: number; primaryTerm: number }
  ) => {
    try {
      const params: any = {
        index,
        id,
        body: document,
      }

      // Handle both old version number and new seqNo/primaryTerm format
      if (versionInfo !== undefined) {
        if (typeof versionInfo === 'number') {
          // Legacy version number support
          params.if_seq_no = versionInfo
          params.if_primary_term = 1
        } else if (versionInfo && typeof versionInfo === 'object') {
          // New seqNo/primaryTerm format
          params.if_seq_no = versionInfo.seqNo
          params.if_primary_term = versionInfo.primaryTerm
        }
      }

      const result = await client.index(params)
      return result
    } catch (err: any) {
      // Check for version conflict
      if (
        err.statusCode === 409 ||
        err.body?.error?.type === 'version_conflict_engine_exception'
      ) {
        const versionStr =
          typeof versionInfo === 'object'
            ? `seq_no:${versionInfo.seqNo}, primary_term:${versionInfo.primaryTerm}`
            : `version:${versionInfo}`
        info(
          `Version conflict when saving to ${index} with id ${id} (${versionStr})`
        )
        return null // Indicate version conflict
      }

      throw err
    }
  }

  update = async (index: any, id: any, updateScript: any, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await client.update({
          index,
          id,
          body: updateScript,
          retry_on_conflict: 3,
        })
        return result
      } catch (err: any) {
        if (attempt === retries) {
          throw err
        }
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt))
      }
    }
  }

  search = (searchQuery: any) => {
    return client.search(searchQuery)
  }
}

module.exports = {
  createIndices,
  save,
  search,
  update,
}

export { createIndices, save, search, update }
