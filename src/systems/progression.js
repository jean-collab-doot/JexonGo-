import { save, load } from '../utils/storage.js';

export function saveProgress(levelNum, stars, xp) {
  const ls = load('levelStars', {});
  if ((ls[levelNum] || 0) < stars) {
    ls[levelNum] = stars;
    save('levelStars', ls);
  }
  save('xp', xp);
}

// 'locked' | 'available' | 'completed'
export function levelState(levelNum, levelStars) {
  if (levelStars[levelNum] !== undefined) return 'completed';
  if (levelNum === 1)                     return 'available';
  if (levelStars[levelNum - 1] !== undefined) return 'available';
  return 'locked';
}
