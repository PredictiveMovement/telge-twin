import 'dotenv/config'

import { env } from 'process'
import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import routes from './routes'
import { search } from '../lib/elastic'

const port = env.PORT || 4000

const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (
    _req: unknown,
    _file: Express.Multer.File,
    cb: (err: Error | null, destination: string) => void
  ) {
    cb(null, uploadsDir)
  },
  filename: function (
    _req: unknown,
    file: Express.Multer.File,
    cb: (err: Error | null, filename: string) => void
  ) {
    cb(null, file.originalname)
  },
})

const upload = multer({ storage })

const app = express()
app.use(cors())
app.use(express.json())

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' })
  }

  return res.json({
    success: true,
    message: 'File uploaded successfully',
    filename: req.file.originalname,
  })
})

app.use('/uploads', express.static(uploadsDir))

// Default response for other routes
app.get('/', (_req, res) => {
  res.status(200).send('PM Digital Twin Engine. Status: OK')
})

app.get('/api/experiments', async (req, res) => {
  try {
    const searchResult = await search({
      index: 'vroom-plans',
      body: {
        query: {
          match_all: {},
        },
        _source: ['planId', 'timestamp'],
        sort: [
          {
            timestamp: {
              order: 'desc',
            },
          },
        ],
        size: 100,
      },
    })

    const experiments =
      searchResult?.body?.hits?.hits?.map((hit: any) => ({
        id: hit._source.planId,
        timestamp: hit._source.timestamp,
        documentId: hit._id,
      })) || []

    res.json({ success: true, data: experiments })
  } catch (error) {
    console.error('Error fetching experiments:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(500).json({ success: false, error: errorMessage })
  }
})

app.get('/api/experiments/:planId', async (req, res) => {
  try {
    const { planId } = req.params
    const searchResult = await search({
      index: 'vroom-plans',
      body: {
        query: {
          term: { planId: planId },
        },
      },
    })

    if (searchResult?.body?.hits?.hits?.length > 0) {
      const planData = searchResult.body.hits.hits[0]._source
      res.json({ success: true, data: planData })
    } else {
      res.status(404).json({ success: false, error: 'Plan not found' })
    }
  } catch (error) {
    console.error('Error fetching plan by ID:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(500).json({ success: false, error: errorMessage })
  }
})

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST'],
  },
})

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

routes.register(io)
