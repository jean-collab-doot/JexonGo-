// Fuel of each playable plane (validated table, 2026-11-20): tank size and
// burn rate per second of flight. Small light planes: small tank, low burn;
// big heavy ones: big tank, high burn. Every plane flies 72 s on a full tank,
// plus a little more the rarer it is (+4 % uncommon … +20 % secret).
//   plane   size / weight          rarity            tank  burn/s  flight
//   t6      small, 2.9 t           common (free)       60   0.83    72 s
//   pc21    small, 4.2 t           common (800)        70   0.97    72 s
//   c130    very big, 70 t         uncommon (2000)    160   2.14    75 s
//   a10     medium-heavy, 23 t     uncommon (3800)    110   1.47    75 s
//   f16     medium, 19 t           rare (6000)        100   1.29    78 s
//   f18     medium-heavy, 23 t     rare (8800)        110   1.41    78 s
//   f22     heavy, 38 t            epic (12000)       130   1.61    81 s
//   f35     heavy, 32 t            epic (14400)       120   1.49    81 s
//   b2      giant, 170 t           legendary (22000)  200   2.40    84 s
//   sr71    big, 78 t              legendary (30000)  170   2.04    84 s
//   f117    medium-heavy, 24 t     secret             110   1.27    86 s
export const BASE_FLIGHT_S = 72;
export const RARITY_BONUS = { common: 0, uncommon: 0.04, rare: 0.08, epic: 0.12, legendary: 0.16, secret: 0.2 };

export const PLANE_FUEL = {
  t6:   { tank: 60,  rarity: 'common' },
  pc21: { tank: 70,  rarity: 'common' },
  c130: { tank: 160, rarity: 'uncommon' },
  a10:  { tank: 110, rarity: 'uncommon' },
  f16:  { tank: 100, rarity: 'rare' },
  f18:  { tank: 110, rarity: 'rare' },
  f22:  { tank: 130, rarity: 'epic' },
  f35:  { tank: 120, rarity: 'epic' },
  b2:   { tank: 200, rarity: 'legendary' },
  sr71: { tank: 170, rarity: 'legendary' },
  f117: { tank: 110, rarity: 'secret' },
};

// { tank, burn (per second), flight (seconds on a full tank) } of a plane.
export function planeFuel(id) {
  const p = PLANE_FUEL[id] || PLANE_FUEL.t6;
  const flight = BASE_FLIGHT_S * (1 + (RARITY_BONUS[p.rarity] || 0));
  return { tank: p.tank, burn: p.tank / flight, flight };
}

// Rules (shares of the plane's own tank).
export const HIT_COST = 0.06;          // hit by an enemy missile (about 4-5 s of flight)
export const CAN_REFILL = 0.30;        // one can
export const CAN_DROP_CHANCE = 1 / 3;  // share of destroyed enemies that drop a can
export const SAFETY_BELOW = 0.30;      // under this, after SAFETY_KILLS kills without a can,
export const SAFETY_KILLS = 4;         // the next kill drops one for sure
export const RESPAWN_FUEL = 0.5;       // back after an empty tank or revived in co-op
export const LOW_ALERT = 0.25;         // red, blinking, alert sound
export const CRITICAL_ALERT = 0.10;    // second alert sound
// Youngest players (game/glitter.js gentle mode): much gentler.
export const GENTLE = { burn: 0.4, hit: 0.5, drop: 1 / 2 };
