const state = require("./state");
const resources = require("./resources");

function startGame(io) {
  state.setGameStatus("started");
  state.setGamePaused(false);
  state.clearResources();
  state.setRemainingTime(state.getGameTime());

  // random pos , score 0
  const players = state.getPlayers();
  Object.values(players).forEach((p) => {
    p.x = Math.floor(Math.random() * 20);
    p.y = Math.floor(Math.random() * 20);
    p.score = 0;
    p.inGame = true; // mark as active participant
  });

  resources.startSpawning(io);

  io.emit("gameStarted", {
    players: Object.fromEntries(
      Object.entries(state.getPlayers()).filter(([, p]) => p.inGame)
    ),
    resources: state.getResources(),
  });
  io.emit("updateTimer", state.getRemainingTime());

  // update queue view for those not in game
  const waiting = state.getAllPlayersArray().filter(p => !p.inGame);
  for (const w of waiting) {
    io.to(w.id).emit('updateQueue', {
      queue: waiting.map(q => ({ id: q.id, name: q.name, color: q.color })),
      count: waiting.length
    });
  }

  startGameTimer(io);
}

function startGameTimer(io) {
  const existingInterval = state.getGameInterval();
  if (existingInterval) {
    clearInterval(existingInterval);
  }

  const gameInterval = setInterval(() => {
    if (state.isGamePaused()) return;

    const remainingTime = state.getRemainingTime() - 1;
    state.setRemainingTime(remainingTime);

    io.emit("updateTimer", remainingTime);

    if (remainingTime <= 0) {
      clearInterval(gameInterval);
      state.setGameInterval(null);
      endGameByTimeout(io);
    }
  }, 1000);

  state.setGameInterval(gameInterval);
}

function endGameByTimeout(io) {
  state.setGameStatus("waiting");
  state.setGamePaused(false);
  resources.stopSpawning();

  const players = state.getAllPlayersArray().filter(p => p.inGame);
  if (players.length === 0) {
    io.emit("gameEnded", { winner: "Nobody", score: 0 });
  } else {
    const maxScore = Math.max(...players.map((p) => p.score));
    const winners = players.filter((p) => p.score === maxScore);
    let winnersNames = "Nobody";
    for (let i = 0; i < winners.length; i++) {
      if (i === 0) {
        winnersNames = winners[0].name;
      } else {
        winnersNames += " and " + winners[i].name;
      }
    }
    io.emit("gameEnded", {
      winner: winnersNames,
      score: maxScore,
    });
  }

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

  state.setGameStatus("waiting");
  state.setGamePaused(false);
  resources.stopSpawning();

  io.emit("gameQuit", { by: byName });

  // Сбрасываем состояние
  state.clearResources();
  state.resetPlayersReady();
}

function togglePause(io, data) {
  state.setGamePaused(data.paused);
  io.emit("togglePause", {
    paused: state.isGamePaused(),
    by: data.by,
  });
}

function quitGame(socket, io, data) {
  // Player leaves current round, goes to lobby; game continues if >=2 remain
  const players = state.getPlayers();
  const player = players[socket.id];
  if (!player) return;

  // mark as not in game
  player.inGame = false;
  player.ready = false;

  // notify others about updated active players only
  const activePlayersObj = Object.fromEntries(
    Object.entries(players).filter(([, p]) => p.inGame)
  );
  io.emit("updatePlayers", activePlayersObj);

  // send lobby view only to quitter
  const lobby = require("./lobby");
  const waiting = state.getAllPlayersArray().filter(p => !p.inGame);
  socket.emit('updateQueue', {
    queue: waiting.map(q => ({ id: q.id, name: q.name, color: q.color })),
    count: waiting.length
  });

  // If less than 2 active players remain, end the game
  const activeCount = Object.values(players).filter((p) => p.inGame).length;
  if (activeCount < 2 && state.getGameStatus() === "started") {
    endGameByTimeout(io);
  }
}

module.exports = {
  startGame,
  endGameByTimeout,
  endGameByQuit,
  togglePause,
  quitGame,
};

function restartGame(io) {
  const existing = state.getGameInterval();
  if (existing) {
    clearInterval(existing);
    state.setGameInterval(null);
  }

  resources.stopSpawning();

  state.setGameStatus("started");
  state.setGamePaused(false);
  state.clearResources();
  state.setRemainingTime(state.getGameTime());

  const players = state.getPlayers();
  Object.values(players).forEach((p) => {
    p.x = Math.floor(Math.random() * 20);
    p.y = Math.floor(Math.random() * 20);
    p.score = 0;
    p.ready = true;
    p.inGame = true; // re-include all connected players in new round
  });

  resources.startSpawning(io);

  io.emit("gameStarted", {
    players: Object.fromEntries(
      Object.entries(state.getPlayers()).filter(([, p]) => p.inGame)
    ),
    resources: state.getResources(),
  });
  io.emit("updateTimer", state.getRemainingTime());

  startGameTimer(io);
}

module.exports.restartGame = restartGame;
