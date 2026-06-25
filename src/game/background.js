// ── PARALLAX BACKGROUND ──────────────────────────────────────────────────────
import { getImage } from './sprites.js';
import { isTouchMobile } from '../utils/device.js';

function _bgSpeed() {
  if (isTouchMobile()) return 0.95;
  return 1.2;
}

const LAYER_DEFS = {
  ocean:  [{ key: 'ocean-bg',  speed: _bgSpeed() }],
  desert: [{ key: 'desert-bg', speed: _bgSpeed() }],
  city:   [{ key: 'city-bg',   speed: _bgSpeed() }],
  arctic: [{ key: 'arctic-bg', speed: _bgSpeed() }],
  space:  [{ key: 'space-bg',  speed: _bgSpeed() }],
};

let _layers      = [];
let _lastCanvasW = 0;
let _activeBiome   = 'ocean';

export function initBackground(biome) {
  _activeBiome = biome || 'ocean';
  const defs = LAYER_DEFS[_activeBiome] ?? LAYER_DEFS.ocean;
  _layers      = defs.map(d => ({ key: d.key, speed: _bgSpeed(), y: 0, offscreen: null, dh: 0 }));
  _lastCanvasW = 0;
}

export function updateBackground() {
  for (const l of _layers) l.y += l.speed;
}

export function drawBackground(ctx, canvas) {
  const cw = canvas.width;
  const ch = canvas.height;

  if (_lastCanvasW !== cw) {
    for (const l of _layers) { l.offscreen = null; l.dh = 0; }
    _lastCanvasW = cw;
  }

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
      ctx.drawImage(off, 0, startY);
      startY += dh;
    }
  }
}
