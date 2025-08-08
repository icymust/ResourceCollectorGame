const state = require('./state');

// Типы ресурсов
const RESOURCE_TYPES = [
  { type: 'gold',   points: 3, rarity: 0.10, color: '#FFD700', symbol: '💰' },
  { type: 'silver', points: 2, rarity: 0.20, color: '#C0C0C0', symbol: '💵' },
  { type: 'bronze', points: 1, rarity: 0.67, color: '#B8621E', symbol: '🪙' },
  { type: 'diamond', points: 10, rarity: 0.03, color: '#68dbfaff', symbol: '💎' },
];

let spawnIntervalId = null;

function pickResourceTypeWeighted() {
  const r = Math.random();
  let acc = 0;
  let selected = RESOURCE_TYPES[RESOURCE_TYPES.length - 1];
  
  for (const t of RESOURCE_TYPES) {
    acc += t.rarity;
    if (r <= acc) {
      selected = t;
      break;
    }
  }
  
  return selected;
}

function spawnResource(io) {
  if (state.getGameStatus() !== 'started' || state.isGamePaused()) return;

  const selected = pickResourceTypeWeighted();
  const players = state.getPlayers();
  const resources = state.getResources();

  // Не спавнить поверх игрока/другого ресурса (до 20 попыток)
  for (let tries = 0; tries < 20; tries++) {
    const x = Math.floor(Math.random() * 20);
    const y = Math.floor(Math.random() * 20);

    const occupiedByPlayer = Object.values(players).some(p => p.x === x && p.y === y);
    const occupiedByResource = resources.some(res => res.x === x && res.y === y);
    
    if (occupiedByPlayer || occupiedByResource) continue;

    const resource = {
      x,
      y,
      type: selected.type,
      points: selected.points,
      color: selected.color,
      symbol: selected.symbol
    };
    
    state.addResource(resource);
    io.emit('updateResources', state.getResources());
    return;
  }
}

function startSpawning(io) {
  stopSpawning();
  spawnIntervalId = setInterval(() => spawnResource(io), 5000);
}

function stopSpawning() {
  if (spawnIntervalId) {
    clearInterval(spawnIntervalId);
    spawnIntervalId = null;
  }
}

function collectResource(playerX, playerY, player) {
  const resources = state.getResources();
  let collected = false;
  let collectedPoints = 0;

  const newResources = resources.filter((res) => {
    if (res.x === playerX && res.y === playerY) {
      collectedPoints += (res.points || 1);
      collected = true;
      return false; // удалить собранный
    }
    return true;
  });

  if (collected) {
    player.score += collectedPoints;
    state.setResources(newResources);
  }

  return collected;
}

module.exports = {
  RESOURCE_TYPES,
  spawnResource,
  startSpawning,
  stopSpawning,
  collectResource,
  pickResourceTypeWeighted
};
