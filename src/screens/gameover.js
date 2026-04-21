import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { t } from '../i18n.js';

export function initGameover(nav) {
  $('btn-retry').onclick         = () => { G.continueState = null; nav.toGame(G.currentLevel, G.practiceMode); };
  $('btn-go-map').onclick        = () => nav.toMenu();
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
  const retryBtn = $('btn-retry');
  if (retryBtn) retryBtn.textContent = t('retry');
  const mapBtn = $('btn-go-map');
  if (mapBtn) mapBtn.textContent = t('backToMenu');
}
