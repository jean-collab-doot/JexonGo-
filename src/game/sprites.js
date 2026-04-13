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
  // Player ships — yellow tier (trainer / transport / attack)
  'ship-y1': { path: '/public/assets/ships/yellow/ship-01.png', frames: 5 },
  'ship-y2': { path: '/public/assets/ships/yellow/ship-02.png', frames: 5 },
  'ship-y3': { path: '/public/assets/ships/yellow/ship-03.png', frames: 5 },
  'ship-y4': { path: '/public/assets/ships/yellow/ship-04.png', frames: 5 },
  // Player ships — red tier (fighter / stealth)
  'ship-r1': { path: '/public/assets/ships/red/ship-01.png', frames: 5 },
  'ship-r2': { path: '/public/assets/ships/red/ship-02.png', frames: 5 },
  'ship-r3': { path: '/public/assets/ships/red/ship-03.png', frames: 5 },
  'ship-r4': { path: '/public/assets/ships/red/ship-04.png', frames: 5 },
  // Enemies
  'enemy-basic': { path: '/public/assets/enemies/enemy-01.png',        frames: 5 },
  'enemy-fast':  { path: '/public/assets/enemies/enemy-02.png',        frames: 4 },
  'enemy-death': { path: '/public/assets/enemies/enemy-explosion.png', frames: 7 },
  // FX
  'bolt':  { path: '/public/assets/fx/bolt.png',        frames: 4 },
  'spark': { path: '/public/assets/fx/explosion-a.png', frames: 8 },
  // Ocean backgrounds (Day variant)
  'ocean-back':   { path: '/public/assets/bg/ocean/back.png',   frames: 1 },
  'ocean-clouds': { path: '/public/assets/bg/ocean/clouds.png', frames: 1 },
  'ocean-middle': { path: '/public/assets/bg/ocean/middle.png', frames: 1 },
};

// Aircraft ID → sprite key
export const AIRCRAFT_SPRITE = {
  t6:   'ship-y1',
  pc21: 'ship-y2',
  c130: 'ship-y3',
  a10:  'ship-y4',
  f16:  'ship-r1',
  f18:  'ship-r2',
  f22:  'ship-r3',
  f35:  'ship-r4',
  b2:   'ship-r3',   // spaceship-unit added in M3
  sr71: 'ship-r4',   // spaceship-unit+thrust added in M3
};

// Enemy type → sprite key
export const ENEMY_SPRITE = {
  basic: 'enemy-basic',
  fast:  'enemy-fast',
  tank:  'enemy-basic',  // enemy-03 added in M2
  boss:  'enemy-basic',  // boss composite added in M2
};

// Biome → sprite keys required before gameplay starts
export const BIOME_SPRITES = {
  ocean: [
    'ship-y1','ship-y2','ship-y3','ship-y4',
    'ship-r1','ship-r2','ship-r3','ship-r4',
    'enemy-basic','enemy-fast','enemy-death',
    'bolt','spark',
    'ocean-back','ocean-clouds','ocean-middle',
  ],
};

// ── LOADING ──────────────────────────────────────────────────────────────────

/** Preload all ship sprites at app startup so the hangar renders immediately. */
export function preloadShips() {
  ['ship-y1','ship-y2','ship-y3','ship-y4','ship-r1','ship-r2','ship-r3','ship-r4']
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
