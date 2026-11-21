// Pilot grade rewards (data/grade-rewards.js): claimed once per grade reached,
// and the free hangar upgrades they give.
// Stored in G.claimedRanks (already saved on the device and in the cloud,
// merged as a union across devices; its old XP-rank use is gone):
//   'grade:<NAME>'  the reward of that grade was claimed
//   'freeup:<n>'    the n-th free upgrade was used
import { G, clampCoins, addLifetimeXp } from '../state.js';
import { save } from '../utils/storage.js';
import { PILOT_GRADES, getPilotGrade } from '../data/pilots.js';
import { GRADE_REWARDS, GRADE_NAMES } from '../data/grade-rewards.js';
import { getLang } from '../i18n.js';

// Lowest grade first.
export const gradesAscending = () => [...PILOT_GRADES].reverse();

const claimed = () => (Array.isArray(G.claimedRanks) ? G.claimedRanks : []);
export const gradeName = g => GRADE_NAMES[g.name]?.[getLang() === 'fr' ? 'fr' : 'en'] || g.name;
export const gradeReward = g => GRADE_REWARDS[g.name] || null;
export const gradeReached = g => (G.highestLevel || 0) >= g.minLevel;
export const gradeClaimed = g => claimed().includes(`grade:${g.name}`);
export const currentGrade = () => getPilotGrade(G.highestLevel || 0);

// Reached, with a reward, not claimed yet.
export function claimableGrades() {
  return gradesAscending().filter(g => gradeReward(g) && gradeReached(g) && !gradeClaimed(g));
}

export function claimGrade(g) {
  const reward = gradeReward(g);
  if (!reward || !gradeReached(g) || gradeClaimed(g)) return null;
  G.claimedRanks = [...claimed(), `grade:${g.name}`];
  if (reward.coins) G.coins = clampCoins((G.coins || 0) + reward.coins);
  if (reward.xp) {
    G.xp = (G.xp || 0) + reward.xp;
    G.totalXpEarned = (G.totalXpEarned || 0) + reward.xp;
    addLifetimeXp(reward.xp);
  }
  save('claimedRanks', G.claimedRanks);
  save('coins', G.coins);
  save('xp', G.xp);
  save('totalXpEarned', G.totalXpEarned);
  return reward;
}

// Free upgrades: earned with the claimed grades, minus the ones used.
export function freeUpgradesLeft() {
  const earned = gradesAscending().filter(gradeClaimed)
    .reduce((n, g) => n + (gradeReward(g)?.freeUpgrades || 0), 0);
  const used = claimed().filter(k => k.startsWith('freeup:')).length;
  return Math.max(0, earned - used);
}

export function useFreeUpgrade() {
  if (freeUpgradesLeft() <= 0) return false;
  const used = claimed().filter(k => k.startsWith('freeup:')).length;
  G.claimedRanks = [...claimed(), `freeup:${used + 1}`];
  save('claimedRanks', G.claimedRanks);
  return true;
}
