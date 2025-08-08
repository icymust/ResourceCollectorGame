const socket = io();
let paused = false;       // Глобальная пауза
let playerName = '';      // Имя текущего игрока
let mySocketId = '';      // ID текущего сокета
let currentHostId = '';   // ID хоста

const statusIndicator = document.getElementById('status-indicator');
const lobby = document.getElementById('lobby');
const playerList = document.getElementById('player-list');
const nameInput = document.getElementById('name-input');
const colorPicker = document.getElementById('color-picker');
const readyBtn = document.getElementById('ready-btn');
const startGameBtn = document.getElementById('start-game-btn');
const gameContainer = document.getElementById('game-container');
const board = document.getElementById('game-board');
const scoreboard = document.getElementById('scoreboard');
const pauseOverlay = document.getElementById('pause-overlay');
const timerDisplay = document.getElementById('timer');

// ⚡ Индикатор подключения
socket.on('connect', () => {
  updateStatus('connected');
  mySocketId = socket.id;
});
socket.on('disconnect', () => updateStatus('disconnected'));
socket.io.on('reconnect_attempt', () => updateStatus('connecting'));

function updateStatus(status) {
  if (status === 'connected') {
    statusIndicator.style.background = '#43b581';
    statusIndicator.title = 'Connected';
  } else if (status === 'connecting') {
    statusIndicator.style.background = '#faa61a';
    statusIndicator.title = 'Reconnecting...';
  } else {
    statusIndicator.style.background = '#f04747';
    statusIndicator.title = 'Disconnected';
  }
}

// 🎨 Отправляем цвет сразу при выборе
colorPicker.addEventListener('input', () => {
  const name = nameInput.value.trim();
  const color = colorPicker.value;
  if (name.length > 0) {
    socket.emit('setPlayerInfo', { name, color });
  }
});

// ✅ Готов
readyBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  const color = colorPicker.value;
  if (name.length === 0) {
    alert("Please enter your name");
    return;
  }
  playerName = name;
  socket.emit('setPlayerInfo', { name, color }, (response) => {
    if (response.success) {
      socket.emit('setReady');
      readyBtn.disabled = true;
      readyBtn.textContent = "⏳ Waiting for others...";
    } else {
      alert(response.message); // Например: "Это имя уже используется"
    }
  });
});

// 🏁 Хост запускает игру
startGameBtn.addEventListener('click', () => {
  socket.emit('startGame');
});

// 🛋️ Лобби
socket.on('updateLobby', (data) => {
  const players = data.players;
  currentHostId = data.hostId;

  lobby.style.display = 'block';
  gameContainer.style.display = 'none';
  pauseOverlay.style.display = 'none';
  paused = false;

  // Очистка списка игроков
  playerList.innerHTML = '';
  players.forEach(player => {
    const isHost = player.id === currentHostId;
    const li = document.createElement('li');
    li.innerHTML = `
      <span style="display:inline-block; width:16px; height:16px; background:${player.color}; border:1px solid #000; margin-right:5px;"></span>
      ${player.name} ${isHost ? '<span style="color:gold;">(Host)</span>' : ''}
      - ${player.ready ? '<span style="color:green;">✅ Ready</span>' : '<span style="color:red;">❌ Not ready</span>'}
    `;
    playerList.appendChild(li);
  });

  // 👀 Проверяем готовность всех
  const allReady = players.length > 0 && players.every(p => p.ready);

  // ⚡ Показываем кнопку Start Game только у хоста
  if (mySocketId === currentHostId) {
    startGameBtn.style.display = allReady ? 'inline-block' : 'none';
  } else {
    startGameBtn.style.display = 'none'; // У не-хостов кнопки нет
  }
});

// ▶️ Старт игры
socket.on('gameStarted', (data) => {
  lobby.style.display = 'none';
  gameContainer.style.display = 'block';
  pauseOverlay.style.display = 'none';
  paused = false;

  board.innerHTML = '';
  for (let i = 0; i < 400; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    board.appendChild(cell);
  }

  updatePlayers(data.players);
  updateResources(data.resources);
});

// 👥 Обновляем игроков
socket.on('updatePlayers', (players) => {
  updatePlayers(players);
});

function updatePlayers(players) {
  document.querySelectorAll('.cell').forEach(cell => {
    cell.classList.remove('player');
    cell.style.backgroundColor = '';
  });
  Object.values(players).forEach(player => {
    const index = player.y * 20 + player.x;
    const cell = board.children[index];
    if (cell) {
      cell.classList.add('player');
      cell.style.backgroundColor = player.color;
      cell.title = player.name;
    }
  });

  scoreboard.innerHTML = '<b>Scores:</b><br>' +
    Object.values(players)
      .map(p => `
        <span style="display:inline-block;
                     width:14px;
                     height:14px;
                     background:${p.color};
                     border:1px solid #000;
                     margin-right:5px;"></span>
        ${p.name}: ${p.score}
      `)
      .join('<br>');
}

// 💰 Ресурсы
socket.on('updateResources', (resources) => {
  if (paused) return;
  updateResources(resources);
});

function updateResources(resources) {
  document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('resource'));
  resources.forEach(res => {
    const index = res.y * 20 + res.x;
    const cell = board.children[index];
    if (cell) cell.classList.add('resource');
  });
}

// ⏱ Таймер
socket.on('updateTimer', (time) => {
  timerDisplay.textContent = `Time: ${time}`;
});

// 🏁 Конец игры
socket.on('gameEnded', (data) => {
  alert(`🏆 Game Over! Winner: ${data.winner} with ${data.score} points!`);
  location.reload();
});

// ⏸ Глобальная пауза
socket.on('togglePause', (data) => {
  paused = data.paused;
  pauseOverlay.style.display = 'flex';
  pauseOverlay.textContent = paused
    ? `⏸ Paused by ${data.by}`
    : `▶️ Resumed by ${data.by}`;
  if (!paused) {
    setTimeout(() => pauseOverlay.style.display = 'none', 1000);
  }
});

// ⌨ Управление
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // ⏸ Пауза
  if (e.key === 'Escape') {
    socket.emit('togglePause', { paused: !paused, by: playerName });
    return;
  }

  if (paused) return;

  let direction = null;
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') direction = 'left';
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') direction = 'right';
  if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') direction = 'up';
  if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') direction = 'down';
  if (direction) {
    e.preventDefault();
    socket.emit('move', direction);
  }
});
