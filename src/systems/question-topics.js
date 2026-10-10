// Which equations a normal level asks, from the player's choice (onboarding
// "hard topics", G.focusTopics / G.focusOperations). Used by the game
// (game.js nextQuestion) and by the level description (briefing.js) so the
// two always agree.
//  - Only the chosen equations: choosing only algebra gives only algebra.
//  - Chosen + - x / stay inside the level's own operations when some of them
//    are in it (level 1 = addition); otherwise the chosen ones are used.
//  - Nothing chosen: the level's own operations (limited by school grade).
import { G } from '../state.js';

export const EXTRA_TOPIC_OPS = { exponent: '^', algebra: 'alg' };
const BASIC_OPS = ['+', '-', '*', '/'];

export function chosenBasicOps() {
  const list = Array.isArray(G.focusOperations) && G.focusOperations.length
    ? G.focusOperations
    : G.focusOperation ? [G.focusOperation] : [];
  return [...new Set(list.filter(op => BASIC_OPS.includes(op)))];
}

export function chosenExtraOps() {
  return [...new Set((G.focusTopics || []).map(topic => EXTRA_TOPIC_OPS[topic]).filter(Boolean))];
}

// The chosen + - x / for a level whose own operations are levelOps
// ([] when the player chose only exponent / algebra, or nothing).
export function chosenBasicOpsForLevel(levelOps) {
  const chosen = chosenBasicOps();
  const inLevel = chosen.filter(op => levelOps.includes(op));
  return inLevel.length ? inLevel : chosen;
}

// Share of a level's questions taken from exponent / algebra: each chosen
// equation is asked about as often as the others; all of them when the
// player chose no + - x /.
export function extraTopicShare(extraCount, basicCount) {
  if (!extraCount) return 0;
  if (!basicCount) return 1;
  return extraCount / (extraCount + basicCount);
}
