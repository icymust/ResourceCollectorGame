import { state } from "./state.js";
import { GRID } from "./constants.js";
import { audioManager } from "./audio.js";

//render pipeline
let pending = { players: null, resources: null };
let scheduled = false;

const prevPlayerIndex = new Map(); //id -> cell index (y*20 + x)
const resourceSet = new Set(); //"x,y" for fast comparison

let board = null;
let scoreboard = null;
let lastResourceCount = 0; //for tracking collected resources
let effectUpdateInterval = null; //interval for updating effects

export function initBoard() {
  board = document.getElementById("game-board");
  scoreboard = document.getElementById("scoreboard");

  //create 400 cells
  board.innerHTML = "";
  for (let i = 0; i < GRID.TOTAL_CELLS; i++) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    board.appendChild(cell);
  }

  //start periodic effect updates
  startEffectUpdates();
}

//function to start auto effect updates
function startEffectUpdates() {
  //clear previous interval if exists
  if (effectUpdateInterval) {
    clearInterval(effectUpdateInterval);
  }

  //update every second
  effectUpdateInterval = setInterval(() => {
    //check if there are players with active effects
    const players = state.players || {};
    const hasActiveEffects = Object.values(players).some(
      (player) =>
        (player.doublePointsUntil && Date.now() < player.doublePointsUntil) ||
        (player.magnetUntil && Date.now() < player.magnetUntil) ||
        (player.frozenUntil && Date.now() < player.frozenUntil) ||
        (player.confusedUntil && Date.now() < player.confusedUntil) ||
        (player.poisonedUntil && Date.now() < player.poisonedUntil) ||
        (player.ghostModeUntil && Date.now() < player.ghostModeUntil)
    );

    //if there are active effects, update display
    if (hasActiveEffects) {
      pending.players = players;
      scheduleRender();
    }
  }, 1000); //update every second
}

export function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    renderFrame();
  });
}

//function to get active player effects
function getPlayerEffects(player) {
  const effects = [];
  const now = Date.now();

  if (player.doublePointsUntil && now < player.doublePointsUntil) {
    const remaining = Math.ceil((player.doublePointsUntil - now) / 1000);
    effects.push({
      class: "double-points",
      icon: "✨",
      text: "2x",
      tooltip: `Double points for ${remaining}s`,
      color: "#333",
      background: "linear-gradient(45deg, #FFE55C, #FFD700)",
      border: "#FFD700",
    });
  }

  if (player.magnetUntil && now < player.magnetUntil) {
    const remaining = Math.ceil((player.magnetUntil - now) / 1000);
    effects.push({
      class: "magnet-effect",
      icon: "🧲",
      text: "MAG",
      tooltip: `Magnet effect for ${remaining}s`,
      color: "white",
      background: "linear-gradient(45deg, #FF4444, #CC3333)",
      border: "#FF4444",
    });
  }

  if (player.frozenUntil && now < player.frozenUntil) {
    const remaining = Math.ceil((player.frozenUntil - now) / 1000);
    effects.push({
      class: "frozen-effect",
      icon: "🧊",
      text: "FRZ",
      tooltip: `Frozen for ${remaining}s`,
      color: "white",
      background: "linear-gradient(45deg, #00BFFF, #0099CC)",
      border: "#00BFFF",
    });
  }

  if (player.confusedUntil && now < player.confusedUntil) {
    const remaining = Math.ceil((player.confusedUntil - now) / 1000);
    effects.push({
      class: "confused-effect",
      icon: "😵",
      text: "CNF",
      tooltip: `Confused controls for ${remaining}s`,
      color: "white",
      background: "linear-gradient(45deg, #FF69B4, #CC1493)",
      border: "#FF69B4",
    });
  }

  if (player.poisonedUntil && now < player.poisonedUntil) {
    const remaining = Math.ceil((player.poisonedUntil - now) / 1000);
    effects.push({
      class: "poisoned-effect",
      icon: "☣️",
      text: "PSN",
      tooltip: `Poisoned for ${remaining}s (-1 HP/2s)`,
      color: "white",
      background: "linear-gradient(45deg, #32CD32, #228B22)",
      border: "#32CD32",
    });
  }

  if (player.ghostModeUntil && now < player.ghostModeUntil) {
    const remaining = Math.ceil((player.ghostModeUntil - now) / 1000);
    effects.push({
      class: "ghost-mode-effect",
      icon: "👻",
      text: "GHOST",
      tooltip: `Ghost Mode for ${remaining}s (Other players invisible)`,
      color: "white",
      background: "linear-gradient(45deg, #9966CC, #6633AA)",
      border: "#9966CC",
    });
  }

  return effects;
}

function renderFrame() {
  //players: only position diff
  if (pending.players) {
    //remove previous positions
    for (const [id, oldIdx] of prevPlayerIndex) {
      const oldCell = board.children[oldIdx];
      if (oldCell) {
        oldCell.classList.remove("player");
        oldCell.classList.remove("double-points"); //remove double points effect
        oldCell.classList.remove("magnet-effect"); //remove magnet effect
        oldCell.classList.remove("frozen-effect"); //remove frozen effect
        oldCell.classList.remove("confused-effect"); //remove confused effect
        oldCell.classList.remove("poisoned-effect"); //remove poisoned effect
        oldCell.classList.remove("ghost-mode-effect"); //remove ghost mode effect
        //do not clear backgroundColor if there is a resource on this cell
        if (!oldCell.classList.contains("resource")) {
          oldCell.style.backgroundColor = "";
        }
        oldCell.title = "";
      }
    }
    prevPlayerIndex.clear();

    //set new positions
    Object.values(pending.players).forEach((p) => {
      const idx = p.y * GRID.COLS + p.x;
      const cell = board.children[idx];
      if (cell) {
        //check Ghost Mode - if someone else activated Ghost Mode, I don't see MYSELF
        const playersWithGhostMode = Object.values(pending.players).filter(
          (player) =>
            player.id !== state.myId && // не я
            player.ghostModeUntil &&
            Date.now() < player.ghostModeUntil
        );

        const shouldHideMyself =
          playersWithGhostMode.length > 0 && p.id === state.myId;

        //if another player activated Ghost Mode and this is my character - hide me
        if (shouldHideMyself) {
          //do not add player class and do not show my player
          prevPlayerIndex.set(p.id, idx);
          return;
        }

        cell.classList.add("player");

        //check active effects
        const effects = getPlayerEffects(p);
        const hasDoublePoints = effects.some(
          (effect) => effect.class === "double-points"
        );
        const hasMagnet = effects.some(
          (effect) => effect.class === "magnet-effect"
        );
        const isFrozen = effects.some(
          (effect) => effect.class === "frozen-effect"
        );
        const isConfused = effects.some(
          (effect) => effect.class === "confused-effect"
        );
        const isPoisoned = effects.some(
          (effect) => effect.class === "poisoned-effect"
        );
        const hasGhostMode = effects.some(
          (effect) => effect.class === "ghost-mode-effect"
        );
        if (hasDoublePoints) {
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
        //if there is a resource on the cell, show info about both player and resource
        if (cell.classList.contains("resource")) {
          const effectTexts = [];
          if (hasDoublePoints) effectTexts.push("2x очков");
          if (hasMagnet) effectTexts.push("магнит");
          if (isFrozen) effectTexts.push("заморожен");
          if (isConfused) effectTexts.push("запутан");
          if (isPoisoned) effectTexts.push("отравлен");
          if (hasGhostMode) effectTexts.push("призрачный режим");
          const effectText = effectTexts.length
            ? ` [${effectTexts.join(", ")}!]`
            : "";
          cell.title = `${p.name}${effectText} (на ресурсе: ${
            cell.title.split(" (+")[0]
          })`;
        } else {
          const effectTexts = [];
          if (hasDoublePoints) effectTexts.push("2x очков");
          if (hasMagnet) effectTexts.push("магнит");
          if (isFrozen) effectTexts.push("заморожен");
          if (isConfused) effectTexts.push("запутан");
          if (isPoisoned) effectTexts.push("отравлен");
          if (hasGhostMode) effectTexts.push("призрачный режим");
          const effectText = effectTexts.length
            ? ` [${effectTexts.join(", ")}!]`
            : "";
          cell.title = p.name + effectText;
        }
        prevPlayerIndex.set(p.id, idx);
      }
    });

    scoreboard.innerHTML =
      "<div style='font-size:18px;font-weight:bold;color:white;text-align:center;margin-bottom:12px;text-shadow: 0 2px 4px rgba(0,0,0,0.5);border-bottom:2px solid rgba(255,255,255,0.3);padding-bottom:8px;'>🏆 Scores</div>" +
      Object.values(pending.players)
        .map((p) => {
          //get all active player effects
          const effects = getPlayerEffects(p);

          //create string with effects
          const effectsText = effects
            .map(
              (effect) =>
                ` <span class="effect-icon" style="color:${effect.color};background:${effect.background};border:1px solid ${effect.border};" title="${effect.tooltip}">${effect.icon} ${effect.text}</span>`
            )
            .join("");

          return `
          <div style="margin-bottom: 10px; padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); border-radius: 6px;">
            <span style="display:inline-block;width:19px;height:16px;background:${p.color};border:2px solid rgba(255,255,255,0.8);margin-right:10px;border-radius:3px;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></span>
            <strong style="font-size:16px;color:white;text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${p.name}:</strong> <span style="font-weight:bold;color:#FFE55C;font-size:16px;text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${p.score}</span>${effectsText}
          </div>
        `;
        })
        .join(""); //removed <br> since now using divs

    pending.players = null; //rendered — reset
  }

  //resources: diff by set
  if (pending.resources) {
    //update resource counter
    lastResourceCount = pending.resources.length;

    //remove missing
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

            //clear all styles that may remain from resources
            cell.style.border = "";
            cell.style.boxShadow = "";

            //if there is a player on the cell, restore their color and title
            if (cell.classList.contains("player")) {
              //find player on this position from current state
              const currentPlayers = state.players || {};
              const playerOnCell = Object.values(currentPlayers).find(
                (p) => p.x === x && p.y === y
              );
              if (playerOnCell) {
                cell.style.backgroundColor = playerOnCell.color;
                cell.title = playerOnCell.name;
              }
            } else {
              //if no player, clear completely
              cell.style.backgroundColor = "";
              cell.title = "";
            }
          }
        }
      }
    }

    //add new
    for (const resource of pending.resources) {
      const key = `${resource.x},${resource.y}`;
      if (!resourceSet.has(key)) {
        const idx = resource.y * GRID.COLS + resource.x;
        const cell = board.children[idx];
        if (cell) {
          cell.classList.add("resource");

          //special handling for bombs - do not set background
          if (resource.type === "timeBomb") {
            cell.style.backgroundColor = ""; //transparent background for bomb
            cell.classList.add("bomb-resource"); //special class for bombs
            cell.title = `💣 Time Bomb (+${
              resource.points || 4
            } points for deactivation! RISK: -3 points on explosion)`;
            cell.textContent = resource.symbol || "💣"; //bomb symbol
          } else if (resource.type === "freezeTrap") {
            cell.textContent = ""; //remove any symbol
            cell.title = ""; //remove tooltip
            cell.style.backgroundColor = "transparent"; //transparent background
            cell.style.border = "none"; //no border
            cell.style.boxShadow = "none"; //no glow
          } else if (resource.type === "poisonTrap") {
            //make poison trap invisible
            cell.textContent = ""; //remove any symbol
            cell.title = ""; //remove tooltip
            cell.style.backgroundColor = "transparent"; //transparent background
            cell.style.border = "none"; //no border
            cell.style.boxShadow = "none"; //no glow
          } else if (resource.type === "confusionTrap") {
            //make confusion trap invisible
            cell.textContent = ""; //remove any symbol
            cell.title = ""; //remove tooltip
            cell.style.backgroundColor = "transparent"; //transparent background
            cell.style.border = "none"; //no border
            cell.style.boxShadow = "none"; //no glow
          } else {
            cell.classList.remove("bomb-resource"); //remove bomb class
            cell.style.backgroundColor = resource.color || "#FFD700";
            cell.title = `${resource.type || "Resource"} (+${
              resource.points || 1
            } points)`;
            cell.textContent = resource.symbol || "●"; //add symbol for regular resources
          }
        }
      }
    }
    resourceSet.clear();
    pending.resources.forEach((r) => resourceSet.add(`${r.x},${r.y}`));
    pending.resources = null;
  }
}

//api for updating
export function updatePlayers(players) {
  pending.players = players;
  scheduleRender();
}

export function updateResources(resources) {
  if (state.paused) return;
  pending.resources = resources;
  scheduleRender();
}

//function to clear intervals (called on game exit)
export function cleanup() {
  if (effectUpdateInterval) {
    clearInterval(effectUpdateInterval);
    effectUpdateInterval = null;
  }
}

//function to show bomb explosion effect
export function showBombExplosion(x, y) {
  const idx = y * GRID.COLS + x;
  const cell = board.children[idx];
  if (cell) {
    //create explosion effect
    const explosion = document.createElement("div");
    explosion.innerHTML = "💥";
    explosion.style.cssText = `
      position: absolute;
      font-size: 40px;
      z-index: 1000;
      pointer-events: none;
      animation: explosionEffect 1s ease-out forwards;
    `;

    //add styles for explosion animation if not present
    if (!document.querySelector("#explosion-styles")) {
      const styles = document.createElement("style");
      styles.id = "explosion-styles";
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

    //position explosion at cell center
    const cellRect = cell.getBoundingClientRect();
    const gameBoard = document.getElementById("game-board");
    const boardRect = gameBoard.getBoundingClientRect();

    explosion.style.left =
      cellRect.left - boardRect.left + cellRect.width / 2 - 20 + "px";
    explosion.style.top =
      cellRect.top - boardRect.top + cellRect.height / 2 - 20 + "px";

    gameBoard.appendChild(explosion);

    //remove effect after 1 second
    setTimeout(() => {
      if (explosion.parentNode) {
        explosion.parentNode.removeChild(explosion);
      }
    }, 1000);
  }
}
