// FPS overlay для диагностики производительности
let frames = 0;
let fps = 0;
let lastFpsTs = performance.now();
let fpsEl = null;

export function initFPS() {
  fpsEl = document.createElement('div');
  fpsEl.style.cssText = 'position:fixed;right:50px;top:16px;background:rgba(34, 30, 63, 0.6);color:#0f0;padding:4px 6px;border-radius:4px;font:12px/1 monospace;z-index:9999';
  fpsEl.textContent = 'FPS: --';
  document.body.appendChild(fpsEl);

  startFPSLoop();
}

function startFPSLoop() {
  function fpsLoop(ts) {
    frames++;
    if (ts - lastFpsTs >= 1000) {
      fps = frames;
      frames = 0;
      lastFpsTs = ts;
      if (fpsEl) {
        fpsEl.textContent = 'FPS: ' + fps;
      }
    }
    requestAnimationFrame(fpsLoop);
  }
  
  requestAnimationFrame(fpsLoop);
}

export function hideFPS() {
  if (fpsEl) {
    fpsEl.style.display = 'none';
  }
}

export function showFPS() {
  if (fpsEl) {
    fpsEl.style.display = 'block';
  }
}
