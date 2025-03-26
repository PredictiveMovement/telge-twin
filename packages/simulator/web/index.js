require('dotenv').config()

const { env } = require('process')
const routes = require('./routes')
const port = env.PORT || 4000
const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const cors = require('cors')

const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  },
})

const upload = multer({ storage: storage })

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
app.get('/', (req, res) => {
  res.writeHead(200)
  res.end('PM Digital Twin Engine. Status: OK')
})

const server = require('http').createServer(app)

const io = require('socket.io')(server, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST'],
  },
})

server.listen(port)
routes.register(io)

console.log(`Server running on port ${port}`)
