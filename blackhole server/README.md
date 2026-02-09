# Blackhole Server - Terminal Chat with Audio

A terminal-based chat server with audio support.

## Features

- Terminal chat interface
- Real-time messaging via WebSocket
- Audio file upload and playback
- Chat log file
- Web interface for clients

## Installation

```bash
npm install
```

## Usage

Start the server:
```bash
npm start
```

The server will:
- Run on port 3001 (or PORT env variable)
- Accept terminal input for broadcasting messages
- Serve web interface at http://localhost:3001
- Store audio uploads in `uploads/` folder
- Log all chat messages to `chat.log`

## Commands

- Type any message to broadcast to all clients
- `/help` - Show help
- `/clear` - Clear chat log
- `/exit` or `/quit` - Shutdown server

## Web Interface

Open http://localhost:3001 in your browser to use the web chat interface.

## API

- `POST /upload-audio` - Upload audio file
- `GET /chat-history` - Get chat history
- WebSocket: Real-time chat and audio messages

