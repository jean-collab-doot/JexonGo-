// ── HANGAR UPGRADES (per aircraft) ───────────────────────────────────────────
// Each aircraft has its own permanent upgrades, bought with coins in the
// hangar's UPGRADE tab and stored in G.planeUpgrades[planeId]:
//   • lives   — +1 life per level at the start of every mission (0-3)
//   • shots   — shorter delay between shots per level (0-3)
//   • homing  — shots steer toward the nearest enemy (0-1)
//   • xp      — +XP_BONUS_PERCENT[level-1] % XP per mission (0-3)
//   • dropChance — { xray, machinegun, shield, support }: airdrop chance level
//                  per item (0-3, weight × AIRDROP_CHANCE_MULT)
//   • dropTime   — longer airdrop items (0-3, + AIRDROP_TIME_BONUS_S seconds)
//   • weapons — weapons bought for this aircraft ('missile' is free)
//   • weapon  — the equipped weapon: 'missile' | 'machinegun' | 'laser'

import { G } from '../state.js';

export const LIFE_UPGRADE_PRICES = [1000, 2000, 4000];   // levels 1 → 3
export const SHOT_UPGRADE_PRICES = [800, 1600, 3200];    // levels 1 → 3
export const HOMING_UPGRADE_PRICES = [3000];             // one level
export const XP_UPGRADE_PRICES = [1000, 2000, 4000];     // levels 1 → 3
// Mirrored in state.js (xpUpgradeMultiplier) to avoid a circular import.
export const XP_BONUS_PERCENT = [10, 25, 50];

// Airdrop items whose chance can be raised, and by how much per level.
export const AIRDROP_BOOST_ITEMS = [
  { id: 'xray',       title: { fr: 'LASER RAYON X', en: 'X-RAY LASER' } },
  { id: 'machinegun', title: { fr: 'MITRAILLEUSE', en: 'MACHINE GUN' } },
  { id: 'shield',     title: { fr: 'CHAMP DE PROTECTION', en: 'FORCE FIELD' } },
  { id: 'support',    title: { fr: 'SOUTIEN AÉRIEN', en: 'AIR SUPPORT' } },
];
export const AIRDROP_CHANCE_PRICES = [600, 1200, 2400];  // levels 1 → 3
export const AIRDROP_CHANCE_MULT = [1, 1.5, 2, 3];       // index = level
export const AIRDROP_TIME_PRICES = [800, 1600, 3200];    // levels 1 → 3
export const AIRDROP_TIME_BONUS_S = [0, 3, 6, 10];       // index = level
export const AIRDROP_BASE_DURATION_S = 10;

export const WEAPONS = [
  {
    id: 'missile',
    price: 0,
    title: { fr: 'Missile', en: 'Missile' },
    detail: { fr: 'Le tir classique.', en: 'The classic shot.' },
  },
  {
    id: 'machinegun',
    price: 1500,
    title: { fr: 'Mitrailleuse', en: 'Machine Gun' },
    detail: { fr: 'Rafale de 3 balles rapides.', en: 'Burst of 3 fast bullets.' },
  },
  {
    id: 'laser',
    price: 2500,
    title: { fr: 'Laser', en: 'Laser' },
    detail: { fr: 'Rayon orange très rapide.', en: 'Very fast orange beam.' },
  },
];

/** Upgrade record for one aircraft, always well-formed. */
export function planeUpgrades(planeId = G.activeAircraft) {
  const all = G.planeUpgrades && typeof G.planeUpgrades === 'object' ? G.planeUpgrades : {};
  const raw = all[planeId] || {};
  const weapons = Array.isArray(raw.weapons) ? raw.weapons.filter(id => WEAPONS.some(w => w.id === id)) : [];
  if (!weapons.includes('missile')) weapons.unshift('missile');
  return {
    lives: Math.max(0, Math.min(LIFE_UPGRADE_PRICES.length, raw.lives | 0)),
    shots: Math.max(0, Math.min(SHOT_UPGRADE_PRICES.length, raw.shots | 0)),
    homing: Math.max(0, Math.min(HOMING_UPGRADE_PRICES.length, raw.homing | 0)),
    xp: Math.max(0, Math.min(XP_UPGRADE_PRICES.length, raw.xp | 0)),
    dropChance: Object.fromEntries(AIRDROP_BOOST_ITEMS.map(({ id }) =>
      [id, Math.max(0, Math.min(AIRDROP_CHANCE_PRICES.length, raw.dropChance?.[id] | 0))])),
    dropTime: Math.max(0, Math.min(AIRDROP_TIME_PRICES.length, raw.dropTime | 0)),
    weapons,
    weapon: weapons.includes(raw.weapon) ? raw.weapon : 'missile',
  };
}

export function setPlaneUpgrades(planeId, record) {
  if (!G.planeUpgrades || typeof G.planeUpgrades !== 'object') G.planeUpgrades = {};
  G.planeUpgrades[planeId] = record;
}

export function shotUpgradeLevel(planeId = G.activeAircraft) {
  return planeUpgrades(planeId).shots;
}

// "More shots" sets the delay between shots (seconds) for levels 1-3.
// A shooting plan that is already faster keeps its own delay.
export const SHOT_DELAY_SECONDS = [2.4, 1.5, 0.5];

export function shotDelaySeconds(baseSeconds, planeId = G.activeAircraft) {
  const level = shotUpgradeLevel(planeId);
  return level > 0 ? Math.min(baseSeconds, SHOT_DELAY_SECONDS[level - 1]) : baseSeconds;
}

export function homingUpgradeOwned(planeId = G.activeAircraft) {
  return planeUpgrades(planeId).homing > 0;
}

/** Airdrop weight multiplier for one item on the active aircraft. */
export function airdropChanceMult(itemId, planeId = G.activeAircraft) {
  return AIRDROP_CHANCE_MULT[planeUpgrades(planeId).dropChance[itemId] || 0];
}

/** Duration (ms) of timed airdrop items on the active aircraft. */
export function airdropItemDurationMs(planeId = G.activeAircraft) {
  return (AIRDROP_BASE_DURATION_S + AIRDROP_TIME_BONUS_S[planeUpgrades(planeId).dropTime]) * 1000;
}

export function activeWeapon(planeId = G.activeAircraft) {
  return planeUpgrades(planeId).weapon;
}
