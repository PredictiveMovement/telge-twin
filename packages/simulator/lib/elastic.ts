export {}

const elastic = require('@elastic/elasticsearch')
const mappings = require('../data/elasticsearch_mappings.json')
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
            let errorType
            try {
              errorType = JSON.parse(err.response)?.error?.type
            } catch (e) {
              error(
                '>>>= Cannot create indices, Malformed Elasticsearch Error',
                e,
                err
              )
            }
            if (errorType === 'resource_already_exists_exception') {
              error(
                `\n            Index ${index} already mapped.\n            If you want to re-map it:\n            - Delete it in Elasticsearch\n            - Re-run this script\n            - Recreate \"index pattern\" in kibana.\n          `
              )
            } else {
              error(
                '>>>= Cannot create indices, Unkown Elasticsearch Error',
                err
              )
            }
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
