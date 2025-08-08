// Константы игры
export const GRID = {
  COLS: 20,
  ROWS: 20,
  CELL_SIZE: 30,
  GAP: 2,
  TOTAL_CELLS: 400
};

export const KEYS = {
  MOVE: {
    LEFT: ['arrowleft', 'a'],
    RIGHT: ['arrowright', 'd'],
    UP: ['arrowup', 'w'],
    DOWN: ['arrowdown', 's']
  },
  PAUSE: ['p'],
  QUIT: ['escape']
};

export const GAME_LIMITS = {
  MIN_TIME: 15,
  MAX_TIME: 900,
  MIN_PLAYERS: 1
};

// Типы ресурсов (клиентская копия для отображения)
export const RESOURCE_TYPES = {
  gold: { points: 3, color: '#FFD700', symbol: '💰' },
  silver: { points: 2, color: '#C0C0C0', symbol: '⚡' },
  bronze: { points: 1, color: '#CD7F32', symbol: '🔥' }
};
