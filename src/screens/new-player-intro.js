// Opening intro, played every time JexonGo opens (storyboard): yellow screen,
// the T-6 rises smoothly from the bottom with wind streaks and hovers in the
// middle. It keeps hovering while the game loads; once everything is ready it
// shoots off the top leaving a white wash, and the yellow comes back with the
// glowing JEXONGO logo. No button: after the logo it carries on by itself -
// into the questionnaire for a new player, or fading into the lobby.
//
// On a first page load the intro markup is already in index.html (#np-intro,
// .np-static) so it plays during loading; for later entries (restart intro,
// new Google account) it is built here.
import { SFX } from '../audio/sound.js';

const T6_SHEET = '/assets/ships/player/t6-animation.webp';   // 5 x 2 frames
const RISE_MS = 1500;         // plane reaches the middle (CSS npRise)
const MIN_HOVER_MS = 400;     // short pause in the middle even if loading is instant

function buildIntro() {
  const overlay = document.createElement('div');
  overlay.id = 'np-intro';
  overlay.className = 'np-intro';
  const streaks = Array.from({ length: 14 }, (_, i) =>
    `<i style="--x:${(i * 37 + 11) % 100}%;--d:${(i * 0.17) % 0.9}s;--l:${40 + (i * 29) % 70}px"></i>`).join('');
  overlay.innerHTML = `
    <div class="np-wind">${streaks}</div>
    <div class="np-plane-wrap">
      <div class="np-plane" style="background-image:url('${T6_SHEET}')"></div>
      <div class="np-wing-wind np-wing-wind-l"></div>
      <div class="np-wing-wind np-wing-wind-r"></div>
    </div>
    <div class="np-wash"></div>
    <div class="np-title">
      <div class="np-logo">JEXON<span>GO</span></div>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

const MAX_LOADING_WAIT_MS = 15000;   // never hover forever on a stuck asset
// After the plane leaves (.np-go): the logo lands at 1.3 + 0.7 s, then stays a
// moment on screen before the intro carries on.
const LOGO_HOLD_MS = 2700;
const LEAVE_MS = 450;                // .np-leave fade (style.css npLeave)

function pageLoaded() {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    window.addEventListener('load', resolve, { once: true });
    setTimeout(resolve, MAX_LOADING_WAIT_MS);
  });
}

// onDone: called when the intro carries on. { leave: true } (returning
// player): the whole intro fades out to show the lobby, instead of handing
// over to the questionnaire's yellow screen.
export function playNewPlayerIntro(onDone, { leave = false } = {}) {
  // Page-load intro (already flying since the first frame) or a fresh one.
  let overlay = document.querySelector('#np-intro.np-static');
  let startedAt = 0;   // performance.now() when the rise began
  if (overlay) {
    overlay.classList.remove('np-static');
    overlay.removeAttribute('aria-hidden');
  } else {
    document.getElementById('np-intro')?.remove();
    overlay = buildIntro();
    startedAt = performance.now();
  }
  setYellowPage(true);
  // How long the plane has already been flying (page-load intro: since the
  // page started).
  SFX.introStart(startedAt ? 0 : performance.now());

  // Continue once the game has loaded AND the plane has had its moment in
  // the middle; until then it keeps hovering (CSS npHover loop).
  const minDelay = Math.max(0, startedAt + RISE_MS + MIN_HOVER_MS - performance.now());
  Promise.all([pageLoaded(), new Promise(resolve => setTimeout(resolve, minDelay))])
    .then(() => {
      overlay.classList.add('np-go');
      SFX.introExit();
      // The phone's top bar follows the white wash (style.css npWash /
      // npWashOut) so the top of the screen never shows a yellow band over
      // the white, then goes back to yellow with the logo.
      setTimeout(() => { if (overlay.isConnected) setTopBar(WASH_WHITE); }, WASH_TOP_WHITE_MS);
      setTimeout(() => { if (overlay.isConnected) setTopBar(INTRO_YELLOW); }, WASH_TOP_YELLOW_MS);
      setTimeout(() => carryOn(overlay, onDone, leave), LOGO_HOLD_MS);
    });
}

// Loading screen in the intro's style (yellow, the T-6 rising and hovering,
// no logo): between the briefing and the beginner practice while the level
// loads (game.js). hide() lets the plane shoot off the top, fades the yellow
// away and resolves once it is gone; it waits for the plane's rise first.
export function showYellowLoader() {
  document.getElementById('np-loader')?.remove();
  const overlay = buildIntro();
  overlay.id = 'np-loader';
  overlay.querySelector('.np-title')?.remove();
  overlay.querySelector('.np-wash')?.remove();
  setYellowPage(true);
  SFX.loaderStart();   // the T-6 engine while it loads (the game music comes after)
  const shownAt = performance.now();
  let hiding = null;
  return {
    hide() {
      hiding ||= new Promise(resolve => {
        const wait = Math.max(0, RISE_MS + MIN_HOVER_MS - (performance.now() - shownAt));
        setTimeout(() => {
          overlay.classList.add('np-go');
          SFX.loaderExit();   // the engine roars away with the plane
          setTimeout(() => {
            overlay.classList.add('np-leave');
            setTimeout(() => {
              overlay.remove();
              if (!document.getElementById('np-intro')) setYellowPage(false);
              resolve();
            }, LEAVE_MS);
          }, 650);
        }, wait);
      });
      return hiding;
    },
    remove() {
      SFX.loaderExit();
      overlay.remove();
      if (!document.getElementById('np-intro')) setYellowPage(false);
    },
  };
}

const INTRO_YELLOW = '#ffc800';
const WASH_WHITE = '#ffffff';
// After .np-go: the wash's solid white reaches the top of the screen at about
// 0.6 s and has faded away at about 1.5 s.
const WASH_TOP_WHITE_MS = 600;
const WASH_TOP_YELLOW_MS = 1500;

// Colour of the phone / tablet top bar (theme-color) and of the page behind
// the intro (seen in the notch and status-bar area).
function setTopBar(color) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = color;
  document.documentElement.style.setProperty('--np-page', color);
}

// Page and browser bar (theme-color) in the intro's yellow while it is on
// screen, so no other colour shows at the top of a phone.
function setYellowPage(on) {
  document.documentElement.classList.toggle('np-yellow', on);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (on) {
    if (meta) meta.dataset.base ||= meta.content;
    setTopBar(INTRO_YELLOW);
  } else {
    document.documentElement.style.removeProperty('--np-page');
    if (meta?.dataset.base) meta.content = meta.dataset.base;
  }
}

function removeIntro(overlay) {
  overlay.remove();
  setYellowPage(false);
}

function carryOn(overlay, onDone, leave) {
  if (leave) {
    // Lobby: it is already rendered underneath; the intro fades away over it.
    onDone?.();
    // The top bar stays yellow until the intro is gone (removeIntro): switching
    // it to the lobby colour at the start of the fade flashed the top of the
    // screen.
    overlay.classList.add('np-leave');
    setTimeout(() => removeIntro(overlay), LEAVE_MS);
    return;
  }
  SFX.introPlay();
  // Only the logo fades out: the yellow stays on screen, the questionnaire
  // (same yellow background) opens on top of it, then this overlay is removed
  // underneath, so the lobby never flashes in between.
  overlay.classList.add('np-to-questions');
  setTimeout(() => {
    onDone?.();
    setTimeout(() => removeIntro(overlay), 600);
  }, 380);
}
