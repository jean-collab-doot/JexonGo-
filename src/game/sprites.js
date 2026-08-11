// ── SPRITE LOADER & RENDERER ─────────────────────────────────────────────────
// Single source of truth for all pixel-art assets.
// Every image is loaded once and cached; drawFrame() is the only draw primitive.

import { isTouchMobile } from '../utils/device.js';

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

function _spritePath(def) {
  return def.path;
}

// ── SPRITE DEFINITIONS ───────────────────────────────────────────────────────
export const SPRITE_DEFS = {
  // Player ships — new top-down artwork (single frame each)
  'ship-t6':   { path: '/assets/ships/player/t6.png',   mobilePath: '/assets/mobile/ships/player/t6.png',   frames: 1 },
  'ship-pc21': { path: '/assets/ships/player/pc21.png', mobilePath: '/assets/mobile/ships/player/pc21.png', frames: 1 },
  'ship-c130': { path: '/assets/ships/player/c130-animation.png', mobilePath: '/assets/ships/player/c130-animation.png', frames: 12, frameCols: 12, frameRows: 1 },
  'ship-a10':  { path: '/assets/ships/player/a10-animation.png',  mobilePath: '/assets/ships/player/a10-animation.png',  frames: 12, frameCols: 12, frameRows: 1 },
  'ship-f16':  { path: '/assets/ships/player/f16-animation.png',  mobilePath: '/assets/ships/player/f16-animation.png',  frames: 12, frameCols: 12, frameRows: 1 },
  'ship-f18':  { path: '/assets/ships/player/f18-animation.png',  mobilePath: '/assets/ships/player/f18-animation.png',  frames: 12, frameCols: 12, frameRows: 1 },
  'ship-f22':  { path: '/assets/ships/player/f22-animation.png',  mobilePath: '/assets/ships/player/f22-animation.png',  frames: 12, frameCols: 12, frameRows: 1 },
  'ship-f35':  { path: '/assets/ships/player/f35-animation.png',  mobilePath: '/assets/ships/player/f35-animation.png',  frames: 12, frameCols: 12, frameRows: 1 },
  'ship-b2':   { path: '/assets/ships/player/b2-animation.png', mobilePath: '/assets/ships/player/b2-animation.png', frames: 12, frameCols: 12, frameRows: 1 },
  'ship-sr71': { path: '/assets/ships/player/sr71-animation.png', mobilePath: '/assets/ships/player/sr71-animation.png', frames: 12, frameCols: 12, frameRows: 1 },
  'ship-f117': { path: '/assets/ships/player/f117-animation.png', mobilePath: '/assets/ships/player/f117-animation.png', frames: 12, frameCols: 4, frameRows: 3 },
  // Enemies — plane artwork
  // v2 forces browsers to discard the older cached F-15 sheet. Its aircraft
  // body is pixel-identical in every frame; only the exhaust is animated.
  'enemy-basic-new': { path: '/assets/enemies/planes/enemy-basic-normalized-v2.png', frames: 12, frameCols: 4, frameRows: 3 },
  'enemy-fast-new':  { path: '/assets/enemies/planes/enemy-fast-normalized.png',  frames: 12, frameCols: 4, frameRows: 3 },
  'enemy-tank-new':  { path: '/assets/enemies/planes/enemy-tank-normalized.png',  frames: 12, frameCols: 4, frameRows: 3 },
  'enemy-apache-new': { path: '/assets/enemies/planes/enemy-helicopter-clean-24-v4.png', frames: 24, frameCols: 4, frameRows: 6 },
  'enemy-mirage-new': { path: '/assets/enemies/planes/enemy-mirage-runtime-v2.png', frames: 12, frameCols: 4, frameRows: 3 },
  'enemy-f14-deploy': { path: '/assets/enemies/planes/enemy-f14-deploy-runtime-v3.png', frames: 12, frameCols: 4, frameRows: 3 },
  'enemy-f14-normal': { path: '/assets/enemies/planes/enemy-f14-normal-runtime-v3.png', frames: 12, frameCols: 4, frameRows: 3 },
  'enemy-boss-new':  { path: '/assets/enemies/planes/enemy-boss-normalized.png',  frames: 12, frameCols: 4, frameRows: 3 },
  'boss-a330': { path: '/assets/enemies/Boss/A330%20MRTT/A330_MRTT.png', frames: 1 },
  'boss-b52': { path: '/assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/b52-turret-center-right-24.png', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-b52-left': { path: '/assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/b52-turret-center-left-24.png', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-b52-left-return': { path: '/assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/b52-turret-left-center-24.png', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-b52-right-return': { path: '/assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/b52-turret-right-center-24.png', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-kawasaki-c2': { path: '/assets/enemies/Boss/Kawasaki_C2/kawasaki-c2-center-right-24.png', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-kawasaki-c2-left': { path: '/assets/enemies/Boss/Kawasaki_C2/kawasaki-c2-center-left-24.png', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-kawasaki-c2-left-return': { path: '/assets/enemies/Boss/Kawasaki_C2/kawasaki-c2-left-center-24.png', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-kawasaki-c2-right-return': { path: '/assets/enemies/Boss/Kawasaki_C2/kawasaki-c2-right-center-24.png', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-c5-galaxy': { path: '/assets/enemies/Boss/C5_Galaxy/Lockheed_C5_Galaxy_Antarctic_Machine_Gun.png', frames: 1 },
  'boss-space-shuttle': { path: '/assets/enemies/Boss/Space_Shuttle_STS/space-shuttle-center-right-24.png', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-space-shuttle-left': { path: '/assets/enemies/Boss/Space_Shuttle_STS/space-shuttle-center-left-24.png', frames: 24, frameCols: 4, frameRows: 6 },
  // FX — death / hit
  'enemy-death': { path: '/assets/enemies/enemy-explosion.png', frames: 7 },
  // FX
  'bolt':      { path: '/assets/fx/Missile/rocket-straight.png', frames: 12, frameCols: 4, frameRows: 3 },
  'missile-fire': { path: '/assets/fx/Missile/Fire%20missiles.png', frames: 12, frameCols: 4, frameRows: 3 },
  'missile-ice':  { path: '/assets/fx/Missile/Ice%20missile.png', frames: 12, frameCols: 4, frameRows: 3 },
  'missile-nuke': { path: '/assets/fx/Missile/Nuke%20missile.png', frames: 12, frameCols: 4, frameRows: 3 },
  'missile-ray':  { path: '/assets/fx/Missile/Ray%20gun%20missile.png', frames: 12, frameCols: 4, frameRows: 3 },
  'explosion-fire': { path: '/assets/fx/Missile/explosion-fire-missile.png', frames: 12, frameCols: 4, frameRows: 3 },
  'explosion-ice':  { path: '/assets/fx/JexonGo_FX_Explosions/ice_missile_explosion/ice_explosion_spritesheet_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'explosion-nuke': { path: '/assets/fx/JexonGo_FX_Explosions/nuke_missile_explosion/nuke_explosion_spritesheet_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'explosion-ray':  { path: '/assets/fx/JexonGo_FX_Explosions/laser_missile_explosion/laser_expansion_spritesheet_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'spark':     { path: '/assets/fx/explosion-a.png',         frames: 8 },
  'fire-ball': { path: '/assets/fx/fire-ball.png', frames: 3 },
  'cloud-1':  { path: '/assets/fx/individual_clouds_256x256/cloud_01.png', frames: 1 },
  'cloud-2':  { path: '/assets/fx/individual_clouds_256x256/cloud_02.png', frames: 1 },
  'cloud-3':  { path: '/assets/fx/individual_clouds_256x256/cloud_03.png', frames: 1 },
  'cloud-4':  { path: '/assets/fx/individual_clouds_256x256/cloud_04.png', frames: 1 },
  'cloud-5':  { path: '/assets/fx/individual_clouds_256x256/cloud_05.png', frames: 1 },
  'cloud-6':  { path: '/assets/fx/individual_clouds_256x256/cloud_06.png', frames: 1 },
  'cloud-7':  { path: '/assets/fx/individual_clouds_256x256/cloud_07.png', frames: 1 },
  'cloud-8':  { path: '/assets/fx/individual_clouds_256x256/cloud_08.png', frames: 1 },
  'cloud-9':  { path: '/assets/fx/individual_clouds_256x256/cloud_09.png', frames: 1 },
  'cloud-10': { path: '/assets/fx/individual_clouds_256x256/cloud_10.png', frames: 1 },
  'cloud-11': { path: '/assets/fx/individual_clouds_256x256/cloud_11.png', frames: 1 },
  'cloud-12': { path: '/assets/fx/individual_clouds_256x256/cloud_12.png', frames: 1 },
  'airdrop-plane': { path: '/assets/fx/Parachut%20anime/A400M_corrected_parachute_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'airdrop-plane-exit': { path: '/assets/fx/Parachut%20anime/JexonGo_A400M_Retro_2D_Transparent.png', frames: 1 },
  'airdrop-crate': { path: '/assets/fx/Parachut%20anime/JexonGo_Parachute_Crate_12_Frames/parachute_crate_spritesheet_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'airdrop-parachute-final': { path: '/assets/fx/Parachut%20anime/JexonGo_Parachute_Crate_12_Frames/frames/plan_12_generated_clean.png', frames: 1 },
  'airdrop-open': { path: '/assets/fx/Parachut%20anime/Crate_parachute_explosion_12_frames/Crate_parachute_explosion_12_frames/crate_parachute_explosion_spritesheet_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'airdrop-plan-icon': { path: '/assets/fx/Parachut%20anime/JexonGo_Parachute_Crate_12_Frames/frames/plan_01.png', frames: 1 },
  'airdrop-coin': { path: '/assets/fx/Caisse/JexonGo_Coin_3D_spritesheet_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'airdrop-exp': { path: '/assets/fx/Caisse/JexonGo_EXP_spritesheet_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'airdrop-heart': { path: '/assets/fx/Caisse/JexonGo_Heart_spritesheet_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'airdrop-xray': { path: '/assets/fx/Caisse/JexonGo_single_red_laser.png', frames: 1 },
  // Ocean backgrounds
  'ocean-back':   { path: '/assets/bg/ocean/back.png',   frames: 1 },
  'ocean-clouds': { path: '/assets/bg/ocean/clouds.png', frames: 1 },
  'ocean-middle': { path: '/assets/bg/ocean/middle.png', frames: 1 },
  // Pack biome — single top-down illustrations per biome
  'ocean-bg':  { path: '/assets/Maps/JexonGo_Map_Ocean/JexonGo_ocean_High_Altitude_1024x8192_seamless.webp', frames: 1 },
  'desert-bg': { path: '/assets/Maps/JexonGo_Map_Desert/JexonGo_desert_High_Altitude_1024x8192.webp', frames: 1 },
  'city-bg':   { path: '/assets/Maps/JexonGo_Map_Ville/JexonGo_city_High_Altitude_1024x8192.webp', frames: 1 },
  'arctic-bg': { path: '/assets/Maps/JexonGo_Map_Arctique/JexonGo_arctic_High_Altitude_1024x8192.webp', frames: 1 },
  'space-bg':  { path: '/assets/Maps/JexonGo_Map_Espace/JexonGo_space_High_Altitude_1024x8192.webp', frames: 1 },
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
  f117: 'ship-f117',
};

// Enemy type → sprite key
export const ENEMY_SPRITE = {
  basic: 'enemy-basic-new',
  fast:  'enemy-fast-new',
  tank:  'enemy-apache-new',
  turner: 'enemy-mirage-new',
  interceptor: 'enemy-f14-deploy',
  boss:  'enemy-boss-new',
};

// Biome → sprite keys required before gameplay starts
const SHIP_KEYS   = ['ship-t6','ship-pc21','ship-c130','ship-a10','ship-f16','ship-f18','ship-f22','ship-f35','ship-b2','ship-sr71','ship-f117'];
const ENEMY_KEYS  = ['enemy-basic-new','enemy-fast-new','enemy-tank-new','enemy-apache-new','enemy-mirage-new','enemy-f14-deploy','enemy-f14-normal','enemy-boss-new','boss-a330','boss-b52','boss-b52-left','boss-b52-left-return','boss-b52-right-return','boss-kawasaki-c2','boss-kawasaki-c2-left','boss-kawasaki-c2-left-return','boss-kawasaki-c2-right-return','boss-c5-galaxy','boss-space-shuttle','boss-space-shuttle-left','enemy-death'];
const FX_KEYS     = ['bolt','missile-fire','missile-ice','missile-nuke','missile-ray','explosion-fire','explosion-ice','explosion-nuke','explosion-ray','spark','fire-ball'];
const MOBILE_FX_KEYS = ['bolt','missile-fire','missile-ice','missile-nuke','missile-ray','explosion-fire','explosion-ice','explosion-nuke','explosion-ray','enemy-death'];
const CLOUD_KEYS = Array.from({ length: 12 }, (_, i) => `cloud-${i + 1}`);
const AIRDROP_KEYS = ['airdrop-plane', 'airdrop-plane-exit', 'airdrop-crate', 'airdrop-parachute-final', 'airdrop-open', 'airdrop-plan-icon', 'airdrop-coin', 'airdrop-exp', 'airdrop-heart', 'airdrop-xray'];

export const BIOME_SPRITES = {
  ocean:  [...SHIP_KEYS, ...ENEMY_KEYS, ...FX_KEYS, ...CLOUD_KEYS, ...AIRDROP_KEYS, 'ocean-bg'],
  desert: [...SHIP_KEYS, ...ENEMY_KEYS, ...FX_KEYS, ...CLOUD_KEYS, ...AIRDROP_KEYS, 'desert-bg'],
  city:   [...SHIP_KEYS, ...ENEMY_KEYS, ...FX_KEYS, ...CLOUD_KEYS, ...AIRDROP_KEYS, 'city-bg'],
  arctic: [...SHIP_KEYS, ...ENEMY_KEYS, ...FX_KEYS, ...CLOUD_KEYS, ...AIRDROP_KEYS, 'arctic-bg'],
  space:  [...SHIP_KEYS, ...ENEMY_KEYS, ...FX_KEYS, ...AIRDROP_KEYS, 'space-bg'],
};

// ── LOADING ──────────────────────────────────────────────────────────────────

/** Preload all ship sprites at app startup so the hangar renders immediately. */
export function preloadShips(activeAircraft = 't6') {
  const activeShip = AIRCRAFT_SPRITE[activeAircraft] ?? 'ship-t6';
  const keys = isTouchMobile() ? [activeShip] : SHIP_KEYS;
  keys
    .forEach(k => {
      const def = SPRITE_DEFS[k];
      if (def) _load(_spritePath(def)).catch(() => {});
    });
}

/** Preload every sprite required for a biome. Missing files are warned, never thrown. */
export async function preloadBiome(biome, options = {}) {
  const activeShip = AIRCRAFT_SPRITE[options.aircraftId] ?? 'ship-t6';
  const enemyTypes = options.enemyTypes?.length ? options.enemyTypes : ['basic', 'fast', 'tank'];
  const mobileEnemyKeys = [...new Set(enemyTypes.map(type => ENEMY_SPRITE[type] ?? 'enemy-basic-new'))];
  const chainedEnemyKeys = [
    ...(enemyTypes.includes('interceptor') ? ['enemy-f14-normal'] : []),
    ...(enemyTypes.includes('boss') ? ['boss-a330', 'boss-b52', 'boss-b52-left', 'boss-b52-left-return', 'boss-b52-right-return', 'boss-kawasaki-c2', 'boss-kawasaki-c2-left', 'boss-kawasaki-c2-left-return', 'boss-kawasaki-c2-right-return', 'boss-c5-galaxy', 'boss-space-shuttle', 'boss-space-shuttle-left'] : []),
  ];
  const keys = isTouchMobile()
    ? [...new Set([
        activeShip,
        ...mobileEnemyKeys,
        ...chainedEnemyKeys,
        ...MOBILE_FX_KEYS,
        ...(biome === 'space' ? [] : CLOUD_KEYS),
        ...AIRDROP_KEYS,
        `${biome || 'ocean'}-bg`,
      ])]
    : (BIOME_SPRITES[biome] ?? Object.keys(SPRITE_DEFS));
  await Promise.all(
    keys.map(k => {
      const def = SPRITE_DEFS[k];
      return def ? _load(_spritePath(def)).catch(err => console.warn('[sprites]', err.message)) : Promise.resolve();
    })
  );
}

// ── DRAW ─────────────────────────────────────────────────────────────────────

/** Get the loaded Image for a key, or null. */
export function getImage(key) {
  const def = SPRITE_DEFS[key];
  if (!def) return null;
  const path = _spritePath(def);
  const cached = _images.get(path);
  if (cached) return cached;
  _load(path).catch(() => {});
  return null;
}

export function preloadSprite(key) {
  const def = SPRITE_DEFS[key];
  return def ? _load(_spritePath(def)) : Promise.resolve(null);
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
  const cols = def.frameCols || def.frames || 1;
  const rows = def.frameRows || 1;
  const totalFrames = def.frames || (cols * rows);
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const rawFrame = def.autoAnimate ? Math.floor((now / 1000) * (def.fps || 8)) : frame;
  const f = ((Math.floor(rawFrame || 0) % totalFrames) + totalFrames) % totalFrames;
  const fw = img.naturalWidth / cols;
  const fh = img.naturalHeight / rows;
  const sx = (f % cols) * fw;
  const sy = Math.floor(f / cols) * fh;

  if (rotate !== 0) {
    ctx.save();
    if (alpha !== 1) ctx.globalAlpha *= alpha;
    ctx.translate(cx, cy);
    ctx.rotate(rotate);
    ctx.drawImage(img, sx, sy, fw, fh, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else if (alpha !== 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(img, sx, sy, fw, fh, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, sx, sy, fw, fh, cx - w / 2, cy - h / 2, w, h);
  }
}
