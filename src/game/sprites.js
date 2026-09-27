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
  // Player ships — new pixel-art artwork, 10-frame sheets (5 cols x 2 rows)
  'ship-t6':   { path: '/assets/ships/player/t6-animation.webp', frames: 10, frameCols: 5, frameRows: 2 },
  // Full roll animation while turning right/left. Only aircraft listed here
  // have hand-drawn turn art — drawAircraftSprite() falls back to the plain
  // rotated sprite for every other ship (see hasTurnArt() below).
  'ship-t6-turn-right': { path: '/assets/ships/player/t6-turn-right-animation.webp', frames: 20, frameCols: 5, frameRows: 4 },
  'ship-t6-turn-left':  { path: '/assets/ships/player/t6-turn-left-animation.webp',  frames: 20, frameCols: 5, frameRows: 4 },
  'ship-a10-turn-right': { path: '/assets/ships/player/a10-turn-right-animation.webp', frames: 20, frameCols: 5, frameRows: 4 },
  'ship-a10-turn-left':  { path: '/assets/ships/player/a10-turn-left-animation.webp',  frames: 20, frameCols: 5, frameRows: 4 },
  'ship-f16-turn-right': { path: '/assets/ships/player/f16-turn-right-animation.webp', frames: 20, frameCols: 5, frameRows: 4 },
  'ship-f16-turn-left':  { path: '/assets/ships/player/f16-turn-left-animation.webp',  frames: 20, frameCols: 5, frameRows: 4 },
  'ship-f18-turn-right': { path: '/assets/ships/player/f18-turn-right-animation.webp', frames: 20, frameCols: 5, frameRows: 4 },
  'ship-f18-turn-left':  { path: '/assets/ships/player/f18-turn-left-animation.webp',  frames: 20, frameCols: 5, frameRows: 4 },
  'ship-b2-turn-left':   { path: '/assets/ships/player/b2-turn-left-animation.webp',   frames: 20, frameCols: 5, frameRows: 4 },
  'ship-f22-turn-left':  { path: '/assets/ships/player/f22-turn-left-animation.webp',  frames: 20, frameCols: 5, frameRows: 4 },
  'ship-f117-turn-left': { path: '/assets/ships/player/f117-turn-left-animation.webp', frames: 20, frameCols: 5, frameRows: 4 },
  'ship-pc21-turn-left': { path: '/assets/ships/player/pc21-turn-left-animation.webp', frames: 20, frameCols: 5, frameRows: 4 },
  'ship-f117-turn-right': { path: '/assets/ships/player/f117-turn-right-animation.webp', frames: 20, frameCols: 5, frameRows: 4 },
  'ship-pc21-turn-right': { path: '/assets/ships/player/pc21-turn-right-animation.webp', frames: 20, frameCols: 5, frameRows: 4 },
  'ship-f22-turn-right':  { path: '/assets/ships/player/f22-turn-right-animation.webp',  frames: 20, frameCols: 5, frameRows: 4 },
  'ship-f35-turn-right':  { path: '/assets/ships/player/f35-turn-right-animation.webp',  frames: 20, frameCols: 5, frameRows: 4 },
  'ship-f35-turn-left':   { path: '/assets/ships/player/f35-turn-left-animation.webp',   frames: 20, frameCols: 5, frameRows: 4 },
  'ship-sr71-turn-right': { path: '/assets/ships/player/sr71-turn-right-animation.webp', frames: 20, frameCols: 5, frameRows: 4 },
  'ship-sr71-turn-left':  { path: '/assets/ships/player/sr71-turn-left-animation.webp',  frames: 20, frameCols: 5, frameRows: 4 },
  'ship-b2-turn-right':   { path: '/assets/ships/player/b2-turn-right-animation.webp',   frames: 20, frameCols: 5, frameRows: 4 },
  'ship-c130-turn-right': { path: '/assets/ships/player/c130-turn-right-animation.webp', frames: 20, frameCols: 5, frameRows: 4 },
  'ship-c130-turn-left':  { path: '/assets/ships/player/c130-turn-left-animation.webp',  frames: 20, frameCols: 5, frameRows: 4 },
  'ship-pc21': { path: '/assets/ships/player/pc21-animation.webp', frames: 10, frameCols: 5, frameRows: 2 },
  'ship-c130': { path: '/assets/ships/player/c130-animation.webp', frames: 10, frameCols: 5, frameRows: 2 },
  'ship-a10':  { path: '/assets/ships/player/a10-animation.webp',  frames: 10, frameCols: 5, frameRows: 2 },
  'ship-f16':  { path: '/assets/ships/player/f16-animation.webp',  frames: 10, frameCols: 5, frameRows: 2 },
  'ship-f18':  { path: '/assets/ships/player/f18-animation.webp',  frames: 10, frameCols: 5, frameRows: 2 },
  'ship-f22':  { path: '/assets/ships/player/f22-animation.webp',  frames: 10, frameCols: 5, frameRows: 2 },
  'ship-f35':  { path: '/assets/ships/player/f35-animation.webp',  frames: 10, frameCols: 5, frameRows: 2 },
  'ship-b2':   { path: '/assets/ships/player/b2-animation.webp', frames: 10, frameCols: 5, frameRows: 2 },
  'ship-sr71': { path: '/assets/ships/player/sr71-animation.webp', frames: 10, frameCols: 5, frameRows: 2 },
  'ship-f117': { path: '/assets/ships/player/f117-animation.webp', frames: 10, frameCols: 5, frameRows: 2 },
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
  // Enemy banking poses. Row 0 = level -> hard bank RIGHT (5 steps), row 1 = the
  // mirrored bank LEFT. Picked by |vx| when the enemy is crossing sideways.
  'enemy-fast-bank':   { path: '/assets/enemies/planes/enemy-fast-bank.png',   frames: 10, frameCols: 5, frameRows: 2 },
  'enemy-turner-bank': { path: '/assets/enemies/planes/enemy-turner-bank.png', frames: 10, frameCols: 5, frameRows: 2 },
  'enemy-boss-new':  { path: '/assets/enemies/planes/enemy-boss-normalized.png',  frames: 12, frameCols: 4, frameRows: 3 },
  'boss-a330': { path: '/assets/enemies/Boss/A330%20MRTT/A330_MRTT.webp', frames: 1 },
  'boss-b52': { path: '/assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/b52-turret-center-right-24.webp', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-b52-left': { path: '/assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/b52-turret-center-left-24.webp', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-b52-left-return': { path: '/assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/b52-turret-left-center-24.webp', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-b52-right-return': { path: '/assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/b52-turret-right-center-24.webp', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-kawasaki-c2': { path: '/assets/enemies/Boss/Kawasaki_C2/kawasaki-c2-center-right-24.webp', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-kawasaki-c2-left': { path: '/assets/enemies/Boss/Kawasaki_C2/kawasaki-c2-center-left-24.webp', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-kawasaki-c2-left-return': { path: '/assets/enemies/Boss/Kawasaki_C2/kawasaki-c2-left-center-24.webp', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-kawasaki-c2-right-return': { path: '/assets/enemies/Boss/Kawasaki_C2/kawasaki-c2-right-center-24.webp', frames: 24, frameCols: 4, frameRows: 6 },
  'boss-c5-galaxy': { path: '/assets/enemies/Boss/C5_Galaxy/Lockheed_C5_Galaxy_Antarctic_Machine_Gun.webp', frames: 1 },
  // STS: 10-frame engine-thrust loop (from "New enemy boss/12 plans droit",
  // magenta removed). No turret art, so both keys share the same sheet.
  'boss-space-shuttle': { path: '/assets/enemies/Boss/Space_Shuttle_STS/space-shuttle-engine-10.png', frames: 10, frameCols: 5, frameRows: 2 },
  'boss-space-shuttle-left': { path: '/assets/enemies/Boss/Space_Shuttle_STS/space-shuttle-engine-10.png', frames: 10, frameCols: 5, frameRows: 2 },
  // FX — death / hit
  'enemy-death': { path: '/assets/enemies/enemy-explosion.png', frames: 7 },
  // FX
  'bolt':      { path: '/assets/fx/Missile/rocket-straight.png', frames: 12, frameCols: 4, frameRows: 3 },
  'missile-fire': { path: '/assets/fx/Missile/Fire%20missiles.png', frames: 12, frameCols: 4, frameRows: 3 },
  'missile-ice':  { path: '/assets/fx/Missile/Ice%20missile.png', frames: 12, frameCols: 4, frameRows: 3 },
  'missile-nuke': { path: '/assets/fx/Missile/Nuke%20missile.png', frames: 12, frameCols: 4, frameRows: 3 },
  // Spinning nuke shown flying to the centre before the nuke explosion.
  'nuke-pivot': { path: '/assets/fx/Missile/nuke-pivot-transparent.png?v=2', frames: 12, frameCols: 4, frameRows: 3 },
  'missile-ray':  { path: '/assets/fx/Missile/Ray%20gun%20missile.png', frames: 12, frameCols: 4, frameRows: 3 },
  'explosion-fire': { path: '/assets/fx/Missile/explosion-fire-missile.png', frames: 12, frameCols: 4, frameRows: 3 },
  'explosion-ice':  { path: '/assets/fx/JexonGo_FX_Explosions/ice_missile_explosion/ice_explosion_spritesheet_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'explosion-nuke': { path: '/assets/fx/JexonGo_FX_Explosions/nuke_missile_explosion/nuke_explosion_spritesheet_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'explosion-ray':  { path: '/assets/fx/JexonGo_FX_Explosions/laser_missile_explosion/laser_expansion_spritesheet_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'spark':     { path: '/assets/fx/explosion-a.png',         frames: 8 },
  'fire-ball': { path: '/assets/fx/Missile/explosion-fire-missile.png', frames: 12, frameCols: 4, frameRows: 3 },
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
  // Same coin, every frame re-centred in an even 4x3 grid (the source sheet's
  // frames sit at uneven spots, which made the spin jump). In-game map coins.
  'map-coin-spin': { path: '/assets/fx/Caisse/JexonGo_Coin_spin_aligned.png', frames: 12, frameCols: 4, frameRows: 3 },
  'airdrop-exp': { path: '/assets/fx/Caisse/JexonGo_EXP_spritesheet_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'airdrop-heart': { path: '/assets/fx/Caisse/JexonGo_Heart_spritesheet_12_frames.png', frames: 12, frameCols: 4, frameRows: 3 },
  'airdrop-xray': { path: '/assets/fx/Caisse/JexonGo_single_red_laser.png', frames: 1 },
  // Pack biome — single top-down illustrations per biome
  'ocean-bg':  { path: '/assets/Maps/JexonGo_Map_Ocean/JexonGo_ocean_seamless_tile.png', frames: 1 },
  'desert-bg': { path: '/assets/Maps/JexonGo_Map_Desert/JexonGo_desert_seamless_tile.png', frames: 1 },
  'city-bg':   { path: '/assets/Maps/JexonGo_Map_Ville/JexonGo_city_seamless_tile.png', frames: 1 },
  'arctic-bg': { path: '/assets/Maps/JexonGo_Map_Arctique/JexonGo_arctic_seamless_tile.png', frames: 1 },
  'space-bg':  { path: '/assets/Maps/JexonGo_Map_Espace/JexonGo_space_seamless_tile.png', frames: 1 },
  // Ocean biome — one unique hand-painted map per level (1-10), each showing
  // the real location that level's mission briefing names (see locations.js).
  'ocean-bg-1':  { path: '/assets/Maps/JexonGo_Map_Ocean/levels/ocean-lv01.webp', frames: 1 }, // South of New Zealand
  'ocean-bg-2':  { path: '/assets/Maps/JexonGo_Map_Ocean/levels/ocean-lv02.webp', frames: 1 }, // North of New Zealand
  'ocean-bg-3':  { path: '/assets/Maps/JexonGo_Map_Ocean/levels/ocean-lv03.webp', frames: 1 }, // Sydney
  'ocean-bg-4':  { path: '/assets/Maps/JexonGo_Map_Ocean/levels/ocean-lv04.webp', frames: 1 }, // Brisbane
  'ocean-bg-5':  { path: '/assets/Maps/JexonGo_Map_Ocean/levels/ocean-lv05.webp', frames: 1 }, // Papua New Guinea
  'ocean-bg-6':  { path: '/assets/Maps/JexonGo_Map_Ocean/levels/ocean-lv06.webp', frames: 1 }, // Philippines
  'ocean-bg-7':  { path: '/assets/Maps/JexonGo_Map_Ocean/levels/ocean-lv07.webp', frames: 1 }, // China coast
  'ocean-bg-8':  { path: '/assets/Maps/JexonGo_Map_Ocean/levels/ocean-lv08.webp', frames: 1 }, // Japan
  'ocean-bg-9':  { path: '/assets/Maps/JexonGo_Map_Ocean/levels/ocean-lv09.webp', frames: 1 }, // Hawaii
  'ocean-bg-10': { path: '/assets/Maps/JexonGo_Map_Ocean/levels/ocean-lv10.webp', frames: 1 }, // Santiago, Chile
  // Desert biome — one unique hand-painted map per level (11-20), each
  // showing the real location that level's mission briefing names.
  'desert-bg-11': { path: '/assets/Maps/JexonGo_Map_Desert/levels/desert-lv11.webp', frames: 1 }, // Western Sahara
  'desert-bg-12': { path: '/assets/Maps/JexonGo_Map_Desert/levels/desert-lv12.webp', frames: 1 }, // Casablanca
  'desert-bg-13': { path: '/assets/Maps/JexonGo_Map_Desert/levels/desert-lv13.webp', frames: 1 }, // Marrakesh
  'desert-bg-14': { path: '/assets/Maps/JexonGo_Map_Desert/levels/desert-lv14.webp', frames: 1 }, // Algiers
  'desert-bg-15': { path: '/assets/Maps/JexonGo_Map_Desert/levels/desert-lv15.webp', frames: 1 }, // Tamanrasset
  'desert-bg-16': { path: '/assets/Maps/JexonGo_Map_Desert/levels/desert-lv16.webp', frames: 1 }, // Tripoli
  'desert-bg-17': { path: '/assets/Maps/JexonGo_Map_Desert/levels/desert-lv17.webp', frames: 1 }, // Cairo
  'desert-bg-18': { path: '/assets/Maps/JexonGo_Map_Desert/levels/desert-lv18.webp', frames: 1 }, // Hurghada
  'desert-bg-19': { path: '/assets/Maps/JexonGo_Map_Desert/levels/desert-lv19.webp', frames: 1 }, // Alexandria
  'desert-bg-20': { path: '/assets/Maps/JexonGo_Map_Desert/levels/desert-lv20.webp', frames: 1 }, // Western Desert, Egypt
  // City biome — one unique hand-painted map per level (21-30), each
  // showing the real location that level's mission briefing names.
  'city-bg-21': { path: '/assets/Maps/JexonGo_Map_Ville/levels/city-lv21.webp', frames: 1 }, // New York City
  'city-bg-22': { path: '/assets/Maps/JexonGo_Map_Ville/levels/city-lv22.webp', frames: 1 }, // Washington D.C.
  'city-bg-23': { path: '/assets/Maps/JexonGo_Map_Ville/levels/city-lv23.webp', frames: 1 }, // North Carolina
  'city-bg-24': { path: '/assets/Maps/JexonGo_Map_Ville/levels/city-lv24.webp', frames: 1 }, // Charleston
  'city-bg-25': { path: '/assets/Maps/JexonGo_Map_Ville/levels/city-lv25.webp', frames: 1 }, // Miami
  'city-bg-26': { path: '/assets/Maps/JexonGo_Map_Ville/levels/city-lv26.webp', frames: 1 }, // Dallas
  'city-bg-27': { path: '/assets/Maps/JexonGo_Map_Ville/levels/city-lv27.webp', frames: 1 }, // San Diego
  'city-bg-28': { path: '/assets/Maps/JexonGo_Map_Ville/levels/city-lv28.webp', frames: 1 }, // Los Angeles
  'city-bg-29': { path: '/assets/Maps/JexonGo_Map_Ville/levels/city-lv29.webp', frames: 1 }, // San Francisco
  'city-bg-30': { path: '/assets/Maps/JexonGo_Map_Ville/levels/city-lv30.webp', frames: 1 }, // Seattle
  // Arctic biome — per-level maps (31-40). Level 33 (Greenland Ice Sheet)
  // has no map yet and uses the generic arctic tile.
  'arctic-bg-31': { path: '/assets/Maps/JexonGo_Map_Arctique/levels/arctic-lv31.webp', frames: 1 }, // Svalbard
  'arctic-bg-32': { path: '/assets/Maps/JexonGo_Map_Arctique/levels/arctic-lv32.webp', frames: 1 }, // Nunavut
  'arctic-bg-34': { path: '/assets/Maps/JexonGo_Map_Arctique/levels/arctic-lv34.webp', frames: 1 }, // Utqiagvik, Alaska
  'arctic-bg-35': { path: '/assets/Maps/JexonGo_Map_Arctique/levels/arctic-lv35.webp', frames: 1 }, // Ny-Ålesund
  'arctic-bg-36': { path: '/assets/Maps/JexonGo_Map_Arctique/levels/arctic-lv36.webp', frames: 1 }, // Franz Josef Land
  'arctic-bg-37': { path: '/assets/Maps/JexonGo_Map_Arctique/levels/arctic-lv37.webp', frames: 1 }, // Novaya Zemlya
  'arctic-bg-38': { path: '/assets/Maps/JexonGo_Map_Arctique/levels/arctic-lv38.webp', frames: 1 }, // Chukchi Sea
  'arctic-bg-39': { path: '/assets/Maps/JexonGo_Map_Arctique/levels/arctic-lv39.webp', frames: 1 }, // North Pole Ice Camp
  'arctic-bg-40': { path: '/assets/Maps/JexonGo_Map_Arctique/levels/arctic-lv40.webp', frames: 1 }, // Ellesmere Island
  // Space biome — one map per level (41-50), two levels per planet/moon.
  'space-bg-41': { path: '/assets/Maps/JexonGo_Map_Espace/levels/space-lv41.webp', frames: 1 }, // Io
  'space-bg-42': { path: '/assets/Maps/JexonGo_Map_Espace/levels/space-lv42.webp', frames: 1 }, // Io
  'space-bg-43': { path: '/assets/Maps/JexonGo_Map_Espace/levels/space-lv43.webp', frames: 1 }, // Jupiter
  'space-bg-44': { path: '/assets/Maps/JexonGo_Map_Espace/levels/space-lv44.webp', frames: 1 }, // Jupiter
  'space-bg-45': { path: '/assets/Maps/JexonGo_Map_Espace/levels/space-lv45.webp', frames: 1 }, // Ganymede
  'space-bg-46': { path: '/assets/Maps/JexonGo_Map_Espace/levels/space-lv46.webp', frames: 1 }, // Ganymede
  'space-bg-47': { path: '/assets/Maps/JexonGo_Map_Espace/levels/space-lv47.webp', frames: 1 }, // Neptune
  'space-bg-48': { path: '/assets/Maps/JexonGo_Map_Espace/levels/space-lv48.webp', frames: 1 }, // Neptune
  'space-bg-49': { path: '/assets/Maps/JexonGo_Map_Espace/levels/space-lv49.webp', frames: 1 }, // Saturn
  'space-bg-50': { path: '/assets/Maps/JexonGo_Map_Espace/levels/space-lv50.webp', frames: 1 }, // Saturn
};

// Per-biome level-number range that has unique per-level artwork.
const BIOME_LEVEL_ART_RANGE = {
  ocean:  [1, 10],
  desert: [11, 20],
  city:   [21, 30],
  arctic: [31, 40],
  space:  [41, 50],
};

/** The sprite key for a biome's flight background, using the level-specific
 * map when one exists for that biome+level and falling back to the generic
 * seamless tile otherwise. */
export function biomeBgKey(biome, levelNum) {
  const generic = `${biome || 'ocean'}-bg`;
  const range = BIOME_LEVEL_ART_RANGE[biome];
  if (range && Number.isInteger(levelNum) && levelNum >= range[0] && levelNum <= range[1]
      && SPRITE_DEFS[`${biome}-bg-${levelNum}`]) {
    return `${biome}-bg-${levelNum}`;
  }
  return generic;
}

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

// True if `aircraftId` has a hand-drawn turn-right/turn-left roll sheet
// (see SPRITE_DEFS above). Aircraft without one fall back to the plain
// rotated sprite in drawAircraftSprite().
export function hasTurnArt(aircraftId, dir) {
  return `ship-${aircraftId}-turn-${dir}` in SPRITE_DEFS;
}

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
const ENEMY_KEYS  = ['enemy-basic-new','enemy-fast-new','enemy-tank-new','enemy-apache-new','enemy-mirage-new','enemy-f14-deploy','enemy-f14-normal','enemy-fast-bank','enemy-turner-bank','enemy-boss-new','boss-a330','boss-b52','boss-b52-left','boss-b52-left-return','boss-b52-right-return','boss-kawasaki-c2','boss-kawasaki-c2-left','boss-kawasaki-c2-left-return','boss-kawasaki-c2-right-return','boss-c5-galaxy','boss-space-shuttle','boss-space-shuttle-left','enemy-death'];
const FX_KEYS     = ['bolt','missile-fire','missile-ice','missile-nuke','nuke-pivot','missile-ray','explosion-fire','explosion-ice','explosion-nuke','explosion-ray','spark','fire-ball'];
const CLOUD_KEYS = Array.from({ length: 12 }, (_, i) => `cloud-${i + 1}`);
const AIRDROP_KEYS = ['airdrop-plane', 'airdrop-plane-exit', 'airdrop-crate', 'airdrop-parachute-final', 'airdrop-open', 'airdrop-plan-icon', 'airdrop-coin', 'map-coin-spin', 'airdrop-exp', 'airdrop-heart', 'airdrop-xray'];

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
    ...(enemyTypes.includes('fast') ? ['enemy-fast-bank'] : []),
    ...(enemyTypes.includes('turner') ? ['enemy-turner-bank'] : []),
    ...(enemyTypes.includes('boss') ? ['boss-a330', 'boss-b52', 'boss-b52-left', 'boss-b52-left-return', 'boss-b52-right-return', 'boss-kawasaki-c2', 'boss-kawasaki-c2-left', 'boss-kawasaki-c2-left-return', 'boss-kawasaki-c2-right-return', 'boss-c5-galaxy', 'boss-space-shuttle', 'boss-space-shuttle-left'] : []),
  ];
  // The active aircraft's roll-turn sheets (if it has any) must be loaded
  // before the level starts — otherwise the very first turn triggers a
  // just-in-time image fetch, and drawFrame() silently skips drawing while
  // it waits, which reads as the plane (or part of it) blinking out.
  const turnKeys = [
    ...(hasTurnArt(options.aircraftId, 'right') ? [`ship-${options.aircraftId}-turn-right`] : []),
    ...(hasTurnArt(options.aircraftId, 'left') ? [`ship-${options.aircraftId}-turn-left`] : []),
  ];
  const genericBgKey = `${biome || 'ocean'}-bg`;
  const bgKey = biomeBgKey(biome, options.levelNum);
  const keys = isTouchMobile()
    ? [...new Set([
        activeShip,
        ...turnKeys,
        ...mobileEnemyKeys,
        ...chainedEnemyKeys,
        ...FX_KEYS,
        ...(biome === 'space' ? [] : CLOUD_KEYS),
        ...AIRDROP_KEYS,
        bgKey,
      ])]
    : [...new Set([
        ...(BIOME_SPRITES[biome] ?? Object.keys(SPRITE_DEFS)).map(k => k === genericBgKey ? bgKey : k),
        ...turnKeys,
      ])];
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
  // On a multi-frame sheet, the browser's smoothing/scaling can sample a
  // sliver of pixels just past the cell boundary — a peek of the neighbouring
  // frame bleeding in along one edge. Cropping 1px inside each frame's
  // boundary keeps every sample inside its own cell. Single-frame sprites
  // have no neighbour to bleed from, so they're left untouched.
  const bleed = (cols > 1 || rows > 1) ? 1 : 0;
  const bsx = sx + bleed, bsy = sy + bleed, bfw = fw - bleed * 2, bfh = fh - bleed * 2;

  if (rotate !== 0) {
    ctx.save();
    if (alpha !== 1) ctx.globalAlpha *= alpha;
    ctx.translate(cx, cy);
    ctx.rotate(rotate);
    ctx.drawImage(img, bsx, bsy, bfw, bfh, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else if (alpha !== 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(img, bsx, bsy, bfw, bfh, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, bsx, bsy, bfw, bfh, cx - w / 2, cy - h / 2, w, h);
  }
}
