// EXP combo: playing well earns EXP faster, mistakes cost some of it.
//  * Combo: each good answer in a row adds ×0.25 to the EXP of the answer
//    (first good answer ×1, second ×1.25 ... up to ×3). The extra EXP of the
//    combo waits in a "pot" and is cashed in at the end of each wave of
//    WAVE_SIZE questions (and at the end of the level).
//  * Speed: a good answer in less than FAST_SECONDS gives +50 % EXP on that
//    answer (earned at once).
//  * Mistakes (wrong answer or timeout) have a severity, from 25 % to 100 %:
//      - 25 % for each mistake of the game (1st 25 %, 2nd 50 %, 3rd 75 %,
//        4th and more 100 %),
//      - +25 % for a wrong answer given too fast (under FAST_SECONDS: a
//        guess), +25 % when the time runs out.
//    The mistake costs that share of the pot, and at least that share of
//    what the question was worth, taken from the bonus already earned when
//    the pot is too small. The combo also falls by that share (100 %: back
//    to ×1). The answers' own EXP is never taken.
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
export const SEVERITY_PER_MISTAKE = 0.25;
export const SEVERITY_TOO_FAST = 0.25;
export const SEVERITY_TIMEOUT = 0.25;
const BEST_GAME_KEY = 'bestGameXp';

let _streak = 0;        // good answers in a row
let _pot = 0;           // combo EXP waiting for the end of the wave
let _banked = 0;        // speed bonus + cashed combo EXP of this game (≤ MAX_BONUS_XP)
let _bestMult = 1;      // best multiplier of the game
let _bestStreak = 0;    // longest run of good answers of the game
let _mistakes = 0;      // wrong answers and timeouts of the game
let _lost = 0;          // bonus EXP lost to mistakes this game

// Multiplier after `streak` good answers in a row.
export function comboMultiplier(streak = _streak) {
  return Math.min(COMBO_MAX, 1 + COMBO_STEP * Math.max(0, streak - 1));
}

// The pot never holds more than the bonus can still take: what it shows can
// really be earned.
function potRoom() { return Math.max(0, MAX_BONUS_XP - _banked); }

// New game. A game continued after a game over keeps its bonus and mistakes.
export function resetCombo({ keepBanked = false } = {}) {
  _streak = 0;
  _pot = 0;
  if (!keepBanked) { _banked = 0; _bestMult = 1; _bestStreak = 0; _mistakes = 0; _lost = 0; }
}

// A good answer worth `baseXp` (state.js sessionXP), found in `seconds`.
// Returns { fast, speedXp, mult, prevMult, comboXp, pot, capped }; capped =
// the bonus maximum of the game is reached.
export function comboCorrect(baseXp, seconds) {
  const fast = seconds >= 0 && seconds < FAST_SECONDS;
  const speedXp = fast ? Math.round(baseXp * FAST_BONUS) : 0;
  const prevMult = comboMultiplier();
  _streak++;
  const mult = comboMultiplier();
  const comboXp = Math.round((baseXp + speedXp) * (mult - 1));
  const capped = speedXp + comboXp > 0 && _banked + _pot + speedXp + comboXp > MAX_BONUS_XP;
  _banked = Math.min(MAX_BONUS_XP, _banked + speedXp);
  _pot = Math.min(potRoom(), _pot + comboXp);
  _bestMult = Math.max(_bestMult, mult);
  _bestStreak = Math.max(_bestStreak, _streak);
  return { fast, speedXp, mult, prevMult, comboXp, pot: _pot, capped };
}

// How bad a mistake is (0.25 … 1): see the top of the file. Counts it.
function mistakeSeverity({ seconds = 0, timeout = false }) {
  _mistakes++;
  let severity = SEVERITY_PER_MISTAKE * _mistakes;
  if (timeout) severity += SEVERITY_TIMEOUT;
  else if (seconds >= 0 && seconds < FAST_SECONDS) severity += SEVERITY_TOO_FAST;
  return Math.min(1, Math.max(SEVERITY_PER_MISTAKE, severity));
}

// A wrong answer (found in `seconds`) or a timeout, on a question worth
// `questionXp`. Returns { severity, lost, lostShown, reason, mult, prevMult,
// mistakes } with reason 'fast' | 'timeout' | 'wrong'; lostShown includes
// the hangar EXP upgrade, like the HUD.
export function comboMistake({ seconds = 0, timeout = false, questionXp = 0 } = {}) {
  const severity = mistakeSeverity({ seconds, timeout });
  const reason = timeout ? 'timeout' : (seconds >= 0 && seconds < FAST_SECONDS ? 'fast' : 'wrong');
  const wanted = Math.max(Math.round(_pot * severity), Math.round(questionXp * severity));
  const fromPot = Math.min(_pot, wanted);
  _pot -= fromPot;
  const fromBank = Math.min(_banked, wanted - fromPot);
  _banked -= fromBank;
  _lost += fromPot + fromBank;
  const prevMult = comboMultiplier();
  _streak = Math.floor(_streak * (1 - severity));
  const lost = fromPot + fromBank;
  return { severity, lost, lostShown: Math.round(lost * xpUpgradeMultiplier()), reason, mult: comboMultiplier(), prevMult, mistakes: _mistakes };
}

// End of a wave (or of the level): the pot is earned. Returns the amount.
export function cashCombo() {
  const amount = _pot;
  _banked = Math.min(MAX_BONUS_XP, _banked + amount);
  _pot = 0;
  return amount;
}

// pot and lost are in EXP as shown (hangar EXP upgrade included).
export function comboState() {
  const k = xpUpgradeMultiplier();
  return {
    streak: _streak, mult: comboMultiplier(), pot: Math.round(_pot * k),
    banked: _banked, bestMult: _bestMult, bestStreak: _bestStreak,
    mistakes: _mistakes, lost: Math.round(_lost * k),
  };
}

// EXP of the game, with every cap applied (live HUD and win screen):
// { base, bonus, collected, total } — collected = picked up during play.
export function gameXpBreakdown() {
  const k = xpUpgradeMultiplier();
  const collected = Math.max(0, G.airdropSessionXP || 0);
  const base = Math.min(Math.round((G.sessionXP || 0) * k), Math.max(0, maxGameXp() - collected));
  const bonus = Math.round(Math.min(_banked, MAX_BONUS_XP) * k);
  return { base, bonus, collected, total: base + bonus + collected };
}

// Best game in EXP: records `total` and says whether it beats the old best
// (the very first game is not a record: there was nothing to beat).
export function recordBestGame(total) {
  const before = Number(load(BEST_GAME_KEY, 0)) || 0;
  if (total > before) save(BEST_GAME_KEY, total);
  return { isRecord: before > 0 && total > before, best: Math.max(before, total) };
}
