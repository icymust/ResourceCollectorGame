const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../public')));

// Игровые переменные
let players = {};
let resources = [];
let gameStatus = 'waiting'; // waiting | started
let gamePaused = false;     // глобальная пауза
let gameTime = 60;          // продолжительность раунда
let gameInterval = null;    // интервал таймера
let remainingTime = 0;

// Спавн ресурса каждые 5 сек
function spawnResource() {
  if (gameStatus !== 'started' || gamePaused) return;
  const resource = {
    x: Math.floor(Math.random() * 20),
    y: Math.floor(Math.random() * 20)
  };
  resources.push(resource);
  io.emit('updateResources', resources);
}

setInterval(spawnResource, 5000);

// 👑 Определение текущего хоста
function getCurrentHostId() {
  return Object.keys(players)[0];
}

// 🏁 Старт игры
function startGame() {
  gameStatus = 'started';
  gamePaused = false;
  resources = [];
  remainingTime = gameTime;

  // Расставляем игроков
  Object.values(players).forEach(player => {
    player.x = Math.floor(Math.random() * 20);
    player.y = Math.floor(Math.random() * 20);
    player.score = 0;
  });

  io.emit('gameStarted', {
    players,
    resources
  });

  io.emit('updateTimer', remainingTime);

  if (gameInterval) clearInterval(gameInterval);

  // ⏱ Запуск таймера
  gameInterval = setInterval(() => {
    if (gamePaused) return;

    remainingTime--;
    io.emit('updateTimer', remainingTime);

    if (remainingTime <= 0) {
      clearInterval(gameInterval);
      endGame();
    }
  }, 1000);
}

// 🏆 Завершение игры
function endGame() {
  gameStatus = 'waiting';
  gamePaused = false;

  // Определяем победителя
  const winner = Object.values(players).reduce((a, b) => (a.score > b.score ? a : b), { name:'Nobody', score:0 });
  io.emit('gameEnded', { winner: winner.name, score: winner.score });

  // Сброс для нового раунда
  resources = [];
  Object.values(players).forEach(p => { p.ready = false; });
}

io.on('connection', (socket) => {
  console.log('🔌 Игрок подключился: ' + socket.id);

  players[socket.id] = {
    id: socket.id,
    name: '',
    color: '',
    x: 0,
    y: 0,
    score: 0,
    ready: false
  };

  io.emit('updateLobby', {
    players: Object.values(players),
    hostId: getCurrentHostId()
  });

  // 📥 Установка имени и цвета
  socket.on('setPlayerInfo', ({ name, color }, callback) => {
    const nameTaken = Object.values(players).some(p => p.name === name && p.id !== socket.id);
    if (nameTaken) {
      if (callback) callback({ success: false, message: 'Это имя уже используется' });
      return;
    }

    if (players[socket.id]) {
      players[socket.id].name = name;
      players[socket.id].color = color;
    }

    io.emit('updateLobby', {
      players: Object.values(players),
      hostId: getCurrentHostId()
    });

    if (callback) callback({ success: true });
  });

  // ✅ Готовность игрока
  socket.on('setReady', () => {
    if (players[socket.id]) {
      players[socket.id].ready = true;
    }
    io.emit('updateLobby', {
      players: Object.values(players),
      hostId: getCurrentHostId()
    });
  });

  // 🏁 Старт игры (только хост)
  socket.on('startGame', () => {
    const hostId = getCurrentHostId();
    if (socket.id !== hostId) return;

    const allReady = Object.values(players).length > 0 && Object.values(players).every(p => p.ready);
    if (!allReady) return;

    startGame();
  });

  // 🎮 Движение
  socket.on('move', (direction) => {
    if (gameStatus !== 'started' || gamePaused) return;
    const player = players[socket.id];
    if (!player) return;

    if (direction === 'left') player.x = (player.x - 1 + 20) % 20;
    if (direction === 'right') player.x = (player.x + 1) % 20;
    if (direction === 'up') player.y = (player.y - 1 + 20) % 20;
    if (direction === 'down') player.y = (player.y + 1) % 20;

    // Сбор ресурса
    resources = resources.filter((res) => {
      if (res.x === player.x && res.y === player.y) {
        player.score += 1;
        return false;
      }
      return true;
    });

    io.emit('updatePlayers', players);
    io.emit('updateResources', resources);
  });

  // ⏸ Глобальная пауза
  socket.on('togglePause', (data) => {
    gamePaused = data.paused;
    io.emit('togglePause', { paused: gamePaused, by: data.by });
  });

  // ❌ Отключение
  socket.on('disconnect', () => {
    console.log('❌ Игрок отключился: ' + socket.id);
    delete players[socket.id];

    if (Object.keys(players).length === 0) {
      gameStatus = 'waiting';
      resources = [];
      gamePaused = false;
      if (gameInterval) clearInterval(gameInterval);
    }

    io.emit('updateLobby', {
      players: Object.values(players),
      hostId: getCurrentHostId()
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});
