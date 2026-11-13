// EXP combo: playing well earns EXP faster.
//  * Combo: each good answer in a row adds ×0.25 to the EXP of the answer
//    (first good answer ×1, second ×1.25 ... up to ×3). The extra EXP of the
//    combo waits in a "pot" and is cashed in at the end of each wave of
//    WAVE_SIZE questions (and at the end of the level). A wrong answer or a
//    timeout before that loses the pot; the answers' own EXP stays earned.
//  * Speed: a good answer in less than FAST_SECONDS gives +50 % EXP on that
//    answer (earned at once, not lost on a mistake).
// These bonuses come on top of the answers' normal EXP: the normal EXP keeps
// its per-game cap (state.js maxGameXp, shared with the EXP picked up during
// play) and the bonuses have their own cap (MAX_BONUS_XP), so a player who
// plays well can earn up to twice as much per game.
// Nothing here is saved, except the best game (BEST_GAME_KEY).
import { G, maxGameXp, xpUpgradeMultiplier } from '../state.js';
import { save, load } from '../utils/storage.js';

export const COMBO_STEP = 0.25;
export const COMBO_MAX = 3;
export const FAST_SECONDS = 3;
export const FAST_BONUS = 0.5;
export const WAVE_SIZE = 5;
export const MAX_BONUS_XP = 150;
const BEST_GAME_KEY = 'bestGameXp';

let _streak = 0;        // good answers in a row
let _pot = 0;           // combo EXP waiting for the end of the wave
let _banked = 0;        // speed bonus + cashed combo EXP of this game
let _bestMult = 1;      // best multiplier of the game
let _bestStreak = 0;    // longest run of good answers of the game

// Multiplier after `streak` good answers in a row.
export function comboMultiplier(streak = _streak) {
  return Math.min(COMBO_MAX, 1 + COMBO_STEP * Math.max(0, streak - 1));
}

// New game. A game continued after a game over keeps its banked bonus.
export function resetCombo({ keepBanked = false } = {}) {
  _streak = 0;
  _pot = 0;
  if (!keepBanked) { _banked = 0; _bestMult = 1; _bestStreak = 0; }
}

// A good answer worth `baseXp` (state.js sessionXP), found in `seconds`.
// Returns what the screen shows: { fast, speedXp, mult, prevMult, comboXp, pot }.
export function comboCorrect(baseXp, seconds) {
  const fast = seconds >= 0 && seconds < FAST_SECONDS;
  const speedXp = fast ? Math.round(baseXp * FAST_BONUS) : 0;
  const prevMult = comboMultiplier();
  _streak++;
  const mult = comboMultiplier();
  const comboXp = Math.round((baseXp + speedXp) * (mult - 1));
  _banked += speedXp;
  _pot += comboXp;
  _bestMult = Math.max(_bestMult, mult);
  _bestStreak = Math.max(_bestStreak, _streak);
  return { fast, speedXp, mult, prevMult, comboXp, pot: _pot };
}

// A wrong answer or a timeout: the run stops and the pot is lost.
// Returns the EXP that was lost.
export function comboBroken() {
  const lost = _pot;
  _streak = 0;
  _pot = 0;
  return lost;
}

// End of a wave (or of the level): the pot is earned. Returns the amount.
export function cashCombo() {
  const amount = _pot;
  _banked += amount;
  _pot = 0;
  return amount;
}

export function comboState() {
  return { streak: _streak, mult: comboMultiplier(), pot: _pot, banked: _banked, bestMult: _bestMult, bestStreak: _bestStreak };
}

// EXP of the game, with every cap applied (live HUD and win screen):
// { base, bonus, collected, total } — collected = picked up during play.
export function gameXpBreakdown() {
  const k = xpUpgradeMultiplier();
  const collected = Math.max(0, G.airdropSessionXP || 0);
  const base = Math.min(Math.round((G.sessionXP || 0) * k), Math.max(0, maxGameXp() - collected));
  const bonus = Math.min(Math.round(_banked * k), Math.round(MAX_BONUS_XP * k));
  return { base, bonus, collected, total: base + bonus + collected };
}

// Best game in EXP: records `total` and says whether it beats the old best
// (the very first game is not a record: there was nothing to beat).
export function recordBestGame(total) {
  const before = Number(load(BEST_GAME_KEY, 0)) || 0;
  if (total > before) save(BEST_GAME_KEY, total);
  return { isRecord: before > 0 && total > before, best: Math.max(before, total) };
}
