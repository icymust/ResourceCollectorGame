const state = require("./state");
const game = require("./game");

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
    inGame: state.getGameStatus() === 'started' ? false : undefined,
  };

  state.addPlayer(playerId, playerData);
  if (state.getGameStatus() === 'started') {
    // player joins queue while round is running
    broadcastQueue(io);
    // also send current active players to keep board for others unchanged
    const activePlayersObj = Object.fromEntries(
      Object.entries(state.getPlayers()).filter(([, p]) => p.inGame)
    );
    io.emit('updatePlayers', activePlayersObj);
  } else {
    broadcastLobby(io);
  }
}

function leavePlayer(socket, io) {
  const playerId = socket.id;
  const wasInGame = state.getPlayer(playerId)?.inGame === true;
  state.removePlayer(playerId);

  if (state.getPlayerCount() === 0) {
    resetGameState();
  }

  if (state.getGameStatus() === 'started') {
    // if active players < 2 -> end game
    const activeCount = Object.values(state.getPlayers()).filter(p => p.inGame).length;
    if (wasInGame && activeCount < 2) {
      game.endGameByTimeout(io);
      return;
    }
    // update active board for players in round
    const activePlayersObj = Object.fromEntries(
      Object.entries(state.getPlayers()).filter(([, p]) => p.inGame)
    );
    io.emit('updatePlayers', activePlayersObj);
    // update queue view for queued players
    broadcastQueue(io);
  } else {
    broadcastLobby(io);
  }
}

function setPlayerInfo(socket, { name, color }, callback, io) {
  const playerId = socket.id;
  const players = state.getPlayers();

  const nameTaken = Object.values(players).some(
    (p) => p.name === name && p.id !== playerId
  );

  if (nameTaken) {
    if (callback) callback({ success: false, message: "Name already exists" });
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

  if (socket.id !== hostId) return;

  if (state.getGameStatus() !== "waiting") return;

  const s = Number(seconds);
  if (!Number.isFinite(s)) return;

  const clamped = Math.max(15, Math.min(900, Math.round(s)));
  state.setGameTime(clamped);

  broadcastLobby(io);
}

function canStartGame(socket) {
  const hostId = state.getCurrentHostId();

  if (socket.id !== hostId) return false;

  const players = state.getAllPlayersArray();
  console.log(players.length);
  if (players.length > 4 || players.length < 2) return false;
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

function broadcastQueue(io) {
  const waiting = state.getAllPlayersArray().filter(p => !p.inGame);
  for (const p of waiting) {
    io.to(p.id).emit('updateQueue', {
      queue: waiting.map(q => ({ id: q.id, name: q.name, color: q.color })),
      count: waiting.length
    });
  }
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
  broadcastQueue,
};
