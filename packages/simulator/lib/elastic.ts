export {}

const elastic = require('@elastic/elasticsearch')
const mappings = require('../data/elasticsearch_mappings.json')
const { error, info } = require('./log')

const host = process.env.ELASTICSEARCH_URL

let save: any = () => undefined
let createIndices: any = () => undefined
let search: any = () => undefined

if (!host) {
  info('No elasticsearch url provided, skipping statistics collection')
  const noOp = (name: string) => () => {
    // info(`noOp: ${name}`)
  }
  save = noOp('save')
  createIndices = noOp('createIndices')
  search = noOp('search')
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

  save = async (document: any, id: any, index: any) => {
    try {
      const result = await client.index({
        index,
        id,
        body: document,
      })
      return result
    } catch (err: any) {
      console.error(`Error saving document to ${index}:`, err)
      throw err
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
}

export { createIndices, save, search }
