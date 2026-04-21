// ── RANK TIERS ────────────────────────────────────────────────────────────────
// Each tier has 3 divisions (I = top, III = bottom), each division = 100 LP.
// Elite has no divisions and is uncapped.

export const TIERS = [
  { id: 'bronze',   name: 'BRONZE',   minLP: 0,    color: '#cd7f32', glow: '#7c4a00', icon: '✦',  divs: 3 },
  { id: 'silver',   name: 'SILVER',   minLP: 300,  color: '#c0c0c0', glow: '#606060', icon: '★',  divs: 3 },
  { id: 'gold',     name: 'GOLD',     minLP: 700,  color: '#fbbf24', glow: '#8a6500', icon: '◆',  divs: 3 },
  { id: 'platinum', name: 'PLATINUM', minLP: 1200, color: '#00d4ff', glow: '#005a70', icon: '❋',  divs: 3 },
  { id: 'diamond',  name: 'DIAMOND',  minLP: 1800, color: '#a855f7', glow: '#5a1a8a', icon: '⬡',  divs: 3 },
  { id: 'elite',    name: 'ELITE',    minLP: 2500, color: '#ff2277', glow: '#8a0040', icon: '♛',  divs: 1 },
];

const DIV_LABELS = ['III', 'II', 'I'];
const DIV_SIZE   = 100; // LP per division

export function getRankInfo(lp) {
  lp = Math.max(0, lp);
  let tier = TIERS[0];
  for (const t of TIERS) { if (lp >= t.minLP) tier = t; else break; }

  if (tier.id === 'elite') {
    return { tier, division: 0, divLabel: 'ELITE', lpInDiv: lp - tier.minLP, lpMax: null };
  }

  const nextTier   = TIERS[TIERS.indexOf(tier) + 1];
  const tierRange  = nextTier ? nextTier.minLP - tier.minLP : tier.divs * DIV_SIZE;
  const divSize    = Math.floor(tierRange / tier.divs);
  const withinTier = lp - tier.minLP;
  const divIdx     = Math.min(tier.divs - 1, Math.floor(withinTier / divSize));
  const lpInDiv    = withinTier - divIdx * divSize;
  const division   = tier.divs - 1 - divIdx; // 0=III, 1=II, 2=I

  return { tier, division, divLabel: `${tier.name} ${DIV_LABELS[divIdx]}`, lpInDiv, lpMax: divSize };
}

export function rankDisplayName(lp) {
  return getRankInfo(lp).divLabel;
}

// ── LP CHANGE CALCULATION ─────────────────────────────────────────────────────
// Base gain/loss adjusted by rating difference between player and opponent.
// New player protection: first PLACEMENT_MATCHES games → no LP loss.

export const PLACEMENT_MATCHES = 5;
const BASE_WIN  = 20;
const BASE_LOSS = 15;

export function calcLPChange({ won, playerLP, opponentLP, gamesPlayed, winStreak }) {
  const diff   = opponentLP - playerLP; // positive = stronger opp
  const adjust = Math.round(Math.max(-8, Math.min(8, diff / 50)));

  if (won) {
    let gain = BASE_WIN + adjust;
    if (winStreak >= 3) gain += 10;
    else if (winStreak === 2) gain += 5;
    return Math.max(8, gain);
  } else {
    if (gamesPlayed < PLACEMENT_MATCHES) return 0; // protected
    const loss = BASE_LOSS - adjust;
    return -Math.max(5, loss);
  }
}

// ── SEASON ───────────────────────────────────────────────────────────────────
export const SEASON_DAYS    = 30;
export const SOFT_RESET_PCT = 0.4; // on season reset, keep 40% of LP above Bronze

export function getSeasonEnd(startTs) {
  return startTs + SEASON_DAYS * 24 * 3600 * 1000;
}

// ── AI OPPONENT ROSTER ────────────────────────────────────────────────────────
const PILOT_NAMES = [
  'ACE_NOVA','SKY_WOLF','THUNDER_X','IRON_HAWK','BLAZE_7',
  'ZERO_G','STORM_ACE','PIXEL_ACE','GHOST_JET','SONIC_V',
  'NEON_FLY','DELTA_1','APEX_BIRD','CRIMSON_W','TURBO_Z',
];

export function generateOpponent(playerLP) {
  const spread  = 80 + Math.random() * 40;
  const sign    = Math.random() < 0.5 ? 1 : -1;
  const oppLP   = Math.max(0, Math.round(playerLP + sign * spread * Math.random()));
  const name    = PILOT_NAMES[Math.floor(Math.random() * PILOT_NAMES.length)];
  return { name, lp: oppLP };
}

// Simulate one opponent answer given its LP
export function simulateOpponentAnswer(lp) {
  const skill    = Math.min(1, lp / 2000);
  const accuracy = 0.52 + skill * 0.43;          // 52 % Bronze → 95 % Elite
  const avgTime  = 9.5 - skill * 7;               // 9.5 s → 2.5 s
  const correct  = Math.random() < accuracy;
  const time     = Math.max(0.4, avgTime + (Math.random() - 0.5) * 3);
  return { correct, time: +time.toFixed(1) };
}

// ── SEASON RANK REWARDS ───────────────────────────────────────────────────────
export const SEASON_REWARDS = {
  bronze:   { coins: 500,  label: 'BRONZE SEASON REWARD' },
  silver:   { coins: 1000, label: 'SILVER SEASON REWARD' },
  gold:     { coins: 2000, label: 'GOLD SEASON REWARD'   },
  platinum: { coins: 3500, label: 'PLATINUM SEASON REWARD' },
  diamond:  { coins: 5000, label: 'DIAMOND SEASON REWARD' },
  elite:    { coins: 8000, label: 'ELITE SEASON REWARD'  },
};
