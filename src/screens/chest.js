import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { SFX } from '../audio/sound.js';

export function initChest(nav) {
  $('btn-chest-continue').onclick = () => nav.toMap();
}

export function showChest(reward) {
  $('chest-title').textContent       = 'CHEST REWARD';
  $('chest-tier-label').textContent  = reward.name;
  $('chest-tier-label').style.color  = reward.color;
  $('chest-box').style.borderColor   = reward.color;
  $('chest-reward-text').textContent = '';
  $('btn-chest-open').classList.remove('hidden');
  $('btn-chest-continue').classList.add('hidden');

  $('btn-chest-open').onclick = () => {
    SFX.chest();
    G.xp += reward.xp;
    save('xp', G.xp);
    $('chest-reward-text').textContent = `+ ${reward.xp} XP`;
    $('chest-reward-text').style.color = reward.color;
    $('btn-chest-open').classList.add('hidden');
    $('btn-chest-continue').classList.remove('hidden');

    // Chest open animation
    $('chest-box').style.transform = 'scale(1.2) rotate(8deg)';
    setTimeout(() => { $('chest-box').style.transform = 'scale(1)'; }, 300);
  };
}
