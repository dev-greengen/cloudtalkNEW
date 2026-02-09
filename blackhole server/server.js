import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3065;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const CHAT_LOG = path.join(__dirname, 'chat.log');

// Create uploads directory
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const audioTypes = /audio|mp3|wav|ogg|m4a|webm|opus/;
    const audioExtensions = /\.(mp3|wav|ogg|m4a|webm|opus)$/i;
    
    if (audioTypes.test(file.mimetype) || audioExtensions.test(file.originalname)) {
      console.log('Accepting audio file:', file.originalname, 'mimetype:', file.mimetype);
      cb(null, true);
    } else {
      console.log('Rejecting file:', file.originalname, 'mimetype:', file.mimetype);
      cb(new Error('Only audio files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(express.json());
app.use(express.static('public'));

// Log chat messages
function logMessage(message) {
  const logEntry = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(CHAT_LOG, logEntry);
  console.log(logEntry.trim());
}

// Terminal chat interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logMessage(`User connected: ${socket.id}`);
  
  socket.on('chat-message', (data) => {
    const message = {
      id: Date.now(),
      user: data.user || 'Anonymous',
      text: data.text,
      timestamp: new Date().toISOString(),
      socketId: socket.id
    };
    
    logMessage(`[${message.user}]: ${message.text}`);
    io.emit('chat-message', message);
  });
  
  socket.on('audio-message', (data) => {
    const message = {
      id: Date.now(),
      user: data.user || 'Anonymous',
      audioUrl: data.audioUrl,
      filename: data.filename,
      timestamp: new Date().toISOString(),
      socketId: socket.id
    };
    
    logMessage(`[${message.user}] sent audio: ${data.filename}`);
    io.emit('audio-message', message);
  });
  
  socket.on('disconnect', () => {
    logMessage(`User disconnected: ${socket.id}`);
  });
});

// API endpoint to upload audio
app.post('/upload-audio', upload.single('audio'), (req, res) => {
  console.log('Audio upload request received');
  console.log('File:', req.file);
  console.log('Body:', req.body);
  
  if (!req.file) {
    console.error('No file in request');
    return res.status(400).json({ error: 'No audio file uploaded' });
  }
  
  const audioUrl = `/uploads/${req.file.filename}`;
  const text = req.body.text || '';
  
  console.log('Audio uploaded successfully:', req.file.filename, 'Size:', req.file.size, 'bytes');
  logMessage(`Audio uploaded: ${req.file.filename} (${req.file.size} bytes)${text ? ` with text: ${text}` : ''}`);
  
  // Broadcast to all connected clients
  const audioMessage = {
    id: Date.now(),
    user: req.body.user || 'Anonymous',
    audioUrl,
    filename: req.file.originalname,
    text: text,
    timestamp: new Date().toISOString()
  };
  
  console.log('Broadcasting audio message:', audioMessage);
  io.emit('audio-message', audioMessage);
  
  res.json({ 
    success: true, 
    audioUrl,
    filename: req.file.originalname,
    size: req.file.size
  });
});

// Serve uploaded files
app.use('/uploads', express.static(UPLOAD_DIR));

// Get chat history
app.get('/chat-history', (req, res) => {
  if (fs.existsSync(CHAT_LOG)) {
    const history = fs.readFileSync(CHAT_LOG, 'utf8');
    res.json({ history: history.split('\n').filter(line => line.trim()) });
  } else {
    res.json({ history: [] });
  }
});

// Terminal input handler
function handleTerminalInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return;
  
  if (trimmed === '/exit' || trimmed === '/quit') {
    logMessage('Shutting down server...');
    process.exit(0);
  }
  
  if (trimmed === '/clear') {
    if (fs.existsSync(CHAT_LOG)) {
      fs.writeFileSync(CHAT_LOG, '');
    }
    console.log('Chat log cleared');
    return;
  }
  
  if (trimmed.startsWith('/help')) {
    console.log(`
Commands:
  /exit or /quit - Shutdown server
  /clear - Clear chat log
  /help - Show this help
  Type any message to broadcast to all connected clients
    `);
    return;
  }
  
  // Broadcast message to all clients
  const message = {
    id: Date.now(),
    user: 'Server',
    text: trimmed,
    timestamp: new Date().toISOString(),
    socketId: 'terminal'
  };
  
  logMessage(`[Server]: ${trimmed}`);
  io.emit('chat-message', message);
}

rl.on('line', handleTerminalInput);

// Start server
httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   BLACKHOLE SERVER - Terminal Chat   ║
╚══════════════════════════════════════╝

Server running on port ${PORT}
WebSocket: ws://localhost:${PORT}
HTTP API: http://localhost:${PORT}

Type messages here to broadcast to all clients.
Commands: /help, /clear, /exit

Waiting for connections...
  `);
  logMessage('Blackhole server started');
});

// Graceful shutdown
process.on('SIGINT', () => {
  logMessage('Shutting down...');
  rl.close();
  httpServer.close(() => {
    process.exit(0);
  });
});

