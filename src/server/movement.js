const state = require('./state');
const resources = require('./resources');

function handleMove(socket, direction, io) {
  if (state.getGameStatus() !== 'started' || state.isGamePaused()) return;
  
  const playerId = socket.id;
  const player = state.getPlayer(playerId);
  
  if (!player || !player.inGame) return; // ignore lobby players
  
  if (player.frozenUntil && Date.now() < player.frozenUntil) {
    return; //player is frozen and cannot move
  }

  //save old coordinates for validation
  const oldX = player.x;
  const oldY = player.y;

  //update position with torus logic (20x20)
  switch (direction) {
    case 'left':
      player.x = (player.x - 1 + 20) % 20;
      break;
    case 'right':
      player.x = (player.x + 1) % 20;
      break;
    case 'up':
      player.y = (player.y - 1 + 20) % 20;
      break;
    case 'down':
      player.y = (player.y + 1) % 20;
      break;
    default:
  return; //unknown direction
  }

  //check resource collection
  const resourceCollected = resources.collectResource(player.x, player.y, player);

  //send updates
  const activePlayers = Object.fromEntries(
    Object.entries(state.getPlayers()).filter(([, p]) => p.inGame)
  );
  io.emit('updatePlayers', activePlayers);
  
  //send resources only if something was collected
  if (resourceCollected) {
    io.emit('updateResources', state.getResources());
    //send special event for collection sound
    socket.emit('resourceCollected');
  }
}

//direction validation
function isValidDirection(direction) {
  return ['left', 'right', 'up', 'down'].includes(direction);
}

//get new coordinates without changing state (for pre-check)
function getNewPosition(x, y, direction) {
  switch (direction) {
    case 'left':
      return { x: (x - 1 + 20) % 20, y };
    case 'right':
      return { x: (x + 1) % 20, y };
    case 'up':
      return { x, y: (y - 1 + 20) % 20 };
    case 'down':
      return { x, y: (y + 1) % 20 };
    default:
      return { x, y };
  }
}

//collision check (if needed)
function checkCollision(x, y, excludePlayerId = null) {
  const players = state.getPlayers();
  
  return Object.values(players).some(p => 
    p.x === x && p.y === y && p.id !== excludePlayerId
  );
}

module.exports = {
  handleMove,
  isValidDirection,
  getNewPosition,
  checkCollision
};
