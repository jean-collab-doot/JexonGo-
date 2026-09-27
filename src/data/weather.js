export const WEATHER_TYPES = {
  CLEAR:  { id: 'CLEAR',  label: 'CLEAR SKIES', labelFr: 'BEAU TEMPS',  icon: 'sun', color: '#fbbf24', desc: '+25% coins',    descFr: '+25% de pièces', coinMult: 1.25, timeMod: 0,  xpMult: 1.0, overlay: 'rgba(255,220,100,0.04)' },
  CLOUDY: { id: 'CLOUDY', label: 'CLOUDY',       labelFr: 'NUAGEUX',     icon: 'cloud', color: '#94a3b8', desc: 'Normal',        descFr: 'Normal',         coinMult: 1.0,  timeMod: 0,  xpMult: 1.0, overlay: 'rgba(150,150,180,0.06)' },
  RAIN:   { id: 'RAIN',   label: 'RAIN',         labelFr: 'PLUIE',       icon: 'rain', color: '#60a5fa', desc: '-1s, +15% XP',  descFr: '-1s, +15% XP',   coinMult: 1.0,  timeMod: -1, xpMult: 1.15, overlay: 'rgba(90,130,200,0.08)' },
  STORM:  { id: 'STORM',  label: 'STORM',        labelFr: 'ORAGE',       icon: 'storm', color: '#818cf8', desc: '-3s, +50% XP',  descFr: '-3s, +50% XP',   coinMult: 1.0,  timeMod: -3, xpMult: 1.5, overlay: 'rgba(80,80,200,0.10)' },
  FOG:    { id: 'FOG',    label: 'DENSE FOG',    labelFr: 'BROUILLARD',  icon: 'fog', color: '#cbd5e1', desc: '-2s timer',     descFr: '-2s',            coinMult: 1.0,  timeMod: -2, xpMult: 1.2, overlay: 'rgba(200,210,220,0.12)' },
  SNOW:   { id: 'SNOW',   label: 'SNOW',         labelFr: 'NEIGE',       icon: 'snow', color: '#e0f2fe', desc: '-2s, +30% XP',  descFr: '-2s, +30% XP',   coinMult: 1.0,  timeMod: -2, xpMult: 1.3, overlay: 'rgba(220,235,255,0.10)' },
  // Arctic only: wind-driven snow that nearly whites out the screen.
  BLIZZARD:  { id: 'BLIZZARD',  label: 'BLIZZARD',   labelFr: 'BLIZZARD',          icon: 'blizzard', color: '#f1f5f9', desc: '-3s, +50% XP',  descFr: '-3s, +50% XP',   coinMult: 1.0,  timeMod: -3, xpMult: 1.5,  overlay: 'rgba(230,240,255,0.14)' },
  // Desert only: blowing sand and an orange haze.
  SANDSTORM: { id: 'SANDSTORM', label: 'SANDSTORM',  labelFr: 'TEMPÊTE DE SABLE',  icon: 'sandstorm', color: '#f59e0b', desc: '-2s, +30% XP',  descFr: '-2s, +30% XP',   coinMult: 1.0,  timeMod: -2, xpMult: 1.3,  overlay: 'rgba(210,150,70,0.14)' },
  // Desert only: blazing sun and shimmering heat waves.
  // Wind streaks all the time and frequent gusts, no rain.
  WINDY:     { id: 'WINDY',     label: 'WINDY',      labelFr: 'VENTEUX',           icon: 'wind', color: '#a5f3fc', desc: '-1s, +15% XP',  descFr: '-1s, +15% XP',   coinMult: 1.0,  timeMod: -1, xpMult: 1.15, overlay: 'rgba(200,230,240,0.05)' },
  // Pacific: torrential rain, a rotating cloud spiral and violent gusts.
  TYPHOON:   { id: 'TYPHOON',   label: 'TYPHOON',    labelFr: 'TYPHON',            icon: 'typhoon', color: '#38bdf8', desc: '-3s, +60% XP',  descFr: '-3s, +60% XP',   coinMult: 1.0,  timeMod: -3, xpMult: 1.6,  overlay: 'rgba(20,40,90,0.14)' },
  // ── Space: one weather per planet (see SPACE_WEATHER below) ──
  VOLCANIC:   { id: 'VOLCANIC',   label: 'VOLCANIC ERUPTIONS', labelFr: 'ÉRUPTIONS VOLCANIQUES', icon: 'volcano', color: '#facc15', desc: '-2s, +30% XP', descFr: '-2s, +30% XP', coinMult: 1.0, timeMod: -2, xpMult: 1.3,  overlay: 'rgba(250,204,21,0.08)' },
  JOVIAN:     { id: 'JOVIAN',     label: 'JOVIAN STORM',       labelFr: 'TEMPÊTE JOVIENNE',      icon: 'typhoon', color: '#f97316', desc: '-3s, +50% XP', descFr: '-3s, +50% XP', coinMult: 1.0, timeMod: -3, xpMult: 1.5,  overlay: 'rgba(180,110,60,0.10)' },
  AURORA:     { id: 'AURORA',     label: 'AURORA',             labelFr: 'AURORE',                icon: 'aurora', color: '#4ade80', desc: '-1s, +15% XP', descFr: '-1s, +15% XP', coinMult: 1.0, timeMod: -1, xpMult: 1.15, overlay: 'rgba(80,200,160,0.05)' },
  SUPERSONIC: { id: 'SUPERSONIC', label: 'SUPERSONIC WINDS',   labelFr: 'VENTS SUPERSONIQUES',   icon: 'wind', color: '#3b82f6', desc: '-3s, +50% XP', descFr: '-3s, +50% XP', coinMult: 1.0, timeMod: -3, xpMult: 1.5,  overlay: 'rgba(30,64,175,0.14)' },
  RING_SHOWER:{ id: 'RING_SHOWER',label: 'RING SHOWER',        labelFr: "PLUIE D'ANNEAUX",       icon: 'planet', color: '#fde68a', desc: '-2s, +30% XP', descFr: '-2s, +30% XP', coinMult: 1.0, timeMod: -2, xpMult: 1.3,  overlay: 'rgba(253,230,138,0.06)' },
  HEATWAVE:  { id: 'HEATWAVE',  label: 'HEAT WAVE',  labelFr: 'CANICULE',          icon: 'heat', color: '#fb923c', desc: '-1s, +15% XP',  descFr: '-1s, +15% XP',   coinMult: 1.0,  timeMod: -1, xpMult: 1.15, overlay: 'rgba(255,160,60,0.08)' },
};

// Which weather can show up in each biome, so a desert never gets snow and an
// ocean level never gets a blizzard. Order doesn't matter, only membership.
const BIOME_WEATHER_POOL = {
  ocean:  ['CLEAR', 'RAIN', 'CLOUDY', 'WINDY', 'FOG'],
  desert: ['CLEAR', 'HEATWAVE', 'SANDSTORM', 'CLOUDY', 'HEATWAVE', 'SANDSTORM'],
  city:   ['CLEAR', 'WINDY', 'RAIN', 'STORM', 'FOG', 'CLOUDY'],
  arctic: ['SNOW', 'BLIZZARD', 'FOG', 'SNOW', 'BLIZZARD', 'CLOUDY'],
  space:  ['CLEAR', 'CLOUDY', 'STORM'],
};

/**
 * Deterministic weather per level (same level always has same weather),
 * restricted to what makes sense for that level's biome.
 * @param {number} n - level number
 * @param {string} [biome] - biome id, e.g. 'ocean' — defaults to the full pool
 * @returns {object} weather type entry
 */
// Space levels go two by two per planet (41-42 Io, 43-44 Jupiter, 45-46
// Ganymede, 47-48 Neptune, 49-50 Saturn); each gets its planet's weather.
const SPACE_WEATHER = ['VOLCANIC', 'JOVIAN', 'AURORA', 'SUPERSONIC', 'RING_SHOWER'];

// Levels whose weather is fixed by their location.
const LEVEL_WEATHER_OVERRIDES = {
  6: 'TYPHOON',    // Manila, Philippines — West Pacific typhoon belt
  8: 'TYPHOON',    // Tokyo, Japan
};

// Weathers offered in practice mode for a biome (its own pool, without
// duplicates; space also gets its planet weathers).
export function weatherOptionsForBiome(biome) {
  const ids = [...(BIOME_WEATHER_POOL[biome] || Object.keys(WEATHER_TYPES))];
  if (biome === 'space') ids.push(...SPACE_WEATHER);
  if (biome === 'ocean') ids.push('TYPHOON');
  return [...new Set(ids)].map(id => WEATHER_TYPES[id]);
}

export function getWeatherForLevel(n, biome) {
  if (LEVEL_WEATHER_OVERRIDES[n]) return WEATHER_TYPES[LEVEL_WEATHER_OVERRIDES[n]];
  if (biome === 'space' && n >= 41) {
    return WEATHER_TYPES[SPACE_WEATHER[Math.min(SPACE_WEATHER.length - 1, Math.floor((n - 41) / 2))]];
  }
  const pool = BIOME_WEATHER_POOL[biome] || Object.keys(WEATHER_TYPES);
  return WEATHER_TYPES[pool[(n * 7 + 3) % pool.length]];
}
