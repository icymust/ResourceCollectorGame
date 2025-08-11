const state = require('./state');

// Типы ресурсов
const RESOURCE_TYPES = [
  { type: 'bronze',       points: 1,  rarity: 0.35, color: '#B8621E', symbol: '🪙' }, // Основной ресурс
  { type: 'silver',       points: 2,  rarity: 0.25, color: '#C0C0C0', symbol: '💵' }, // Частый
  { type: 'gold',         points: 3,  rarity: 0.15, color: '#FFD700', symbol: '💰' }, // Хороший
  { type: 'doublePoints', points: 0,  rarity: 0.10, color: '#FFE55C', symbol: '✨', effect: 'doublePoints' }, // Полезный баф
  { type: 'magnet',       points: 0,  rarity: 0.06, color: '#FF4444', symbol: '🧲', effect: 'magnet' }, // Редкий баф
  { type: 'teleport',     points: 0,  rarity: 0.04, color: '#9966FF', symbol: '🌀', effect: 'teleport' }, // Эскейп
  { type: 'timeBomb',     points: 4,  rarity: 0.025, color: '#FF0000', symbol: '💣', effect: 'timeBomb' }, // Риск/награда
  { type: 'confusionTrap', points: 0, rarity: 0.01, color: '#FF69B4', symbol: '😵', effect: 'confusion' }, // Ловушка путаницы
  { type: 'freezeTrap',   points: 0,  rarity: 0.008, color: '#00BFFF', symbol: '🧊', effect: 'freeze' }, // Редкая ловушка  
  { type: 'poisonTrap',   points: -2, rarity: 0.007, color: '#32CD32', symbol: '☣️', effect: 'poison' }, // Ядовитая ловушка
  { type: 'diamond',      points: 10, rarity: 0.005, color: '#68dbfaff', symbol: '💎' }, // Джекпот
];

let spawnIntervalId = null;
let cleanupIntervalId = null;
let magnetIntervalId = null; // Интервал для обработки магнитного эффекта
let bombIntervalId = null; // Интервал для обработки бомб
let poisonIntervalId = null; // Интервал для обработки яда

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
      symbol: selected.symbol,
      effect: selected.effect, // Добавляем эффект если есть
      spawnTime: Date.now() // Добавляем время спавна
    };
    
    // Если это бомба, добавляем таймер взрыва
    if (selected.type === 'timeBomb') {
      // Случайное время взрыва от 1 до 6 секунд
      const randomTime = Math.floor(Math.random() * 6000) + 1000; // 1000-6000 мс
      resource.explodeTime = Date.now() + randomTime;
      resource.isBlinking = true; // Флаг для мигания
      resource.canDeactivate = true; // Флаг что бомбу можно деактивировать
    }
    
    state.addResource(resource);
    io.emit('updateResources', state.getResources());
    return;
  }
}

function startSpawning(io) {
  stopSpawning();
  spawnIntervalId = setInterval(() => spawnResource(io), 2000);
  // Запускаем очистку старых ресурсов каждые 5 секунд
  cleanupIntervalId = setInterval(() => cleanupExpiredResources(io), 10000);
  // Запускаем обработку магнитных эффектов каждые 500мс для плавности
  magnetIntervalId = setInterval(() => processMagnetEffects(io), 500);
  // Запускаем обработку бомб каждые 100мс для точности
  bombIntervalId = setInterval(() => processBombEffects(io), 100);
  // Запускаем обработку яда каждые 2 секунды
  poisonIntervalId = setInterval(() => processPoisonEffects(io), 2000);
}

function stopSpawning() {
  if (spawnIntervalId) {
    clearInterval(spawnIntervalId);
    spawnIntervalId = null;
  }
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
  if (magnetIntervalId) {
    clearInterval(magnetIntervalId);
    magnetIntervalId = null;
  }
  if (bombIntervalId) {
    clearInterval(bombIntervalId);
    bombIntervalId = null;
  }
  if (poisonIntervalId) {
    clearInterval(poisonIntervalId);
    poisonIntervalId = null;
  }
}

function cleanupExpiredResources(io) {
  if (state.getGameStatus() !== 'started' || state.isGamePaused()) return;
  
  const resources = state.getResources();
  const currentTime = Date.now();
  const RESOURCE_LIFETIME = 7000; // 7 секунд жизни ресурса
  
  const validResources = resources.filter(res => {
    return (currentTime - res.spawnTime) < RESOURCE_LIFETIME;
  });
  
  // Если что-то было удалено, обновляем состояние
  if (validResources.length < resources.length) {
    state.setResources(validResources);
    io.emit('updateResources', validResources);
  }
}

function collectResource(playerX, playerY, player) {
  const resources = state.getResources();
  let collected = false;
  let collectedPoints = 0;
  let hasEffect = false;
  let effectType = null;
  let bombDeactivated = false;

  const newResources = resources.filter((res) => {
    if (res.x === playerX && res.y === playerY) {
      // Специальная обработка для бомб
      if (res.type === 'timeBomb' && res.canDeactivate) {
        bombDeactivated = true;
        collectedPoints += (res.points || 0);
        collected = true;
        // Для бомб не применяем эффект взрыва, а деактивируем их
        return false; // удалить деактивированную бомбу
      } else if (res.type === 'timeBomb') {
        // Если бомба уже не может быть деактивирована, не подбираем её
        return true; // оставить бомбу
      } else {
        // Обычная обработка ресурсов
        collectedPoints += (res.points || 0);
        collected = true;
        
        // Проверяем наличие эффекта
        if (res.effect) {
          hasEffect = true;
          effectType = res.effect;
        }
        
        return false; // удалить собранный
      }
    }
    return true;
  });

  if (collected) {
    // Проверяем эффект двойных очков
    const hasDoublePoints = player.doublePointsUntil && Date.now() < player.doublePointsUntil;
    const finalPoints = hasDoublePoints ? collectedPoints * 2 : collectedPoints;
    
    player.score += finalPoints;
    state.setResources(newResources);
    
    // Применяем эффект, если есть (но не для деактивированных бомб)
    if (hasEffect && !bombDeactivated) {
      applyResourceEffect(player, effectType);
    }
  }

  return collected;
}

function applyResourceEffect(player, effectType) {
  switch (effectType) {
    case 'teleport':
      // Телепортируем игрока в случайную свободную позицию
      const players = state.getPlayers();
      const resources = state.getResources();
      
      // Попытаться найти свободную позицию (до 50 попыток)
      for (let tries = 0; tries < 50; tries++) {
        const newX = Math.floor(Math.random() * 20);
        const newY = Math.floor(Math.random() * 20);
        
        const occupiedByPlayer = Object.values(players).some(p => 
          p.id !== player.id && p.x === newX && p.y === newY
        );
        const occupiedByResource = resources.some(res => res.x === newX && res.y === newY);
        
        if (!occupiedByPlayer && !occupiedByResource) {
          player.x = newX;
          player.y = newY;
          break;
        }
      }
      break;
      
    case 'doublePoints':
      // Активируем эффект двойных очков на 7 секунд
      player.doublePointsUntil = Date.now() + 7000; // 7 секунд
      break;
      
    case 'magnet':
      // Активируем эффект магнита на 6 секунд
      player.magnetUntil = Date.now() + 6000; // 6 секунд
      break;
      
    case 'freeze':
      // Замораживаем игрока на 4 секунды
      player.frozenUntil = Date.now() + 4000; // 4 секунды
      break;
      
    case 'confusion':
      // Путаем управление игрока на 6 секунд
      player.confusedUntil = Date.now() + 6000; // 6 секунд
      break;
      
    case 'poison':
      // Отравляем игрока на 6 секунд (-1 очко каждые 2 секунды)
      player.poisonedUntil = Date.now() + 6000; // 6 секунд
      player.lastPoisonDamage = Date.now(); // Время последнего урона от яда
      break;
      
    // Здесь можно добавить другие эффекты в будущем
    default:
      console.log(`Unknown effect: ${effectType}`);
  }
}

// Функция обработки магнитного эффекта (вызывается периодически)
function processMagnetEffects(io) {
  if (state.getGameStatus() !== 'started' || state.isGamePaused()) return;
  
  const players = state.getPlayers();
  let resources = state.getResources();
  let resourcesChanged = false;
  let playersChanged = false;
  
  // Проходим по всем игрокам с активным эффектом магнита
  Object.values(players).forEach(player => {
    if (player.magnetUntil && Date.now() < player.magnetUntil) {
      // Находим ресурсы в радиусе 2 клеток и автоматически собираем их
      const resourcesToCollect = [];
      
      resources.forEach((resource, index) => {
        const distance = Math.abs(resource.x - player.x) + Math.abs(resource.y - player.y);
        if (distance <= 3 && distance > 0) {
          // Магнит не подбирает бомбы автоматически - слишком опасно!
          if (resource.type !== 'timeBomb') {
            resourcesToCollect.push(index);
          }
        }
      });
      
      // Собираем ресурсы (в обратном порядке, чтобы не сбились индексы)
      for (let i = resourcesToCollect.length - 1; i >= 0; i--) {
        const resourceIndex = resourcesToCollect[i];
        const resource = resources[resourceIndex];
        
        // Начисляем очки
        let points = resource.points || 0;
        const hasDoublePoints = player.doublePointsUntil && Date.now() < player.doublePointsUntil;
        const finalPoints = hasDoublePoints ? points * 2 : points;
        player.score += finalPoints;
        
        // Применяем эффект ресурса, если есть
        if (resource.effect) {
          applyResourceEffect(player, resource.effect);
        }
        
        // Удаляем собранный ресурс
        resources.splice(resourceIndex, 1);
        resourcesChanged = true;
        playersChanged = true;
      }
    }
  });
  
  // Если что-то изменилось, отправляем обновления
  if (resourcesChanged) {
    state.setResources(resources);
    io.emit('updateResources', resources);
  }
  
  if (playersChanged) {
    io.emit('updatePlayers', state.getPlayers());
  }
}

// Функция обработки бомб (вызывается периодически)
function processBombEffects(io) {
  if (state.getGameStatus() !== 'started' || state.isGamePaused()) return;
  
  let resources = state.getResources();
  const players = state.getPlayers();
  let resourcesChanged = false;
  let playersChanged = false;
  const currentTime = Date.now();
  
  // Проходим по всем бомбам
  const bombsToExplode = [];
  resources.forEach((resource, index) => {
    if (resource.type === 'timeBomb' && resource.explodeTime <= currentTime) {
      bombsToExplode.push({ index, resource });
    }
  });
  
  // Обрабатываем взрывы бомб
  for (let i = bombsToExplode.length - 1; i >= 0; i--) {
    const { index, resource: bomb } = bombsToExplode[i];
    
    // Наносим урон игрокам в радиусе взрыва
    Object.values(players).forEach(player => {
      const distance = Math.abs(bomb.x - player.x) + Math.abs(bomb.y - player.y);
      if (distance <= 3) {
        player.score = Math.max(0, player.score - 3); // Не даем счету уйти в минус
        playersChanged = true;
      }
    });
    
    // Удаляем другие ресурсы в радиусе взрыва
    const resourcesToRemove = [];
    resources.forEach((resource, resIndex) => {
      if (resIndex !== index) { // Не удаляем саму бомбу пока
        const distance = Math.abs(bomb.x - resource.x) + Math.abs(bomb.y - resource.y);
        if (distance <= 3) {
          resourcesToRemove.push(resIndex);
        }
      }
    });
    
    // Удаляем ресурсы в обратном порядке
    resourcesToRemove.sort((a, b) => b - a).forEach(resIndex => {
      resources.splice(resIndex, 1);
      resourcesChanged = true;
    });
    
    // Корректируем индекс бомбы после удаления других ресурсов
    let correctedBombIndex = index;
    resourcesToRemove.forEach(removedIndex => {
      if (removedIndex < index) {
        correctedBombIndex--;
      }
    });
    
    // Удаляем саму бомбу
    resources.splice(correctedBombIndex, 1);
    resourcesChanged = true;
    
    // Отправляем эффект взрыва клиентам
    io.emit('bombExplosion', { x: bomb.x, y: bomb.y });
  }
  
  // Если что-то изменилось, отправляем обновления
  if (resourcesChanged) {
    state.setResources(resources);
    io.emit('updateResources', resources);
  }
  
  if (playersChanged) {
    io.emit('updatePlayers', state.getPlayers());
  }
}

// Функция обработки ядовитых эффектов (вызывается каждые 2 секунды)
function processPoisonEffects(io) {
  if (state.getGameStatus() !== 'started' || state.isGamePaused()) return;
  
  const players = state.getPlayers();
  let playersChanged = false;
  const currentTime = Date.now();
  
  // Проходим по всем игрокам с активным эффектом яда
  Object.values(players).forEach(player => {
    if (player.poisonedUntil && currentTime < player.poisonedUntil) {
      // Проверяем, прошло ли 2 секунды с последнего урона
      if (currentTime - (player.lastPoisonDamage || 0) >= 2000) {
        // Наносим урон от яда (-1 очко)
        player.score = Math.max(0, player.score - 1);
        player.lastPoisonDamage = currentTime;
        playersChanged = true;
      }
    }
  });
  
  // Если что-то изменилось, отправляем обновления
  if (playersChanged) {
    io.emit('updatePlayers', state.getPlayers());
  }
}

module.exports = {
  RESOURCE_TYPES,
  spawnResource,
  startSpawning,
  stopSpawning,
  collectResource,
  pickResourceTypeWeighted,
  processMagnetEffects,
  processBombEffects,
  processPoisonEffects
};
