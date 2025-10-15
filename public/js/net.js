import { state, setMyId, setConnected, setPaused, setPlayers, setResources } from './state.js';
import { updatePlayers, updateResources, showBombExplosion } from './render.js';
import { updateLobby, updateTimer, showGameEnded, showGameQuit, showPauseOverlay, playEndSound, playStartSound } from './ui.js';
import { audioManager } from './audio.js';

let socket = null;

export function connect() {
  socket = io();
  
  socket.on('connect', () => {
    setMyId(socket.id);
    setConnected(true);
    updateStatus('connected');
  });
  
  socket.on('disconnect', () => {
    setConnected(false);
    updateStatus('disconnected');
  });
  
  socket.io.on('reconnect_attempt', () => {
    updateStatus('connecting');
  });

  socket.on('updateLobby', (data) => {
  const queueEl = document.getElementById('queue-container');
  if (queueEl) queueEl.style.display = 'none';
    updateLobby(data);
  });

  socket.on('gameStarted', (data) => {
  const queueEl = document.getElementById('queue-container');
  if (queueEl) queueEl.style.display = 'none';
    playStartSound();
    setPlayers(data.players);
    setResources(data.resources);
    updatePlayers(data.players);
    updateResources(data.resources);
    
    const lobby = document.getElementById('lobby');
    const gameContainer = document.getElementById('game-container');
    const pauseOverlay = document.getElementById('pause-overlay');
    const quitBtn = document.getElementById('quit-btn');
    
    lobby.style.display = 'none';
    gameContainer.style.display = 'block';
    pauseOverlay.style.display = 'none';
    quitBtn.style.display = 'inline-block';
  });

  // queue updates for players not in current round
  socket.on('updateQueue', (data) => {
    const lobby = document.getElementById('lobby');
    const gameContainer = document.getElementById('game-container');
    let queueEl = document.getElementById('queue-container');
    if (!queueEl) {
      queueEl = document.createElement('div');
      queueEl.id = 'queue-container';
      queueEl.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;';
      document.body.appendChild(queueEl);
    }
    lobby.style.display = 'none';
    gameContainer.style.display = 'none';
    queueEl.style.display = 'flex';
    const names = (data.queue || []).map(p => p.name || 'Player').join(', ');
    queueEl.textContent = `Waiting room (${data.count}): ${names}`;
  });

  socket.on('updatePlayers', (players) => {
    setPlayers(players);
    updatePlayers(players);
  });

  socket.on('updateResources', (resources) => {
    setResources(resources);
    updateResources(resources);
  });

  socket.on('resourceCollected', () => {
    audioManager.play('coin-pickup');
  });

  socket.on('bombExplosion', (data) => {
    showBombExplosion(data.x, data.y);
  });

  socket.on('updateTimer', (time) => {
    updateTimer(time);
  });

  socket.on('gameEnded', (data) => {
    playEndSound()
    showGameEnded(data);
  });

  socket.on('gameQuit', (data) => {
    showGameQuit(data);
  });

  socket.on('togglePause', (data) => {
    setPaused(data.paused);
    showPauseOverlay(data);
  });

    socket.on('alert', (err) => {
    alert(err.message);
    })
}

function updateStatus(status) {
  const statusIndicator = document.getElementById('status-indicator');
  if (!statusIndicator) return;
  
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

export const emitMove = (direction) => socket.emit('move', direction);
export const emitPause = (paused, by) => socket.emit('togglePause', { paused, by });
export const emitQuit = (by) => socket.emit('quitGame', { by });
export const emitReady = () => socket.emit('setReady');
export const emitStart = () => socket.emit('startGame');
export const emitSetGameTime = (seconds) => socket.emit('setGameTime', seconds);
export const emitSetPlayerInfo = (info, callback) => socket.emit('setPlayerInfo', info, callback);
export const emitRestart = () => socket.emit('restartGame');
