// ENDLESS MODE ("Mode Infini"): numbers of the mode (validated 2026-11-25).
// Every plane starts with 3 hearts, whatever it has in the levels (the
// hangar's +1 LIFE does not count either; the other upgrades do), so the
// leaderboard stays fair. Same on the server (013_endless_three_hearts.sql).
export const ENDLESS_HEARTS_ALL = 3;
export const endlessHearts = () => ENDLESS_HEARTS_ALL;

// The enemies of this level are the base of wave 1.
export const ENDLESS_BASE_LEVEL = 5;
// A wave = 10 correct answers (also a reward step).
export const ENDLESS_WAVE_ANSWERS = 10;
export const ENDLESS_STEP_COINS = 15;
export const ENDLESS_STEP_XP = 25;

// Wave n (1, 2, 3...): +12 % enemies, +6 % speed, -5 % answer time per wave,
// up to x2.5 / x1.6 / 60 % (never under 5 s). Youngest players: it gets
// harder too, a bit more slowly (3/4 of the growth, up to x2.2 / x1.45,
// time never under 70 %).
export function endlessWave(n, gentle = false) {
  const k = Math.max(0, n - 1) * (gentle ? 0.75 : 1);
  return {
    count: Math.min(gentle ? 2.2 : 2.5, 1 + 0.12 * k),
    speed: Math.min(gentle ? 1.45 : 1.6, 1 + 0.06 * k),
    time: Math.max(gentle ? 0.7 : 0.6, 1 - 0.05 * k),
  };
}
export const ENDLESS_MIN_ANSWER_S = 5;
