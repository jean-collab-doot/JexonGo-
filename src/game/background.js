// ── PARALLAX BACKGROUND ──────────────────────────────────────────────────────
// Each biome has N layers; each layer stores a key into SPRITE_DEFS and a
// scroll speed (canvas-pixels per game tick, applied downward so it looks
// like the player is flying upward).
//
// If an image isn't loaded yet the layer is silently skipped — game.js draws
// the solid-colour gradient fallback before calling drawBackground(), so the
// canvas is never blank.

import { getImage } from './sprites.js';

// ── LAYER CONFIG ─────────────────────────────────────────────────────────────
const LAYER_DEFS = {
  ocean:  [{ key: 'ocean-bg',  speed: 1.2 }],
  desert: [{ key: 'desert-bg', speed: 1.2 }],
  city:   [{ key: 'city-bg',   speed: 1.2 }],
  arctic: [{ key: 'arctic-bg', speed: 1.2 }],
  space:  [{ key: 'space-bg',  speed: 1.2 }],
};

// ── STATE ─────────────────────────────────────────────────────────────────────
// Each active layer: { key, speed, y } where y is the running scroll offset.
let _layers = [];

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/** Call once when a level starts (or biome changes). */
export function initBackground(biome) {
  const defs = LAYER_DEFS[biome] ?? LAYER_DEFS.ocean;
  _layers = defs.map(d => ({ key: d.key, speed: d.speed, y: 0 }));
}

/** Call every game-tick (before draw). */
export function updateBackground() {
  for (const l of _layers) l.y += l.speed;
}

/**
 * Draw all parallax layers onto the canvas.
 *
 * Each image is scaled to fill the canvas width while preserving its aspect
 * ratio, then tiled vertically so there are no gaps as it scrolls.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement}        canvas
 */
export function drawBackground(ctx, canvas) {
  const cw = canvas.width;
  const ch = canvas.height;

  for (const l of _layers) {
    const img = getImage(l.key);
    if (!img) continue;

    // Scale image to fit canvas width exactly
    const scale = cw / img.naturalWidth;
    const dw    = cw;
    const dh    = Math.ceil(img.naturalHeight * scale);
    if (dh <= 0) continue;

    // Wrap offset so the tile seamlessly loops
    const offset = l.y % dh;

    // Draw enough tiles to cover the full canvas height (usually 2, rarely 3)
    let startY = offset - dh; // start above viewport so first tile is visible from the top
    while (startY < ch) {
      ctx.drawImage(img, 0, startY, dw, dh);
      startY += dh;
    }
  }

}
