// ── SPRITE LOADER & RENDERER ─────────────────────────────────────────────────
// Single source of truth for all pixel-art assets.
// Every image is loaded once and cached; drawFrame() is the only draw primitive.

const _images = new Map(); // path → HTMLImageElement

function _load(path) {
  if (_images.has(path)) return Promise.resolve(_images.get(path));
  return new Promise((resolve, reject) => {
    const img   = new Image();
    img.onload  = () => { _images.set(path, img); resolve(img); };
    img.onerror = () => reject(new Error(`Sprite not found: ${path}`));
    img.src     = path;
  });
}

// ── SPRITE DEFINITIONS ───────────────────────────────────────────────────────
export const SPRITE_DEFS = {
  // Player ships — new top-down artwork (single frame each)
  'ship-t6':   { path: '/public/assets/ships/player/t6.png',   frames: 1 },
  'ship-pc21': { path: '/public/assets/ships/player/pc21.png', frames: 1 },
  'ship-c130': { path: '/public/assets/ships/player/c130.png', frames: 1 },
  'ship-a10':  { path: '/public/assets/ships/player/a10.png',  frames: 1 },
  'ship-f16':  { path: '/public/assets/ships/player/f16.png',  frames: 1 },
  'ship-f18':  { path: '/public/assets/ships/player/f18.png',  frames: 1 },
  'ship-f22':  { path: '/public/assets/ships/player/f22.png',  frames: 1 },
  'ship-f35':  { path: '/public/assets/ships/player/f35.png',  frames: 1 },
  'ship-b2':   { path: '/public/assets/ships/player/b2.png',   frames: 1 },
  'ship-sr71': { path: '/public/assets/ships/player/sr71.png', frames: 1 },
  // Enemies — plane artwork
  'enemy-f15':   { path: '/public/assets/enemies/planes/f15.png',  frames: 1 },
  'enemy-t38':   { path: '/public/assets/enemies/planes/t38.png',  frames: 1 },
  'enemy-f117':  { path: '/public/assets/enemies/planes/f117.png', frames: 1 },
  // FX — death / hit
  'enemy-death': { path: '/public/assets/enemies/enemy-explosion.png', frames: 7 },
  // FX
  'bolt':  { path: '/public/assets/fx/rocket.png',      frames: 1 },
  'spark': { path: '/public/assets/fx/explosion-a.png', frames: 8 },
  // Ocean backgrounds (Day variant)
  'ocean-back':   { path: '/public/assets/bg/ocean/back.png',   frames: 1 },
  'ocean-clouds': { path: '/public/assets/bg/ocean/clouds.png', frames: 1 },
  'ocean-middle': { path: '/public/assets/bg/ocean/middle.png', frames: 1 },
};

// Aircraft ID → sprite key
export const AIRCRAFT_SPRITE = {
  t6:   'ship-t6',
  pc21: 'ship-pc21',
  c130: 'ship-c130',
  a10:  'ship-a10',
  f16:  'ship-f16',
  f18:  'ship-f18',
  f22:  'ship-f22',
  f35:  'ship-f35',
  b2:   'ship-b2',
  sr71: 'ship-sr71',
};

// Enemy type → sprite key
export const ENEMY_SPRITE = {
  basic: 'enemy-f15',
  fast:  'enemy-t38',
  tank:  'enemy-f117',
  boss:  'enemy-f117',
};

// Biome → sprite keys required before gameplay starts
export const BIOME_SPRITES = {
  ocean: [
    'ship-t6','ship-pc21','ship-c130','ship-a10',
    'ship-f16','ship-f18','ship-f22','ship-f35','ship-b2','ship-sr71',
    'enemy-f15','enemy-t38','enemy-f117','enemy-death',
    'bolt','spark',
    'ocean-back','ocean-clouds','ocean-middle',
  ],
};

// ── LOADING ──────────────────────────────────────────────────────────────────

/** Preload all ship sprites at app startup so the hangar renders immediately. */
export function preloadShips() {
  ['ship-t6','ship-pc21','ship-c130','ship-a10',
   'ship-f16','ship-f18','ship-f22','ship-f35','ship-b2','ship-sr71']
    .forEach(k => {
      const def = SPRITE_DEFS[k];
      if (def) _load(def.path).catch(() => {});
    });
}

/** Preload every sprite required for a biome. Missing files are warned, never thrown. */
export async function preloadBiome(biome) {
  const keys = BIOME_SPRITES[biome] ?? Object.keys(SPRITE_DEFS);
  await Promise.all(
    keys.map(k => {
      const def = SPRITE_DEFS[k];
      return def ? _load(def.path).catch(err => console.warn('[sprites]', err.message)) : Promise.resolve();
    })
  );
}

// ── DRAW ─────────────────────────────────────────────────────────────────────

/** Get the loaded Image for a key, or null. */
export function getImage(key) {
  const def = SPRITE_DEFS[key];
  return def ? (_images.get(def.path) ?? null) : null;
}

/**
 * Draw one animation frame of a sprite centred at (cx, cy).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string}  key     SPRITE_DEFS key
 * @param {number}  frame   zero-based frame index (floored internally)
 * @param {number}  cx      centre X
 * @param {number}  cy      centre Y
 * @param {number}  w       drawn width
 * @param {number}  h       drawn height
 * @param {object}  [opts]
 * @param {number}  [opts.rotate=0]
 * @param {number}  [opts.alpha=1]
 */
export function drawFrame(ctx, key, frame, cx, cy, w, h, { rotate = 0, alpha = 1 } = {}) {
  const img = getImage(key);
  if (!img) return;

  const def = SPRITE_DEFS[key];
  const fw  = img.naturalWidth / def.frames;
  const fh  = img.naturalHeight;
  const f   = Math.floor(frame) % def.frames;

  ctx.save();
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  if (rotate !== 0) ctx.rotate(rotate);
  ctx.drawImage(img, f * fw, 0, fw, fh, -w / 2, -h / 2, w, h);
  ctx.restore();
}
