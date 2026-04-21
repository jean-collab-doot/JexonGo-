import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { SFX } from '../audio/sound.js';
import { RARITIES, BLUEPRINT_COST, applyRewards } from '../systems/chest.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { t } from '../i18n.js';

// ── REWARD CARD BUILDER ───────────────────────────────────────────────────────

function buildCard(reward) {
  const rarity = RARITIES[reward.rarity];
  const card   = document.createElement('div');
  card.className = 'chest-card chest-card-hidden';
  card.style.borderColor = rarity.color;
  card.style.setProperty('--glow', rarity.color);

  const badge = document.createElement('div');
  badge.className   = 'chest-card-badge';
  badge.textContent = rarity.label;
  badge.style.color = rarity.color;

  const iconEl = document.createElement('div');
  iconEl.className   = 'chest-card-icon';
  iconEl.textContent = reward.icon;

  const valEl = document.createElement('div');
  valEl.className   = 'chest-card-value';
  valEl.style.color = rarity.color;

  const subEl = document.createElement('div');
  subEl.className = 'chest-card-sub';

  if (reward.type === 'xp') {
    valEl.textContent = `+${reward.amount.toLocaleString()} XP`;
    subEl.textContent = reward.label;

  } else if (reward.type === 'coins') {
    valEl.textContent = `+${reward.amount} COINS`;
    subEl.textContent = reward.label;

  } else if (reward.type === 'blueprint') {
    const ac     = AIRCRAFT[reward.aircraft];
    const needed = BLUEPRINT_COST[reward.aircraft] || 99;
    const have   = G.blueprints?.[reward.aircraft] || 0;

    if (reward._converted) {
      valEl.textContent = t('convertedToCoins');
      subEl.textContent = `${ac?.name || reward.aircraft} ${t('duplicate')}`;
      subEl.style.color = '#94a3b8';
    } else {
      valEl.textContent = ac?.name || reward.aircraft;
      const progress = Math.min(have, needed);
      const filled   = Math.round((progress / needed) * 8);
      const bar      = '█'.repeat(filled) + '░'.repeat(8 - filled);
      subEl.innerHTML  =
        `+${reward.pieces} PIECE${reward.pieces > 1 ? 'S' : ''}&nbsp;&nbsp;${bar}&nbsp;&nbsp;${progress}/${needed}`;
      subEl.style.color = rarity.color;
    }
  }

  card.appendChild(badge);
  card.appendChild(iconEl);
  card.appendChild(valEl);
  card.appendChild(subEl);
  return card;
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

export function initChest(nav) {
  $('btn-chest-continue').onclick = () => nav.toMap();
}

export function showChest(chestData) {
  const { chestName, chestColor, chestImg, rewards } = chestData;

  $('chest-title').textContent      = t('chestReward');
  $('chest-tier-label').textContent = chestName + ' ' + t('chestSuffix');
  $('chest-tier-label').style.color = chestColor;

  const box = $('chest-box');
  $('chest-img').src  = chestImg;
  box.style.filter    = `drop-shadow(0 0 22px ${chestColor})`;
  box.style.transform = '';

  const rewardsEl = $('chest-rewards');
  rewardsEl.innerHTML = '';
  rewardsEl.classList.add('hidden');

  $('btn-chest-open').disabled = false;
  $('btn-chest-open').classList.remove('hidden');
  $('btn-chest-open').textContent = t('openChest');
  $('btn-chest-continue').classList.add('hidden');
  $('btn-chest-continue').textContent = t('continueBtn');

  $('btn-chest-open').onclick = () => {
    $('btn-chest-open').disabled = true;

    // Bouncy open animation
    SFX.chest?.();
    [
      [80,  'scale(1.25) rotate(-6deg)'],
      [220, 'scale(0.88) rotate(3deg)'],
      [360, 'scale(1.12) rotate(-2deg)'],
      [470, 'scale(1)    rotate(0deg)'],
    ].forEach(([ms, t]) => setTimeout(() => { box.style.transform = t; }, ms));

    // Apply all rewards to G first so card display shows post-apply state
    const newlyUnlocked = applyRewards(rewards);

    // Persist
    save('xp',                G.xp);
    save('coins',             G.coins);
    save('blueprints',        G.blueprints);
    save('chestsWithoutEpic', G.chestsWithoutEpic);
    if (newlyUnlocked.length) save('unlockedAircraft', G.unlockedAircraft);

    // Build and reveal cards one by one
    $('btn-chest-open').classList.add('hidden');
    rewardsEl.classList.remove('hidden');

    const cards = rewards.map(r => buildCard(r));
    cards.forEach(c => rewardsEl.appendChild(c));

    cards.forEach((card, i) => {
      setTimeout(() => {
        card.classList.remove('chest-card-hidden');
        card.classList.add('chest-card-visible');
      }, 500 + i * 420);
    });

    const doneAt = 500 + cards.length * 420;

    // Aircraft unlock banner (if any)
    if (newlyUnlocked.length) {
      setTimeout(() => {
        const banner = document.createElement('div');
        banner.className   = 'chest-unlock-banner';
        banner.textContent =
          `${t('unlocked')} ${newlyUnlocked.map(id => AIRCRAFT[id]?.name || id).join(' + ')}`;
        rewardsEl.appendChild(banner);
      }, doneAt + 200);
    }

    setTimeout(
      () => { $('btn-chest-continue').classList.remove('hidden'); },
      doneAt + (newlyUnlocked.length ? 900 : 350)
    );
  };
}
