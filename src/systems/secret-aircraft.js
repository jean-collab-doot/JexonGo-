import { G } from '../state.js';
import { save } from '../utils/storage.js';

// The secret F-117 joins the hangar for good the first time the player beats
// a boss (it used to come with the removed "Chasseur de Boss" badge).
// Returns true when it was just unlocked, so the result screen can reveal it.
export function unlockBossAircraft({ won, isBoss } = {}) {
  if (G.tutorialMode || !won || !isBoss || G.unlockedAircraft.includes('f117')) return false;
  G.secretAircraftUnlocked = true;
  G.unlockedAircraft.push('f117');
  if (!G.acquiredAircraft.includes('f117')) G.acquiredAircraft.push('f117');
  ['secretAircraftUnlocked', 'unlockedAircraft', 'acquiredAircraft'].forEach(k => save(k, G[k]));
  return true;
}
