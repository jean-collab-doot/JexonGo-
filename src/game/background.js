// ── PARALLAX BACKGROUND ──────────────────────────────────────────────────────
import { getImage } from './sprites.js';
import { isTouchMobile } from '../utils/device.js';

function _bgSpeed() {
  if (isTouchMobile()) return 0.1;
  return 0.14;
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
let _lastCanvasH = 0;
let _activeBiome   = 'ocean';

export function initBackground(biome) {
  _activeBiome = biome || 'ocean';
  const defs = LAYER_DEFS[_activeBiome] ?? LAYER_DEFS.ocean;
  _layers = defs.map(d => ({
    key: d.key,
    speed: _bgSpeed(),
    y: 0,
    positioned: false,
    dh: 0,
  }));
  _lastCanvasW = 0;
  _lastCanvasH = 0;
}

export function updateBackground(step = 1) {
  for (const l of _layers) {
    l.y += l.speed * step;
  }
}

export function drawBackground(ctx, canvas) {
  const cw = canvas.width;
  const ch = canvas.height;

  if (_lastCanvasW !== cw || _lastCanvasH !== ch) {
    for (const l of _layers) {
      l.dh = 0;
      l.positioned = false;
    }
    _lastCanvasW = cw;
    _lastCanvasH = ch;
  }

  for (const l of _layers) {
    const img = getImage(l.key);
    if (!img) continue;

    if (!l.dh) {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) continue;
      l.dh = Math.ceil(img.naturalHeight * (cw / img.naturalWidth));
    }

    const { dh } = l;
    if (!l.positioned) {
      // Begin at the map's bottom edge, then scroll toward its top.
      l.y = ch;
      l.positioned = true;
    }
    const offset = l.y % dh;
    let startY   = offset - dh;
    while (startY < ch) {
      ctx.drawImage(img, 0, startY, cw, dh);
      startY += dh;
    }
  }
}
