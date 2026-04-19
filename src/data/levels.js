export const BIOMES = ['ocean', 'desert', 'city', 'arctic', 'space'];

export const BIOME_META = {
  ocean:  { label: 'OCEAN',  sky: '#0c1a3a', horizon: '#0d3b6e', accent: '#00d4ff' },
  desert: { label: 'DESERT', sky: '#2d1505', horizon: '#7c4a1e', accent: '#fbbf24' },
  city:   { label: 'CITY',   sky: '#0a0e1a', horizon: '#1a1a2e', accent: '#a855f7' },
  arctic: { label: 'ARCTIC', sky: '#0e1f35', horizon: '#b8d4e8', accent: '#e0f2fe' },
  space:  { label: 'SPACE',  sky: '#000000', horizon: '#0a0a1e', accent: '#f472b6' },
};

function biomeForLevel(n) { return BIOMES[Math.min(Math.floor((n - 1) / 10), 4)]; }

// Operations unlocked progressively
function opsForLevel(n) {
  if (n <= 10) return ['+'];
  if (n <= 20) return ['+', '-'];
  if (n <= 30) return ['+', '-', '*'];
  return ['+', '-', '*', '/'];
}

// Number range for arithmetic — grows with level
function mathRangeForLevel(n) {
  if (n <= 5)  return { cap: 10,  multCap: 0  };
  if (n <= 10) return { cap: 15,  multCap: 0  };
  if (n <= 15) return { cap: 18,  multCap: 0  };
  if (n <= 20) return { cap: 20,  multCap: 0  };
  if (n <= 25) return { cap: 20,  multCap: 10 };
  if (n <= 30) return { cap: 25,  multCap: 12 };
  if (n <= 35) return { cap: 30,  multCap: 12 };
  if (n <= 40) return { cap: 40,  multCap: 15 };
  if (n <= 45) return { cap: 50,  multCap: 15 };
  return               { cap: 99,  multCap: 20 };
}

// Seconds to answer — shrinks with level
function timeLimitForLevel(n) {
  if (n <= 10) return 15;
  if (n <= 25) return 12;
  if (n <= 50) return 10;
  return 4;
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

// Maximum enemies on screen at once — grows with level
function maxEnemiesForLevel(n) {
  if (n % 10 === 0) {
    // Boss count scales: 1 → 1 → 2 → 2 → 3
    const milestone = n / 10;
    return milestone <= 2 ? 1 : milestone <= 4 ? 2 : 3;
  }
  if (n <= 10) return 3;
  if (n <= 20) return 4;
  if (n <= 30) return 5;
  if (n <= 40) return 6;
  return 7;
}

// Frames between enemy spawns — shrinks with level (faster = harder)
function spawnRateForLevel(n) {
  if (n <= 5)  return 220;
  if (n <= 10) return 180;
  if (n <= 15) return 150;
  if (n <= 20) return 130;
  if (n <= 25) return 110;
  if (n <= 30) return 90;
  if (n <= 40) return 70;
  return 50;
}

// Enemy movement speed multiplier — grows with level
function enemySpeedMultForLevel(n) {
  return Math.round((1 + (n - 1) * 0.012) * 100) / 100; // 1.00 → ~1.59 at lv50
}

// Enemy fire-rate multiplier — lower = fires faster
function enemyFireRateMultForLevel(n) {
  const base = Math.max(0.45, 1 - (n - 1) * 0.011); // 1.00 → ~0.47 at lv50
  if (n % 10 === 0) {
    // Boss levels: bonus shrinks each milestone so later bosses fire faster
    // lvl10 +0.40, lvl20 +0.32, lvl30 +0.24, lvl40 +0.16, lvl50 +0.08
    const milestone = n / 10; // 1..5
    const bonus = 0.40 - (milestone - 1) * 0.08;
    return Math.min(base + bonus, 1.0);
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
  };
}

export const TOTAL_LEVELS = 50;
