const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { registerSocketHandlers } = require('./server/sockets');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", //ngrok
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
    credentials: true
  },
  allowEIO3: true, //old socket.io
  transports: ['websocket', 'polling']
});

// Middleware ngrok
app.use((req, res, next) => {
  //ngrok
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Логирование запросов для отладки
  if (req.headers['x-forwarded-for'] || req.connection.remoteAddress !== '127.0.0.1') {
    console.log(`🌐 Remote connection from: ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
  }
  
  next();
});

// static files
app.use(express.static(path.join(__dirname, '../public')));

// stat serv
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount
  });
});

//main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

registerSocketHandlers(io);

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server port: ${PORT}`);
  console.log(`Static files: ${path.join(__dirname, '../public')}`);
  console.log(`\nLocal connection`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://127.0.0.1:${PORT}`);
  console.log(`\nwww connection:`);
  console.log(`   ngrok http ${PORT}`);
  console.log(`For automatic startup with ngrok:`);
  console.log(`   npm run dev-tunnel`);
  
  io.on('connection', (socket) => {
    const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    console.log(`New player: ${socket.id} (IP: ${clientIP})`);
    
    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
    });
  });
});

let isShuttingDown = false;

const gracefulShutdown = (signal) => {
  if (isShuttingDown) {
    console.log('Shutdown is already in progress...');
    return;
  }

  isShuttingDown = true;
  console.log(`\nReceived signal ${signal}, shutting down server...`);

  // Set a timeout for forced shutdown
  const forceShutdownTimer = setTimeout(() => {
    console.log('Forced shutdown');
    process.exit(1);
  }, 3000);

  // Notify clients about shutdown
  try {
    io.emit('server_shutdown', { message: 'Server is shutting down' });
  } catch (err) {
    console.log('No clients to notify');
  }

  // Close HTTP server first
  if (server.listening) {
    server.close((err) => {
      clearTimeout(forceShutdownTimer);

      if (err) {
        console.error('Error closing HTTP server:', err);
      } else {
        console.log('HTTP server closed');
      }

      // Close Socket.IO connections
      io.close(() => {
        console.log('Socket.IO server closed');
        console.log('Server stopped successfully');
        process.exit(0);
      });
    });
  } else {
    // If server is not listening, just close Socket.IO
    clearTimeout(forceShutdownTimer);
    io.close(() => {
      console.log('Socket.IO server closed');
      console.log('Server stopped successfully');
      process.exit(0);
    });
  }
};

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled promise rejection:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
