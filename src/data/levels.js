export const BIOMES = ['ocean', 'desert', 'city', 'arctic', 'space'];

export const BIOME_META = {
  ocean:  { label: 'OCEAN',  sky: '#0c1a3a', horizon: '#0d3b6e', accent: '#00d4ff' },
  desert: { label: 'DESERT', sky: '#2d1505', horizon: '#7c4a1e', accent: '#fbbf24' },
  city:   { label: 'CITY',   sky: '#0a0e1a', horizon: '#1a1a2e', accent: '#a855f7' },
  arctic: { label: 'ARCTIC', sky: '#0e1f35', horizon: '#b8d4e8', accent: '#e0f2fe' },
  space:  { label: 'SPACE',  sky: '#000000', horizon: '#0a0a1e', accent: '#f472b6' },
};

function biomeForLevel(n)    { return BIOMES[Math.floor((n - 1) / 10)]; }
function opsForLevel(n)      { return n <= 10 ? ['+'] : n <= 25 ? ['+','-'] : ['+','-','*']; }
function timeLimitForLevel(n){ return n <= 10 ? 10 : n <= 25 ? 8 : n <= 40 ? 7 : 6; }
function enemyTypesForLevel(n) {
  if (n % 10 === 0)  return ['boss'];
  if (n <= 5)        return ['basic'];
  if (n <= 15)       return ['basic','basic','fast'];
  if (n <= 25)       return ['basic','tank','fast'];
  return ['tank','fast','basic'];
}

export function getLevel(n) {
  const biome = biomeForLevel(n);
  return {
    num:           n,
    biome,
    colors:        BIOME_META[biome],
    ops:           opsForLevel(n),
    timeLimit:     timeLimitForLevel(n),
    questionCount: 10,
    enemyTypes:    enemyTypesForLevel(n),
    isBossLevel:   n % 10 === 0,
    isChestLevel:  n % 10 === 0,
  };
}

export const TOTAL_LEVELS = 50;
