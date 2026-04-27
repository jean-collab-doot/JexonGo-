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

// ── ROULETTE SLOT DEFINITIONS ─────────────────────────────────────────────────
// weight = out of 100 total
export const ROULETTE_SLOTS = [
  { id: 'common',    label: 'COMMON PART',    icon: '🔧', color: '#94a3b8', weight: 40, rewardType: 'blueprint', rarityIdx: 0 },
  { id: 'rare',      label: 'RARE PART',      icon: '🔩', color: '#60a5fa', weight: 25, rewardType: 'blueprint', rarityIdx: 1 },
  { id: 'epic',      label: 'EPIC PART',      icon: '⚙',  color: '#a855f7', weight: 15, rewardType: 'blueprint', rarityIdx: 2 },
  { id: 'legendary', label: 'LEGENDARY PART', icon: '💎', color: '#fbbf24', weight: 10, rewardType: 'blueprint', rarityIdx: 3 },
  { id: 'xp200',     label: 'BONUS XP',       icon: '⚡', color: '#00e84b', weight: 7,  rewardType: 'xp', xpAmount: 200 },
  { id: 'xp500',     label: 'MEGA XP',        icon: '⭐', color: '#fff700', weight: 3,  rewardType: 'xp', xpAmount: 500 },
];

// Blueprint pieces needed to auto-unlock each aircraft via blueprints
export const BLUEPRINT_COST = {
  pc21: 6, c130: 8, a10: 10, f16: 12,
  f18: 15, f22: 18, f35: 20, b2: 25, sr71: 30,
};

// Which aircraft can appear in each chest tier
const BP_POOLS = [
  ['pc21', 'c130'],
  ['c130', 'a10', 'f16'],
  ['a10',  'f16', 'f18'],
  ['f18',  'f22', 'f35'],
  ['f22',  'f35', 'b2', 'sr71'],
];

const BP_PIECES = [1, 2, 3, 5];

// ── HELPERS ───────────────────────────────────────────────────────────────────
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollRouletteSlot() {
  const roll = Math.random() * 100;
  let acc = 0;
  for (const slot of ROULETTE_SLOTS) {
    acc += slot.weight;
    if (roll < acc) return slot;
  }
  return ROULETTE_SLOTS[0];
}

function buildRewardFromSlot(slot, tierIdx) {
  if (slot.rewardType === 'xp') {
    return {
      type: 'xp',
      rarity: slot.id === 'xp500' ? 3 : 2,
      amount: slot.xpAmount,
      icon: slot.icon,
      label: slot.label,
      slotId: slot.id,
    };
  }

  // Blueprint
  const pool = BP_POOLS[tierIdx];
  const available = pool.filter(id => {
    const needed = BLUEPRINT_COST[id] || 99;
    const have   = (G.blueprints || {})[id] || 0;
    return have < needed && !G.unlockedAircraft.includes(id);
  });

  if (!available.length) {
    // All unlocked — give XP bonus instead
    const xpAmounts = [100, 250, 500, 1000];
    return {
      type: 'xp',
      rarity: slot.rarityIdx,
      amount: xpAmounts[slot.rarityIdx] ?? 100,
      icon: '⚡',
      label: 'BONUS XP',
      slotId: slot.id,
    };
  }

  const aircraft = available[Math.floor(Math.random() * available.length)];
  return {
    type: 'blueprint',
    rarity: slot.rarityIdx,
    aircraft,
    pieces: BP_PIECES[slot.rarityIdx] ?? 1,
    icon: slot.icon,
    label: slot.label,
    slotId: slot.id,
  };
}

// ── MAIN ROLL ─────────────────────────────────────────────────────────────────
export function rollChest() {
  const lvl       = G.currentLevel;
  const milestone = Math.min(Math.floor(lvl / 10) * 10, 50) || 10;
  const tier      = CHEST_TIERS.find(t => t.level === milestone) || CHEST_TIERS[0];
  const t         = tier.idx;

  const slot   = rollRouletteSlot();
  const reward = buildRewardFromSlot(slot, t);

  const hasEpic = reward.rarity >= 2;
  G.chestsWithoutEpic = hasEpic ? 0 : (G.chestsWithoutEpic || 0) + 1;

  return { chestName: tier.name, chestColor: tier.color, chestImg: tier.img, reward, slot };
}

// ── APPLY REWARD TO STATE ─────────────────────────────────────────────────────
export function applyReward(reward) {
  const newlyUnlocked = [];

  if (reward.type === 'xp') {
    G.xp = (G.xp || 0) + reward.amount;

  } else if (reward.type === 'blueprint') {
    if (!G.blueprints) G.blueprints = {};
    const needed = BLUEPRINT_COST[reward.aircraft] || 99;
    const have   = G.blueprints[reward.aircraft] || 0;

    if (G.unlockedAircraft.includes(reward.aircraft) || have >= needed) {
      // Duplicate — give XP bonus
      reward._converted = true;
      G.xp = (G.xp || 0) + 50;
    } else {
      G.blueprints[reward.aircraft] = have + reward.pieces;
      if (G.blueprints[reward.aircraft] >= needed) {
        G.unlockedAircraft.push(reward.aircraft);
        newlyUnlocked.push(reward.aircraft);
      }
    }
  }

  return newlyUnlocked;
}

// Legacy alias so old callers (shop.js) don't break
export function applyRewards(rewards) {
  let all = [];
  const arr = Array.isArray(rewards) ? rewards : [rewards];
  for (const r of arr) all = all.concat(applyReward(r));
  return all;
}
