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

function buildScaledLayer(layer, img, width) {
  const height = Math.max(1, Math.ceil(img.naturalHeight * (width / img.naturalWidth)));
  const chunkHeight = 1536;
  const sourceScale = img.naturalHeight / height;
  layer.surface = [];
  for (let y = 0; y < height; y += chunkHeight) {
    const h = Math.min(chunkHeight, height - y);
    const surface = document.createElement('canvas');
    surface.width = width;
    surface.height = h;
    const surfaceCtx = surface.getContext('2d', { alpha: false });
    surfaceCtx.imageSmoothingEnabled = false;
    surfaceCtx.drawImage(img, 0, y * sourceScale, img.naturalWidth, h * sourceScale, 0, 0, width, h);
    layer.surface.push({ canvas: surface, y });
  }
  layer.dh = height;
}

export function initBackground(biome) {
  _activeBiome = biome || 'ocean';
  const defs = LAYER_DEFS[_activeBiome] ?? LAYER_DEFS.ocean;
  _layers = defs.map(d => ({
    key: d.key,
    speed: _bgSpeed(),
    y: 0,
    positioned: false,
    dh: 0,
    surface: null,
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
      l.surface = null;
      l.positioned = false;
    }
    _lastCanvasW = cw;
    _lastCanvasH = ch;
  }

  for (const l of _layers) {
    const img = getImage(l.key);
    if (!img) continue;

    if (!l.dh || !l.surface) {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) continue;
      // Scale the 8192px map once instead of resizing it every frame.
      buildScaledLayer(l, img, cw);
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
      for (const chunk of l.surface) {
        const y = startY + chunk.y;
        if (y < ch && y + chunk.canvas.height > 0) ctx.drawImage(chunk.canvas, 0, y);
      }
      startY += dh;
    }
  }
}
