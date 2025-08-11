const state = require('./state');
const resources = require('./resources');

function handleMove(socket, direction, io) {
  // Проверяем состояние игры
  if (state.getGameStatus() !== 'started' || state.isGamePaused()) return;
  
  const playerId = socket.id;
  const player = state.getPlayer(playerId);
  
  if (!player) return;
  
  // Проверяем, не заморожен ли игрок
  if (player.frozenUntil && Date.now() < player.frozenUntil) {
    return; // Игрок заморожен и не может двигаться
  }

  // Сохраняем старые координаты для проверки
  const oldX = player.x;
  const oldY = player.y;

  // Обновляем позицию с учетом тора (20x20)
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
      return; // Неизвестное направление
  }

  // Проверяем сбор ресурсов
  const resourceCollected = resources.collectResource(player.x, player.y, player);

  // Отправляем обновления
  io.emit('updatePlayers', state.getPlayers());
  
  // Отправляем ресурсы только если что-то собрали
  if (resourceCollected) {
    io.emit('updateResources', state.getResources());
    // Отправляем специальное событие для звука сбора
    socket.emit('resourceCollected');
  }
}

// Валидация направления
function isValidDirection(direction) {
  return ['left', 'right', 'up', 'down'].includes(direction);
}

// Получить новые координаты без изменения состояния (для предварительной проверки)
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

// Проверка коллизий (если понадобится)
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
