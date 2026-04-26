import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { SFX } from '../audio/sound.js';
import { RARITIES, BLUEPRINT_COST, ROULETTE_SLOTS, applyReward } from '../systems/chest.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { t } from '../i18n.js';

// ── ROULETTE CONFIGURATION ────────────────────────────────────────────────────
const TILE_W    = 110;   // px width of each tile
const TILE_GAP  = 6;     // px gap between tiles
const TILE_UNIT = TILE_W + TILE_GAP;
const STRIP_REPS = 6;    // how many times to repeat the slot sequence

function buildStrip(winSlotId) {
  // Build a pool of tile indices respecting weights (100 tiles total)
  const pool = [];
  for (const s of ROULETTE_SLOTS) {
    for (let i = 0; i < s.weight; i++) pool.push(s);
  }

  // Build a shuffled-then-repeated strip of 60 tiles
  const strip = [];
  for (let r = 0; r < STRIP_REPS; r++) {
    const seg = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
    strip.push(...seg);
  }

  // Force the winning slot to appear at index ~50 (last quarter)
  const winSlot = ROULETTE_SLOTS.find(s => s.id === winSlotId) || ROULETTE_SLOTS[0];
  const targetIdx = Math.floor(strip.length * 0.75) + Math.floor(Math.random() * 5);
  strip[Math.min(targetIdx, strip.length - 1)] = winSlot;

  return { strip, targetIdx: Math.min(targetIdx, strip.length - 1) };
}

function buildTileEl(slot) {
  const div = document.createElement('div');
  div.className = 'rl-tile';
  div.style.setProperty('--tc', slot.color);
  div.innerHTML = `
    <div class="rl-tile-icon">${slot.icon}</div>
    <div class="rl-tile-label" style="color:${slot.color}">${slot.label}</div>
  `;
  return div;
}

function showRoulette(chestData, onDone) {
  const { reward, slot } = chestData;
  const winSlotId = slot?.id ?? reward?.slotId ?? 'common';

  const { strip, targetIdx } = buildStrip(winSlotId);

  // Build HTML
  const vp    = $('rl-viewport');
  const rlStr = $('rl-strip');
  if (!vp || !rlStr) return;

  rlStr.innerHTML = '';
  strip.forEach(s => rlStr.appendChild(buildTileEl(s)));

  // Viewport width = 3 tiles visible
  const vpW = TILE_UNIT * 3 + TILE_GAP;
  vp.style.width = vpW + 'px';

  // Offset so the middle tile is centered in viewport
  const centerOffset = Math.floor(vpW / 2) - Math.floor(TILE_W / 2);

  // Position strip so tile 0 starts in center, then scroll to targetIdx
  const startTranslate = centerOffset;
  const endTranslate   = centerOffset - targetIdx * TILE_UNIT;

  rlStr.style.transition = 'none';
  rlStr.style.transform  = `translateX(${startTranslate}px)`;

  // Force reflow
  rlStr.getBoundingClientRect();

  // Spin — deceleration easing
  requestAnimationFrame(() => {
    rlStr.style.transition = 'transform 3.2s cubic-bezier(0.08, 0.72, 0.22, 1)';
    rlStr.style.transform  = `translateX(${endTranslate}px)`;
  });

  // After spin, highlight and reveal result
  setTimeout(() => {
    // Highlight winning tile
    const tiles = rlStr.querySelectorAll('.rl-tile');
    tiles.forEach((t, i) => t.classList.toggle('rl-tile-win', i === targetIdx));

    SFX.rouletteWin?.();

    // Show result card
    setTimeout(() => { if (onDone) onDone(); }, 600);
  }, 3300);
}

// ── REWARD DESCRIPTION ────────────────────────────────────────────────────────
function buildResultCard(reward) {
  const rarity   = RARITIES[reward.rarity] || RARITIES[0];
  const card     = document.createElement('div');
  card.className = 'chest-result-card';
  card.style.setProperty('--rc', rarity.color);

  let icon  = reward.icon || '⚡';
  let title = '';
  let sub   = '';

  if (reward.type === 'xp') {
    title = `+${reward.amount} XP`;
    sub   = reward.label || 'BONUS XP';
  } else if (reward.type === 'blueprint') {
    const ac     = AIRCRAFT[reward.aircraft];
    const needed = BLUEPRINT_COST[reward.aircraft] || 99;
    const have   = Math.min((G.blueprints?.[reward.aircraft] || 0), needed);
    const filled = Math.round((have / needed) * 8);
    const bar    = '█'.repeat(filled) + '░'.repeat(8 - filled);

    if (reward._converted) {
      title = '+50 XP';
      sub   = `${ac?.name || reward.aircraft} DUPLICATE`;
    } else {
      title = ac?.name || reward.aircraft;
      sub   = `+${reward.pieces} PIECE${reward.pieces > 1 ? 'S' : ''}  ${bar}  ${have}/${needed}`;
    }
  }

  card.innerHTML = `
    <div class="crc-badge" style="color:${rarity.color}">${rarity.label}</div>
    <div class="crc-icon">${icon}</div>
    <div class="crc-title" style="color:${rarity.color}">${title}</div>
    <div class="crc-sub">${sub}</div>
  `;
  return card;
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
let _returnTo = 'map';

export function initChest(nav) {
  $('btn-chest-continue').onclick = () => {
    if (_returnTo === 'shop') nav.toShop();
    else nav.toMap();
  };
}

export function setChestReturn(dest) { _returnTo = dest; }

export function showChest(chestData) {
  const { chestName, chestColor, chestImg, reward } = chestData;

  $('chest-title').textContent      = t('chestReward');
  $('chest-tier-label').textContent = chestName + ' ' + t('chestSuffix');
  $('chest-tier-label').style.color = chestColor;

  const box = $('chest-box');
  $('chest-img').src  = chestImg;
  box.style.filter    = `drop-shadow(0 0 22px ${chestColor})`;
  box.style.transform = '';

  // Reset roulette area
  const rlArea = $('chest-roulette-area');
  if (rlArea) { rlArea.classList.add('hidden'); rlArea.innerHTML = ''; }
  const resultArea = $('chest-result-area');
  if (resultArea) { resultArea.classList.add('hidden'); resultArea.innerHTML = ''; }

  $('btn-chest-open').disabled = false;
  $('btn-chest-open').classList.remove('hidden');
  $('btn-chest-open').textContent = t('openChest');
  $('btn-chest-continue').classList.add('hidden');
  box.classList.remove('hidden');

  $('btn-chest-open').onclick = () => {
    $('btn-chest-open').disabled = true;

    // Bounce open animation
    SFX.chest?.();
    [
      [80,  'scale(1.25) rotate(-6deg)'],
      [220, 'scale(0.88) rotate(3deg)'],
      [360, 'scale(1.12) rotate(-2deg)'],
      [470, 'scale(1)    rotate(0deg)'],
    ].forEach(([ms, tr]) => setTimeout(() => { box.style.transform = tr; }, ms));

    setTimeout(() => {
      // Hide chest, show roulette
      box.classList.add('hidden');
      $('btn-chest-open').classList.add('hidden');

      if (rlArea) {
        rlArea.innerHTML = `
          <div class="rl-label">SPIN THE WHEEL</div>
          <div class="rl-viewport-wrap">
            <div class="rl-pointer-top">▼</div>
            <div id="rl-viewport" class="rl-viewport">
              <div id="rl-strip" class="rl-strip"></div>
            </div>
            <div class="rl-pointer-bot">▲</div>
          </div>
        `;
        rlArea.classList.remove('hidden');
      }

      showRoulette(chestData, () => {
        // Apply reward
        const newlyUnlocked = applyReward(reward);
        save('xp',                G.xp);
        save('blueprints',        G.blueprints);
        save('chestsWithoutEpic', G.chestsWithoutEpic);
        if (newlyUnlocked.length) save('unlockedAircraft', G.unlockedAircraft);

        // Show result card
        if (resultArea) {
          resultArea.innerHTML = '';
          resultArea.appendChild(buildResultCard(reward));

          if (newlyUnlocked.length) {
            const banner = document.createElement('div');
            banner.className   = 'chest-unlock-banner';
            banner.textContent =
              `${t('unlocked')} ${newlyUnlocked.map(id => AIRCRAFT[id]?.name || id).join(' + ')}`;
            resultArea.appendChild(banner);
          }

          resultArea.classList.remove('hidden');
        }

        setTimeout(() => $('btn-chest-continue').classList.remove('hidden'), 500);
      });
    }, 600);
  };
}
