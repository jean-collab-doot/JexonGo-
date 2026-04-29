// ── LEGACY XP-BASED TIERS (used by briefing avatar) ─────────────────────────
export const PILOT_TIERS = [
  { id: 'cadet',     name: 'CADET',     minXp: 0,     avatar: '♟', color: '#94a3b8', desc: 'Training begins...' },
  { id: 'pilot',     name: 'PILOT',     minXp: 500,   avatar: '▲',  color: '#60a5fa', desc: 'First solo flight!' },
  { id: 'ace',       name: 'ACE',       minXp: 2000,  avatar: '★',  color: '#fbbf24', desc: 'A force to reckon with.' },
  { id: 'general',   name: 'GENERAL',   minXp: 5000,  avatar: '◆',  color: '#f87171', desc: 'Leading the squadron.' },
  { id: 'commander', name: 'COMMANDER', minXp: 10000, avatar: '♛', color: '#c084fc', desc: 'Sky legend.' },
];

export function getPilotInfo(xp) {
  let tierIdx = 0;
  for (let i = PILOT_TIERS.length - 1; i >= 0; i--) {
    if (xp >= PILOT_TIERS[i].minXp) { tierIdx = i; break; }
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

// ── MILITARY PILOT GRADES (level-based) ─────────────────────────────────────
export const PILOT_GRADES = [
  { minLevel: 50, name: 'AIR ACE',       short: 'ACE',  emoji: '✦', color: '#ffd700' },
  { minLevel: 46, name: 'GENERAL',       short: 'GEN',  emoji: '◆', color: '#f87171' },
  { minLevel: 36, name: 'COLONEL',       short: 'COL',  emoji: '★', color: '#a855f7' },
  { minLevel: 26, name: 'MAJOR',         short: 'MAJ',  emoji: '⚡', color: '#00d4ff' },
  { minLevel: 16, name: 'CAPTAIN',       short: 'CPT',  emoji: '▲', color: '#fbbf24' },
  { minLevel: 11, name: 'LIEUTENANT',    short: 'LT',   emoji: '◈', color: '#60a5fa' },
  { minLevel: 6,  name: '2ND LT',        short: '2LT',  emoji: '◇', color: '#94a3b8' },
  { minLevel: 0,  name: 'CADET',         short: 'CDT',  emoji: '▷', color: '#64748b' },
];

export function getPilotGrade(highestLevel) {
  for (const g of PILOT_GRADES) {
    if ((highestLevel || 0) >= g.minLevel) return g;
  }
  return PILOT_GRADES[PILOT_GRADES.length - 1];
}

/** Returns the next grade threshold above highestLevel, or null if max. */
export function getNextGrade(highestLevel) {
  const cur = getPilotGrade(highestLevel);
  const idx = PILOT_GRADES.indexOf(cur);
  return idx > 0 ? PILOT_GRADES[idx - 1] : null;
}
