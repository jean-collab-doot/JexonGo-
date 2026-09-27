// First-visit intro for new players (storyboard): yellow screen, the T-6
// rises smoothly from the bottom with wind streaks and hovers in the middle.
// It keeps hovering while the game loads; once everything is ready it shoots
// off the top leaving a white wash, and the yellow comes back with the
// glowing JEXONGO logo and a JOUER button.
//
// On a first page load the intro markup is already in index.html (#np-intro,
// .np-static) so it plays during loading; for later entries (restart intro,
// new Google account) it is built here.
import { getLang } from '../i18n.js';
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
      <button class="np-play" type="button"></button>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

const MAX_LOADING_WAIT_MS = 15000;   // never hover forever on a stuck asset

function pageLoaded() {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    window.addEventListener('load', resolve, { once: true });
    setTimeout(resolve, MAX_LOADING_WAIT_MS);
  });
}

export function playNewPlayerIntro(onPlay) {
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
  overlay.querySelector('.np-play').textContent = getLang() === 'fr' ? 'JOUER' : 'PLAY';
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
    });

  const button = overlay.querySelector('.np-play');
  button.addEventListener('click', () => {
    button.disabled = true;
    SFX.introPlay();
    // Only the logo and button fade out: the yellow stays on screen, the
    // questionnaire (same yellow background) opens on top of it, then this
    // overlay is removed underneath, so the lobby never flashes in between.
    overlay.classList.add('np-to-questions');
    setTimeout(() => {
      onPlay?.();
      setTimeout(() => overlay.remove(), 600);
    }, 380);
  }, { once: true });
}
