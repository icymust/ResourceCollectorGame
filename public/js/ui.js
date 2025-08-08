import { state, setPlayerName, setHostId, setGameTime, setQuitModalOpen } from './state.js';
import * as net from './net.js';

let lobby = null;
let playerList = null;
let hostControls = null;
let roundMinutesInput = null;
let roundSecondsInput = null;
let nameInput = null;
let colorPicker = null;
let readyBtn = null;
let startGameBtn = null;
let gameContainer = null;
let pauseOverlay = null;
let timerDisplay = null;
let quitBtn = null;
let quitModal = null;
let quitYes = null;
let quitNo = null;
let helpBtn = null;
let helpModal = null;
let helpClose = null;

export function bindUI() {
  // Получаем DOM элементы
  lobby = document.getElementById('lobby');
  playerList = document.getElementById('player-list');
  hostControls = document.getElementById('host-controls');
  roundMinutesInput = document.getElementById('round-minutes');
  roundSecondsInput = document.getElementById('round-seconds');
  nameInput = document.getElementById('name-input');
  colorPicker = document.getElementById('color-picker');
  readyBtn = document.getElementById('ready-btn');
  startGameBtn = document.getElementById('start-game-btn');
  gameContainer = document.getElementById('game-container');
  pauseOverlay = document.getElementById('pause-overlay');
  timerDisplay = document.getElementById('timer');
  quitBtn = document.getElementById('quit-btn');
  quitModal = document.getElementById('quit-modal');
  quitYes = document.getElementById('quit-yes');
  quitNo = document.getElementById('quit-no');
  helpBtn = document.getElementById('help-btn');
  helpModal = document.getElementById('help-modal');
  helpClose = document.getElementById('help-close');

  // Привязываем обработчики
  setupColorPicker();
  setupReadyButton();
  setupGameTimeInputs();
  setupStartButton();
  setupQuitModal();
  setupHelpModal();
}

function setupColorPicker() {
  colorPicker.addEventListener('input', () => {
    const name = nameInput.value.trim();
    const color = colorPicker.value;
    if (name.length > 0) {
      net.emitSetPlayerInfo({ name, color });
    }
  });
}

function setupReadyButton() {
  readyBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const color = colorPicker.value;
    if (!name) {
      alert('Please enter your name');
      return;
    }
    setPlayerName(name);
    net.emitSetPlayerInfo({ name, color }, (res) => {
      if (res.success) {
        net.emitReady();
        readyBtn.disabled = true;
        readyBtn.textContent = '⏳ Waiting for others...';
      } else {
        alert(res.message);
      }
    });
  });
}

function setupGameTimeInputs() {
  const sendGameTime = () => {
    const minutes = Number(roundMinutesInput.value) || 0;
    const seconds = Number(roundSecondsInput.value) || 0;
    let total = minutes * 60 + seconds;
    if (total < 15) total = 15;
    net.emitSetGameTime(total);
  };

  roundMinutesInput.addEventListener('change', sendGameTime);
  roundSecondsInput.addEventListener('change', sendGameTime);
}

function setupStartButton() {
  startGameBtn.addEventListener('click', () => {
    net.emitStart();
  });
}

function setupQuitModal() {
  quitBtn.addEventListener('click', openQuitModal);
  quitNo.addEventListener('click', closeQuitModal);
  quitYes.addEventListener('click', () => {
    closeQuitModal();
    net.emitQuit(state.playerName || 'Unknown');
  });
}

function setupHelpModal() {
  helpBtn.addEventListener('click', toggleHelpModal);
  helpClose.addEventListener('click', closeHelpModal);
  
  // Закрытие по клику вне модального окна
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      closeHelpModal();
    }
  });
  
  // Закрытие по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal.style.display === 'flex') {
      closeHelpModal();
    }
  });
}

function toggleHelpModal() {
  if (helpModal.style.display === 'flex') {
    closeHelpModal();
  } else {
    openHelpModal();
  }
}

function openHelpModal() {
  helpModal.style.display = 'flex';
  helpBtn.textContent = '×';
  helpBtn.classList.add('close');
  helpBtn.title = 'Close Help';
  document.body.style.overflow = 'hidden'; // Предотвращаем скролл фона
}

function closeHelpModal() {
  helpModal.style.display = 'none';
  helpBtn.textContent = '?';
  helpBtn.classList.remove('close');
  helpBtn.title = 'Help & Instructions';
  document.body.style.overflow = 'hidden'; // Оставляем скролл заблокированным
}

export function openQuitModal() {
  if (state.quitModalOpen) return;
  setQuitModalOpen(true);
  quitModal.style.display = 'flex';
}

export function closeQuitModal() {
  setQuitModalOpen(false);
  quitModal.style.display = 'none';
}

// Функция для создания карточки игрока
function createPlayerCard(player) {
  return `
    <div class="player-card ${player.ready ? 'ready' : ''} ${player.isHost ? 'host' : ''}" data-id="${player.id}">
      <div class="player-info">
        <div class="player-color" style="background-color: ${player.color}"></div>
        <div class="player-details">
          <h4>${player.name}</h4>
          <div class="player-status ${player.ready ? 'status-ready' : 'status-waiting'}">
            ${player.ready ? '✅ Ready' : '⏳ Waiting'}
            ${player.isHost ? ' • Host' : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Обновление списка игроков
function updatePlayersList(players) {
  const playersGrid = document.getElementById('players-grid');
  const playerCount = document.querySelector('.player-count');
  
  playersGrid.innerHTML = players.map(createPlayerCard).join('');
  playerCount.textContent = `${players.length}/4`;
}

export function updateLobby(data) {
  const players = data.players;
  setHostId(data.hostId);
  setGameTime(data.gameTime ?? state.gameTime);

  // Показать лобби, скрыть игру
  lobby.style.display = 'block';
  gameContainer.style.display = 'none';
  pauseOverlay.style.display = 'none';
  quitBtn.style.display = 'none';
  closeQuitModal();

  // Панель хоста
  const iAmHost = state.myId === data.hostId;
  if (hostControls) {
    hostControls.style.display = iAmHost ? 'block' : 'none';
  }

  // Обновляем поля времени
  if (roundMinutesInput && roundSecondsInput) {
    const mins = Math.floor(state.gameTime / 60);
    const secs = state.gameTime % 60;
    roundMinutesInput.value = mins;
    roundSecondsInput.value = secs;
  }

  // Обновляем карточки игроков
  const playersWithHostInfo = players.map(p => ({
    ...p,
    isHost: p.id === data.hostId
  }));
  updatePlayersList(playersWithHostInfo);

  // Кнопка старта
  const allReady = players.length > 0 && players.every(p => p.ready);
  startGameBtn.style.display = (iAmHost && allReady) ? 'inline-block' : 'none';
}

export function showGameStarted() {
  lobby.style.display = 'none';
  gameContainer.style.display = 'block';
  pauseOverlay.style.display = 'none';
  quitBtn.style.display = 'inline-block';
}

export function updateTimer(time) {
  const mm = String(Math.floor(time / 60)).padStart(2, '0');
  const ss = String(time % 60).padStart(2, '0');
  timerDisplay.textContent = `Time: ${mm}:${ss}`;
}

export function showGameEnded(data) {
  alert(`🏆 Game Over! Winner: ${data.winner} with ${data.score} points!`);
  location.reload();
}

export function showGameQuit(data) {
  alert(`⛔ Game was ended by ${data.by}`);
  location.reload();
}

export function showPauseOverlay(data) {
  pauseOverlay.style.display = 'flex';
  pauseOverlay.textContent = data.paused
    ? `⏸ Paused by ${data.by}`
    : `▶️ Resumed by ${data.by}`;
  if (!data.paused) {
    setTimeout(() => (pauseOverlay.style.display = 'none'), 1000);
  }
}
