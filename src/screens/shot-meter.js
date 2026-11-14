// Shot coins on screen (rules in systems/shot-coins.js): the little meter
// under the HUD that fills with each hit (one pip per hit, the coins of the
// next step at its end), and the big "+5 🪙" that jumps out when a step is
// reached, then flies into the HUD coin counter. Rainbow letters and glitter
// for the youngest players (game/glitter.js gentle mode).
// Visuals only: game.js plays the sound and updates the coin counter.
import { getLang } from '../i18n.js';
import { gentleFx } from '../game/glitter.js';
import { hudUnder } from './combo-fx.js';

const COIN_IMG = '/assets/fx/Caisse/JexonGo_Coin_frame_01.png';
// Pixel crosshair (ring, 4 ticks, centre dot).
const AIM_SVG = '<svg viewBox="0 0 16 16"><path fill="none" stroke="currentColor" stroke-width="2" '
  + 'd="M5 3h6M5 13h6M3 5v6M13 5v6M8 0v3M8 13v3M0 8h3M13 8h3"/><rect x="7" y="7" width="2" height="2" fill="currentColor"/></svg>';
const GLITTER = ['#ff5fa2', '#ffb13b', '#ffe14d', '#5ee87a', '#4cc9ff', '#9b7bff', '#ffffff'];
const POP_MS = 1250;
const POP_ARRIVE = 0.9;   // share of POP_MS when it reaches the coin counter

const isFr = () => getLang() === 'fr';

function meter() {
  let el = document.getElementById('hud-shots');
  if (el) return el;
  const row = hudUnder();
  if (!row) return null;
  el = document.createElement('div');
  el.id = 'hud-shots';
  el.className = 'hud-shots';
  el.setAttribute('role', 'img');
  el.innerHTML = `<span class="hud-shots-aim" aria-hidden="true">${AIM_SVG}</span>`
    + '<span class="hud-shots-pips" aria-hidden="true"></span>'
    + `<b class="hud-shots-reward" aria-hidden="true"></b>`;
  row.prepend(el);   // first in the row: the combo badge comes after it
  return el;
}

function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// progress = systems/shot-coins.js shotProgress(), or null to hide (practice,
// tutorial). hit = a new hit just filled a pip (it pops).
export function setShotMeter(progress, { hit = false } = {}) {
  const el = progress ? meter() : document.getElementById('hud-shots');
  if (!el) return;
  if (!progress) { el.classList.remove('is-on'); return; }
  const { filled, size, left, max, coins } = progress;
  el.classList.add('is-on');
  el.classList.toggle('is-max', max);
  el.classList.toggle('is-gentle', gentleFx());
  const pips = el.querySelector('.hud-shots-pips');
  if (pips.children.length !== size) pips.innerHTML = '<i></i>'.repeat(size);
  [...pips.children].forEach((pip, i) => pip.classList.toggle('is-full', i < filled));
  if (hit && filled > 0 && !max) restart(pips.children[filled - 1], 'is-hit');
  el.querySelector('.hud-shots-reward').innerHTML = max ? 'MAX' : `+${coins}<img src="${COIN_IMG}" alt="">`;
  el.setAttribute('aria-label', max
    ? (isFr() ? 'Pièces de tir au maximum' : 'Shot coins maxed out')
    : isFr()
      ? `Encore ${left} tir${left > 1 ? 's' : ''} réussi${left > 1 ? 's' : ''} avant +${coins} pièces`
      : `${left} more hit${left > 1 ? 's' : ''} for +${coins} coins`);
}

function glitterBits(count) {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.round((360 / count) * i + Math.random() * 20);
    const dist = 38 + Math.round(Math.random() * 34);
    return `<i style="--a:${angle}deg;--d:${dist}px;--c:${GLITTER[i % GLITTER.length]}"></i>`;
  }).join('');
}

function centerOf(el) {
  const r = el?.getBoundingClientRect();
  return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

// A step is reached: "+5 🪙" jumps out of the meter into the play area, then
// flies into the HUD coin counter; onArrive() runs when it gets there (the
// counter counts up then).
export function shotStepPop(coins, onArrive = () => {}) {
  const meterEl = document.getElementById('hud-shots');
  if (meterEl) restart(meterEl, 'is-step');
  const from = centerOf(meterEl?.querySelector('.hud-shots-reward') || meterEl);
  const to = centerOf(document.getElementById('hud-coins-count')?.closest('.hud-currency-item'));
  if (!from || !to) { onArrive(); return; }
  const gentle = gentleFx();
  const pop = document.createElement('div');
  pop.className = `jx-coin-pop${gentle ? ' is-gentle' : ''}`;
  pop.setAttribute('aria-hidden', 'true');
  pop.innerHTML = `<span class="jx-coin-pop-text">+${coins}</span><img src="${COIN_IMG}" alt="">`
    + (gentle ? glitterBits(14) : '');
  pop.style.left = `${from.x}px`;
  pop.style.top = `${from.y}px`;
  document.body.appendChild(pop);
  let arrived = false;
  const arrive = () => { if (!arrived) { arrived = true; onArrive(); } };
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced || typeof pop.animate !== 'function') {
    // No flight: it shows a moment by the meter and fades.
    pop.classList.add('is-still');
    arrive();
    setTimeout(() => pop.remove(), 1200);
    return;
  }
  // Jump to the middle of the screen, just under the HUD (clear of the side
  // callouts on the left), then fly up to the coins.
  const jx = window.innerWidth / 2 - from.x;
  const jy = Math.min(90, Math.max(52, window.innerHeight * 0.08));
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const at = (x, y, s) => `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${s})`;
  pop.animate([
    { transform: at(0, 0, 0.3), opacity: 0, offset: 0 },
    { transform: at(jx, jy, 1.3), opacity: 1, offset: 0.22 },
    { transform: at(jx, jy, 1), opacity: 1, offset: 0.34 },
    { transform: at(jx, jy - 6, 1.04), opacity: 1, offset: 0.55 },
    { transform: at(dx, dy, 0.42), opacity: 0.95, offset: POP_ARRIVE },
    { transform: at(dx, dy, 0.3), opacity: 0, offset: 1 },
  ], { duration: POP_MS, easing: 'ease-in-out', fill: 'forwards' });
  setTimeout(arrive, POP_MS * POP_ARRIVE);
  setTimeout(() => pop.remove(), POP_MS + 60);
}

// New game: the meter starts empty (game.js shows it again when it applies).
export function resetShotMeter() {
  document.getElementById('hud-shots')?.classList.remove('is-on', 'is-max', 'is-step');
  document.querySelectorAll('.jx-coin-pop').forEach(el => el.remove());
}
