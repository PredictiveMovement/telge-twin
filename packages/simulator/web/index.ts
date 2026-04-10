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
import optimizationRouter from './routes/http/optimization'
import { createIndices } from '../lib/elastic'
import { requireAuth, verifyToken, isAuthConfigured } from './middleware/requireAuth'

const PORT = env.PORT || 4000
const BODY_LIMIT = '50mb'

const app = express()
const ALLOWED_ORIGINS = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000']

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}))
app.use(express.json({ limit: BODY_LIMIT }))
app.use(express.urlencoded({ limit: BODY_LIMIT, extended: true }))

app.use('/api', requireAuth)
app.use('/api', apiRouter)

app.use('/api', experimentsRouter)
app.use('/api', datasetsRouter)
app.use('/api', simulationRouter)
app.use('/api', telgeRouter)
app.use('/api', optimizationRouter)

app.get('/', (_req, res) => {
  res.status(200).send('PM Digital Twin Engine. Status: OK')
})

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST'],
  },
})

io.use(async (socket, next) => {
  if (!isAuthConfigured) return next()

  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('Missing token'))

  try {
    await verifyToken(token)
    next()
  } catch {
    next(new Error('Invalid or expired token'))
  }
})

// Start server after indices are created
;(async () => {
  try {
    await createIndices()
    console.log('Elasticsearch indices ready')
  } catch (err) {
    console.error('Failed to create Elasticsearch indices:', err)
  }

  if (!isAuthConfigured) {
    console.warn('[auth] Azure AD not configured — all requests are unauthenticated')
  }

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
  })

  routes.register(io)
})()
