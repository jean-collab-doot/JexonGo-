import { getWeatherForLevel } from './weather.js';

export const BIOMES = ['ocean', 'desert', 'city', 'arctic', 'space'];

export const BIOME_META = {
  ocean:  { label: 'OCEAN',  sky: '#0c1a3a', horizon: '#0d3b6e', accent: '#00d4ff' },
  desert: { label: 'DESERT', sky: '#2d1505', horizon: '#7c4a1e', accent: '#fbbf24' },
  city:   { label: 'CITY',   sky: '#0a0e1a', horizon: '#1a1a2e', accent: '#a855f7' },
  arctic: { label: 'ARCTIC', sky: '#0e1f35', horizon: '#b8d4e8', accent: '#e0f2fe' },
  space:  { label: 'SPACE',  sky: '#000000', horizon: '#0a0a1e', accent: '#f472b6' },
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
  if (n <= 30)       return ['fast',  'tank', 'basic'];
  if (n <= 40)       return ['tank',  'fast', 'fast'];
  return                    ['tank',  'fast', 'boss'];
}

// Regular companion enemies that appear alongside the boss
function bossCompanionTypesForLevel(n) {
  const m = n / 10;
  if (m === 1) return ['basic'];
  if (m === 2) return ['basic', 'fast'];
  if (m === 3) return ['fast',  'tank'];
  if (m === 4) return ['fast',  'tank'];
  return               ['tank',  'fast'];
}

// How many companion enemies can be on screen at once (not counting the boss)
function bossCompanionCountForLevel(n) {
  const m = n / 10;
  return m; // 1, 2, 3, 4, 5 for lv10→50
}

// Maximum enemies on screen at once — fewer for kids
function maxEnemiesForLevel(n) {
  if (n % 10 === 0) {
    const milestone = n / 10;
    return milestone <= 2 ? 1 : milestone <= 4 ? 2 : 3;
  }
  if (n <= 10) return 2;
  if (n <= 20) return 3;
  if (n <= 30) return 4;
  if (n <= 40) return 5;
  return 6;
}

// Frames between enemy spawns — slower pacing for kids
function spawnRateForLevel(n) {
  if (n <= 5)  return 300;
  if (n <= 10) return 260;
  if (n <= 15) return 220;
  if (n <= 20) return 190;
  if (n <= 25) return 160;
  if (n <= 30) return 130;
  if (n <= 40) return 110;
  return 90;
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

export function getLevel(n) {
  const biome = biomeForLevel(n);
  const range = mathRangeForLevel(n);
  return {
    num:               n,
    biome,
    colors:            BIOME_META[biome],
    ops:               opsForLevel(n),
    mathCap:           range.cap,
    mathMultCap:       range.multCap,
    timeLimit:         timeLimitForLevel(n),
    questionCount:     10,
    enemyTypes:        enemyTypesForLevel(n),
    maxEnemies:        maxEnemiesForLevel(n),
    spawnRate:         spawnRateForLevel(n),
    enemySpeedMult:    enemySpeedMultForLevel(n),
    enemyFireRateMult: enemyFireRateMultForLevel(n),
    isBossLevel:       n % 10 === 0,
    isChestLevel:      n % 10 === 0,
    bossCompanionTypes: n % 10 === 0 ? bossCompanionTypesForLevel(n) : [],
    bossCompanionMax:   n % 10 === 0 ? bossCompanionCountForLevel(n) : 0,
    weather:           getWeatherForLevel(n),
  };
}

export const TOTAL_LEVELS = 50;
