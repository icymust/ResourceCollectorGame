document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // --- Состояние клиента ---
  let paused = false;
  let playerName = '';
  let mySocketId = '';
  let currentHostId = '';
  let currentGameTime = 60;

  // ---- Рендер-пайплайн ----
  const GRID_COLS = 20;
  let pending = { players: null, resources: null };
  let scheduled = false;

  const prevPlayerIndex = new Map(); // id -> индекс клетки (y*20 + x)
  const resourceSet = new Set();     // "x,y" для быстрого сравнения

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      renderFrame();
    });
  }

  function renderFrame() {
    // Игроки: только дифф позиций
    if (pending.players) {
      // снять прошлые позиции
      for (const [id, oldIdx] of prevPlayerIndex) {
        const oldCell = board.children[oldIdx];
        if (oldCell) {
          oldCell.classList.remove('player');
          oldCell.style.backgroundColor = '';
          oldCell.title = '';
        }
      }
      prevPlayerIndex.clear();

      // поставить новые
      Object.values(pending.players).forEach(p => {
        const idx = p.y * GRID_COLS + p.x;
        const cell = board.children[idx];
        if (cell) {
          cell.classList.add('player');
          cell.style.backgroundColor = p.color;
          cell.title = p.name;
          prevPlayerIndex.set(p.id, idx);
        }
      });

      // табло (одним innerHTML за кадр)
      scoreboard.innerHTML = '<b>Scores:</b><br>' +
        Object.values(pending.players)
          .map(p => `
            <span style="display:inline-block;width:14px;height:14px;background:${p.color};border:1px solid #000;margin-right:5px;"></span>
            ${p.name}: ${p.score}
          `).join('<br>');

      pending.players = null; // отрисовали — сбросили
    }

    // Ресурсы: дифф по множеству
    if (pending.resources) {
      // убрать отсутствующие
      const nextSet = new Set(pending.resources.map(r => `${r.x},${r.y}`));
      if (resourceSet.size) {
        for (const key of resourceSet) {
          if (!nextSet.has(key)) {
            const [x, y] = key.split(',').map(Number);
            const idx = y * GRID_COLS + x;
            const cell = board.children[idx];
            if (cell) cell.classList.remove('resource');
          }
        }
      }
      // добавить новые
      for (const key of nextSet) {
        if (!resourceSet.has(key)) {
          const [x, y] = key.split(',').map(Number);
          const idx = y * GRID_COLS + x;
          const cell = board.children[idx];
          if (cell) cell.classList.add('resource');
        }
      }
      resourceSet.clear();
      nextSet.forEach(k => resourceSet.add(k));
      pending.resources = null;
    }
  }

  // ---- FPS overlay (диагностика) ----
  let frames = 0, fps = 0, lastFpsTs = performance.now();
  const fpsEl = document.createElement('div');
  fpsEl.style.cssText = 'position:fixed;left:8px;bottom:8px;background:rgba(0,0,0,.6);color:#0f0;padding:4px 6px;border-radius:4px;font:12px/1 monospace;z-index:9999';
  fpsEl.textContent = 'FPS: --';
  document.body.appendChild(fpsEl);

  (function fpsLoop(ts) {
    frames++;
    if (ts - lastFpsTs >= 1000) {
      fps = frames; frames = 0; lastFpsTs = ts;
      fpsEl.textContent = 'FPS: ' + fps;
    }
    requestAnimationFrame(fpsLoop);
  })(performance.now());

  // --- DOM ---
  const statusIndicator = document.getElementById('status-indicator');
  const lobby = document.getElementById('lobby');
  const playerList = document.getElementById('player-list');
  const hostControls = document.getElementById('host-controls');
  const roundMinutesInput = document.getElementById('round-minutes'); // если используешь минуты/сек
  const roundSecondsInput = document.getElementById('round-seconds'); // см. ниже: если у тебя одно поле — просто убери минуты
  const nameInput = document.getElementById('name-input');
  const colorPicker = document.getElementById('color-picker');
  const readyBtn = document.getElementById('ready-btn');
  const startGameBtn = document.getElementById('start-game-btn');
  const gameContainer = document.getElementById('game-container');
  const board = document.getElementById('game-board');
  const scoreboard = document.getElementById('scoreboard');
  const pauseOverlay = document.getElementById('pause-overlay');
  const timerDisplay = document.getElementById('timer');
  
  // Quit modal elements
  const quitBtn = document.getElementById('quit-btn');
  const quitModal = document.getElementById('quit-modal');
  const quitYes = document.getElementById('quit-yes');
  const quitNo = document.getElementById('quit-no');

  // Флаг, чтобы Esc не "мигал" модалкой
  let quitPromptOpen = false;

  // Функции для работы с модальным окном выхода
  function openQuitModal() {
    if (quitPromptOpen) return;
    quitPromptOpen = true;
    quitModal.style.display = 'flex';
  }
  
  function closeQuitModal() {
    quitPromptOpen = false;
    quitModal.style.display = 'none';
  }

  // Обработчики для кнопок модального окна
  quitBtn.addEventListener('click', openQuitModal);
  quitNo.addEventListener('click', closeQuitModal);
  quitYes.addEventListener('click', () => {
    closeQuitModal();
    socket.emit('quitGame', { by: playerName || 'Unknown' });
  });

  // Если у тебя пока один `<input type="number" id="round-seconds">` без минут — можешь удалить roundMinutesInput и функцию ниже.

  // ==== Сеть ====
  socket.on('connect', () => {
    mySocketId = socket.id;
    updateStatus('connected');
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

  // Цвет сразу отправляем (если имя введено)
  colorPicker.addEventListener('input', () => {
    const name = nameInput.value.trim();
    const color = colorPicker.value;
    if (name.length > 0) socket.emit('setPlayerInfo', { name, color });
  });

  // Готов
  readyBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const color = colorPicker.value;
    if (!name) { alert('Please enter your name'); return; }
    playerName = name;
    socket.emit('setPlayerInfo', { name, color }, (res) => {
      if (res.success) {
        socket.emit('setReady');
        readyBtn.disabled = true;
        readyBtn.textContent = '⏳ Waiting for others...';
      } else {
        alert(res.message);
      }
    });
  });

  // Хост меняет время.
  // Вариант А: минуты+секунды
  if (roundMinutesInput && roundSecondsInput) {
    const sendGameTime = () => {
      const m = Number(roundMinutesInput.value) || 0;
      const s = Number(roundSecondsInput.value) || 0;
      let total = m * 60 + s;
      if (total < 15) total = 15;
      socket.emit('setGameTime', total);
    };
    roundMinutesInput.addEventListener('change', sendGameTime);
    roundSecondsInput.addEventListener('change', sendGameTime);
  } else if (roundSecondsInput) {
    // Вариант B: одно поле секунд
    roundSecondsInput.addEventListener('change', () => {
      const val = Number(roundSecondsInput.value);
      if (Number.isFinite(val)) socket.emit('setGameTime', val);
    });
  }

  // Хост запускает
  startGameBtn.addEventListener('click', () => socket.emit('startGame'));

  // Лобби
  socket.on('updateLobby', (data) => {
    const players = data.players;
    currentHostId = data.hostId;
    currentGameTime = data.gameTime ?? currentGameTime;

    lobby.style.display = 'block';
    gameContainer.style.display = 'none';
    pauseOverlay.style.display = 'none';
    paused = false;

    // Возврат в лобби — кнопку скрываем и модалку закрываем
    quitBtn.style.display = 'none';
    closeQuitModal();

    const iAmHost = mySocketId === currentHostId;
    if (hostControls) hostControls.style.display = iAmHost ? 'block' : 'none';

    // синхронизация инпутов времени
    if (roundMinutesInput && roundSecondsInput) {
      const mins = Math.floor(currentGameTime / 60);
      const secs = currentGameTime % 60;
      roundMinutesInput.value = mins;
      roundSecondsInput.value = secs;
    } else if (roundSecondsInput) {
      roundSecondsInput.value = currentGameTime;
    }

    playerList.innerHTML = '';
    players.forEach((p) => {
      const isHost = p.id === currentHostId;
      const li = document.createElement('li');
      li.innerHTML = `
        <span style="display:inline-block;width:16px;height:16px;background:${p.color};border:1px solid #000;margin-right:5px;"></span>
        ${p.name} ${isHost ? '👑<span style="color:gold;">(Host)</span>' : ''}
        - ${p.ready ? '<span style="color:green;">✅ Ready</span>' : '<span style="color:red;">❌ Not ready</span>'}
      `;
      playerList.appendChild(li);
    });

    const allReady = players.length > 0 && players.every(p => p.ready);
    startGameBtn.style.display = (iAmHost && allReady) ? 'inline-block' : 'none';
  });

  // Старт
  socket.on('gameStarted', (data) => {
    lobby.style.display = 'none';
    gameContainer.style.display = 'block';
    pauseOverlay.style.display = 'none';
    paused = false;

    // Показывать кнопку Quit только во время игры
    quitBtn.style.display = 'inline-block';

    board.innerHTML = '';
    for (let i = 0; i < 400; i++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      board.appendChild(cell);
    }

    // Используем новый рендер-пайплайн
    pending.players = data.players;
    pending.resources = data.resources;
    scheduleRender();
  });

  // Игроки
  socket.on('updatePlayers', (players) => {
    pending.players = players;
    scheduleRender();
  });

  // Ресурсы
  socket.on('updateResources', (resources) => {
    if (paused) return;

    // Сначала очистим все клетки от ресурсов (чтобы не оставались хвосты)
    document.querySelectorAll('.cell.resource').forEach(cell => {
      cell.classList.remove('resource');
      cell.style.backgroundColor = '';
      cell.textContent = '';   // убираем символ
    });

    // Теперь выставим актуальные ресурсы
    resources.forEach(res => {
      const idx = res.y * 20 + res.x;
      const cell = board.children[idx];
      if (cell) {
        cell.classList.add('resource');
        cell.style.backgroundColor = res.color || '';
        cell.textContent = res.symbol || ''; // 💰 ⚡ 🔥
        // опционально всплывашка
        cell.title = `${res.type} +${res.points}`;
      }
    });
  });


  // Таймер
  socket.on('updateTimer', (time) => {
    // отобразим в формате mm:ss
    const mm = String(Math.floor(time / 60)).padStart(2, '0');
    const ss = String(time % 60).padStart(2, '0');
    timerDisplay.textContent = `Time: ${mm}:${ss}`;
  });

  // Конец по таймеру
  socket.on('gameEnded', (data) => {
    alert(`🏆 Game Over! Winner: ${data.winner} with ${data.score} points!`);
    location.reload();
  });

  // Конец по выходу (Esc)
  socket.on('gameQuit', ({ by }) => {
    alert(`⛔ Game was ended by ${by}`);
    location.reload();
  });

  // Пауза (теперь на P/p)
  socket.on('togglePause', (data) => {
    paused = data.paused;
    pauseOverlay.style.display = 'flex';
    pauseOverlay.textContent = paused
      ? `⏸ Paused by ${data.by}`
      : `▶️ Resumed by ${data.by}`;
    if (!paused) setTimeout(() => (pauseOverlay.style.display = 'none'), 1000);
  });

  // Управление: P/p — пауза, Esc — открывает модалку выхода (без confirm)
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const k = e.key.toLowerCase();

    // Выход (Esc) - только открываем модалку
    if (k === 'escape') {
      // Только открываем, не закрываем — чтобы Esc не закрывал её тут же
      openQuitModal();
      e.preventDefault();
      return;
    }

    // Пауза (P/p)
    if (k === 'p') {
      socket.emit('togglePause', { paused: !paused, by: playerName || 'Unknown' });
      return;
    }

    if (paused || quitPromptOpen) return;

    // Движение
    let direction = null;
    if (k === 'arrowleft' || k === 'a') direction = 'left';
    if (k === 'arrowright' || k === 'd') direction = 'right';
    if (k === 'arrowup' || k === 'w') direction = 'up';
    if (k === 'arrowdown' || k === 's') direction = 'down';

    if (direction) {
      e.preventDefault();
      socket.emit('move', direction);
    }
  });
});
