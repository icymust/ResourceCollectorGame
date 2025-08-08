import { state } from './state.js';
import { KEYS } from './constants.js';
import { emitMove, emitPause } from './net.js';
import { openQuitModal } from './ui.js';

export function bindInput() {
  document.addEventListener('keydown', handleKeyDown);
}

function handleKeyDown(e) {
  // Игнорируем ввод в полях
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  const key = e.key.toLowerCase();

  // Выход через Escape
  if (KEYS.QUIT.includes(key)) {
    openQuitModal();
    e.preventDefault();
    return;
  }

  // Пауза через P
  if (KEYS.PAUSE.includes(key)) {
    emitPause(!state.paused, state.playerName || 'Unknown');
    return;
  }

  // Блокируем движение если игра на паузе или модалка открыта
  if (state.paused || state.quitModalOpen) {
    return;
  }

  // Движение
  let direction = null;
  if (KEYS.MOVE.LEFT.includes(key)) direction = 'left';
  else if (KEYS.MOVE.RIGHT.includes(key)) direction = 'right';
  else if (KEYS.MOVE.UP.includes(key)) direction = 'up';
  else if (KEYS.MOVE.DOWN.includes(key)) direction = 'down';

  if (direction) {
    e.preventDefault(); // не скроллим страницу
    emitMove(direction);
  }
}
