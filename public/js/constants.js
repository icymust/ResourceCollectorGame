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
  MIN_PLAYERS: 1,
  MAX_PLAYERS: 4
};

export const AUDIO_SETTINGS = {
  DEFAULT_VOLUME: 0.5,
  DEFAULT_ENABLED: true,
  STORAGE_KEY: 'audio-settings'
};

// Типы ресурсов определяются на сервере и приходят через сокеты
// Никакого дублирования констант!
