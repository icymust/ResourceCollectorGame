# 🟨 Resource Collector Game

A simple multiplayer grid-based game where each player is a pixel on a 20x20 board.
Players move with **WASD / Arrow Keys**, collect coins and power-ups, and compete to score the most points before the timer ends.

Whoever has the highest score at the end wins! 🏆

---

## 🚀 Getting Started

### 1. Clone and install

```bash
git clone <your-repo-url>
cd game
npm install
npm start
```

This starts the game server at **[http://localhost:3000](http://localhost:3000)**. (`http://127.0.0.1:3000` on windows)

---

## 🎮 How to Play

* **Controls:**

    * Move: `WASD` or Arrow Keys
    * Pause: `P`
    * Quit: `Esc`

* **Objective:**

    * Collect as many coins and power-ups as possible.
    * Some power-ups give bonuses (2x points, magnet, ghost mode, etc.).
    * Some are traps (freeze, poison, confusion).
    * The player with the most points when the round timer ends wins.

---

## 👥 Testing Multiplayer Locally

You can open **multiple browser tabs** pointing to:

* `http://localhost:3000`
* `http://127.0.0.1:3000` (on Windows)

Each tab simulates a different player.

---

## 🌍 Playing Online with Friends

To make your local server accessible:

1. Open a second terminal in the project folder.
2. Run:

   ```bash
   ngrok http 3000
   ```
3. Ngrok will give you a **public URL** (like `https://b6c770924690.ngrok-free.app/`).
4. Share this link with friends so they can join your game.

---

## 🛠 Development Notes

* FPS counter is enabled for debugging.
* Game supports from **2 players** up to **4 players** per round.
