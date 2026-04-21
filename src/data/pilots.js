// Maps XP to a pilot tier with icon, color, avatar emoji
export const PILOT_TIERS = [
  { id: 'cadet',     name: 'CADET',     minXp: 0,     avatar: '🪖', color: '#94a3b8', desc: 'Training begins...' },
  { id: 'pilot',     name: 'PILOT',     minXp: 500,   avatar: '✈',  color: '#60a5fa', desc: 'First solo flight!' },
  { id: 'ace',       name: 'ACE',       minXp: 2000,  avatar: '⚡',  color: '#fbbf24', desc: 'A force to reckon with.' },
  { id: 'general',   name: 'GENERAL',   minXp: 5000,  avatar: '🎖',  color: '#f87171', desc: 'Leading the squadron.' },
  { id: 'commander', name: 'COMMANDER', minXp: 10000, avatar: '🏆', color: '#c084fc', desc: 'Sky legend.' },
];

/**
 * Returns pilot info for a given XP value.
 * @param {number} xp
 * @returns {{ tier: object, next: object|null, xpInTier: number, xpToNext: number, pct: number }}
 */
export function getPilotInfo(xp) {
  let tierIdx = 0;
  for (let i = PILOT_TIERS.length - 1; i >= 0; i--) {
    if (xp >= PILOT_TIERS[i].minXp) {
      tierIdx = i;
      break;
    }
  }

  const tier = PILOT_TIERS[tierIdx];
  const next = tierIdx < PILOT_TIERS.length - 1 ? PILOT_TIERS[tierIdx + 1] : null;

  const xpInTier = xp - tier.minXp;
  const xpToNext = next ? next.minXp - xp : 0;
  const pct = next
    ? Math.min(100, Math.round((xpInTier / (next.minXp - tier.minXp)) * 100))
    : 100;

  return { tier, next, xpInTier, xpToNext, pct };
}
