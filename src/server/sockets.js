const lobby = require('./lobby');
const game = require('./game');
const movement = require('./movement');

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Игрок присоединяется к лобби
    lobby.joinPlayer(socket, io);

    // === ЛОББИ СОБЫТИЯ ===
    
    socket.on('setPlayerInfo', ({ name, color }, callback) => {
      lobby.setPlayerInfo(socket, { name, color }, callback, io);
    });

    socket.on('setReady', () => {
      lobby.setPlayerReady(socket, io);
    });

    socket.on('setGameTime', (seconds) => {
      lobby.setGameTime(socket, seconds, io);
    });

    socket.on('startGame', () => {
      if (lobby.canStartGame(socket)) {
        game.startGame(io);
      }
    });

    // === ИГРОВЫЕ СОБЫТИЯ ===

    socket.on('move', (direction) => {
      if (movement.isValidDirection(direction)) {
        movement.handleMove(socket, direction, io);
      }
    });

    socket.on('togglePause', (data) => {
      game.togglePause(io, data);
    });

    socket.on('quitGame', (data) => {
      game.quitGame(socket, io, data);
    });

    // === ОТКЛЮЧЕНИЕ ===

    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      lobby.leavePlayer(socket, io);
    });
  });
}

module.exports = {
  registerSocketHandlers
};
