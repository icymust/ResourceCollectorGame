const state = require('./state');
const resources = require('./resources');

function startGame(io) {
  state.setGameStatus('started');
  state.setGamePaused(false);
  state.clearResources();
  state.setRemainingTime(state.getGameTime());

  // Случайные позиции и сброс очков игроков
  const players = state.getPlayers();
  Object.values(players).forEach(p => {
    p.x = Math.floor(Math.random() * 20);
    p.y = Math.floor(Math.random() * 20);
    p.score = 0;
  });

  // Запускаем спавн ресурсов
  resources.startSpawning(io);

  // Отправляем начальное состояние
  io.emit('gameStarted', {
    players: state.getPlayers(),
    resources: state.getResources()
  });
  io.emit('updateTimer', state.getRemainingTime());

  // Запускаем таймер
  startGameTimer(io);
}

function startGameTimer(io) {
  // Очищаем предыдущий таймер
  const existingInterval = state.getGameInterval();
  if (existingInterval) {
    clearInterval(existingInterval);
  }

  const gameInterval = setInterval(() => {
    if (state.isGamePaused()) return;

    const remainingTime = state.getRemainingTime() - 1;
    state.setRemainingTime(remainingTime);
    
    io.emit('updateTimer', remainingTime);
    
    if (remainingTime <= 0) {
      clearInterval(gameInterval);
      state.setGameInterval(null);
      endGameByTimeout(io);
    }
  }, 1000);

  state.setGameInterval(gameInterval);
}

function endGameByTimeout(io) {
  state.setGameStatus('waiting');
  state.setGamePaused(false);
  resources.stopSpawning();

  const players = state.getAllPlayersArray();
  const winner = players.reduce((a, b) => (a.score > b.score ? a : b), { name: 'Nobody', score: 0 });

  io.emit('gameEnded', {
    winner: winner.name,
    score: winner.score
  });

  // Сбрасываем состояние
  state.clearResources();
  state.resetPlayersReady();
}

function endGameByQuit(io, byName) {
  // Останавливаем игру немедленно
  const gameInterval = state.getGameInterval();
  if (gameInterval) {
    clearInterval(gameInterval);
    state.setGameInterval(null);
  }

  state.setGameStatus('waiting');
  state.setGamePaused(false);
  resources.stopSpawning();

  io.emit('gameQuit', { by: byName });

  // Сбрасываем состояние
  state.clearResources();
  state.resetPlayersReady();
}

function togglePause(io, data) {
  state.setGamePaused(data.paused);
  io.emit('togglePause', {
    paused: state.isGamePaused(),
    by: data.by
  });
}

function quitGame(socket, io, data) {
  if (state.getGameStatus() !== 'started') return;
  
  const byName = data.by || 'Unknown';
  endGameByQuit(io, byName);
}

module.exports = {
  startGame,
  endGameByTimeout,
  endGameByQuit,
  togglePause,
  quitGame
};
