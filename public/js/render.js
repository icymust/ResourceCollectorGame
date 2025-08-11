import { state } from "./state.js";
import { GRID } from "./constants.js";
import { audioManager } from "./audio.js";

// Рендер-пайплайн
let pending = { players: null, resources: null };
let scheduled = false;

const prevPlayerIndex = new Map(); // id -> индекс клетки (y*20 + x)
const resourceSet = new Set(); // "x,y" для быстрого сравнения

let board = null;
let scoreboard = null;
let lastResourceCount = 0; // Для отслеживания собранных ресурсов
let effectUpdateInterval = null; // Интервал для обновления эффектов

export function initBoard() {
  board = document.getElementById("game-board");
  scoreboard = document.getElementById("scoreboard");

  // Создаём 400 клеток
  board.innerHTML = "";
  for (let i = 0; i < GRID.TOTAL_CELLS; i++) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    board.appendChild(cell);
  }
  
  // Запускаем периодическое обновление эффектов
  startEffectUpdates();
}

// Функция для запуска автообновления эффектов
function startEffectUpdates() {
  // Очищаем предыдущий интервал если есть
  if (effectUpdateInterval) {
    clearInterval(effectUpdateInterval);
  }
  
  // Обновляем каждую секунду
  effectUpdateInterval = setInterval(() => {
    // Проверяем, есть ли игроки с активными эффектами
    const players = state.players || {};
    const hasActiveEffects = Object.values(players).some(player => 
      (player.doublePointsUntil && Date.now() < player.doublePointsUntil) ||
      (player.magnetUntil && Date.now() < player.magnetUntil) ||
      (player.frozenUntil && Date.now() < player.frozenUntil) ||
      (player.confusedUntil && Date.now() < player.confusedUntil) ||
      (player.poisonedUntil && Date.now() < player.poisonedUntil) ||
      (player.ghostModeUntil && Date.now() < player.ghostModeUntil)
    );
    
    // Если есть активные эффекты, обновляем отображение
    if (hasActiveEffects) {
      pending.players = players;
      scheduleRender();
    }
  }, 1000); // Обновляем каждую секунду
}

export function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    renderFrame();
  });
}

// Функция для получения активных эффектов игрока
function getPlayerEffects(player) {
  const effects = [];
  const now = Date.now();
  
  if (player.doublePointsUntil && now < player.doublePointsUntil) {
    const remaining = Math.ceil((player.doublePointsUntil - now) / 1000);
    effects.push({
      class: 'double-points',
      icon: '✨',
      text: '2x',
      tooltip: `Double points for ${remaining}s`,
      color: '#333',
      background: 'linear-gradient(45deg, #FFE55C, #FFD700)',
      border: '#FFD700'
    });
  }
  
  if (player.magnetUntil && now < player.magnetUntil) {
    const remaining = Math.ceil((player.magnetUntil - now) / 1000);
    effects.push({
      class: 'magnet-effect',
      icon: '🧲',
      text: 'MAG',
      tooltip: `Magnet effect for ${remaining}s`,
      color: 'white',
      background: 'linear-gradient(45deg, #FF4444, #CC3333)',
      border: '#FF4444'
    });
  }
  
  if (player.frozenUntil && now < player.frozenUntil) {
    const remaining = Math.ceil((player.frozenUntil - now) / 1000);
    effects.push({
      class: 'frozen-effect',
      icon: '🧊',
      text: 'FRZ',
      tooltip: `Frozen for ${remaining}s`,
      color: 'white',
      background: 'linear-gradient(45deg, #00BFFF, #0099CC)',
      border: '#00BFFF'
    });
  }
  
  if (player.confusedUntil && now < player.confusedUntil) {
    const remaining = Math.ceil((player.confusedUntil - now) / 1000);
    effects.push({
      class: 'confused-effect',
      icon: '😵',
      text: 'CNF',
      tooltip: `Confused controls for ${remaining}s`,
      color: 'white',
      background: 'linear-gradient(45deg, #FF69B4, #CC1493)',
      border: '#FF69B4'
    });
  }
  
  if (player.poisonedUntil && now < player.poisonedUntil) {
    const remaining = Math.ceil((player.poisonedUntil - now) / 1000);
    effects.push({
      class: 'poisoned-effect',
      icon: '☣️',
      text: 'PSN',
      tooltip: `Poisoned for ${remaining}s (-1 HP/2s)`,
      color: 'white',
      background: 'linear-gradient(45deg, #32CD32, #228B22)',
      border: '#32CD32'
    });
  }
  
  if (player.ghostModeUntil && now < player.ghostModeUntil) {
    const remaining = Math.ceil((player.ghostModeUntil - now) / 1000);
    effects.push({
      class: 'ghost-mode-effect',
      icon: '👻',
      text: 'GHOST',
      tooltip: `Ghost Mode for ${remaining}s (Other players invisible)`,
      color: 'white',
      background: 'linear-gradient(45deg, #9966CC, #6633AA)',
      border: '#9966CC'
    });
  }
  
  return effects;
}

function renderFrame() {
  // Игроки: только дифф позиций
  if (pending.players) {
    // снять прошлые позиции
    for (const [id, oldIdx] of prevPlayerIndex) {
      const oldCell = board.children[oldIdx];
      if (oldCell) {
        oldCell.classList.remove("player");
        oldCell.classList.remove("double-points"); // Убираем эффект двойных очков
        oldCell.classList.remove("magnet-effect"); // Убираем эффект магнита
        oldCell.classList.remove("frozen-effect"); // Убираем эффект заморозки
        oldCell.classList.remove("confused-effect"); // Убираем эффект путаницы
        oldCell.classList.remove("poisoned-effect"); // Убираем эффект отравления
        oldCell.classList.remove("ghost-mode-effect"); // Убираем эффект призрачного режима
        // Не очищаем backgroundColor, если на этой клетке есть ресурс
        if (!oldCell.classList.contains("resource")) {
          oldCell.style.backgroundColor = "";
        }
        oldCell.title = "";
      }
    }
    prevPlayerIndex.clear();

    // поставить новые
    Object.values(pending.players).forEach((p) => {
      const idx = p.y * GRID.COLS + p.x;
      const cell = board.children[idx];
      if (cell) {
        // Проверяем Ghost Mode - если кто-то другой активировал Ghost Mode, то я не вижу СЕБЯ
        const playersWithGhostMode = Object.values(pending.players).filter(player => 
          player.id !== state.myId && // не я
          player.ghostModeUntil && 
          Date.now() < player.ghostModeUntil
        );
        
        const shouldHideMyself = playersWithGhostMode.length > 0 && p.id === state.myId;
        
        // Если другой игрок активировал Ghost Mode и это мой персонаж - скрываем меня
        if (shouldHideMyself) {
          // Не добавляем класс player и не показываем своего игрока
          prevPlayerIndex.set(p.id, idx);
          return;
        }
        
        cell.classList.add("player");
        
        // Проверяем активные эффекты
        const effects = getPlayerEffects(p);
        const hasDoublePoints = effects.some(effect => effect.class === 'double-points');
        const hasMagnet = effects.some(effect => effect.class === 'magnet-effect');
        const isFrozen = effects.some(effect => effect.class === 'frozen-effect');
        const isConfused = effects.some(effect => effect.class === 'confused-effect');
        const isPoisoned = effects.some(effect => effect.class === 'poisoned-effect');
        const hasGhostMode = effects.some(effect => effect.class === 'ghost-mode-effect');        if (hasDoublePoints) {
          cell.classList.add("double-points");
        } else {
          cell.classList.remove("double-points");
        }
        
        if (hasMagnet) {
          cell.classList.add("magnet-effect");
        } else {
          cell.classList.remove("magnet-effect");
        }
        
        if (isFrozen) {
          cell.classList.add("frozen-effect");
        } else {
          cell.classList.remove("frozen-effect");
        }
        
        if (isConfused) {
          cell.classList.add("confused-effect");
        } else {
          cell.classList.remove("confused-effect");
        }
        
        if (isPoisoned) {
          cell.classList.add("poisoned-effect");
        } else {
          cell.classList.remove("poisoned-effect");
        }
        
        if (hasGhostMode) {
          cell.classList.add("ghost-mode-effect");
        } else {
          cell.classList.remove("ghost-mode-effect");
        }
        
        cell.style.backgroundColor = p.color;
        // Если на клетке есть ресурс, показываем информацию и об игроке, и о ресурсе
        if (cell.classList.contains("resource")) {
          const effectTexts = [];
          if (hasDoublePoints) effectTexts.push("2x очков");
          if (hasMagnet) effectTexts.push("магнит");
          if (isFrozen) effectTexts.push("заморожен");
          if (isConfused) effectTexts.push("запутан");
          if (isPoisoned) effectTexts.push("отравлен");
          if (hasGhostMode) effectTexts.push("призрачный режим");
          const effectText = effectTexts.length ? ` [${effectTexts.join(', ')}!]` : "";
          cell.title = `${p.name}${effectText} (на ресурсе: ${cell.title.split(' (+')[0]})`;
        } else {
          const effectTexts = [];
          if (hasDoublePoints) effectTexts.push("2x очков");
          if (hasMagnet) effectTexts.push("магнит");
          if (isFrozen) effectTexts.push("заморожен");
          if (isConfused) effectTexts.push("запутан");
          if (isPoisoned) effectTexts.push("отравлен");
          if (hasGhostMode) effectTexts.push("призрачный режим");
          const effectText = effectTexts.length ? ` [${effectTexts.join(', ')}!]` : "";
          cell.title = p.name + effectText;
        }
        prevPlayerIndex.set(p.id, idx);
      }
    });

    // табло (одним innerHTML за кадр)
    scoreboard.innerHTML =
      "<div style='font-size:18px;font-weight:bold;color:white;text-align:center;margin-bottom:12px;text-shadow: 0 2px 4px rgba(0,0,0,0.5);border-bottom:2px solid rgba(255,255,255,0.3);padding-bottom:8px;'>🏆 Scores</div>" +
      Object.values(pending.players)
        .map((p) => {
          // Получаем все активные эффекты игрока
          const effects = getPlayerEffects(p);
          
          // Создаем строку с эффектами
          const effectsText = effects.map(effect => 
            ` <span class="effect-icon" style="color:${effect.color};background:${effect.background};border:1px solid ${effect.border};" title="${effect.tooltip}">${effect.icon} ${effect.text}</span>`
          ).join('');
          
          return `
          <div style="margin-bottom: 10px; padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); border-radius: 6px;">
            <span style="display:inline-block;width:19px;height:16px;background:${p.color};border:2px solid rgba(255,255,255,0.8);margin-right:10px;border-radius:3px;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></span>
            <strong style="font-size:16px;color:white;text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${p.name}:</strong> <span style="font-weight:bold;color:#FFE55C;font-size:16px;text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${p.score}</span>${effectsText}
          </div>
        `;
        })
        .join("");  // Убрали <br> так как теперь используем div-ы

    pending.players = null; // отрисовали — сбросили
  }

  // Ресурсы: дифф по множеству
  if (pending.resources) {
    // Обновляем счетчик ресурсов
    lastResourceCount = pending.resources.length;

    // убрать отсутствующие
    const nextSet = new Set(pending.resources.map((r) => `${r.x},${r.y}`));
    if (resourceSet.size) {
      for (const key of resourceSet) {
        if (!nextSet.has(key)) {
          const [x, y] = key.split(",").map(Number);
          const idx = y * GRID.COLS + x;
          const cell = board.children[idx];
          if (cell) {
            cell.classList.remove("resource");
            cell.classList.remove("being-attracted"); // Убираем эффект притяжения
            cell.classList.remove("bomb-resource"); // Убираем класс бомбы
            cell.textContent = "";
            
            // Очищаем все стили, которые могли остаться от ресурсов
            cell.style.border = "";
            cell.style.boxShadow = "";
            
            // Если на клетке есть игрок, восстанавливаем его цвет и title
            if (cell.classList.contains("player")) {
              // Найдем игрока на этой позиции из текущего состояния
              const currentPlayers = state.players || {};
              const playerOnCell = Object.values(currentPlayers).find(p => 
                p.x === x && p.y === y
              );
              if (playerOnCell) {
                cell.style.backgroundColor = playerOnCell.color;
                cell.title = playerOnCell.name;
              }
            } else {
              // Если игрока нет, очищаем полностью
              cell.style.backgroundColor = "";
              cell.title = "";
            }
          }
        }
      }
    }

    // добавить новые
    for (const resource of pending.resources) {
      const key = `${resource.x},${resource.y}`;
      if (!resourceSet.has(key)) {
        const idx = resource.y * GRID.COLS + resource.x;
        const cell = board.children[idx];
        if (cell) {
          cell.classList.add("resource");
          
          // Специальная обработка для бомб - не устанавливаем фон
          if (resource.type === 'timeBomb') {
            cell.style.backgroundColor = ""; // Прозрачный фон для бомбы
            cell.classList.add('bomb-resource'); // Специальный класс для бомб
            cell.title = `💣 Time Bomb (+${resource.points || 4} очков за деактивацию! РИСК: -3 очка при взрыве)`;
            cell.textContent = resource.symbol || "💣"; // Символ бомбы
          } else if (resource.type === 'freezeTrap') {
            // Делаем ловушку заморозки видимой для тестирования
            // cell.style.backgroundColor = resource.color || "#00BFFF"; // Голубой фон
            // cell.style.border = "2px solid #87CEEB"; // Ледяная граница
            // cell.style.boxShadow = "0 0 10px rgba(0, 191, 255, 0.5)"; // Ледяное свечение
            // cell.textContent = resource.symbol || "🧊"; // Символ льда
            // cell.title = `❄️ Freeze Trap (замораживает на 4 секунды!)`; // Подсказка
            cell.textContent = ""; // Убираем любой символ
            cell.title = ""; // Убираем подсказку
            cell.style.backgroundColor = "transparent"; // Прозрачный фон
            cell.style.border = "none"; // Без границ
            cell.style.boxShadow = "none"; // Без свечения
          } else if (resource.type === 'poisonTrap') {
            // Делаем ядовитую ловушку невидимой
            cell.textContent = ""; // Убираем любой символ
            cell.title = ""; // Убираем подсказку
            cell.style.backgroundColor = "transparent"; // Прозрачный фон
            cell.style.border = "none"; // Без границ
            cell.style.boxShadow = "none"; // Без свечения
          } else if (resource.type === 'confusionTrap') {
            // Делаем ловушку путаницы невидимой
            cell.textContent = ""; // Убираем любой символ
            cell.title = ""; // Убираем подсказку
            cell.style.backgroundColor = "transparent"; // Прозрачный фон
            cell.style.border = "none"; // Без границ
            cell.style.boxShadow = "none"; // Без свечения
          } else {
            cell.classList.remove('bomb-resource'); // Убираем класс бомбы
            cell.style.backgroundColor = resource.color || "#FFD700";
            cell.title = `${resource.type || "Resource"} (+${
              resource.points || 1
            } points)`;
            cell.textContent = resource.symbol || "●"; // Добавляем символ для обычных ресурсов
          }
        }
      } else {
        // Ресурсы уже отображены правильно, нет нужды в дополнительных обновлениях
      }
    }
    resourceSet.clear();
    pending.resources.forEach((r) => resourceSet.add(`${r.x},${r.y}`));
    pending.resources = null;
  }
}

// API для обновления
export function updatePlayers(players) {
  pending.players = players;
  scheduleRender();
}

export function updateResources(resources) {
  if (state.paused) return;
  pending.resources = resources;
  scheduleRender();
}

// Функция для очистки интервалов (вызывается при выходе из игры)
export function cleanup() {
  if (effectUpdateInterval) {
    clearInterval(effectUpdateInterval);
    effectUpdateInterval = null;
  }
}

// Функция для показа эффекта взрыва бомбы
export function showBombExplosion(x, y) {
  const idx = y * GRID.COLS + x;
  const cell = board.children[idx];
  if (cell) {
    // Создаем эффект взрыва
    const explosion = document.createElement('div');
    explosion.innerHTML = '💥';
    explosion.style.cssText = `
      position: absolute;
      font-size: 40px;
      z-index: 1000;
      pointer-events: none;
      animation: explosionEffect 1s ease-out forwards;
    `;
    
    // Добавляем стили для анимации взрыва если их нет
    if (!document.querySelector('#explosion-styles')) {
      const styles = document.createElement('style');
      styles.id = 'explosion-styles';
      styles.textContent = `
        @keyframes explosionEffect {
          0% {
            transform: scale(0.5);
            opacity: 1;
          }
          50% {
            transform: scale(2);
            opacity: 0.8;
          }
          100% {
            transform: scale(3);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(styles);
    }
    
    // Позиционируем взрыв по центру клетки
    const cellRect = cell.getBoundingClientRect();
    const gameBoard = document.getElementById('game-board');
    const boardRect = gameBoard.getBoundingClientRect();
    
    explosion.style.left = (cellRect.left - boardRect.left + cellRect.width/2 - 20) + 'px';
    explosion.style.top = (cellRect.top - boardRect.top + cellRect.height/2 - 20) + 'px';
    
    gameBoard.appendChild(explosion);
    
    // Удаляем эффект через 1 секунду
    setTimeout(() => {
      if (explosion.parentNode) {
        explosion.parentNode.removeChild(explosion);
      }
    }, 1000);
  }
}
