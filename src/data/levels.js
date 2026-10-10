import { getWeatherForLevel } from './weather.js';
import { getLocation } from './locations.js';

export const BIOMES = ['ocean', 'desert', 'city', 'arctic', 'space'];

export const BIOME_META = {
  ocean:  { label: 'OCEAN',  labelFr: 'PACIFIQUE', sky: '#0c1a3a', horizon: '#0d3b6e', accent: '#00d4ff' },
  desert: { label: 'DESERT', labelFr: 'SAHARA',    sky: '#2d1505', horizon: '#7c4a1e', accent: '#fbbf24' },
  city:   { label: 'USA',    labelFr: 'USA',       sky: '#0a0e1a', horizon: '#1a1a2e', accent: '#a855f7' },
  arctic: { label: 'ARCTIC', labelFr: 'ARCTIQUE',  sky: '#0e1f35', horizon: '#b8d4e8', accent: '#e0f2fe' },
  space:  { label: 'SPACE',  labelFr: 'ESPACE',    sky: '#000000', horizon: '#0a0a1e', accent: '#f472b6' },
};

function biomeForLevel(n) { return BIOMES[Math.min(Math.floor((n - 1) / 10), 4)]; }

// Operations unlocked progressively — gentler for kids 6–12
function opsForLevel(n) {
  if (n <= 15) return ['+'];
  if (n <= 25) return ['+', '-'];
  if (n <= 35) return ['+', '-', '*'];
  return ['+', '-', '*', '/'];
}

// Number range — small, friendly numbers throughout
function mathRangeForLevel(n) {
  if (n <= 5)  return { cap: 8,   multCap: 0  };
  if (n <= 10) return { cap: 10,  multCap: 0  };
  if (n <= 15) return { cap: 12,  multCap: 0  };
  if (n <= 20) return { cap: 15,  multCap: 0  };
  if (n <= 25) return { cap: 15,  multCap: 5  };
  if (n <= 30) return { cap: 20,  multCap: 6  };
  if (n <= 35) return { cap: 20,  multCap: 8  };
  if (n <= 40) return { cap: 25,  multCap: 10 };
  if (n <= 45) return { cap: 30,  multCap: 10 };
  return               { cap: 40,  multCap: 12 };
}

// Seconds to answer — generous time for young players
function timeLimitForLevel(n) {
  if (n <= 10) return 20;
  if (n <= 25) return 18;
  if (n <= 40) return 15;
  return 12;
}

// Enemy type pool — harder mix at higher levels
function enemyTypesForLevel(n) {
  if (n % 10 === 0)  return ['boss'];
  if (n <= 5)        return ['basic'];
  if (n <= 10)       return ['basic', 'basic', 'fast'];
  if (n <= 15)       return ['basic', 'fast', 'fast'];
  if (n <= 20)       return ['basic', 'fast', 'tank'];
  if (n <= 25)       return ['fast', 'tank', 'turner'];
  if (n <= 30)       return ['turner', 'fast', 'tank', 'basic'];
  if (n <= 35)       return ['turner', 'interceptor', 'fast', 'tank'];
  if (n <= 40)       return ['interceptor', 'turner', 'tank', 'fast'];
  return                    ['interceptor', 'turner', 'tank', 'fast', 'basic'];
}

// Regular companion enemies that appear alongside the boss
function bossCompanionTypesForLevel(n) {
  const m = n / 10;
  if (m === 1) return ['basic'];
  if (m === 2) return ['basic', 'fast'];
  if (m === 3) return ['fast', 'tank', 'turner'];
  if (m === 4) return ['interceptor', 'turner', 'tank'];
  return               ['interceptor', 'turner', 'tank', 'fast'];
}

// How many companion enemies can be on screen at once (not counting the boss)
function bossCompanionCountForLevel(n) {
  const m = n / 10;
  return 2 + m * 2; // 4, 6, 8, 10, 12 for lv10→50
}

// Maximum enemies on screen at once
function maxEnemiesForLevel(n) {
  if (n % 10 === 0) {
    const milestone = n / 10;
    return 2 + milestone;
  }
  return Math.min(20, 5 + Math.floor((n - 1) / 3)); // 5 → 20
}

// Frames between enemy spawns
function spawnRateForLevel(n) {
  // Every new level shortens the interval, producing a smooth increase in
  // enemy density instead of large jumps only at biome boundaries.
  return Math.max(40, Math.round(150 - (n - 1) * 2.25)); // 150 → 40
}

// Enemy movement speed — slower start, gentler ramp
function enemySpeedMultForLevel(n) {
  return Math.round((0.7 + (n - 1) * 0.008) * 100) / 100; // 0.70 → ~1.09 at lv50
}

// Enemy fire-rate multiplier — fires less often overall
function enemyFireRateMultForLevel(n) {
  const base = Math.max(0.6, 1.2 - (n - 1) * 0.012); // 1.20 → ~0.62 at lv50
  if (n % 10 === 0) {
    const milestone = n / 10;
    const bonus = 0.40 - (milestone - 1) * 0.08;
    return Math.min(base + bonus, 1.4);
  }
  return base;
}

// Collectible coins placed through each level. The count grows gently with
// each new biome without filling the screen with pickups. Boss levels receive
// two extra coins because they are longer and more demanding.
function mapCoinCountForLevel(n) {
  const biomeCoins = 20 + Math.floor((n - 1) / 10) * 2; // 20, 22, 24, 26, 28
  return biomeCoins + (n % 10 === 0 ? 4 : 0);
}

// A stable (not re-randomized on every render) example equation for the
// briefing screen, built from the same op pool and number ranges the real
// in-game questions use, so it's representative of what the player will see.
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
function rndSeeded(seed, min, max) {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}
const SQUARE = { 2: '²', 3: '³' };
export function equationExampleForLevel(n, ops, cap, multCap) {
  const op = ops[Math.floor(seededRandom(n * 13.7) * ops.length)];
  // Exponent / algebra: same shapes as the game's questions (math-engine.js).
  if (op === '^') {
    const base = rndSeeded(n * 2.1, 2, cap <= 15 ? 5 : 10);
    return { text: `${base}${SQUARE[2]} = ?`, answer: base * base, op };
  }
  if (op === 'alg') {
    const x = rndSeeded(n * 2.1, 1, Math.max(5, Math.min(cap, 20)));
    const a = rndSeeded(n * 3.3, 1, Math.max(5, Math.min(cap, 20)));
    return { text: `x + ${a} = ${x + a}, x = ?`, answer: x, op };
  }
  let a, b, answer;
  switch (op) {
    case '+': a = rndSeeded(n * 2.1, 1, cap); b = rndSeeded(n * 3.3, 1, cap); answer = a + b; break;
    case '-': a = rndSeeded(n * 2.1, 2, cap); b = rndSeeded(n * 3.3, 1, a); answer = a - b; break;
    case '*': { const mc = multCap || 12; a = rndSeeded(n * 2.1, 2, mc); b = rndSeeded(n * 3.3, 2, mc); answer = a * b; break; }
    default: { const mc = multCap || 12; b = rndSeeded(n * 3.3, 2, mc); answer = rndSeeded(n * 2.1, 1, mc); a = b * answer; }
  }
  const sym = op === '*' ? '×' : op === '/' ? '÷' : op;
  return { text: `${a} ${sym} ${b} = ?`, answer, op };
}

export function getLevel(n) {
  const biome = biomeForLevel(n);
  const range = mathRangeForLevel(n);
  const ops = opsForLevel(n);
  return {
    num:               n,
    biome,
    colors:            BIOME_META[biome],
    ops,
    mathCap:           range.cap,
    mathMultCap:       range.multCap,
    location:          getLocation(n),
    equationExample:   equationExampleForLevel(n, ops, range.cap, range.multCap),
    timeLimit:         timeLimitForLevel(n),
    questionCount:     10,
    enemyTypes:        enemyTypesForLevel(n),
    maxEnemies:        maxEnemiesForLevel(n),
    spawnRate:         spawnRateForLevel(n),
    enemySpeedMult:    enemySpeedMultForLevel(n),
    enemyFireRateMult: enemyFireRateMultForLevel(n),
    mapCoinCount:      mapCoinCountForLevel(n),
    isBossLevel:       n % 10 === 0,
    // 20 chests total across the 50-level campaign: 2 per 5-level block
    // (…3,5, 8,10, 13,15…), so 4 per 10-level world.
    isChestLevel:      n % 5 === 0 || n % 5 === 3,
    bossCompanionTypes: n % 10 === 0 ? bossCompanionTypesForLevel(n) : [],
    bossCompanionMax:   n % 10 === 0 ? bossCompanionCountForLevel(n) : 0,
    weather:           getWeatherForLevel(n, biome),
  };
}

export const TOTAL_LEVELS = 50;
