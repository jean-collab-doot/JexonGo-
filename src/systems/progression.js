import { save, load } from '../utils/storage.js';
import { TEST_UNLOCK, FULL_UNLOCK } from '../utils/test-mode.js';
import { G } from '../state.js';

// Players without an account can play level 1 only; signing in opens the
// rest (and saves the progress). Not on the dev server / test-debloque.
export const GUEST_MAX_LEVEL = 1;
export function guestLevelCapped() {
  return !G.playerRegistered && !FULL_UNLOCK;
}

// Set to false to restore normal progressive unlocking (complete a level to
// open the next one). While true, every level shows as available regardless
// of stars/highestLevel — pilot grade, XP, coins etc. are untouched.
const UNLOCK_ALL_LEVELS = TEST_UNLOCK;   // dev server and Vercel preview only (utils/test-mode.js)

export function saveProgress(levelNum, stars, xp) {
  const ls = load('levelStars', {});
  if ((ls[levelNum] || 0) < stars) {
    ls[levelNum] = stars;
    save('levelStars', ls);
  }
  save('xp', xp);
}

export function highestUnlockedLevel(levelStars = {}, highestLevel = 0, recommendedLevel = 1) {
  if (guestLevelCapped()) return GUEST_MAX_LEVEL;
  if (UNLOCK_ALL_LEVELS) return 9999;
  const completed = Object.keys(levelStars)
    .map(Number)
    .filter(Number.isFinite)
    .reduce((max, level) => Math.max(max, level), 0);
  return Math.max(1, completed + 1, Number(highestLevel || 0) + 1, Number(recommendedLevel || 1));
}

export function isLevelUnlocked(levelNum, levelStars = {}, highestLevel = 0, recommendedLevel = 1) {
  return levelNum <= highestUnlockedLevel(levelStars, highestLevel, recommendedLevel);
}

// 'locked' | 'available' | 'completed'
export function levelState(levelNum, levelStars, highestLevel = 0, recommendedLevel = 1) {
  if (levelStars[levelNum] !== undefined) return 'completed';
  return isLevelUnlocked(levelNum, levelStars, highestLevel, recommendedLevel) ? 'available' : 'locked';
}
