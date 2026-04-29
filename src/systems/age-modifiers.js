// ── AGE-BASED DIFFICULTY MODIFIERS ───────────────────────────────────────────
// Applied on top of the level config at game start.
// Baseline (no modifier) is age 11-12 — the game's original target audience.
//
// timeMod:    seconds added/removed per question
// mathMult:   multiplier on mathCap and mathMultCap (number size)
// spawnMod:   frames added/removed between enemy spawns (positive = fewer spawns = easier)
// speedMult:  multiplier on enemySpeedMult
// fireMult:   multiplier on enemyFireRateMult (>1 = more frames between shots = easier)
// enemyMod:   integer added to maxEnemies

const AGE_BRACKETS = [
  { maxAge:  6, label: 'CADET',    timeMod: +8, mathMult: 0.60, spawnMod: +120, speedMult: 0.70, fireMult: 1.50, enemyMod: -2 },
  { maxAge:  8, label: 'ROOKIE',   timeMod: +5, mathMult: 0.75, spawnMod:  +80, speedMult: 0.82, fireMult: 1.30, enemyMod: -1 },
  { maxAge: 10, label: 'JUNIOR',   timeMod: +3, mathMult: 0.88, spawnMod:  +40, speedMult: 0.92, fireMult: 1.15, enemyMod:  0 },
  { maxAge: 12, label: 'STANDARD', timeMod:  0, mathMult: 1.00, spawnMod:    0, speedMult: 1.00, fireMult: 1.00, enemyMod:  0 },
  { maxAge: 14, label: 'VETERAN',  timeMod: -2, mathMult: 1.15, spawnMod:  -25, speedMult: 1.12, fireMult: 0.90, enemyMod: +1 },
  { maxAge: 16, label: 'ELITE',    timeMod: -4, mathMult: 1.30, spawnMod:  -40, speedMult: 1.22, fireMult: 0.82, enemyMod: +1 },
  { maxAge: 99, label: 'ACE',      timeMod: -6, mathMult: 1.50, spawnMod:  -60, speedMult: 1.35, fireMult: 0.70, enemyMod: +2 },
];

export function getAgeBracket(age) {
  return AGE_BRACKETS.find(b => age <= b.maxAge) || AGE_BRACKETS[AGE_BRACKETS.length - 1];
}

export function applyAgeModifiers(levelCfg, playerAge) {
  if (!playerAge || playerAge <= 0) return levelCfg;
  const m = getAgeBracket(playerAge);

  return {
    ...levelCfg,
    timeLimit:         Math.max(5,  levelCfg.timeLimit + m.timeMod),
    mathCap:           Math.max(5,  Math.round(levelCfg.mathCap     * m.mathMult)),
    mathMultCap:       levelCfg.mathMultCap > 0
                         ? Math.max(2, Math.round(levelCfg.mathMultCap * m.mathMult))
                         : 0,
    spawnRate:         Math.max(60, levelCfg.spawnRate + m.spawnMod),
    enemySpeedMult:    Math.round(levelCfg.enemySpeedMult * m.speedMult * 100) / 100,
    enemyFireRateMult: Math.round(levelCfg.enemyFireRateMult * m.fireMult * 100) / 100,
    maxEnemies:        Math.max(1,  levelCfg.maxEnemies + m.enemyMod),
    _ageBracket:       m.label,
  };
}
