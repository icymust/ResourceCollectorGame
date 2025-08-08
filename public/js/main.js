// Главная точка входа приложения
import * as net from './net.js';
import { initBoard } from './render.js';
import { bindUI, showGameStarted } from './ui.js';
import { bindInput } from './input.js';
import { initFPS } from './fps.js';
import { state } from './state.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎮 Initializing Resource Collector Game...');
  
  // Инициализируем модули
  initBoard();
  bindUI();
  bindInput();
  initFPS(); // только для разработки
  
  // Подключаемся к серверу
  net.connect();
  
  // Отслеживаем начало игры
  const gameContainer = document.getElementById('game-container');
  const lobby = document.getElementById('lobby');
  
  // Слушаем событие gameStarted через MutationObserver
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        if (gameContainer.style.display === 'block' && lobby.style.display === 'none') {
          showGameStarted();
        }
      }
    });
  });
  
  observer.observe(gameContainer, { attributes: true, attributeFilter: ['style'] });
  observer.observe(lobby, { attributes: true, attributeFilter: ['style'] });
  
  console.log('✅ Game initialized successfully!');
});
