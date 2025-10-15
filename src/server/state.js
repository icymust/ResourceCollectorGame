//global server state
let players = {};
let resources = [];
let gameStatus = 'waiting'; //'waiting' | 'started'
let gamePaused = false;
let gameTime = 60; //round duration (sec)
let gameInterval = null;
let remainingTime = 0;

//getters
const getPlayers = () => players;
const getResources = () => resources;
const getGameStatus = () => gameStatus;
const isGamePaused = () => gamePaused;
const getGameTime = () => gameTime;
const getGameInterval = () => gameInterval;
const getRemainingTime = () => remainingTime;

//setters
const setPlayers = (newPlayers) => { players = newPlayers; };
const setResources = (newResources) => { resources = newResources; };
const setGameStatus = (status) => { gameStatus = status; };
const setGamePaused = (paused) => { gamePaused = paused; };
const setGameTime = (time) => { gameTime = time; };
const setGameInterval = (interval) => { gameInterval = interval; };
const setRemainingTime = (time) => { remainingTime = time; };

//utils
const addPlayer = (id, playerData) => { players[id] = playerData; };
const removePlayer = (id) => { delete players[id]; };
const getPlayer = (id) => players[id];
const getPlayerCount = () => Object.keys(players).length;
const getAllPlayersArray = () => Object.values(players);

const addResource = (resource) => { resources.push(resource); };
const clearResources = () => { resources = []; };

//helper functions
const getCurrentHostId = () => Object.keys(players)[0];

const resetPlayersReady = () => {
  Object.values(players).forEach(p => { p.ready = false; });
};

module.exports = {
  //getters
  getPlayers,
  getResources,
  getGameStatus,
  isGamePaused,
  getGameTime,
  getGameInterval,
  getRemainingTime,
  
  //setters
  setPlayers,
  setResources,
  setGameStatus,
  setGamePaused,
  setGameTime,
  setGameInterval,
  setRemainingTime,
  
  //player utils
  addPlayer,
  removePlayer,
  getPlayer,
  getPlayerCount,
  getAllPlayersArray,
  
  //resource utils
  addResource,
  clearResources,
  
  //helpers
  getCurrentHostId,
  resetPlayersReady
};
