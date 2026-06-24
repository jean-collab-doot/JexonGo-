import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { t } from '../i18n.js';
import { SFX } from '../audio/sound.js';

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

  // Update button labels to current language
  const continueBtn = $('btn-continue-game');
  if (continueBtn) continueBtn.classList.add('hidden');
  const retryBtn = $('btn-retry');
  if (retryBtn) retryBtn.textContent = t('retry');
  const mapBtn = $('btn-go-map');
  if (mapBtn) mapBtn.textContent = t('backToMenu');
}
