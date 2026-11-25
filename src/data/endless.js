// ENDLESS MODE ("Mode Infini"): numbers of the mode (validated 2026-11-25).
// Starting hearts per plane (the hangar's +1 LIFE does not count here, so the
// leaderboard stays fair). Same table on the server (011_endless_leaderboard.sql).
export const ENDLESS_HEARTS = {
  t6: 3, pc21: 3, c130: 4, a10: 4, f16: 3, f18: 3, f22: 3, f35: 3, b2: 4, sr71: 2, f117: 2,
};
export const endlessHearts = id => ENDLESS_HEARTS[id] ?? 3;

// The enemies of this level are the base of wave 1.
export const ENDLESS_BASE_LEVEL = 5;
// A wave = 10 correct answers (also a reward step).
export const ENDLESS_WAVE_ANSWERS = 10;
export const ENDLESS_STEP_COINS = 15;
export const ENDLESS_STEP_XP = 25;

// Wave n (1, 2, 3...): +12 % enemies, +6 % speed, -5 % answer time per wave,
// up to x2.5 / x1.6 / 60 % (never under 5 s). Youngest players: half the
// growth, time never under 80 %.
export function endlessWave(n, gentle = false) {
  const k = Math.max(0, n - 1) * (gentle ? 0.5 : 1);
  return {
    count: Math.min(2.5, 1 + 0.12 * k),
    speed: Math.min(1.6, 1 + 0.06 * k),
    time: Math.max(gentle ? 0.8 : 0.6, 1 - 0.05 * k),
  };
}
export const ENDLESS_MIN_ANSWER_S = 5;
