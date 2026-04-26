import { G } from '../state.js';
import { AIRCRAFT } from '../data/aircraft.js';

// ── CHEST TIERS (one per 10-level milestone) ──────────────────────────────────
const CHEST_TIERS = [
  { level: 10, name: 'BRONZE',    color: '#cd7f32', img: '/assets/chest/chest-blue.png',      idx: 0 },
  { level: 20, name: 'SILVER',    color: '#c0c0c0', img: '/assets/chest/chest-blue.png',      idx: 1 },
  { level: 30, name: 'GOLD',      color: '#fbbf24', img: '/assets/chest/chest-purple.png',    idx: 2 },
  { level: 40, name: 'PLATINUM',  color: '#00d4ff', img: '/assets/chest/chest-purple.png',    idx: 3 },
  { level: 50, name: 'LEGENDARY', color: '#cc44ff', img: '/assets/chest/chest-legendary.png', idx: 4 },
];

// ── RARITIES ──────────────────────────────────────────────────────────────────
export const RARITIES = [
  { id: 'common',    label: 'COMMON',    color: '#94a3b8' },
  { id: 'rare',      label: 'RARE',      color: '#60a5fa' },
  { id: 'epic',      label: 'EPIC',      color: '#a855f7' },
  { id: 'legendary', label: 'LEGENDARY', color: '#fbbf24' },
];

// Drop weights per chest tier [common, rare, epic, legendary]
const RARITY_WEIGHTS = [
  [60, 30,  8,  2],  // Bronze
  [45, 35, 15,  5],  // Silver
  [30, 40, 22,  8],  // Gold
  [20, 35, 30, 15],  // Platinum
  [10, 30, 35, 25],  // Legendary
];

// XP reward ranges [min, max] per [tierIdx][rarityIdx]
const XP_TABLE = [
  [[80,150],   [200,400],   [500,900],   [1000,1500]],
  [[150,300],  [350,700],   [800,1400],  [1800,2500]],
  [[250,500],  [600,1100],  [1200,2000], [2800,4000]],
  [[400,800],  [900,1700],  [1800,3000], [4000,6000]],
  [[600,1200], [1400,2600], [2800,4500], [6000,9000]],
];

// Coin reward ranges per [tierIdx][rarityIdx]
const COIN_TABLE = [
  [[10,30],   [40,80],   [100,200],  [300,500]],
  [[20,60],   [80,150],  [200,350],  [500,800]],
  [[40,100],  [130,250], [300,550],  [800,1300]],
  [[70,160],  [200,400], [500,900],  [1300,2000]],
  [[100,250], [300,600], [800,1400], [2000,3000]],
];

// Blueprint pieces awarded per rarityIdx
const BP_PIECES = [1, 2, 3, 5];

// Which aircraft can appear in each chest tier (easier -> harder)
const BP_POOLS = [
  ['pc21', 'c130'],
  ['c130', 'a10', 'f16'],
  ['a10',  'f16', 'f18'],
  ['f18',  'f22', 'f35'],
  ['f22',  'f35', 'b2', 'sr71'],
];

// Blueprint pieces needed to auto-unlock each aircraft via blueprints
export const BLUEPRINT_COST = {
  pc21: 6, c130: 8, a10: 10, f16: 12,
  f18: 15, f22: 18, f35: 20, b2: 25, sr71: 30,
};

// Coin conversion rate for duplicate blueprint pieces (per rarityIdx)
const BP_CONVERT_RATE = [5, 12, 30, 80];

// ── HELPERS ───────────────────────────────────────────────────────────────────

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollRarity(tierIdx) {
  const w = [...RARITY_WEIGHTS[tierIdx]];

  // Soft pity: after 3 chests without Epic+, shift weight away from Common
  if ((G.chestsWithoutEpic || 0) >= 3) {
    const shift = Math.min(w[0], 20);
    w[0] -= shift;
    w[2] += Math.floor(shift * 0.6);
    w[3] += Math.ceil(shift * 0.4);
  }

  const total = w.reduce((a, b) => a + b, 0);
  const roll  = Math.random() * total;
  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    acc += w[i];
    if (roll < acc) return i;
  }
  return 0;
}

function xpReward(tierIdx, rarityIdx) {
  const [min, max] = XP_TABLE[tierIdx][rarityIdx];
  return { type: 'xp', rarity: rarityIdx, amount: rand(min, max), icon: '⚡', label: 'EXPERIENCE' };
}

function coinReward(tierIdx, rarityIdx) {
  const [min, max] = COIN_TABLE[tierIdx][rarityIdx];
  return { type: 'coins', rarity: rarityIdx, amount: rand(min, max), icon: '🪙', label: 'COINS' };
}

function blueprintReward(tierIdx, rarityIdx) {
  const pool = BP_POOLS[tierIdx];

  const available = pool.filter(id => {
    const needed = BLUEPRINT_COST[id] || 99;
    const have   = (G.blueprints || {})[id] || 0;
    return have < needed && !G.unlockedAircraft.includes(id);
  });

  // All aircraft in this tier already unlocked — convert to coins
  if (!available.length) return coinReward(tierIdx, rarityIdx);

  const aircraft = available[Math.floor(Math.random() * available.length)];
  return {
    type: 'blueprint',
    rarity: rarityIdx,
    aircraft,
    pieces: BP_PIECES[rarityIdx],
    icon: '📋',
    label: 'BLUEPRINT',
  };
}

// ── MAIN ROLL ─────────────────────────────────────────────────────────────────

export function rollChest() {
  const lvl       = G.currentLevel;
  const milestone = Math.min(Math.floor(lvl / 10) * 10, 50) || 10;
  const tier      = CHEST_TIERS.find(t => t.level === milestone) || CHEST_TIERS[0];
  const t         = tier.idx;

  const rewards = [
    xpReward(t, rollRarity(t)),
    coinReward(t, rollRarity(t)),
    (() => {
      const bpChance = 0.30 + t * 0.08; // 30% at Bronze -> 62% at Legendary
      if (Math.random() < bpChance) return blueprintReward(t, rollRarity(t));
      return Math.random() < 0.5 ? xpReward(t, rollRarity(t)) : coinReward(t, rollRarity(t));
    })(),
  ];

  const hasEpic = rewards.some(r => r.rarity >= 2);
  G.chestsWithoutEpic = hasEpic ? 0 : (G.chestsWithoutEpic || 0) + 1;

  return { chestName: tier.name, chestColor: tier.color, chestImg: tier.img, rewards };
}

// ── APPLY REWARDS TO STATE ────────────────────────────────────────────────────

export function applyRewards(rewards) {
  const newlyUnlocked = [];

  for (const r of rewards) {
    if (r.type === 'xp') {
      G.xp = (G.xp || 0) + r.amount;

    } else if (r.type === 'coins') {
      G.coins = (G.coins || 0) + r.amount;

    } else if (r.type === 'blueprint') {
      if (!G.blueprints) G.blueprints = {};
      const needed = BLUEPRINT_COST[r.aircraft] || 99;
      const have   = G.blueprints[r.aircraft] || 0;

      if (G.unlockedAircraft.includes(r.aircraft) || have >= needed) {
        // Duplicate — convert pieces to coins
        G.coins = (G.coins || 0) + BP_CONVERT_RATE[r.rarity] * r.pieces;
        r._converted = true;
      } else {
        G.blueprints[r.aircraft] = have + r.pieces;
        if (G.blueprints[r.aircraft] >= needed) {
          G.unlockedAircraft.push(r.aircraft);
          newlyUnlocked.push(r.aircraft);
        }
      }
    }
  }

  return newlyUnlocked;
}
