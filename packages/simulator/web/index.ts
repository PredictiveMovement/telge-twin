import 'dotenv/config'

import { env } from 'process'
import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'

// Importing CommonJS module
// eslint-disable-next-line @typescript-eslint/no-var-requires
const routes = require('./routes')

const port = env.PORT || 4000

const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (_req: any, _file: any, cb: any) {
    cb(null, uploadsDir)
  },
  filename: function (_req: any, file: any, cb: any) {
    cb(null, file.originalname)
  },
})

const upload = multer({ storage })

const app = express()
app.use(cors())
app.use(express.json())

app.post('/api/upload', upload.single('file'), (req: any, res) => {
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
  res.writeHead(200)
  res.end('PM Digital Twin Engine. Status: OK')
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
