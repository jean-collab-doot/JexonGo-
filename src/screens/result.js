import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { SFX } from '../audio/sound.js';
import { calcXP, calcStars } from '../systems/xp.js';
import { saveProgress } from '../systems/progression.js';
import { rollChest } from '../systems/chest.js';
import { t } from '../i18n.js';

export function initResult(nav) {
  $('btn-result-continue').onclick = () => {
    if (G.practiceMode) { nav.toMenu(); return; }
    const lvlCfg = window._currentLevelCfg;
    if (lvlCfg && lvlCfg.isChestLevel) {
      nav.toChest(rollChest());
    } else {
      nav.toMap();
    }
  };
  $('btn-result-retry').onclick = () => nav.toGame(G.currentLevel, G.practiceMode);
}

export function showResult(won) {
  if (!won) return;

  SFX.levelWin();
  const xp    = calcXP(G.correctAnswers);
  const stars = calcStars(G.correctAnswers);

  if (!G.practiceMode) {
    G.xp += xp;
    G.levelStars[G.currentLevel] = Math.max(G.levelStars[G.currentLevel] || 0, stars);
    saveProgress(G.currentLevel, stars, G.xp);
    window._currentLevelCfg = { isChestLevel: G.currentLevel % 10 === 0 };
  }

  $('result-title').textContent   = G.practiceMode ? t('practiceComplete') : t('missionComplete');
  $('result-stars').innerHTML =
    [...Array(3)].map((_, i) =>
      `<span style="color:${i < stars ? '#fbbf24' : '#334155'};font-size:44px">★</span>`
    ).join('');
  $('result-xp').textContent      = G.practiceMode ? t('noXpPractice') : `+ ${xp} XP`;
  $('result-correct').textContent = `${G.correctAnswers} / 10 ${t('correct')}`;
}
