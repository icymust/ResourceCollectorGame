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

// Флаг для предотвращения множественного завершения
let isShuttingDown = false;

// Функция для graceful shutdown
const gracefulShutdown = (signal) => {
  if (isShuttingDown) {
    console.log('⚠️ Завершение уже в процессе...');
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n🛑 Получен сигнал ${signal}, завершение сервера...`);
  
  // Устанавливаем таймаут для принудительного завершения
  const forceShutdownTimer = setTimeout(() => {
    console.log('⚠️ Принудительное завершение');
    process.exit(1);
  }, 3000);
  
  // Уведомляем клиентов о завершении работы
  try {
    io.emit('server_shutdown', { message: 'Сервер завершает работу' });
  } catch (err) {
    console.log('Клиентов для уведомления нет');
  }
  
  // Закрываем HTTP сервер сначала
  if (server.listening) {
    server.close((err) => {
      clearTimeout(forceShutdownTimer);
      
      if (err) {
        console.error('❌ Ошибка при закрытии HTTP сервера:', err);
      } else {
        console.log('✅ HTTP сервер закрыт');
      }
      
      // Закрываем Socket.IO соединения
      io.close(() => {
        console.log('✅ Socket.IO сервер закрыт');
        console.log('✅ Сервер успешно остановлен');
        process.exit(0);
      });
    });
  } else {
    // Если сервер уже не слушает, просто закрываем Socket.IO
    clearTimeout(forceShutdownTimer);
    io.close(() => {
      console.log('✅ Socket.IO сервер закрыт');
      console.log('✅ Сервер успешно остановлен');
      process.exit(0);
    });
  }
};

// Обработка ошибок
process.on('uncaughtException', (err) => {
  console.error('❌ Необработанная ошибка:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необработанное отклонение промиса:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Обработка сигналов завершения
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
