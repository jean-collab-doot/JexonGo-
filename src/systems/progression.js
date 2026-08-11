import { save, load } from '../utils/storage.js';

export function saveProgress(levelNum, stars, xp) {
  const ls = load('levelStars', {});
  if ((ls[levelNum] || 0) < stars) {
    ls[levelNum] = stars;
    save('levelStars', ls);
  }
  save('xp', xp);
}

export function highestUnlockedLevel(levelStars = {}, highestLevel = 0, recommendedLevel = 1) {
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
