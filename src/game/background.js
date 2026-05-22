// ── PARALLAX BACKGROUND ──────────────────────────────────────────────────────
// Two-level cache on mobile:
//   Level 1 — per-layer tile canvas (pre-scaled image, built once per biome/resize)
//   Level 2 — full-frame canvas (composite of all tiles, rebuilt every other frame)
// Skipped frames blit the full-frame cache with a single drawImage call.
// Desktop renders directly to ctx with no extra canvas overhead.

import { getImage } from './sprites.js';

const _isMobileBg = /iPhone|iPad|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

// ── LAYER CONFIG ─────────────────────────────────────────────────────────────
const _bgSpeed = _isMobileBg ? 1.0 : 2.0;
const LAYER_DEFS = {
  ocean:  [{ key: 'ocean-bg',  speed: _bgSpeed }],
  desert: [{ key: 'desert-bg', speed: _bgSpeed }],
  city:   [{ key: 'city-bg',   speed: _bgSpeed }],
  arctic: [{ key: 'arctic-bg', speed: _bgSpeed }],
  space:  [{ key: 'space-bg',  speed: _bgSpeed }],
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let _layers      = [];
let _lastCanvasW = 0;

// Shared tick counter — both update and draw read it to stay in sync
let _bgTick = 0;

// Level-2 full-frame cache (mobile only)
let _frameCache    = null;
let _frameCacheCtx = null;

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/** Call once when a level starts (or biome changes). */
export function initBackground(biome) {
  const defs = LAYER_DEFS[biome] ?? LAYER_DEFS.ocean;
  _layers      = defs.map(d => ({ key: d.key, speed: d.speed, y: 0, offscreen: null, dh: 0 }));
  _lastCanvasW = 0;  // force tile rebuild on next draw
  _frameCache  = null;
  _bgTick      = 0;
}

/** Call every game-tick (before draw). Advances scroll position. */
export function updateBackground() {
  _bgTick++;
  // Always advance position — skip only affects draw, not scroll speed
  for (const l of _layers) l.y += l.speed;
}

/**
 * Draw all parallax layers onto the canvas.
 *
 * Desktop: tiles are blitted directly to ctx every frame (no cache overhead).
 * Mobile even ticks: composite tiles into _frameCache, then blit cache to ctx.
 * Mobile odd ticks: blit _frameCache to ctx — single drawImage, no other work.
 */
export function drawBackground(ctx, canvas) {
  const cw = canvas.width;
  const ch = canvas.height;

  // Invalidate tile caches on resize
  if (_lastCanvasW !== cw) {
    for (const l of _layers) { l.offscreen = null; l.dh = 0; }
    _frameCache  = null;
    _lastCanvasW = cw;
  }

  // ── Mobile skip frame: blit last cached composite ─────────────────────────
  if (_isMobileBg && _bgTick % 2 !== 0) {
    if (_frameCache) ctx.drawImage(_frameCache, 0, 0);
    return;
  }

  // ── Choose render target ───────────────────────────────────────────────────
  let targetCtx = ctx;
  if (_isMobileBg) {
    if (!_frameCache || _frameCache.width !== cw || _frameCache.height !== ch) {
      _frameCache    = document.createElement('canvas');
      _frameCache.width  = cw;
      _frameCache.height = ch;
      _frameCacheCtx = _frameCache.getContext('2d');
    }
    _frameCacheCtx.clearRect(0, 0, cw, ch);
    targetCtx = _frameCacheCtx;
  }

  // ── Render tiles (pre-scaled level-1 cache) ───────────────────────────────
  for (const l of _layers) {
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

    const { offscreen: off, dh } = l;
    const offset = l.y % dh;
    let startY   = offset - dh;
    while (startY < ch) {
      targetCtx.drawImage(off, 0, startY);
      startY += dh;
    }
  }

  // ── Blit full-frame cache to main canvas (mobile only) ───────────────────
  if (_isMobileBg) ctx.drawImage(_frameCache, 0, 0);
}
