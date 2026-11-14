// Nuke reward: after each nuke explosion (B-2 bomb, airdrop nuke, B-2 strike
// plan, co-op B-2), the player gets NUKE_XP EXP and NUKE_COINS coins at once
// (HUD counters and a side callout, game.js).
// Up to MAX_NUKES rewarded per game, on top of the other per-game caps
// (state.js, xp-combo.js, shot-coins.js; within the server's anti-cheat
// refill). Like the coins and EXP picked up during play, they are saved when
// the level is won (game.js finishLevel). Not in practice or the tutorial.
export const NUKE_XP = 100;
export const NUKE_COINS = 50;
export const MAX_NUKES = 3;

let _nukes = 0;

// New game. A game continued after a game over keeps its count.
export function resetNukeReward({ keep = false } = {}) {
  if (!keep) _nukes = 0;
}

// A nuke exploded: returns { xp, coins } given (0 once the cap is reached).
export function nukeReward() {
  if (_nukes >= MAX_NUKES) return { xp: 0, coins: 0 };
  _nukes++;
  return { xp: NUKE_XP, coins: NUKE_COINS };
}

// Totals of the game so far.
export function nukeRewardTotal() {
  return { nukes: _nukes, xp: _nukes * NUKE_XP, coins: _nukes * NUKE_COINS };
}
