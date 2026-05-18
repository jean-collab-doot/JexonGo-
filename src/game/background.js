// ── PARALLAX BACKGROUND ──────────────────────────────────────────────────────
// Each biome has one scrolling layer. The source image is pre-scaled once into
// an offscreen canvas so every frame only does a cheap pixel blit, not a
// scaled drawImage of a 1024×1536 texture.

import { getImage } from './sprites.js';

const _isMobileBg = window.innerWidth < 768;

// ── LAYER CONFIG ─────────────────────────────────────────────────────────────
const LAYER_DEFS = {
  ocean:  [{ key: 'ocean-bg',  speed: _isMobileBg ? 0.8 : 1.2 }],
  desert: [{ key: 'desert-bg', speed: _isMobileBg ? 0.8 : 1.2 }],
  city:   [{ key: 'city-bg',   speed: _isMobileBg ? 0.8 : 1.2 }],
  arctic: [{ key: 'arctic-bg', speed: _isMobileBg ? 0.8 : 1.2 }],
  space:  [{ key: 'space-bg',  speed: _isMobileBg ? 0.8 : 1.2 }],
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let _layers       = [];
let _lastCanvasW  = 0;  // track resize to invalidate tile caches

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/** Call once when a level starts (or biome changes). */
export function initBackground(biome) {
  const defs = LAYER_DEFS[biome] ?? LAYER_DEFS.ocean;
  _layers = defs.map(d => ({ key: d.key, speed: d.speed, y: 0, offscreen: null, dh: 0 }));
  _lastCanvasW = 0; // force tile rebuild on next draw
}

/** Call every game-tick (before draw). */
export function updateBackground() {
  for (const l of _layers) l.y += l.speed;
}

/**
 * Draw all parallax layers onto the canvas.
 *
 * Each layer's image is pre-scaled to an offscreen canvas once (on first
 * available frame and whenever the canvas is resized). After that, every
 * frame is a plain blit — no GPU scaling, no save/restore.
 */
export function drawBackground(ctx, canvas) {
  const cw = canvas.width;
  const ch = canvas.height;

  // Invalidate tile caches on resize
  if (_lastCanvasW !== cw) {
    for (const l of _layers) { l.offscreen = null; l.dh = 0; }
    _lastCanvasW = cw;
  }

  for (const l of _layers) {
    // Build pre-scaled tile on first frame when image is loaded
    if (!l.offscreen) {
      const img = getImage(l.key);
      if (!img) continue;
      const scale = cw / img.naturalWidth;
      const dw    = cw;
      const dh    = Math.ceil(img.naturalHeight * scale);
      if (dh <= 0) continue;
      const off = document.createElement('canvas');
      off.width  = dw;
      off.height = dh;
      off.getContext('2d').drawImage(img, 0, 0, dw, dh);
      l.offscreen = off;
      l.dh        = dh;
    }

    // Blit pre-scaled tile — no scaling, just position
    const { offscreen: off, dh } = l;
    const offset = l.y % dh;
    let startY = offset - dh;
    while (startY < ch) {
      ctx.drawImage(off, 0, startY);
      startY += dh;
    }
  }
}
