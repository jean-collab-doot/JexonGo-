export function calcXP(correct) {
  if (correct === 10) return 200;
  if (correct >= 6)   return 120;
  return 50;
}

export function calcStars(correct) {
  if (correct === 10) return 3;
  if (correct >= 6)   return 2;
  if (correct >= 1)   return 1;
  return 0;
}

export function streakBonus(streak) {
  if (streak >= 5) return 30;
  if (streak >= 3) return 10;
  return 0;
}
