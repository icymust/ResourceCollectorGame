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
    
    // Проверяем, есть ли эффект confusion у текущего игрока
    const currentPlayer = state.players && state.players[state.myId];
    
    // Отладочная информация о состоянии игрока
    if (currentPlayer) {
      console.log(`Player state:`, {
        id: state.myId,
        confusedUntil: currentPlayer.confusedUntil,
        now: Date.now(),
        isConfused: currentPlayer.confusedUntil && Date.now() < currentPlayer.confusedUntil
      });
    } else {
      console.log('❌ Current player not found in state.players', { myId: state.myId, players: state.players });
    }
    
    const isConfused = currentPlayer && 
      currentPlayer.confusedUntil && 
      Date.now() < currentPlayer.confusedUntil;
    
    // Отладочная информация
    if (isConfused) {
      console.log(`🔄 CONFUSION ACTIVE! Original: ${direction}`);
    }
    
    // Если игрок запутан, реверсируем управление
    if (isConfused) {
      const originalDirection = direction;
      switch (direction) {
        case 'left': direction = 'right'; break;
        case 'right': direction = 'left'; break;
        case 'up': direction = 'down'; break;
        case 'down': direction = 'up'; break;
      }
      console.log(`🔄 Direction reversed: ${originalDirection} → ${direction}`);
    }
    
    emitMove(direction);
  }
}
