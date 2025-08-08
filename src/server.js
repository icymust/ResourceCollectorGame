const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { registerSocketHandlers } = require('./server/sockets');

// Создаем Express приложение
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Статические файлы
app.use(express.static(path.join(__dirname, '../public')));

// Регистрируем обработчики сокетов
registerSocketHandlers(io);

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
  console.log(`📁 Статические файлы: ${path.join(__dirname, '../public')}`);
  console.log(`🎮 Модульная архитектура загружена`);
});
