// EXP combo on screen (rules in systems/xp-combo.js): the HUD EXP and coin
// counters that count up live, the combo badge under them and the big side
// callouts for the good moments and the mistakes (rainbow letters and
// glitter for the youngest players, game/glitter.js gentle mode).
// Visuals only: game.js plays the sounds and shakes the screen.
import { getLang, numLocale } from '../i18n.js';
import { gentleFx } from '../game/glitter.js';

const isFr = () => getLang() === 'fr';
const num = n => Math.round(n).toLocaleString(numLocale());
// ×2,5 in French, ×2.5 in English.
export const multText = m => `×${isFr() ? String(m).replace('.', ',') : String(m)}`;
const COMBO_STEPS = [1.5, 2, 2.5, 3];
const GLITTER = ['#ff5fa2', '#ffb13b', '#ffe14d', '#5ee87a', '#4cc9ff', '#9b7bff', '#ffffff'];

// ── HUD EXP and coin counters ─────────────────────────────────────────────
// Count up when the value grows (with a little jump), drop at once with a
// red flash when a mistake costs EXP, no flash for a new game (`instant`).
function hudCounter(id) {
  let shown = 0;
  let target = 0;
  let raf = 0;
  const elOf = () => document.getElementById(id);
  function step() {
    const el = elOf();
    const diff = target - shown;
    if (!el || diff <= 0) {
      shown = target;
      if (el) el.textContent = num(shown);
      raf = 0;
      return;
    }
    shown = Math.min(target, shown + Math.max(1, Math.ceil(diff * 0.12)));
    el.textContent = num(shown);
    raf = requestAnimationFrame(step);
  }
  return function set(value, { instant = false } = {}) {
    const el = elOf();
    if (!el) return;
    const next = Math.max(0, Math.round(value) || 0);
    const item = el.closest('.hud-currency-item');
    if (instant || next < shown) {
      if (!instant && item) restart(item, 'is-drop');
      cancelAnimationFrame(raf);
      raf = 0;
      target = shown = next;
      el.textContent = num(shown);
      return;
    }
    // Called every frame by game.js: only a new, higher value jumps.
    if (next > target && item) restart(item, 'is-bump');
    target = next;
    if (target !== shown && !raf) raf = requestAnimationFrame(step);
  };
}

export const setHudXp = hudCounter('hud-xp-count');
export const setHudCoins = hudCounter('hud-coins-count');

// Row just under the top bar, outside its flow so it never squeezes the
// hearts and the coins: the shot coins meter (screens/shot-meter.js), then
// the combo badge.
export function hudUnder() {
  let row = document.getElementById('hud-under');
  if (row) return row;
  const host = document.getElementById('hud-left-cluster');
  if (!host) return null;
  row = document.createElement('div');
  row.id = 'hud-under';
  host.appendChild(row);
  return row;
}

// ── Combo badge (under the coins / EXP of the HUD) ────────────────────────
function badge() {
  let el = document.getElementById('hud-combo');
  if (el) return el;
  const host = hudUnder();
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
  el.classList.remove('is-lost', 'is-drop');
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

// Mistake: the combo falls to its new level (shakes, flashes, stays) or
// goes away when it is back to ×1.
export function comboBadgeDrop({ mult, pot }) {
  const el = document.getElementById('hud-combo');
  if (mult > 1 && el) {
    setComboBadge({ mult, pot });
    restart(el, 'is-drop');
  } else {
    comboBadgeLost();
  }
}

// ── Side callouts ─────────────────────────────────────────────────────────
// Big messages on the left side of the play area, in the JexonGo font (like
// trick names in a ski game): a title ("BONNE RÉPONSE !", "COMBO ×2 !",
// "BEAU TIR !"), the EXP under it and smaller extra lines ("RAPIDE !").
// Yellow for the good moments; a mistake or a hit gets kind words in soft
// coral, never harsh. One callout at a time: a new one waits until the
// current one was seen (CALLOUT_MIN_MS), except mistakes and hits, shown at
// once. Extra good moments join the current callout as small lines.
const CALLOUT_MIN_MS = 1100;
const CALLOUT_LIFE_MS = 2300;
const MAX_SUBS = 3;
let _co = null;          // { el, tone, until, subs }
let _queue = [];
let _queueTimer = 0;
let _fadeTimer = 0;

const pick = list => list[Math.floor(Math.random() * list.length)];
// French puts a space before "!": a no-break one, so the "!" never ends up
// alone on the last line.
const bang = text => (isFr() ? `${text} !` : `${text}!`);
const words = (fr, en) => (isFr() ? fr : en);

function calloutHost() {
  let el = document.getElementById('jx-callouts');
  if (el) return el;
  const host = document.getElementById('s-game');
  if (!host) return null;
  el = document.createElement('div');
  el.id = 'jx-callouts';
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

function subHTML({ text, value = '' }) {
  return `<div class="jx-callout-sub">${text}${value ? ` <b>${value}</b>` : ''}</div>`;
}

// Longest word of the title: long words get a smaller font so they never
// spill out of the side column.
// (Split on plain spaces only: "ÉCOULÉ !" with its no-break space is one word.)
const longestWord = text => Math.max(4, ...text.split(' ').map(w => w.length));

function leave(el) {
  if (!el || el.classList.contains('is-out')) return;
  el.classList.add('is-out');
  setTimeout(() => el.remove(), 320);
  if (_co?.el === el) _co = null;
}

function lifeFrom(now, ms) {
  clearTimeout(_fadeTimer);
  const el = _co?.el;
  _fadeTimer = setTimeout(() => leave(el), ms);
}

function showCallout(item) {
  const host = calloutHost();
  if (!host) return null;
  if (_co) leave(_co.el);
  const gentle = gentleFx();
  const el = document.createElement('div');
  el.className = `jx-callout is-${item.tone}${gentle ? ' is-gentle' : ''}`;
  el.style.setProperty('--w', String(longestWord(item.title)));
  el.innerHTML = `<div class="jx-callout-title">${item.title}</div>`
    + (item.value ? `<div class="jx-callout-value${item.valueClass ? ` ${item.valueClass}` : ''}">${item.value}</div>` : '')
    + `<div class="jx-callout-subs">${item.subs.map(subHTML).join('')}</div>`
    + (gentle && item.tone === 'good' ? glitterBits(item.priority >= 2 ? 14 : 9) : '');
  host.appendChild(el);
  const now = performance.now();
  _co = { el, tone: item.tone, until: now + CALLOUT_MIN_MS, subs: item.subs.length };
  lifeFrom(now, CALLOUT_LIFE_MS);
  return el;
}

function drainQueue() {
  _queueTimer = 0;
  const next = _queue.shift();
  if (!next) return;
  showCallout(next);
  if (_queue.length) scheduleQueue();
}

function scheduleQueue() {
  clearTimeout(_queueTimer);
  const wait = _co ? Math.max(0, _co.until - performance.now()) : 0;
  _queueTimer = setTimeout(drainQueue, wait);
}

// title, value ('+31 EXP'), tone 'good' | 'soft', subs [{ text, value }],
// priority (the queue keeps the 2 most important), now = show at once.
export function callout({ title, value = '', tone = 'good', subs = [], priority = 1, now = false, valueClass = '' }) {
  const item = { title, value, tone, subs, priority, valueClass };
  if (now) {
    _queue = [];
    clearTimeout(_queueTimer);
    return showCallout(item);
  }
  if (!_co || performance.now() >= _co.until) return showCallout(item);
  _queue.push(item);
  _queue.sort((a, b) => b.priority - a.priority);
  _queue.length = Math.min(_queue.length, 2);
  scheduleQueue();
  return null;
}

// A small extra line on the current callout (same tone), or a callout of
// its own when nothing is shown. Returns the line's element when shown.
export function calloutSub(text, { value = '', tone = 'good' } = {}) {
  if (_co && _co.tone === tone && _co.subs < MAX_SUBS && !_co.el.classList.contains('is-out')) {
    const box = _co.el.querySelector('.jx-callout-subs');
    box.insertAdjacentHTML('beforeend', subHTML({ text, value }));
    _co.subs++;
    const now = performance.now();
    _co.until = Math.max(_co.until, now + 400);
    lifeFrom(now, 1300);
    return box.lastElementChild;
  }
  const el = callout({ title: text, value, tone, priority: 0 });
  return el ? el.querySelector('.jx-callout-title') : null;
}

// ── What the game says ────────────────────────────────────────────────────
// Combo step just reached by a good answer (1.5, 2, 2.5 or 3), or 0.
export function comboStepReached(c) {
  return COMBO_STEPS.find(s => c.prevMult < s && c.mult >= s) || 0;
}

// A good answer: xp = the EXP it added (0 in practice), reached = combo step.
export function calloutAnswer({ fast = false, reached = 0, xp = 0 } = {}) {
  const title = reached
    ? `COMBO ${multText(reached)}`
    : pick(words(['BONNE RÉPONSE', 'BIEN JOUÉ', 'EXACT', 'BRAVO', 'SUPER'], ['CORRECT', 'WELL DONE', 'NICE', 'GREAT', 'SUPER']));
  const subs = fast ? [{ text: bang(words('RAPIDE', 'FAST')) }] : [];
  callout({ title: bang(title), value: xp > 0 ? `+${num(xp)} EXP` : '', subs, priority: reached ? 2 : 1 });
}

// End of a wave: the combo EXP is earned.
export function calloutCash(amount) {
  if (amount <= 0) return;
  callout({
    title: bang(pick(words(['BEAU SCORE', 'BELLE SÉRIE', 'SUPER EXP'], ['GREAT SCORE', 'GREAT STREAK', 'NICE EXP']))),
    value: `+${num(amount)} EXP`, priority: 2,
  });
}

// The bonus maximum of the game is reached (said once per game).
let _maxShown = false;
export function calloutExpMax() {
  if (_maxShown) return;
  _maxShown = true;
  calloutSub(bang('EXP MAX'));
}

// Enemy planes shot down: one line that grows with quick kills
// (BEAU TIR ! → DOUBLÉ ! → TRIPLÉ ! → INARRÊTABLE !); a boss has its own.
let _kills = 0;
let _killAt = 0;
let _killEl = null;
export function calloutKill({ boss = false } = {}) {
  if (boss) { callout({ title: bang(words('BOSS VAINCU', 'BOSS DEFEATED')), priority: 3 }); return; }
  const now = performance.now();
  _kills = now - _killAt < 1600 ? _kills + 1 : 1;
  _killAt = now;
  const text = bang(_kills >= 4 ? words('INARRÊTABLE', 'UNSTOPPABLE')
    : _kills === 3 ? words('TRIPLÉ', 'TRIPLE')
      : _kills === 2 ? words('DOUBLÉ', 'DOUBLE')
        : pick(words(['BEAU TIR', 'BON TIR'], ['NICE SHOT', 'GOOD SHOT'])));
  if (_kills > 1 && _killEl?.isConnected && !_killEl.closest('.is-out')) {
    _killEl.textContent = text;
    restart(_killEl, 'is-bump');
    if (_co) { _co.until = Math.max(_co.until, now + 400); lifeFrom(now, 1300); }
    return;
  }
  _killEl = calloutSub(text);
}

// A wrong answer or a timeout: kind words, the EXP lost and a tip.
// reason 'wrong' | 'fast' | 'timeout' (systems/xp-combo.js comboMistake).
export function calloutMistake({ reason = 'wrong', lostShown = 0 } = {}) {
  const title = reason === 'timeout'
    ? words('TEMPS ÉCOULÉ', "TIME'S UP")
    : pick(words(['PRESQUE', 'PAS GRAVE', 'OUPS'], ['ALMOST', 'NO WORRIES', 'OOPS']));
  const tip = reason === 'fast' ? words('PRENDS TON TEMPS', 'TAKE YOUR TIME')
    : reason === 'timeout' ? words('TU VAS Y ARRIVER', "YOU'VE GOT THIS")
      : words('ON CONTINUE', 'KEEP GOING');
  callout({ title: bang(title), value: lostShown > 0 ? `−${num(lostShown)} EXP` : '', tone: 'soft', subs: [{ text: tip }], priority: 2, now: true });
}

// The player's plane was hit by an enemy shot. It waits until a good
// message was seen (first in line), and is not repeated for hits in a row.
let _hitAt = 0;
export function calloutHit() {
  const now = performance.now();
  if (now - _hitAt < 2500) return;
  _hitAt = now;
  callout({
    title: bang(pick(words(['OUPS, TOUCHÉ', 'ATTENTION'], ['OOPS, HIT', 'WATCH OUT']))),
    tone: 'soft', subs: [{ text: words('ESQUIVE LES TIRS', 'DODGE THE SHOTS') }], priority: 3,
  });
}

// A nuke exploded: its reward (systems/nuke-reward.js), big and at once.
// Practice: the title alone.
export function calloutNuke({ xp = 0, coins = 0 } = {}) {
  callout({
    title: bang(pick(words(['NUKE', 'BOUM'], ['NUKE', 'BOOM']))),
    // Both gains big, one per line, in digits that read clearly.
    value: [xp > 0 ? `+${num(xp)} EXP` : '', coins > 0 ? `+${num(coins)} ${words('PIÈCES', 'COINS')}` : '']
      .filter(Boolean).join('<br>'),
    valueClass: 'is-reward',
    priority: 3, now: true,
  });
}

// New game: nothing left on screen.
export function resetComboFx() {
  _maxShown = false;
  _hitAt = 0;
  _kills = 0;
  _killEl = null;
  _queue = [];
  clearTimeout(_queueTimer);
  clearTimeout(_fadeTimer);
  _co = null;
  hideComboBadge();
  document.getElementById('jx-callouts')?.replaceChildren();
  setHudXp(0, { instant: true });
  setHudCoins(0, { instant: true });
}
