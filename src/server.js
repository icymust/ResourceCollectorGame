const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { registerSocketHandlers } = require('./server/sockets');

// Создаем Express приложение
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Разрешаем все источники для ngrok
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
    credentials: true
  },
  allowEIO3: true, // Поддержка старых версий socket.io
  transports: ['websocket', 'polling'] // Поддержка разных транспортов
});

// Middleware для поддержки ngrok
app.use((req, res, next) => {
  // Добавляем заголовки для работы с ngrok
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Логирование запросов для отладки
  if (req.headers['x-forwarded-for'] || req.connection.remoteAddress !== '127.0.0.1') {
    console.log(`🌐 Remote connection from: ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
  }
  
  next();
});

// Статические файлы
app.use(express.static(path.join(__dirname, '../public')));

// Роут для проверки статуса сервера
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount
  });
});

// Главная страница (если нужно)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Регистрируем обработчики сокетов
registerSocketHandlers(io);

// Определяем порт
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📁 Статические файлы: ${path.join(__dirname, '../public')}`);
  console.log(`🎮 Модульная архитектура загружена`);
  console.log(`\n📱 Локальные подключения:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://127.0.0.1:${PORT}`);
  console.log(`\n🌐 Для удаленного доступа запустите:`);
  console.log(`   ngrok http ${PORT}`);
  console.log(`\n💡 Для автоматического запуска с ngrok:`);
  console.log(`   npm run dev-tunnel`);
  
  // Логирование подключений
  io.on('connection', (socket) => {
    const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    console.log(`👤 Новое подключение: ${socket.id} (IP: ${clientIP})`);
    
    socket.on('disconnect', () => {
      console.log(`👋 Отключение: ${socket.id}`);
    });
  });
});

// Обработка ошибок
process.on('uncaughtException', (err) => {
  console.error('❌ Необработанная ошибка:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необработанное отклонение промиса:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Получен сигнал SIGTERM, завершение сервера...');
  server.close(() => {
    console.log('✅ Сервер успешно остановлен');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Получен сигнал SIGINT, завершение сервера...');
  server.close(() => {
    console.log('✅ Сервер успешно остановлен');
    process.exit(0);
  });
});
