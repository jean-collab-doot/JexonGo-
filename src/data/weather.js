export const WEATHER_TYPES = {
  CLEAR:  { id:'CLEAR',  label:'CLEAR SKIES', icon:'☀',  color:'#fbbf24', desc:'+25% coins',      coinMult:1.25, timeMod:0,  xpMult:1.0,  overlay:'rgba(255,220,100,0.04)' },
  CLOUDY: { id:'CLOUDY', label:'CLOUDY',       icon:'☁',  color:'#94a3b8', desc:'Normal',          coinMult:1.0,  timeMod:0,  xpMult:1.0,  overlay:'rgba(150,150,180,0.06)' },
  STORM:  { id:'STORM',  label:'STORM',        icon:'⛈',  color:'#818cf8', desc:'-3s, +50% XP',   coinMult:1.0,  timeMod:-3, xpMult:1.5,  overlay:'rgba(80,80,200,0.10)'   },
  FOG:    { id:'FOG',    label:'DENSE FOG',    icon:'🌫', color:'#cbd5e1', desc:'-2s timer',        coinMult:1.0,  timeMod:-2, xpMult:1.2,  overlay:'rgba(200,210,220,0.12)' },
};

/**
 * Deterministic weather per level (same level always has same weather).
 * @param {number} n - level number
 * @returns {object} weather type entry
 */
export function getWeatherForLevel(n) {
  const keys = Object.keys(WEATHER_TYPES);
  return WEATHER_TYPES[keys[(n * 7 + 3) % keys.length]];
}
