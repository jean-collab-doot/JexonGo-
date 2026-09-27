import { G, clampCoins, addLifetimeXp } from '../state.js';
import { coinIcon, uiIcon } from '../utils/icons.js';
import { AIRCRAFT, AIRCRAFT_ORDER } from '../data/aircraft.js';

// ── CHEST TIERS (20 total — 4 milestone levels per rarity) ────────────────────
// Levels …3,5, 8,10, 13,15… (see isChestLevel in data/levels.js): 2 chests
// per 5-level block, grouped 4 per rarity so each 10-level world gets one
// full BRONZE→…→LEGENDARY sweep every other world.
const CHEST_TIER_DEFS = [
  { name: 'BRONZE',    color: '#cd7f32', img: '/assets/chest/chest-blue.png' },
  { name: 'SILVER',    color: '#c0c0c0', img: '/assets/chest/chest-blue.png' },
  { name: 'GOLD',      color: '#fbbf24', img: '/assets/chest/chest-purple.png' },
  { name: 'PLATINUM',  color: '#00d4ff', img: '/assets/chest/chest-purple.png' },
  { name: 'LEGENDARY', color: '#cc44ff', img: '/assets/chest/chest-legendary.png' },
];
const CHEST_LEVELS = [3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30, 33, 35, 38, 40, 43, 45, 48, 50];
const CHEST_TIERS = CHEST_LEVELS.map((level, i) => {
  const idx = Math.floor(i / 4);
  return { level, idx, ...CHEST_TIER_DEFS[idx] };
});

// ── RARITIES ──────────────────────────────────────────────────────────────────
export const RARITIES = [
  { id: 'common',    label: 'COMMON',    color: '#94a3b8' },
  { id: 'rare',      label: 'RARE',      color: '#60a5fa' },
  { id: 'epic',      label: 'EPIC',      color: '#a855f7' },
  { id: 'legendary', label: 'LEGENDARY', color: '#fbbf24' },
  { id: 'mythic',    label: 'MYTHIC',    color: '#ff2d78' },
];

// ── ROULETTE SLOT DEFINITIONS ─────────────────────────────────────────────────
// Coins (scaled by rarity, see COIN_MULT_BY_RARITY) and a flat XP bonus make
// up most drops. One MYTHIC slot can award a full aircraft outright — see
// buildRewardFromSlot()'s 'aircraft' branch — kept extremely rare via its
// near-zero weight in SLOT_WEIGHTS_BY_TIER below.
export const ROULETTE_SLOTS = [
  { id: 'coinsCommon',    label: 'COINS',      icon: coinIcon('jg-coin-icon-small'), color: '#94a3b8', rewardType: 'coins', rarityIdx: 0 },
  { id: 'coinsRare',      label: 'COINS',      icon: coinIcon('jg-coin-icon-small'), color: '#60a5fa', rewardType: 'coins', rarityIdx: 1 },
  { id: 'coinsEpic',      label: 'COINS',      icon: coinIcon('jg-coin-icon-small'), color: '#a855f7', rewardType: 'coins', rarityIdx: 2 },
  { id: 'coinsLegendary', label: 'BIG COINS',  icon: coinIcon('jg-coin-icon-small'), color: '#fbbf24', rewardType: 'coins', rarityIdx: 3 },
  { id: 'xp200',      label: 'BONUS XP',       icon: '<img class="jg-exp-icon" src="/assets/fx/Caisse/JexonGo_EXP_frame_01.png" alt="EXP">', color: '#00e84b', rewardType: 'xp', xpAmount: 200 },
  { id: 'xp500',      label: 'MEGA XP',        icon: '<img class="jg-exp-icon" src="/assets/fx/Caisse/JexonGo_EXP_frame_01.png" alt="EXP">', color: '#fff700', rewardType: 'xp', xpAmount: 500 },
  { id: 'aircraft',   label: 'AIRCRAFT',       icon: uiIcon('plane'), color: '#ff2d78', rewardType: 'aircraft', rarityIdx: 4 },
];

// Weights per tier — index matches ROULETTE_SLOTS order above
// [coinsCommon, coinsRare, coinsEpic, coinsLegendary, xp200, xp500, aircraft]  must sum to 100
export const SLOT_WEIGHTS_BY_TIER = [
  [ 54, 29, 10,  2,  5,  0,  0 ],  // 0 Bronze    — mostly common
  [ 32, 37, 18,  4,  7,  2,  0 ],  // 1 Silver    — common/rare mix
  [ 13, 30, 34, 12,  7,  4,  0 ],  // 2 Gold      — rare/epic mix
  [  6, 16, 38, 29,  6,  4,  1 ],  // 3 Platinum  — epic/legendary mix, rare aircraft
  [  0,  9, 31, 46,  5,  5,  4 ],  // 4 Legendary — mostly legendary, aircraft jackpot
];

// Kept for existing save data / cloud-sync compatibility (see state.js,
// systems/cloud-save.js) — chests no longer roll blueprint-part rewards, so
// this cost table has nothing left reading from it going forward.
export const BLUEPRINT_COST = {
  pc21: 6, c130: 8, a10: 10, f16: 12,
  f18: 15, f22: 18, f35: 20, b2: 25, sr71: 30,
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
function rollRouletteSlot(tierIdx) {
  const weights = SLOT_WEIGHTS_BY_TIER[tierIdx] ?? SLOT_WEIGHTS_BY_TIER[0];
  const roll = Math.random() * 100;
  let acc = 0;
  for (let i = 0; i < ROULETTE_SLOTS.length; i++) {
    acc += weights[i];
    if (roll < acc) return ROULETTE_SLOTS[i];
  }
  return ROULETTE_SLOTS[0];
}

// Coins per tier: Bronze→50, Silver→100, Gold→200, Platinum→350, Legendary→500
const COINS_BY_TIER = [50, 100, 200, 350, 500];
// Coin slots scale further by their own rarity within that tier (common→legendary).
const COIN_MULT_BY_RARITY = [1, 1.6, 2.5, 4];

// Every unlockable aircraft is eligible for the MYTHIC drop — the starter
// (already owned from the start) and the secret F-117 (found its own way,
// not bought or dropped) are excluded.
function eligibleAircraftPool() {
  return AIRCRAFT_ORDER.filter(id => !AIRCRAFT[id]?.starter && !AIRCRAFT[id]?.secret);
}

const MYTHIC_DUPLICATE_XP = 1500;

function buildRewardFromSlot(slot, tierIdx) {
  if (slot.rewardType === 'coins') {
    const base   = COINS_BY_TIER[tierIdx] ?? 50;
    const mult   = COIN_MULT_BY_RARITY[slot.rarityIdx] ?? 1;
    const amount = Math.round(base * mult);
    return {
      type:   'coins',
      rarity: slot.rarityIdx,
      amount,
      icon:   'coin',
      label:  slot.label,
      slotId: slot.id,
    };
  }

  if (slot.rewardType === 'aircraft') {
    const available = eligibleAircraftPool().filter(id => !G.unlockedAircraft.includes(id));
    if (!available.length) {
      // Every aircraft already owned — convert to a big XP bonus instead.
      return {
        type: 'xp',
        rarity: 4,
        amount: MYTHIC_DUPLICATE_XP,
        icon: '<img class="jg-exp-icon" src="/assets/fx/Caisse/JexonGo_EXP_frame_01.png" alt="EXP">',
        label: 'MYTHIC XP',
        slotId: slot.id,
      };
    }
    const aircraft = available[Math.floor(Math.random() * available.length)];
    return {
      type: 'aircraft',
      rarity: 4,
      aircraft,
      icon: slot.icon,
      label: slot.label,
      slotId: slot.id,
    };
  }

  // xp
  return {
    type: 'xp',
    rarity: slot.id === 'xp500' ? 3 : 2,
    amount: slot.xpAmount,
    icon: slot.icon,
    label: slot.label,
    slotId: slot.id,
  };
}

// ── MAIN ROLL ─────────────────────────────────────────────────────────────────
export function rollChest() {
  const lvl  = G.currentLevel;
  // rollChest() is only called on an actual chest level (see isChestLevel in
  // data/levels.js), so this matches exactly — the "at or below" fallback
  // only guards against being called off-schedule.
  const tier = CHEST_TIERS.find(t => t.level === lvl)
    || [...CHEST_TIERS].reverse().find(t => t.level <= lvl)
    || CHEST_TIERS[0];
  return rollChestTier(tier.idx);
}

// Daily rewards (see LOGIN_REWARDS in daily.js) give a chest of a fixed
// rarity: 0 BRONZE, 1 SILVER, 2 GOLD, 3 PLATINUM, 4 LEGENDARY.
export function rollChestTier(tierIdx) {
  const t    = Math.max(0, Math.min(CHEST_TIER_DEFS.length - 1, tierIdx | 0));
  const tier = CHEST_TIER_DEFS[t];

  const slot   = rollRouletteSlot(t);
  const reward = buildRewardFromSlot(slot, t);

  const hasEpic = reward.rarity >= 2;
  G.chestsWithoutEpic = hasEpic ? 0 : (G.chestsWithoutEpic || 0) + 1;

  return { chestName: tier.name, chestColor: tier.color, chestImg: tier.img, reward, slot, tierIdx: t };
}

// ── APPLY REWARD TO STATE ─────────────────────────────────────────────────────
export function applyReward(reward) {
  const newlyUnlocked = [];
  if (!G.playerRegistered) {
    reward._locked = true;
    return newlyUnlocked;
  }

  if (reward.type === 'coins') {
    G.coins = clampCoins((G.coins || 0) + reward.amount);

  } else if (reward.type === 'xp') {
    G.xp            = (G.xp            || 0) + reward.amount;
    G.totalXpEarned = (G.totalXpEarned || 0) + reward.amount;
    addLifetimeXp(reward.amount);

  } else if (reward.type === 'blueprint') {
    if (!G.blueprints) G.blueprints = {};
    const needed = BLUEPRINT_COST[reward.aircraft] || 99;
    const have   = G.blueprints[reward.aircraft] || 0;

    if (G.unlockedAircraft.includes(reward.aircraft) || have >= needed) {
      // Duplicate — give XP bonus
      reward._converted = true;
      G.xp            = (G.xp            || 0) + 50;
      G.totalXpEarned = (G.totalXpEarned || 0) + 50;
      addLifetimeXp(50);
    } else {
      G.blueprints[reward.aircraft] = have + reward.pieces;
      if (G.blueprints[reward.aircraft] >= needed) {
        G.unlockedAircraft.push(reward.aircraft);
        newlyUnlocked.push(reward.aircraft);
      }
    }


  } else if (reward.type === 'aircraft') {
    if (G.unlockedAircraft.includes(reward.aircraft)) {
      // Safety net for a stale/duplicate roll — buildRewardFromSlot() already
      // filters these out, so this should not normally happen.
      reward._converted = true;
      G.xp            = (G.xp            || 0) + MYTHIC_DUPLICATE_XP;
      G.totalXpEarned = (G.totalXpEarned || 0) + MYTHIC_DUPLICATE_XP;
      addLifetimeXp(MYTHIC_DUPLICATE_XP);
    } else {
      G.unlockedAircraft.push(reward.aircraft);
      if (!G.acquiredAircraft.includes(reward.aircraft)) G.acquiredAircraft.push(reward.aircraft);
      newlyUnlocked.push(reward.aircraft);
    }
  }

  return newlyUnlocked;
}

