import 'dotenv/config'

import { env } from 'process'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import routes from './routes'
import apiRouter from './api'
import experimentsRouter from './routes/http/experiments'
import datasetsRouter from './routes/http/datasets'
import simulationRouter from './routes/http/simulation'
import telgeRouter from './routes/http/telge'
import routingRouter from './routes/http/routing'
import { createIndices } from '../lib/elastic'

const PORT = env.PORT || 4000
const BODY_LIMIT = '50mb'

const app = express()
app.use(cors())
app.use(express.json({ limit: BODY_LIMIT }))
app.use(express.urlencoded({ limit: BODY_LIMIT, extended: true }))

app.use('/api', apiRouter)

app.use('/api', experimentsRouter)
app.use('/api', datasetsRouter)
app.use('/api', simulationRouter)
app.use('/api', telgeRouter)
app.use('/api', routingRouter)

app.get('/', (_req, res) => {
  res.status(200).send('PM Digital Twin Engine. Status: OK')
})

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST'],
  },
})

// Start server after indices are created
;(async () => {
  try {
    await createIndices()
    console.log('Elasticsearch indices ready')
  } catch (err) {
    console.error('Failed to create Elasticsearch indices:', err)
  }

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
  })

  routes.register(io)
})()
