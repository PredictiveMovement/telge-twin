// Simple preboot script that ensures Elasticsearch indices exist before starting.
// Can be executed with ts-node or compiled.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const elastic = require('./lib/elastic') as { createIndices: () => void }

elastic.createIndices()
