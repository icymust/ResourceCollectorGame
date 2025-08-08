const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../public')));

// ==== Игровые переменные ====
let players = {};
let resources = [];
let gameStatus = 'waiting'; // 'waiting' | 'started'
let gamePaused = false;     // глобальная пауза
let gameTime = 60;          // длительность раунда (сек)
let gameInterval = null;
let remainingTime = 0;

// ==== Вспомогательные ====
function getCurrentHostId() {
  return Object.keys(players)[0];
}

// Типы ресурсов
const RESOURCE_TYPES = [
  { type: 'gold',   points: 3, rarity: 0.10, color: '#FFD700', symbol: '💰' },
  { type: 'silver', points: 2, rarity: 0.20, color: '#C0C0C0', symbol: '⚡' },
  { type: 'bronze', points: 1, rarity: 0.70, color: '#CD7F32', symbol: '🔥' },
];

function spawnResource() {
  if (gameStatus !== 'started' || gamePaused) return;

  // Взвешенный выбор по rarity
  const r = Math.random();
  let acc = 0;
  let selected = RESOURCE_TYPES[RESOURCE_TYPES.length - 1];
  for (const t of RESOURCE_TYPES) {
    acc += t.rarity;
    if (r <= acc) { selected = t; break; }
  }

  // Не спавнить поверх игрока/другого ресурса (до 20 попыток)
  for (let tries = 0; tries < 20; tries++) {
    const x = Math.floor(Math.random() * 20);
    const y = Math.floor(Math.random() * 20);

    const occupiedByPlayer = Object.values(players).some(p => p.x === x && p.y === y);
    const occupiedByResource = resources.some(res => res.x === x && res.y === y);
    if (occupiedByPlayer || occupiedByResource) continue;

    const resource = { x, y, type: selected.type, points: selected.points, color: selected.color, symbol: selected.symbol };
    resources.push(resource);
    io.emit('updateResources', resources);
    return;
  }
}

setInterval(spawnResource, 5000);

function startGame() {
  gameStatus = 'started';
  gamePaused = false;
  resources = [];
  remainingTime = gameTime;

  Object.values(players).forEach(p => {
    p.x = Math.floor(Math.random() * 20);
    p.y = Math.floor(Math.random() * 20);
    p.score = 0;
  });

  io.emit('gameStarted', { players, resources });
  io.emit('updateTimer', remainingTime);

  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    if (gamePaused) return;
    remainingTime--;
    io.emit('updateTimer', remainingTime);
    if (remainingTime <= 0) {
      clearInterval(gameInterval);
      endGameByTimeout();
    }
  }, 1000);
}

function endGameByTimeout() {
  gameStatus = 'waiting';
  gamePaused = false;

  const winner = Object.values(players)
    .reduce((a, b) => (a.score > b.score ? a : b), { name: 'Nobody', score: 0 });

  io.emit('gameEnded', { winner: winner.name, score: winner.score });
  resources = [];
  Object.values(players).forEach(p => { p.ready = false; });
}

function endGameByQuit(byName) {
  // Останавливаем игру немедленно и сообщаем всем, кто завершил
  if (gameInterval) clearInterval(gameInterval);
  gameStatus = 'waiting';
  gamePaused = false;
  io.emit('gameQuit', { by: byName });
  resources = [];
  Object.values(players).forEach(p => { p.ready = false; });
}

// ==== Сокеты ====
io.on('connection', (socket) => {
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
    hostId: getCurrentHostId(),
    gameTime
  });

  socket.on('setPlayerInfo', ({ name, color }, callback) => {
    const nameTaken = Object.values(players).some(p => p.name === name && p.id !== socket.id);
    if (nameTaken) {
      callback && callback({ success: false, message: 'Это имя уже используется' });
      return;
    }
    if (players[socket.id]) {
      players[socket.id].name = name;
      players[socket.id].color = color;
    }
    io.emit('updateLobby', {
      players: Object.values(players),
      hostId: getCurrentHostId(),
      gameTime
    });
    callback && callback({ success: true });
  });

  socket.on('setReady', () => {
    if (players[socket.id]) players[socket.id].ready = true;
    io.emit('updateLobby', {
      players: Object.values(players),
      hostId: getCurrentHostId(),
      gameTime
    });
  });

  // Хост задаёт время раунда (в секундах)
  socket.on('setGameTime', (seconds) => {
    const hostId = getCurrentHostId();
    if (socket.id !== hostId) return;
    if (gameStatus !== 'waiting') return;
    const s = Number(seconds);
    if (!Number.isFinite(s)) return;
    const clamped = Math.max(15, Math.min(900, Math.round(s)));
    gameTime = clamped;
    io.emit('updateLobby', {
      players: Object.values(players),
      hostId: getCurrentHostId(),
      gameTime
    });
  });

  // Старт (только хост, все готовы)
  socket.on('startGame', () => {
    const hostId = getCurrentHostId();
    if (socket.id !== hostId) return;
    const allReady = Object.values(players).length > 0 &&
                     Object.values(players).every(p => p.ready);
    if (!allReady) return;
    startGame();
  });

  // Движение
  socket.on('move', (direction) => {
    if (gameStatus !== 'started' || gamePaused) return;
    const p = players[socket.id];
    if (!p) return;

    if (direction === 'left') p.x = (p.x - 1 + 20) % 20;
    if (direction === 'right') p.x = (p.x + 1) % 20;
    if (direction === 'up') p.y = (p.y - 1 + 20) % 20;
    if (direction === 'down') p.y = (p.y + 1) % 20;

    // Сбор ресурса (учитываем points)
    resources = resources.filter((res) => {
      if (res.x === p.x && res.y === p.y) {
        p.score += (res.points || 1);
        return false; // удалить собранный
      }
      return true;
    });

    io.emit('updatePlayers', players); // передаем всех игроков
    io.emit('updateResources', resources); // передаем все ресурсы
  });

  // Пауза (глобально)
  socket.on('togglePause', (data) => {
    gamePaused = data.paused;
    io.emit('togglePause', { paused: gamePaused, by: data.by });
  });

  // Выход (Esc -> подтверждение на клиенте -> сюда)
  socket.on('quitGame', ({ by }) => {
    if (gameStatus !== 'started') return;
    endGameByQuit(by || 'Unknown');
  });

  socket.on('disconnect', () => {
    delete players[socket.id];

    if (Object.keys(players).length === 0) {
      gameStatus = 'waiting';
      resources = [];
      gamePaused = false;
      if (gameInterval) clearInterval(gameInterval);
    }

    io.emit('updateLobby', {
      players: Object.values(players),
      hostId: getCurrentHostId(),
      gameTime
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});
