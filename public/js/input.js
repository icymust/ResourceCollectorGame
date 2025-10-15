import { state } from "./state.js";
import { KEYS } from "./constants.js";
import { emitMove, emitPause } from "./net.js";
import { openQuitModal } from "./ui.js";

export function bindInput() {
  document.addEventListener("keydown", handleKeyDown);
}

function handleKeyDown(e) {
  //ignore input in fields
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    return;
  }

  const key = e.key.toLowerCase();

  //quit via Escape
  if (KEYS.QUIT.includes(key)) {
    openQuitModal();
    e.preventDefault();
    return;
  }

  //pause via P
  if (KEYS.PAUSE.includes(key)) {
    emitPause(!state.paused, state.playerName || "Unknown");
    return;
  }

  //block movement if game is paused or modal is open
  if (state.paused || state.quitModalOpen) {
    return;
  }

  //movement
  let direction = null;
  if (KEYS.MOVE.LEFT.includes(key)) direction = "left";
  else if (KEYS.MOVE.RIGHT.includes(key)) direction = "right";
  else if (KEYS.MOVE.UP.includes(key)) direction = "up";
  else if (KEYS.MOVE.DOWN.includes(key)) direction = "down";

  if (direction) {
    e.preventDefault(); //do not scroll page

    //check if current player has confusion effect
    const currentPlayer = state.players && state.players[state.myId];

    //debug info about player state
    if (currentPlayer) {
      console.log(`Player state:`, {
        id: state.myId,
        confusedUntil: currentPlayer.confusedUntil,
        now: Date.now(),
        isConfused:
          currentPlayer.confusedUntil &&
          Date.now() < currentPlayer.confusedUntil,
      });
    } else {
      console.log("Current player not found in state.players", {
        myId: state.myId,
        players: state.players,
      });
    }

    const isConfused =
      currentPlayer &&
      currentPlayer.confusedUntil &&
      Date.now() < currentPlayer.confusedUntil;

    //debug info
    if (isConfused) {
      console.log(`CONFUSION ACTIVE! Original: ${direction}`);
    }

    //if player is confused, reverse controls
    if (isConfused) {
      const originalDirection = direction;
      switch (direction) {
        case "left":
          direction = "right";
          break;
        case "right":
          direction = "left";
          break;
        case "up":
          direction = "down";
          break;
        case "down":
          direction = "up";
          break;
      }
      console.log(`🔄 Direction reversed: ${originalDirection} → ${direction}`);
    }

    emitMove(direction);
  }
}
