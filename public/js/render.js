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
}

export function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    renderFrame();
  });
}

function renderFrame() {
  // Игроки: только дифф позиций
  if (pending.players) {
    // снять прошлые позиции
    for (const [id, oldIdx] of prevPlayerIndex) {
      const oldCell = board.children[oldIdx];
      if (oldCell) {
        oldCell.classList.remove("player");
        oldCell.style.backgroundColor = "";
        oldCell.title = "";
      }
    }
    prevPlayerIndex.clear();

    // поставить новые
    Object.values(pending.players).forEach((p) => {
      const idx = p.y * GRID.COLS + p.x;
      const cell = board.children[idx];
      if (cell) {
        cell.classList.add("player");
        cell.style.backgroundColor = p.color;
        cell.title = p.name;
        prevPlayerIndex.set(p.id, idx);
      }
    });

    // табло (одним innerHTML за кадр)
    scoreboard.innerHTML =
      "<b>Scores:</b><br>" +
      Object.values(pending.players)
        .map(
          (p) => `
          <span style="display:inline-block;width:14px;height:14px;background:${p.color};border:1px solid #000;margin-right:5px;"></span>
          ${p.name}: ${p.score}
        `
        )
        .join("<br>");

    pending.players = null; // отрисовали — сбросили
  }

  // Ресурсы: дифф по множеству
  if (pending.resources) {
    // Проверяем, уменьшилось ли количество ресурсов (значит кто-то собрал)
    if (lastResourceCount > 0 && pending.resources.length < lastResourceCount) {
      // Воспроизводим звук сбора ресурса
      audioManager.play('coin-pickup');
    }
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
            cell.textContent = "";
            cell.title = "";
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
          cell.style.backgroundColor = resource.color || "#FFD700";
          cell.textContent = resource.symbol || "●";
          cell.title = `${resource.type || "Resource"} (+${
            resource.points || 1
          } points)`;
        }
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
