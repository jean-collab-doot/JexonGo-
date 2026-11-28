// Lobby tour for new players: the first time a new player reaches the lobby,
// the screen goes dark except for a light on one thing at a time, with a
// bubble saying what it does. CONTINUER moves on, COMPRIS ends it. Shown
// once (localStorage "lobbyTourDone"); players who already have progress
// never see it. It waits until nothing else covers the lobby (intro, daily
// reward, pilot name, sign-in invitation, panels...).
//
// Some steps really open what they talk about, then close it before the
// next one: the HANGAR drawer slides up (planes, the ⓘ sheet of a plane,
// shot choice, upgrades), the missions room opens, the carousel turns to the
// shop and to practice and comes back, the settings drawer opens.
// Test version only (not jexongo.app): ?visite=1 in the address, or V + T
// on a keyboard, shows it again.
import { G } from '../state.js';
import { load, save } from '../utils/storage.js';
import { getLang } from '../i18n.js';

const DONE_KEY = 'lobbyTourDone';
const PAD = 8;            // light around the button
const CHECK_MS = 600;     // how often the lobby is checked while waiting
const SETTLE_MS = 900;    // the lobby must stay free this long before starting
const OPEN_MS = 520;      // a drawer / a page slides in
const IS_LIVE = /(^|\.)jexongo\.app$/.test(location.hostname);

const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = sel => document.querySelector(sel);
const click = sel => { $(sel)?.click(); };
const nav = () => window._nav;

// Hangar drawer (menu.js makeBottomSheet) and its tabs.
const sheet = () => $('#lobby-sheet')?._jxSheet;
async function openHangar(tab = 'planes') {
  if (!sheet()?.isOpen()) { sheet()?.open(); await wait(OPEN_MS); }
  hangarTab(tab);
  await wait(250);
}
function hangarTab(tab) { click(`#lobby-sheet [data-hangar-tab="${tab}"]`); }
async function closeHangar() {
  hangarTab('planes');
  sheet()?.close();
  await wait(OPEN_MS);
}
// The plane's ⓘ sheet (hangar.js openPlaneInfo, through its button).
async function openPlaneSheet() {
  const btn = $('#lobby-sheet .jx-slot.is-active .jx-slot-info-btn') || $('#lobby-sheet .jx-slot-info-btn');
  btn?.click();
  await wait(700);
}
async function closePlaneSheet() { click('#btn-plane-info-close'); await wait(300); }
// Missions room (menu.js openMissionsPanel / its ▶ close button).
async function openMissions() { click('#btn-jx-nav-prev'); await wait(OPEN_MS); }
async function closeMissions() { click('#btn-missions-close'); await wait(OPEN_MS); }
// The carousel: lobby › shop › practice, and back.
async function toShop() { nav()?.toShop('next'); await wait(OPEN_MS); }
async function toTraining() { nav()?.toTraining('next'); await wait(OPEN_MS); }
async function backToLobby() { nav()?.toMenu('prev'); await wait(OPEN_MS); }
// Settings drawer (settings.js: the ☰ button / its close).
async function openSettings() { click('#s-menu .jx-burger, #btn-jx-menu'); await wait(OPEN_MS); }
async function closeSettings() { click('#btn-settings-close'); await wait(350); }

// In order. sel: what is lit up (first one found and visible); fr / en:
// title + text; enter / leave: open before, close after.
const STEPS = [
  { sel: '#btn-play',
    fr: ['JOUER', 'Lance ta prochaine mission. Réponds aux calculs pour tirer sur les avions ennemis.'],
    en: ['PLAY', 'Start your next mission. Answer the calculations to shoot the enemy planes.'] },
  { sel: '#s-menu .jx-hud-main',
    fr: ['PIÈCES ET EXP', 'Tu gagnes des pièces et de l’EXP en jouant. L’EXP achète des avions, les pièces achètent des tirs et des améliorations.'],
    en: ['COINS AND EXP', 'You earn coins and EXP by playing. EXP buys planes; coins buy shots and upgrades.'] },
  { sel: '#menu-selected-plane', around: ['#btn-lobby-plane-prev', '#btn-lobby-plane-next'],
    fr: ['TON AVION', 'Les flèches changent d’avion. Chaque avion a son propre pouvoir.'],
    en: ['YOUR PLANE', 'The arrows switch planes. Each plane has its own power.'] },

  // ── HANGAR (the drawer slides up) ──
  { sel: '#lobby-sheet .jx-grid', clip: 0.5, enter: () => openHangar('planes'),
    fr: ['HANGAR : LES AVIONS', 'Fais glisser le HANGAR vers le haut pour voir tous les avions. Touche un avion pour le choisir, ou pour l’acheter avec ton EXP.'],
    en: ['HANGAR: THE PLANES', 'Slide the HANGAR up to see every plane. Tap a plane to pick it, or to buy it with your EXP.'] },
  { sel: '#lobby-sheet .jx-slot.is-active .jx-slot-info-btn, #lobby-sheet .jx-slot-info-btn', pad: 6, inside: true,
    fr: ['LA FICHE DE L’AVION', 'Le petit ⓘ en haut à droite de chaque avion ouvre sa fiche.'],
    en: ['THE PLANE’S CARD', 'The little ⓘ at the top right of each plane opens its card.'] },
  { sel: '#plane-info-overlay .pi-card', enter: openPlaneSheet, leave: closePlaneSheet,
    fr: ['TOUT SUR L’AVION', 'Sa capacité spéciale, son prix, le niveau à atteindre et son essence. Ferme la fiche avec le X.'],
    en: ['ALL ABOUT THE PLANE', 'Its special ability, its price, the level to reach and its fuel. Close the card with the X.'] },
  { sel: '#lobby-sheet .jx-sheet-content', clip: 0.5, enter: () => openHangar('missiles'),
    fr: ['CHOIX DE TIR', 'Choisis comment ton avion tire (tir simple, double, triple…) et ton missile (feu, glace…). Les nouveaux s’achètent avec tes pièces.'],
    en: ['SHOT CHOICE', 'Choose how your plane fires (single, twin, triple shot…) and your missile (fire, ice…). New ones are bought with your coins.'] },
  { sel: '#lobby-sheet .jx-sheet-content', clip: 0.5, enter: () => openHangar('upgrades'), leave: closeHangar,
    fr: ['AMÉLIORER L’AVION', 'Rends ton avion plus fort avec tes pièces : une vie de plus, des tirs plus rapides, un missile qui suit l’ennemi, plus d’EXP.'],
    en: ['UPGRADE THE PLANE', 'Make your plane stronger with your coins: one more life, faster shots, a missile that follows the enemy, more EXP.'] },

  // ── MISSIONS (the room opens, then closes) ──
  { sel: '#btn-jx-nav-prev',
    fr: ['MISSIONS', 'Cette flèche ouvre la salle des missions.'],
    en: ['MISSIONS', 'This arrow opens the missions room.'] },
  { sel: '#btn-missions-tablet, #missions-panel', pad: 14, enter: openMissions, leave: closeMissions,
    fr: ['LES DÉFIS DU JOUR', 'Touche la tablette pour voir tes défis. Réussis-les pour gagner des pièces et de l’EXP.'],
    en: ['TODAY’S CHALLENGES', 'Tap the tablet to see your challenges. Complete them to earn coins and EXP.'] },

  // ── The carousel turns: shop, then practice, then back ──
  { sel: '#btn-jx-nav-next',
    fr: ['BOUTIQUE', 'Cette flèche fait tourner l’écran vers la boutique.'],
    en: ['SHOP', 'This arrow turns the screen to the shop.'] },
  { sel: '#shop-arsenal-btns > *', all: true, pad: 10, enter: toShop,
    fr: ['LA BOUTIQUE', 'Achète des missiles spéciaux (feu, glace…) avec tes pièces. Fais glisser « Type de tir » vers le haut pour voir les façons de tirer.'],
    en: ['THE SHOP', 'Buy special missiles (fire, ice…) with your coins. Slide “Shot type” up to see the ways to fire.'] },
  { sel: '#btn-training-practice', enter: toTraining, leave: backToLobby,
    fr: ['PRATIQUE', 'Encore une flèche : l’entraînement. Joue sans pression, avec tes exercices, ton monde et ta météo.'],
    en: ['PRACTICE', 'One more arrow: training. Play with no pressure, with your exercises, world and weather.'] },

  // ── Back in the lobby ──
  { sel: '#s-menu .jx-daytab',
    fr: ['TEMPS DU JOUR', 'Ton temps de jeu aujourd’hui. Joue un peu chaque jour pour atteindre ton objectif.'],
    en: ['TODAY’S TIME', 'Your play time today. Play a little every day to reach your goal.'] },
  { sel: '#btn-lobby-multi',
    fr: ['MULTI', 'Joue avec un ami grâce à un code, ou avec un robot. Il faut un compte et le niveau 3.'],
    en: ['MULTI', 'Play with a friend using a code, or with a bot. You need an account and level 3.'] },
  { sel: '#btn-lobby-top20',
    fr: ['TOP 20', 'Le classement des meilleurs pilotes du monde. Il faut un compte et le niveau 5.'],
    en: ['TOP 20', 'The ranking of the best pilots in the world. You need an account and level 5.'] },
  { sel: '#btn-lobby-mistakes',
    fr: ['ERREURS', 'Tes erreurs sont gardées ici. Rejoue-les pour t’entraîner : une question réussie sort du carnet.'],
    en: ['MISTAKES', 'Your mistakes are kept here. Play them again to practise: a question you get right leaves the notebook.'] },
  { sel: '#btn-lobby-grades',
    fr: ['GRADES', 'Ton grade de pilote, de CADET à AS DE L’AIR. Chaque nouveau grade donne des pièces, de l’EXP ou des améliorations gratuites.'],
    en: ['GRADES', 'Your pilot grade, from CADET to AIR ACE. Every new grade gives coins, EXP or free upgrades.'] },
  { sel: '#btn-lobby-endless',
    fr: ['INFINI', 'Le Mode Infini : des questions sans fin avec tes exercices. Tiens le plus longtemps possible et entre au classement.'],
    en: ['ENDLESS', 'Endless Mode: questions without end with your exercises. Last as long as you can and get on the leaderboard.'] },

  // ── Settings (the drawer opens, then closes) ──
  { sel: '#btn-jx-menu, #s-menu .jx-burger',
    fr: ['MENU', 'Ce bouton ouvre les réglages.'],
    en: ['MENU', 'This button opens the settings.'] },
  { sel: '#settings-panel .jx-drawer', enter: openSettings, leave: closeSettings,
    fr: ['RÉGLAGES', 'La langue, le son, la musique, tes exercices, les contrôles et ton compte. Fais glisser vers la droite pour fermer.'],
    en: ['SETTINGS', 'Language, sound, music, your exercises, controls and your account. Swipe right to close.'] },
];

// Anything that covers the lobby: wait until it is gone.
const BLOCKERS = [
  '#np-intro', '#np-loader', '#connect-prompt', '#brief-overlay', '#onboarding-overlay',
  '#pilot-name-prompt', '#world-cup-intro', '#gsi-fallback-overlay:not(.hidden)',
  '#daily-reward-overlay:not(.hidden)', '#missions-panel:not(.hidden)',
  '#settings-panel:not(.hidden)', '#lobby-top20:not(.hidden)', '#lobby-grades:not(.hidden)', '#mp-sheet:not(.hidden)',
  '.sett-backdrop:not(.hidden)', '#lobby-sheet:not(.is-collapsed)', '#lobby-tour', '.xp-overlay',
];

let _timer = null;
let _freeSince = 0;

function visible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  const st = getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0.05;
}

function lobbyIsFree() {
  const menu = document.getElementById('s-menu');
  if (!menu || menu.classList.contains('hidden')) return false;
  return !BLOCKERS.some(sel => document.querySelector(sel));
}

// First visible element of a "a, b" list.
function pick(sel) {
  for (const one of sel.split(',')) {
    const el = document.querySelector(one.trim());
    if (visible(el)) return el;
  }
  return null;
}

// Union of the step's element and its companions (e.g. the plane arrows),
// kept inside the screen.
function stepRect(step) {
  const main = step.all ? [...document.querySelectorAll(step.sel)].filter(visible) : [pick(step.sel)];
  const els = [...main, ...(step.around || []).map(pick)].filter(Boolean);
  if (!els.length) return null;
  const rs = els.map(el => el.getBoundingClientRect());
  const vw = window.innerWidth, vh = window.innerHeight;
  const left = Math.max(4, Math.min(...rs.map(r => r.left))), top = Math.max(4, Math.min(...rs.map(r => r.top)));
  const right = Math.min(vw - 4, Math.max(...rs.map(r => r.right)));
  let bottom = Math.min(vh - 4, Math.max(...rs.map(r => r.bottom)));
  // A tall panel (planes grid, a hangar tab): only its top part is lit, so
  // the bubble fits under it.
  if (step.clip) bottom = Math.min(bottom, top + vh * step.clip);
  return { left, top, width: right - left, height: bottom - top };
}

// A step is kept if what it lights up exists (or will, once opened).
const stepAvailable = s => !!s.enter || !!s.inside || !!stepRect(s);

function startTour() {
  const steps = STEPS.filter(stepAvailable);
  if (!steps.length) { save(DONE_KEY, true); return; }
  const fr = getLang() === 'fr';
  const root = document.createElement('div');
  root.id = 'lobby-tour';
  root.className = 'lt';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `
    <div class="lt-light"></div>
    <div class="lt-bubble">
      <div class="lt-count"></div>
      <div class="lt-title"></div>
      <div class="lt-text"></div>
      <button class="lt-next" type="button"></button>
    </div>`;
  document.body.appendChild(root);
  const light = root.querySelector('.lt-light');
  const bubble = root.querySelector('.lt-bubble');
  const btn = root.querySelector('.lt-next');
  let index = 0;
  let busy = false;
  let _replace1 = 0, _replace2 = 0;

  const place = () => {
    const step = steps[index];
    const r = stepRect(step);
    const vw = window.innerWidth, vh = window.innerHeight;
    const pad = step.pad ?? PAD;
    if (!r) { light.style.width = '0px'; light.style.height = '0px'; light.style.left = `${vw / 2}px`; light.style.top = `${vh / 2}px`; }
    else {
      light.style.left = `${r.left - pad}px`;
      light.style.top = `${r.top - pad}px`;
      light.style.width = `${r.width + pad * 2}px`;
      light.style.height = `${r.height + pad * 2}px`;
    }
    const bw = Math.min(vw - 32, 380);
    bubble.style.width = `${bw}px`;
    const bh = bubble.offsetHeight;
    const lr = r ? { left: r.left - pad, top: r.top - pad, right: r.left + r.width + pad, bottom: r.top + r.height + pad }
      : { left: vw / 2, top: vh / 2, right: vw / 2, bottom: vh / 2 };
    const gap = 14;
    // Below, above, then beside the light; if none fits (a big panel), at
    // the bottom of the screen over it.
    let left, top, side;
    if (lr.bottom + gap + bh <= vh - 12) { side = 'below'; top = lr.bottom + gap; }
    else if (lr.top - gap - bh >= 12) { side = 'above'; top = lr.top - gap - bh; }
    if (side) left = (lr.left + lr.right) / 2 - bw / 2;
    else if (vw - lr.right - gap >= bw + 12) { side = 'right'; left = lr.right + gap; top = (lr.top + lr.bottom) / 2 - bh / 2; }
    else if (lr.left - gap >= bw + 12) { side = 'left'; left = lr.left - gap - bw; top = (lr.top + lr.bottom) / 2 - bh / 2; }
    else { side = 'over'; left = (vw - bw) / 2; top = vh - bh - 16; }
    bubble.style.left = `${Math.max(16, Math.min(vw - 16 - bw, left))}px`;
    bubble.style.top = `${Math.max(12, Math.min(vh - 12 - bh, top))}px`;
    bubble.classList.toggle('is-below', side === 'below');
  };

  const show = () => {
    const step = steps[index];
    const [title, text] = fr ? step.fr : step.en;
    root.querySelector('.lt-count').textContent = `${index + 1} / ${steps.length}`;
    root.querySelector('.lt-title').textContent = title;
    root.querySelector('.lt-text').textContent = text;
    const last = index === steps.length - 1;
    btn.textContent = last ? (fr ? 'COMPRIS' : 'GOT IT') : (fr ? 'CONTINUER' : 'CONTINUE');
    bubble.classList.remove('lt-pop');
    void bubble.offsetWidth;
    bubble.classList.add('lt-pop');
    place();
    // A drawer may still be sliding in: placed again once it has settled.
    clearTimeout(_replace1); clearTimeout(_replace2);
    _replace1 = setTimeout(() => { if (!busy) place(); }, 350);
    _replace2 = setTimeout(() => { if (!busy) place(); }, 900);
    btn.focus({ preventScroll: true });
  };

  // Hide the light and bubble while something opens or closes.
  const go = async (next) => {
    busy = true;
    root.classList.add('lt-busy');
    try {
      await steps[index].leave?.();
      if (next >= steps.length) return finish();
      index = next;
      await steps[index].enter?.();
      // Something the step needs is not there (e.g. a button hidden for this
      // player): skip it.
      if (!stepRect(steps[index])) await wait(500);   // still appearing
      while (index < steps.length - 1 && !stepRect(steps[index])) {
        await steps[index].leave?.();
        index++;
        await steps[index].enter?.();
      }
    } catch (_) { /* keep going */ }
    root.classList.remove('lt-busy');
    busy = false;
    show();
  };

  const finish = async () => {
    save(DONE_KEY, true);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('transitionend', onAnimEnd, true);
    document.removeEventListener('animationend', onAnimEnd, true);
    root.classList.add('lt-out');
    setTimeout(() => root.remove(), 250);
    // Back to a clean lobby whatever was open.
    if (sheet()?.isOpen()) sheet().close();
    if (!$('#plane-info-overlay')?.classList.contains('hidden')) click('#btn-plane-info-close');
    if (!$('#settings-panel')?.classList.contains('hidden')) click('#btn-settings-close');
    if (!$('#missions-panel')?.classList.contains('hidden')) click('#btn-missions-close');
    if ($('#s-menu')?.classList.contains('hidden') && ($('#s-shop:not(.hidden)') || $('#s-training:not(.hidden)'))) nav()?.toMenu('prev');
  };

  const onResize = () => { if (!busy) place(); };
  window.addEventListener('resize', onResize);
  // A drawer or a card that finishes sliding in: the light follows it.
  const onAnimEnd = e => { if (!busy && !root.contains(e.target)) place(); };
  document.addEventListener('transitionend', onAnimEnd, true);
  document.addEventListener('animationend', onAnimEnd, true);
  // Taps outside the bubble do nothing: the player reads, then presses the button.
  root.addEventListener('click', e => { if (!e.target.closest('.lt-next')) e.stopPropagation(); });
  btn.addEventListener('click', () => { if (!busy) go(index + 1); });
  (async () => {
    busy = true;
    await steps[0].enter?.();
    busy = false;
    show();
  })();
}

// Players who already have progress know the lobby (also an existing
// account whose save arrives from the cloud on a new device).
function hasProgress() {
  return (G.highestLevel || 0) > 0 || (G.lifetimeXpEarned || 0) > 0 || Object.keys(G.levelStars || {}).length > 0;
}

let _force = false;   // test version: shown again even with progress
function check() {
  if (!_force && load(DONE_KEY, false)) { clearInterval(_timer); _timer = null; return; }
  if (!_force && hasProgress()) { save(DONE_KEY, true); clearInterval(_timer); _timer = null; return; }
  if (!lobbyIsFree()) { _freeSince = 0; return; }
  const now = Date.now();
  if (!_freeSince) { _freeSince = now; return; }
  if (now - _freeSince < SETTLE_MS) return;
  clearInterval(_timer);
  _timer = null;
  _force = false;
  startTour();
}

/** Called once from initMenu. */
export function initLobbyTour() {
  if (!IS_LIVE) {
    // Test version: ?visite=1 or V + T shows the tour again.
    if (/[?&]visite=1\b/.test(location.search)) replayLobbyTour();
    const held = new Set();
    window.addEventListener('keydown', e => {
      held.add(String(e.key).toLowerCase());
      if (held.has('v') && held.has('t')) { held.clear(); replayLobbyTour(); }
    });
    window.addEventListener('keyup', e => held.delete(String(e.key).toLowerCase()));
  }
  if (_timer) return;
  if (load(DONE_KEY, false)) return;
  if (hasProgress()) { save(DONE_KEY, true); return; }
  _timer = setInterval(check, CHECK_MS);
}

/** Shows the tour again (test version, and for a future "replay" button). */
export function replayLobbyTour() {
  if ($('#lobby-tour')) return;
  save(DONE_KEY, false);
  _force = true;
  _freeSince = 0;
  if (!_timer) _timer = setInterval(check, CHECK_MS);
}
