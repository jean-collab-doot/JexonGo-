// Lobby tour for new players: the first time a new player reaches the lobby,
// the screen goes dark except for a light on one button at a time, with a
// bubble saying what it does. CONTINUER moves to the next button, COMPRIS ends
// it. Shown once (localStorage "lobbyTourDone"); players who already have
// progress never see it. It waits until nothing else covers the lobby (intro,
// daily reward, pilot name, sign-in invitation, panels...).
import { G } from '../state.js';
import { load, save } from '../utils/storage.js';
import { getLang } from '../i18n.js';

const DONE_KEY = 'lobbyTourDone';
const PAD = 8;            // light around the button
const CHECK_MS = 600;     // how often the lobby is checked while waiting
const SETTLE_MS = 900;    // the lobby must stay free this long before starting

// Priority order. sel: the element lit up; fr / en: title + description.
const STEPS = [
  { sel: '#btn-play',
    fr: ['JOUER', 'Lance ta prochaine mission. Réponds aux questions de maths pour tirer sur les avions ennemis!'],
    en: ['PLAY', 'Start your next mission. Answer the math questions to shoot the enemy planes!'] },
  { sel: '#s-menu .jx-hud-main',
    fr: ['PIÈCES ET EXP', 'Tu gagnes des pièces et de l’EXP en jouant. Elles servent à acheter des avions et des améliorations.'],
    en: ['COINS AND EXP', 'You earn coins and EXP by playing. Use them to buy planes and upgrades.'] },
  { sel: '#menu-selected-plane', around: ['#btn-lobby-plane-prev', '#btn-lobby-plane-next'],
    fr: ['TON AVION', 'Les flèches changent d’avion. Chaque avion a son propre pouvoir.'],
    en: ['YOUR PLANE', 'The arrows switch planes. Each plane has its own power.'] },
  { sel: '#lobby-sheet .jx-sheet-grip',
    fr: ['HANGAR', 'Améliore ton avion : plus de vies, plus de tirs, de nouveaux missiles.'],
    en: ['HANGAR', 'Upgrade your plane: more lives, more shots, new missiles.'] },
  { sel: '#btn-jx-nav-prev',
    fr: ['MISSIONS', 'Des défis chaque jour. Réussis-les pour gagner des pièces et de l’EXP.'],
    en: ['MISSIONS', 'New challenges every day. Complete them to earn coins and EXP.'] },
  { sel: '#btn-jx-nav-next',
    fr: ['BOUTIQUE', 'Achète des missiles et de l’équipement avec tes pièces.'],
    en: ['SHOP', 'Buy missiles and gear with your coins.'] },
  { sel: '#s-menu .jx-daytab',
    fr: ['TEMPS DU JOUR', 'Ton temps de jeu aujourd’hui. Joue un peu chaque jour pour atteindre ton objectif!'],
    en: ['TODAY’S TIME', 'Your play time today. Play a little every day to reach your goal!'] },
  { sel: '#btn-lobby-multi',
    fr: ['MULTI', 'Joue avec un ami grâce à un code, ou avec un bot. Débloqué au niveau 3.'],
    en: ['MULTI', 'Play with a friend using a code, or with a bot. Unlocked at level 3.'] },
  { sel: '#btn-lobby-top20',
    fr: ['TOP 20', 'Le classement des meilleurs pilotes du monde. Débloqué au niveau 5.'],
    en: ['TOP 20', 'The ranking of the best pilots in the world. Unlocked at level 5.'] },
  { sel: '#btn-jx-menu',
    fr: ['MENU', 'Ton compte, les réglages, la langue et le son.'],
    en: ['MENU', 'Your account, settings, language and sound.'] },
];

// Anything that covers the lobby: wait until it is gone.
const BLOCKERS = [
  '#np-intro', '#np-loader', '#connect-prompt', '#brief-overlay', '#onboarding-overlay',
  '#pilot-name-prompt', '#world-cup-intro', '#gsi-fallback-overlay:not(.hidden)',
  '#daily-reward-overlay:not(.hidden)', '#missions-panel:not(.hidden)',
  '#settings-panel:not(.hidden)', '#lobby-top20:not(.hidden)', '#mp-sheet:not(.hidden)',
  '.sett-backdrop:not(.hidden)', '#lobby-sheet:not(.is-collapsed)', '#lobby-tour',
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

// Union of the step's element and its companions (e.g. the plane arrows).
function stepRect(step) {
  const els = [step.sel, ...(step.around || [])]
    .map(sel => document.querySelector(sel)).filter(visible);
  if (!els.length) return null;
  const rs = els.map(el => el.getBoundingClientRect());
  const left = Math.min(...rs.map(r => r.left)), top = Math.min(...rs.map(r => r.top));
  const right = Math.max(...rs.map(r => r.right)), bottom = Math.max(...rs.map(r => r.bottom));
  return { left, top, width: right - left, height: bottom - top };
}

function startTour() {
  const steps = STEPS.filter(s => stepRect(s));
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

  const place = () => {
    const step = steps[index];
    const r = stepRect(step);
    if (!r) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    light.style.left = `${r.left - PAD}px`;
    light.style.top = `${r.top - PAD}px`;
    light.style.width = `${r.width + PAD * 2}px`;
    light.style.height = `${r.height + PAD * 2}px`;
    // Bubble below the light when the button is in the top half, above it
    // otherwise, kept inside the screen.
    const bw = Math.min(vw - 32, 340);
    bubble.style.width = `${bw}px`;
    const bh = bubble.offsetHeight;
    const centerX = r.left + r.width / 2;
    bubble.style.left = `${Math.max(16, Math.min(vw - 16 - bw, centerX - bw / 2))}px`;
    const below = r.top + r.height / 2 < vh / 2;
    let top = below ? r.top + r.height + PAD + 14 : r.top - PAD - 14 - bh;
    top = Math.max(16, Math.min(vh - 16 - bh, top));
    bubble.style.top = `${top}px`;
    bubble.classList.toggle('is-below', below);
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
    btn.focus({ preventScroll: true });
  };

  const onResize = () => place();
  window.addEventListener('resize', onResize);
  // Taps outside the bubble do nothing: the player reads, then presses the button.
  root.addEventListener('click', e => { if (!e.target.closest('.lt-next')) e.stopPropagation(); });
  btn.addEventListener('click', () => {
    if (index < steps.length - 1) { index++; show(); return; }
    save(DONE_KEY, true);
    window.removeEventListener('resize', onResize);
    root.classList.add('lt-out');
    setTimeout(() => root.remove(), 250);
  });
  show();
}

// Players who already have progress know the lobby (also an existing
// account whose save arrives from the cloud on a new device).
function hasProgress() {
  return (G.highestLevel || 0) > 0 || (G.lifetimeXpEarned || 0) > 0 || Object.keys(G.levelStars || {}).length > 0;
}

function check() {
  if (load(DONE_KEY, false)) { clearInterval(_timer); _timer = null; return; }
  if (hasProgress()) { save(DONE_KEY, true); clearInterval(_timer); _timer = null; return; }
  if (!lobbyIsFree()) { _freeSince = 0; return; }
  const now = Date.now();
  if (!_freeSince) { _freeSince = now; return; }
  if (now - _freeSince < SETTLE_MS) return;
  clearInterval(_timer);
  _timer = null;
  startTour();
}

/** Called once from initMenu. */
export function initLobbyTour() {
  if (load(DONE_KEY, false)) return;
  if (hasProgress()) { save(DONE_KEY, true); return; }
  if (!_timer) _timer = setInterval(check, CHECK_MS);
}

/** Test helper (and for a future "replay the tour" button). */
export function replayLobbyTour() {
  save(DONE_KEY, false);
  _freeSince = 0;
  if (!_timer) _timer = setInterval(check, CHECK_MS);
}
