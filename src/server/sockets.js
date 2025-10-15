const lobby = require("./lobby");
const game = require("./game");
const movement = require("./movement");

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`Player connected: ${socket.id}`);

    //player joins lobby
    lobby.joinPlayer(socket, io);

    //=== lobby events ===

    socket.on("setPlayerInfo", ({ name, color }, callback) => {
      lobby.setPlayerInfo(socket, { name, color }, callback, io);
    });

    socket.on("setReady", () => {
      lobby.setPlayerReady(socket, io);
    });

    socket.on("setGameTime", (seconds) => {
      lobby.setGameTime(socket, seconds, io);
    });

    socket.on("startGame", () => {
      if (lobby.canStartGame(socket)) {
        game.startGame(io);
      } else {
        io.emit("alert", { type: "error", message: "there must be at least 2-4 players" });
      }
    });

    //=== game events ===

    socket.on("move", (direction) => {
      if (movement.isValidDirection(direction)) {
        movement.handleMove(socket, direction, io);
      }
    });

    socket.on("togglePause", (data) => {
      game.togglePause(io, data);
    });

    socket.on("quitGame", (data) => {
      game.quitGame(socket, io, data);
    });

    socket.on("restartGame", () => {
      const state = require('./state');
      const p = state.getPlayer(socket.id);
      const by = (p && typeof p.name === 'string' && p.name.trim().length > 0) ? p.name.trim() : 'Unknown';
      game.restartGame(io);
      io.emit("alert", { type: "info", message: `Game restarted by ${by}` });
    });

    //=== disconnect ===

    socket.on("disconnect", () => {
      console.log(`Player disconnected: ${socket.id}`);
      lobby.leavePlayer(socket, io);
    });
  });
}

module.exports = {
  registerSocketHandlers,
};
