// Coins for good shooting, by steps: every HITS_PER_STEP shots of the
// player's own plane that hit an enemy plane, STEP_COINS coins.
//  * A hit = a shot of the player's plane (missile, laser, bullet, shell,
//    airdrop weapon) that touches an enemy plane. Allies' shots (turned enemy,
//    air support, teammate bot) do not count.
//  * At most MAX_STEPS steps per game (MAX_SHOT_COINS coins), on top of the
//    other coins (state.js MAX_GAME_COINS, within the server's coin refill).
// Sized on the shop prices (500 to 8,000 coins; a game gives up to 100): a
// level 1 with the basic shot (about 14 hits) gives 2 steps, +10; the best
// weapons reach the cap, +30. So a game gives at most 30 % more coins.
// Like the coins picked up during play, they are earned only when the level
// is won (game.js finishLevel). The HUD shows the hits left before the next
// step (screens/combo-fx.js setShotMeter).
export const HITS_PER_STEP = 6;
export const STEP_COINS = 5;
export const MAX_STEPS = 6;
export const MAX_SHOT_COINS = STEP_COINS * MAX_STEPS;

let _hits = 0;

// New game. A game continued after a game over keeps its count.
export function resetShotCoins({ keep = false } = {}) {
  if (!keep) _hits = 0;
}

function stepsOf(hits) {
  return Math.min(MAX_STEPS, Math.floor(hits / HITS_PER_STEP));
}

// One more hit. Returns the coins of the step it reaches (0 when none).
export function countHit() {
  const before = stepsOf(_hits);
  _hits++;
  return stepsOf(_hits) > before ? STEP_COINS : 0;
}

// For the HUD meter: { filled, size, left, steps, max }. `filled` hits of
// `size` toward the next step, `left` hits still needed; `max` once the cap
// is reached (the meter shows MAX).
export function shotProgress() {
  const steps = stepsOf(_hits);
  const max = steps >= MAX_STEPS;
  const filled = max ? HITS_PER_STEP : _hits % HITS_PER_STEP;
  return { filled, size: HITS_PER_STEP, left: max ? 0 : HITS_PER_STEP - filled, steps, max, coins: STEP_COINS };
}

// Coins of the steps reached so far (the HUD coin counter shows them live).
export function liveShotCoins() {
  return stepsOf(_hits) * STEP_COINS;
}

// End of the level: { hits, steps, total }.
export function shotCoinsResult() {
  const steps = stepsOf(_hits);
  return { hits: _hits, steps, total: steps * STEP_COINS };
}
