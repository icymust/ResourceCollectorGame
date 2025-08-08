// Глобальное состояние клиента
export const state = {
  // Сеть
  myId: null,
  connected: false,
  
  // Игровое состояние
  paused: false,
  gameStatus: 'lobby', // 'lobby' | 'playing'
  gameTime: 60,
  
  // Участники
  playerName: '',
  hostId: null,
  players: {},
  resources: [],
  
  // UI состояние
  quitModalOpen: false
};

// Геттеры
export const getMyPlayer = () => state.players[state.myId];
export const isHost = () => state.myId === state.hostId;
export const getAllPlayers = () => Object.values(state.players);

// Сеттеры
export const setMyId = (id) => { state.myId = id; };
export const setConnected = (connected) => { state.connected = connected; };
export const setPaused = (paused) => { state.paused = paused; };
export const setGameStatus = (status) => { state.gameStatus = status; };
export const setGameTime = (time) => { state.gameTime = time; };
export const setPlayerName = (name) => { state.playerName = name; };
export const setHostId = (id) => { state.hostId = id; };
export const setPlayers = (players) => { state.players = players; };
export const setResources = (resources) => { state.resources = resources; };
export const setQuitModalOpen = (open) => { state.quitModalOpen = open; };
