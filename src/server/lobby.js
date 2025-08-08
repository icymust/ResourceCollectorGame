const state = require("./state");

function joinPlayer(socket, io) {
  const playerId = socket.id;

  const playerData = {
    id: playerId,
    name: "",
    color: "#ffffffff",
    x: 0,
    y: 0,
    score: 0,
    ready: false,
  };

  state.addPlayer(playerId, playerData);
  broadcastLobby(io);
}

function leavePlayer(socket, io) {
  const playerId = socket.id;
  state.removePlayer(playerId);

  // Если игроков не осталось, сбрасываем игру
  if (state.getPlayerCount() === 0) {
    resetGameState();
  }

  broadcastLobby(io);
}

function setPlayerInfo(socket, { name, color }, callback, io) {
  const playerId = socket.id;
  const players = state.getPlayers();

  // Проверяем уникальность имени
  const nameTaken = Object.values(players).some(
    (p) => p.name === name && p.id !== playerId
  );

  if (nameTaken) {
    if (callback)
      callback({ success: false, message: "Это имя уже используется" });
    return;
  }

  const player = state.getPlayer(playerId);
  if (player) {
    player.name = name;
    player.color = color;
  }

  broadcastLobby(io);
  if (callback) callback({ success: true });
}

function setPlayerReady(socket, io) {
  const playerId = socket.id;
  const player = state.getPlayer(playerId);

  if (player) {
    player.ready = true;
  }

  broadcastLobby(io);
}

function setGameTime(socket, seconds, io) {
  const hostId = state.getCurrentHostId();

  // Только хост может менять время
  if (socket.id !== hostId) return;

  // Только в лобби
  if (state.getGameStatus() !== "waiting") return;

  const s = Number(seconds);
  if (!Number.isFinite(s)) return;

  const clamped = Math.max(15, Math.min(900, Math.round(s)));
  state.setGameTime(clamped);

  broadcastLobby(io);
}

function canStartGame(socket) {
  const hostId = state.getCurrentHostId();

  // Только хост может запускать
  if (socket.id !== hostId) return false;

  // Все игроки должны быть готовы
  const players = state.getAllPlayersArray();
  const allReady = players.length > 0 && players.every((p) => p.ready);

  return allReady;
}

function broadcastLobby(io) {
  io.emit("updateLobby", {
    players: state.getAllPlayersArray(),
    hostId: state.getCurrentHostId(),
    gameTime: state.getGameTime(),
  });
}

function resetGameState() {
  state.setGameStatus("waiting");
  state.clearResources();
  state.setGamePaused(false);

  const gameInterval = state.getGameInterval();
  if (gameInterval) {
    clearInterval(gameInterval);
    state.setGameInterval(null);
  }
}

module.exports = {
  joinPlayer,
  leavePlayer,
  setPlayerInfo,
  setPlayerReady,
  setGameTime,
  canStartGame,
  broadcastLobby,
  resetGameState,
};
