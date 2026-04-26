export function calcXP(correct) {
  if (correct >= 10) return 200;
  if (correct >= 6)  return 120;
  return 50;
}

/**
 * Star criteria (score-based):
 *  1 star  — completed the level
 *  2 stars — 70%+ correct answers
 *  3 stars — 100% correct answers AND never hit by enemy missile
 */
export function calcStars(correct, questionsAnswered, missileHits = 0) {
  const total = questionsAnswered || 0;
  const pct   = total > 0 ? correct / total : 0;
  if (pct >= 1 && missileHits === 0) return 3;
  if (pct >= 0.7) return 2;
  return 1;
}

export function streakBonus(streak) {
  if (streak >= 5) return 30;
  if (streak >= 3) return 10;
  return 0;
}
