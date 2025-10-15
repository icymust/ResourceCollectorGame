const state = require("./state");

//resource types
const RESOURCE_TYPES = [
  { type: "bronze", points: 1, rarity: 0.35, color: "#B8621E", symbol: "🪙" },
  { type: "silver", points: 2, rarity: 0.25, color: "#C0C0C0", symbol: "💵" },
  { type: "gold", points: 3, rarity: 0.15, color: "#FFD700", symbol: "💰" },
  {
    type: "doublePoints",
    points: 0,
    rarity: 0.1,
    color: "#FFE55C",
    symbol: "✨",
    effect: "doublePoints",
  },
  {
    type: "magnet",
    points: 0,
    rarity: 0.06,
    color: "#FF4444",
    symbol: "🧲",
    effect: "magnet",
  },
  {
    type: "teleport",
    points: 0,
    rarity: 0.04,
    color: "#9966FF",
    symbol: "🌀",
    effect: "teleport",
  },
  {
    type: "timeBomb",
    points: 4,
    rarity: 0.025,
    color: "#FF0000",
    symbol: "💣",
    effect: "timeBomb",
  },
  {
    type: "confusionTrap",
    points: 0,
    rarity: 0.01,
    color: "#FF69B4",
    symbol: "😵",
    effect: "confusion",
  },
  {
    type: "freezeTrap",
    points: 0,
    rarity: 0.008,
    color: "#00BFFF",
    symbol: "🧊",
    effect: "freeze",
  },
  {
    type: "poisonTrap",
    points: -2,
    rarity: 0.007,
    color: "#32CD32",
    symbol: "☣️",
    effect: "poison",
  },
  {
    type: "ghostMode",
    points: 2,
    rarity: 0.05,
    color: "#9966CC",
    symbol: "👻",
    effect: "ghostMode",
  },
  {
    type: "diamond",
    points: 10,
    rarity: 0.005,
    color: "#68dbfaff",
    symbol: "💎",
  },
];

let spawnIntervalId = null;
let cleanupIntervalId = null;
let magnetIntervalId = null; //magnet effect interval
let bombIntervalId = null; //bombs interval
let poisonIntervalId = null; //poison interval

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
  if (state.getGameStatus() !== "started" || state.isGamePaused()) return;

  const selected = pickResourceTypeWeighted();
  const players = state.getPlayers();
  const resources = state.getResources();

  //do not spawn on top of player/other resource (up to 20 tries)
  for (let tries = 0; tries < 20; tries++) {
    const x = Math.floor(Math.random() * 20);
    const y = Math.floor(Math.random() * 20);

    const occupiedByPlayer = Object.values(players).some(
      (p) => p.x === x && p.y === y
    );
    const occupiedByResource = resources.some(
      (res) => res.x === x && res.y === y
    );

    if (occupiedByPlayer || occupiedByResource) continue;

    const resource = {
      x,
      y,
      type: selected.type,
      points: selected.points,
      color: selected.color,
      symbol: selected.symbol,
      effect: selected.effect, //add effect if present
      spawnTime: Date.now(), //add spawn time
    };

    //if it's a bomb, add explosion timer
    if (selected.type === "timeBomb") {
      //random explosion time from 1 to 6 seconds
      const randomTime = Math.floor(Math.random() * 6000) + 1000; // 1000-6000 мс
      resource.explodeTime = Date.now() + randomTime;
      resource.isBlinking = true; //blinking flag
      resource.canDeactivate = true; //bomb can be deactivated flag
    }

    state.addResource(resource);
    io.emit("updateResources", state.getResources());
    return;
  }
}

function startSpawning(io) {
  stopSpawning();
  spawnIntervalId = setInterval(() => spawnResource(io), 2000);
  //cleanup old resources every 5 seconds
  cleanupIntervalId = setInterval(() => cleanupExpiredResources(io), 10000);
  //process magnet effects every 500ms for smoothness
  magnetIntervalId = setInterval(() => processMagnetEffects(io), 500);
  //process bombs every 100ms for accuracy
  bombIntervalId = setInterval(() => processBombEffects(io), 100);
  //process poison every 2 seconds
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
  if (state.getGameStatus() !== "started" || state.isGamePaused()) return;

  const resources = state.getResources();
  const currentTime = Date.now();
  const RESOURCE_LIFETIME = 7000; //7 sec resource lifetime

  const validResources = resources.filter((res) => {
    return currentTime - res.spawnTime < RESOURCE_LIFETIME;
  });

  //if something was deleted, update state
  if (validResources.length < resources.length) {
    state.setResources(validResources);
    io.emit("updateResources", validResources);
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
      //special handling for bombs
      if (res.type === "timeBomb" && res.canDeactivate) {
        bombDeactivated = true;
        collectedPoints += res.points || 0;
        collected = true;
        //do not apply explosion effect for bombs, just deactivate
        return false; //remove deactivated bomb
      } else if (res.type === "timeBomb") {
        //if bomb can't be deactivated, don't pick it up
        return true; //keep bomb
      } else {
        //regular resource handling
        collectedPoints += res.points || 0;
        collected = true;

        //check for effect
        if (res.effect) {
          hasEffect = true;
          effectType = res.effect;
        }

        return false; //remove collected
      }
    }
    return true;
  });

  if (collected) {
    //check double points effect
    const hasDoublePoints =
      player.doublePointsUntil && Date.now() < player.doublePointsUntil;
    const finalPoints = hasDoublePoints ? collectedPoints * 2 : collectedPoints;

    player.score += finalPoints;
    state.setResources(newResources);

    //apply effect if present (but not for deactivated bombs)
    if (hasEffect && !bombDeactivated) {
      applyResourceEffect(player, effectType);
    }
  }

  return collected;
}

function applyResourceEffect(player, effectType) {
  switch (effectType) {
    case "teleport":
      //teleport player to random free position
      const players = state.getPlayers();
      const resources = state.getResources();

      //try to find free position (up to 50 tries)
      for (let tries = 0; tries < 50; tries++) {
        const newX = Math.floor(Math.random() * 20);
        const newY = Math.floor(Math.random() * 20);

        const occupiedByPlayer = Object.values(players).some(
          (p) => p.id !== player.id && p.x === newX && p.y === newY
        );
        const occupiedByResource = resources.some(
          (res) => res.x === newX && res.y === newY
        );

        if (!occupiedByPlayer && !occupiedByResource) {
          player.x = newX;
          player.y = newY;
          break;
        }
      }
      break;

    case "doublePoints":
      //activate double points effect for 7 seconds
      player.doublePointsUntil = Date.now() + 7000;
      break;

    case "magnet":
      //activate magnet effect for 6 seconds
      player.magnetUntil = Date.now() + 6000;
      break;

    case "freeze":
      //freeze player for 4 seconds
      player.frozenUntil = Date.now() + 4000;
      break;

    case "confusion":
      //confuse player controls for 6 seconds
      player.confusedUntil = Date.now() + 6000;
      break;

    case "poison":
      //poison player for 6 seconds (-1 point every 2 seconds)
      player.poisonedUntil = Date.now() + 6000;
      player.lastPoisonDamage = Date.now();
      break;

    case "ghostMode":
      //activate ghost mode for 10 seconds
      player.ghostModeUntil = Date.now() + 10000;
      break;

    //other effects can be added here in future
    default:
      console.log(`Unknown effect: ${effectType}`);
  }
}

//magnet effect handler (called periodically)
function processMagnetEffects(io) {
  if (state.getGameStatus() !== "started" || state.isGamePaused()) return;

  const players = state.getPlayers();
  let resources = state.getResources();
  let resourcesChanged = false;
  let playersChanged = false;

  //iterate all players with active magnet effect
  Object.values(players).forEach((player) => {
    if (player.magnetUntil && Date.now() < player.magnetUntil) {
      //find resources within 2 cells and auto collect
      const resourcesToCollect = [];

      resources.forEach((resource, index) => {
        const distance =
          Math.abs(resource.x - player.x) + Math.abs(resource.y - player.y);
        if (distance <= 3 && distance > 0) {
          //magnet does not auto collect bombs - too dangerous!
          if (resource.type !== "timeBomb") {
            resourcesToCollect.push(index);
          }
        }
      });

      //collect resources (in reverse order to keep indices correct)
      for (let i = resourcesToCollect.length - 1; i >= 0; i--) {
        const resourceIndex = resourcesToCollect[i];
        const resource = resources[resourceIndex];

        //add points
        let points = resource.points || 0;
        const hasDoublePoints =
          player.doublePointsUntil && Date.now() < player.doublePointsUntil;
        const finalPoints = hasDoublePoints ? points * 2 : points;
        player.score += finalPoints;

        //apply resource effect if present
        if (resource.effect) {
          applyResourceEffect(player, resource.effect);
        }

        //remove collected resource
        resources.splice(resourceIndex, 1);
        resourcesChanged = true;
        playersChanged = true;
      }
    }
  });

  //if something changed, send updates
  if (resourcesChanged) {
    state.setResources(resources);
    io.emit("updateResources", resources);
  }

  if (playersChanged) {
    io.emit("updatePlayers", state.getPlayers());
  }
}

//bomb handler (called periodically)
function processBombEffects(io) {
  if (state.getGameStatus() !== "started" || state.isGamePaused()) return;

  let resources = state.getResources();
  const players = state.getPlayers();
  let resourcesChanged = false;
  let playersChanged = false;
  const currentTime = Date.now();

  //iterate all bombs
  const bombsToExplode = [];
  resources.forEach((resource, index) => {
    if (resource.type === "timeBomb" && resource.explodeTime <= currentTime) {
      bombsToExplode.push({ index, resource });
    }
  });

  //handle bomb explosions
  for (let i = bombsToExplode.length - 1; i >= 0; i--) {
    const { index, resource: bomb } = bombsToExplode[i];

    //deal damage to players in explosion radius
    Object.values(players).forEach((player) => {
      const distance =
        Math.abs(bomb.x - player.x) + Math.abs(bomb.y - player.y);
      if (distance <= 3) {
        //do not allow score to go negative
        player.score = Math.max(0, player.score - 3);
        playersChanged = true;
      }
    });

    //remove other resources in explosion radius
    const resourcesToRemove = [];
    resources.forEach((resource, resIndex) => {
      if (resIndex !== index) {
        //do not remove bomb itself yet
        const distance =
          Math.abs(bomb.x - resource.x) + Math.abs(bomb.y - resource.y);
        if (distance <= 3) {
          resourcesToRemove.push(resIndex);
        }
      }
    });

    //remove resources in reverse order
    resourcesToRemove
      .sort((a, b) => b - a)
      .forEach((resIndex) => {
        resources.splice(resIndex, 1);
        resourcesChanged = true;
      });

    //correct bomb index after removing other resources
    let correctedBombIndex = index;
    resourcesToRemove.forEach((removedIndex) => {
      if (removedIndex < index) {
        correctedBombIndex--;
      }
    });

    //remove bomb itself
    resources.splice(correctedBombIndex, 1);
    resourcesChanged = true;

    //send explosion effect to clients
    io.emit("bombExplosion", { x: bomb.x, y: bomb.y });
  }

  //if something changed, send updates
  if (resourcesChanged) {
    state.setResources(resources);
    io.emit("updateResources", resources);
  }

  if (playersChanged) {
    io.emit("updatePlayers", state.getPlayers());
  }
}

//poison effect handler (called every 2 seconds)
function processPoisonEffects(io) {
  if (state.getGameStatus() !== "started" || state.isGamePaused()) return;

  const players = state.getPlayers();
  let playersChanged = false;
  const currentTime = Date.now();

  //iterate all players with active poison effect
  Object.values(players).forEach((player) => {
    if (player.poisonedUntil && currentTime < player.poisonedUntil) {
      //check if 2 seconds passed since last poison damage
      if (currentTime - (player.lastPoisonDamage || 0) >= 2000) {
        //deal poison damage (-1 point)
        player.score = Math.max(0, player.score - 1);
        player.lastPoisonDamage = currentTime;
        playersChanged = true;
      }
    }
  });

  //if something changed, send updates
  if (playersChanged) {
    io.emit("updatePlayers", state.getPlayers());
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
  processPoisonEffects,
};
