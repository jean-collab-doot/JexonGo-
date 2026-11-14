// Coins and EXP chips at the top of the lobby, map, hangar, shop and
// training screens: they follow the player's balance (G.coins / G.xp) as soon
// as it changes, wherever the change comes from (end of a game, a mission or
// daily reward, a chest, a purchase), without having to open another screen.
// A gain counts up with a little jump; a purchase shows the new total at once.
// The screens still write their chips when they open; this only keeps them
// current in between. (The in-game HUD shows the game's own gains: not here.)
import { G } from '../state.js';
import { numLocale } from '../i18n.js';

const CHIPS = {
  coins: ['menu-hud-coins', 'map-coins', 'hangar-coins', 'shop-coins-val', 'training-coins'],
  xp: ['menu-hud-xp', 'map-xp', 'hangar-xp', 'shop-xp-val', 'training-xp'],
};
const CHECK_MS = 250;
const COUNT_MS = 900;

const fmt = n => Math.max(0, Math.round(n)).toLocaleString(numLocale());
const _anim = new Map();   // element -> { from, to, start, written }

function bump(el) {
  const chip = el.closest('.jx-chip') || el;
  chip.classList.remove('is-wallet-bump');
  void chip.offsetWidth;
  chip.classList.add('is-wallet-bump');
}

function step(now) {
  for (const [el, a] of _anim) {
    // Written by its screen meanwhile (it opened again): leave it.
    if (el.textContent !== a.written) { _anim.delete(el); continue; }
    const t = Math.min(1, (now - a.start) / COUNT_MS);
    const k = 1 - Math.pow(1 - t, 3);
    a.written = fmt(a.from + (a.to - a.from) * k);
    el.textContent = a.written;
    if (t >= 1) _anim.delete(el);
  }
  if (_anim.size) requestAnimationFrame(step);
}

function show(el, value) {
  const target = fmt(value);
  const running = _anim.get(el);
  if (running ? running.to === value : el.textContent === target) return;
  const shown = Number(String(el.textContent).replace(/[^\d]/g, '')) || 0;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // A spending, a first fill or hidden chip: the new total at once.
  if (value < shown || !el.textContent.trim() || !el.offsetParent || reduced) {
    _anim.delete(el);
    el.textContent = target;
    if (value > shown && el.offsetParent) bump(el);
    return;
  }
  const wasIdle = !_anim.size;
  _anim.set(el, { from: shown, to: value, start: performance.now(), written: el.textContent });
  bump(el);
  if (wasIdle) requestAnimationFrame(step);
}

function refresh() {
  const balance = { coins: G.coins || 0, xp: G.xp || 0 };
  for (const kind of Object.keys(CHIPS)) {
    for (const id of CHIPS[kind]) {
      const el = document.getElementById(id);
      if (el) show(el, balance[kind]);
    }
  }
}

let _timer = 0;
export function startWalletHud() {
  if (_timer) return;
  _timer = setInterval(refresh, CHECK_MS);
  window.addEventListener('jexongo:xp', refresh);   // state.js addLifetimeXp
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}
