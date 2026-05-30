// ── PARALLAX BACKGROUND ──────────────────────────────────────────────────────
import { getImage } from './sprites.js';
import { isTouchMobile, isTablet, isPhone } from '../utils/device.js';

function _bgSpeed() {
  if (isPhone()) return 0.45;
  if (isTablet()) return 0.55;
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
let _bgTick = 0;
let _bgSkip = 0;
let _frameCache    = null;
let _frameCacheCtx = null;
let _activeBiome   = 'ocean';

export function initBackground(biome) {
  _activeBiome = biome || 'ocean';
  const defs = LAYER_DEFS[_activeBiome] ?? LAYER_DEFS.ocean;
  _layers      = defs.map(d => ({ key: d.key, speed: _bgSpeed(), y: 0, offscreen: null, dh: 0 }));
  _lastCanvasW = 0;
  _frameCache  = null;
  _bgTick      = 0;
  _bgSkip      = 0;
}

export function updateBackground() {
  _bgTick++;
  if (isTouchMobile()) _bgSkip++;
  const skipEvery = isPhone() ? 2 : isTablet() ? 1 : 1;
  if (isTouchMobile() && _bgSkip % skipEvery !== 0) return;
  for (const l of _layers) l.y += l.speed;
}

export function drawBackground(ctx, canvas) {
  const cw = canvas.width;
  const ch = canvas.height;

  if (_lastCanvasW !== cw) {
    for (const l of _layers) { l.offscreen = null; l.dh = 0; }
    _frameCache  = null;
    _lastCanvasW = cw;
  }

  const drawEvery = isPhone() ? 2 : isTablet() ? 1 : 1;
  if (isTouchMobile() && _bgTick % drawEvery !== 0) {
    if (_frameCache) ctx.drawImage(_frameCache, 0, 0);
    return;
  }

  let targetCtx = ctx;
  if (isTouchMobile()) {
    if (!_frameCache || _frameCache.width !== cw || _frameCache.height !== ch) {
      _frameCache    = document.createElement('canvas');
      _frameCache.width  = cw;
      _frameCache.height = ch;
      _frameCacheCtx = _frameCache.getContext('2d');
    }
    _frameCacheCtx.clearRect(0, 0, cw, ch);
    targetCtx = _frameCacheCtx;
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
      targetCtx.drawImage(off, 0, startY);
      startY += dh;
    }
  }

  if (isTouchMobile()) ctx.drawImage(_frameCache, 0, 0);
}
