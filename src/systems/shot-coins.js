// Coins for good shooting: the more of the player's own shots hit enemy
// planes, the more coins.
//  * Each shot of the player's plane (missile, laser, bullet, shell, airdrop
//    weapon) that hits an enemy plane gives SHOT_HIT_COINS coin at once.
//    Allies' shots (turned enemy, air support, teammate bot) do not count.
//  * At the end of a won level, an accuracy bonus: the hits again × the
//    accuracy (hits / shots). 20 hits out of 25 shots (80 %) = 20 + 16.
// These coins have their own cap per game (MAX_SHOT_COINS), on top of the
// other coins (state.js MAX_GAME_COINS, within the server's coin refill).
// Like the coins picked up during play, they are earned only when the level
// is won (game.js finishLevel).
export const SHOT_HIT_COINS = 1;
export const MAX_SHOT_COINS = 60;

let _shots = 0;
let _hits = 0;

// New game. A game continued after a game over keeps its count.
export function resetShotCoins({ keep = false } = {}) {
  if (keep) return;
  _shots = 0;
  _hits = 0;
}

export function countShot(n = 1) { _shots += n; }
export function countHit() { _hits++; }

export function shotAccuracy() {
  return _shots > 0 ? Math.min(1, _hits / _shots) : 0;
}

// Coins of the hits so far (the HUD shows them live).
export function liveShotCoins() {
  return Math.min(MAX_SHOT_COINS, _hits * SHOT_HIT_COINS);
}

// End of the level: { shots, hits, accuracy, hitCoins, bonus, total }.
export function shotCoinsResult() {
  const accuracy = shotAccuracy();
  const hitCoins = liveShotCoins();
  const bonus = Math.min(MAX_SHOT_COINS - hitCoins, Math.round(_hits * SHOT_HIT_COINS * accuracy));
  return { shots: _shots, hits: _hits, accuracy, hitCoins, bonus, total: hitCoins + bonus };
}
