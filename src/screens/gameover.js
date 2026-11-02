import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { t } from '../i18n.js';
import { SFX } from '../audio/sound.js';
import { reportTiles, mountReportDetails } from './mistake-review.js';

export function initGameover(nav) {
  $('btn-continue-game')?.addEventListener('click', () => {
    setTimeout(() => SFX.stopSFX(), 150);
    if (G.pausedGameResume) G.pausedGameResume();
  });

  $('btn-retry').onclick = () => {
    setTimeout(() => SFX.stopSFX(), 150);
    window._gameResume = null;
    G.pausedGameResume = null;
    G.continueState = null;
    G.coopRetry = true;   // MULTI: replay with the same teammate (main.js toGame)
    nav.toGame(G.currentLevel, G.practiceMode);
  };

  $('btn-go-map').onclick = () => {
    SFX.stopSFX();
    window._gameResume = null;
    G.pausedGameResume = null;
    G.continueState = null;
    nav.toMenu();
  };
}

const POSITIVE_KEYS = [
  'keepGoing',
  'youCanDoIt',
  'almostThere',
  'neverGiveUp',
  'tryAgain',
  'believeInYourself',
];

export function showGameover() {
  const key = POSITIVE_KEYS[Math.floor(Math.random() * POSITIVE_KEYS.length)];
  $('gameover-title').textContent = t(key);
  $('gameover-score').textContent = `${G.correctAnswers} ${t('correctKeepPracticing')}`;
  renderGameoverReport();

  // Update button labels to current language
  const continueBtn = $('btn-continue-game');
  if (continueBtn) continueBtn.classList.add('hidden');
  const retryBtn = $('btn-retry');
  if (retryBtn) retryBtn.textContent = t('retry');
  const mapBtn = $('btn-go-map');
  if (mapBtn) mapBtn.textContent = t('backToMenu');
}

// End-of-game report (screens/mistake-review.js): questions, success,
// average time, best theme, theme to work on, and the mistake replay.
function renderGameoverReport() {
  const el = $('gameover-report');
  if (!el) return;
  el.innerHTML = `
    <div class="jx-report-tiles">${reportTiles().map(([label, value]) =>
      `<div class="jx-report-tile"><small>${label}</small><b>${value}</b></div>`).join('')}</div>
    <div class="jx-report-details"></div>`;
  mountReportDetails(el.querySelector('.jx-report-details'), renderGameoverReport);
}
