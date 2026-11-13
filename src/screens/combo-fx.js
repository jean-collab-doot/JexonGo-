// EXP combo on screen (rules in systems/xp-combo.js): the HUD EXP counter
// that counts up live, the combo badge under it, the jumping texts
// ("COMBO ×2 !", "RAPIDE !", "+48 EXP") and, for the youngest players
// (game/glitter.js gentle mode), rainbow letters and glitter.
// Visuals only: game.js plays the sounds and shakes the screen.
import { getLang, numLocale } from '../i18n.js';
import { gentleFx } from '../game/glitter.js';

const isFr = () => getLang() === 'fr';
const num = n => Math.round(n).toLocaleString(numLocale());
// ×2,5 in French, ×2.5 in English.
export const multText = m => `×${isFr() ? String(m).replace('.', ',') : String(m)}`;
const COMBO_STEPS = [1.5, 2, 2.5, 3];
const GLITTER = ['#ff5fa2', '#ffb13b', '#ffe14d', '#5ee87a', '#4cc9ff', '#9b7bff', '#ffffff'];

// ── HUD EXP counter ───────────────────────────────────────────────────────
let _shownXp = 0;
let _targetXp = 0;
let _raf = 0;

function hudXpEl() { return document.getElementById('hud-xp-count'); }

// Shows `value` in the HUD: counts up when it grows, jumps when it goes down
// (new game) or when `instant`.
export function setHudXp(value, { instant = false } = {}) {
  const el = hudXpEl();
  if (!el) return;
  _targetXp = Math.max(0, Math.round(value) || 0);
  if (instant || _targetXp < _shownXp) {
    cancelAnimationFrame(_raf);
    _raf = 0;
    _shownXp = _targetXp;
    el.textContent = num(_shownXp);
    return;
  }
  if (_targetXp === _shownXp) return;
  const item = el.closest('.hud-currency-item');
  if (item) { item.classList.remove('is-bump'); void item.offsetWidth; item.classList.add('is-bump'); }
  if (!_raf) _raf = requestAnimationFrame(stepHudXp);
}

function stepHudXp() {
  const el = hudXpEl();
  const diff = _targetXp - _shownXp;
  if (!el || diff <= 0) {
    _shownXp = _targetXp;
    if (el) el.textContent = num(_shownXp);
    _raf = 0;
    return;
  }
  _shownXp = Math.min(_targetXp, _shownXp + Math.max(1, Math.ceil(diff * 0.12)));
  el.textContent = num(_shownXp);
  _raf = requestAnimationFrame(stepHudXp);
}

// ── Combo badge (under the coins / EXP of the HUD) ────────────────────────
function badge() {
  let el = document.getElementById('hud-combo');
  if (el) return el;
  const host = document.getElementById('hud-left-cluster');
  if (!host) return null;
  el = document.createElement('div');
  el.id = 'hud-combo';
  el.className = 'hud-combo';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<b class="hud-combo-mult"></b><span class="hud-combo-pot"></span>';
  host.appendChild(el);
  return el;
}

function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// { mult, pot } from systems/xp-combo.js comboState().
export function setComboBadge({ mult, pot }) {
  const el = badge();
  if (!el) return;
  el.classList.remove('is-lost');
  el.classList.toggle('is-gentle', gentleFx());
  if (mult <= 1) { el.classList.remove('is-on'); return; }
  el.querySelector('.hud-combo-mult').textContent = `COMBO ${multText(mult)}`;
  el.querySelector('.hud-combo-pot').textContent = pot > 0 ? `+${num(pot)}` : '';
  el.style.setProperty('--heat', String(Math.min(1, (mult - 1) / 2)));
  el.classList.add('is-on');
  restart(el, 'is-bump');
}

// Wrong answer: the badge shakes and falls away with the lost pot.
export function comboBadgeLost() {
  const el = document.getElementById('hud-combo');
  if (!el || !el.classList.contains('is-on')) return;
  restart(el, 'is-lost');
  setTimeout(() => { if (el.classList.contains('is-lost')) el.classList.remove('is-on', 'is-lost'); }, 650);
}

export function hideComboBadge() {
  document.getElementById('hud-combo')?.classList.remove('is-on', 'is-lost', 'is-bump');
}

// ── Jumping texts ─────────────────────────────────────────────────────────
function popLayer() {
  let el = document.getElementById('combo-pops');
  if (el) return el;
  const host = document.getElementById('s-game');
  if (!host) return null;
  el = document.createElement('div');
  el.id = 'combo-pops';
  el.setAttribute('aria-hidden', 'true');
  host.appendChild(el);
  return el;
}

function glitterBits(count) {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.round((360 / count) * i + Math.random() * 20);
    const dist = 50 + Math.round(Math.random() * 45);
    return `<i style="--a:${angle}deg;--d:${dist}px;--c:${GLITTER[i % GLITTER.length]}"></i>`;
  }).join('');
}

// kind: 'combo' | 'fast' | 'cash'.
export function popText(text, kind = 'combo', delayMs = 0) {
  const layer = popLayer();
  if (!layer) return;
  const gentle = gentleFx();
  const el = document.createElement('div');
  el.className = `combo-pop combo-pop-${kind}${gentle ? ' is-gentle' : ''}`;
  el.style.setProperty('--delay', `${delayMs}ms`);
  el.innerHTML = `<span>${text}</span>${gentle ? glitterBits(kind === 'cash' ? 14 : 9) : ''}`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1300 + delayMs);
}

// After a good answer (comboCorrect's result). Returns the combo step that
// was just reached (1.5, 2, 2.5 or 3), or 0.
export function showComboGain(c) {
  let delay = 0;
  if (c.fast) { popText(isFr() ? 'RAPIDE !' : 'FAST!', 'fast'); delay = 170; }
  const reached = COMBO_STEPS.find(s => c.prevMult < s && c.mult >= s) || 0;
  if (reached) popText(`COMBO ${multText(reached)}${isFr() ? ' !' : '!'}`, 'combo', delay);
  return reached;
}

// End of a wave: the combo EXP is earned. 0 = the game's EXP maximum is
// already reached (said once per game).
let _maxShown = false;
export function showComboCash(amount) {
  if (amount > 0) popText(`+${num(amount)} EXP`, 'cash', 120);
  else if (!_maxShown) { _maxShown = true; popText(isFr() ? 'EXP MAX !' : 'EXP MAX!', 'cash', 120); }
}

// New game: nothing left on screen.
export function resetComboFx() {
  _maxShown = false;
  hideComboBadge();
  document.getElementById('combo-pops')?.replaceChildren();
  setHudXp(0, { instant: true });
}
