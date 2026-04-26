import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { SFX } from '../audio/sound.js';
import { calcXP, calcStars } from '../systems/xp.js';
import { saveProgress } from '../systems/progression.js';
import { rollChest } from '../systems/chest.js';
import { getPilotGrade, getNextGrade } from '../data/pilots.js';
import { t } from '../i18n.js';

let _prevHighestLevel = 0;

export function initResult(nav) {
  $('btn-result-continue').onclick = () => {
    if (G.practiceMode) { nav.toMenu(); return; }
    const lvlCfg = window._currentLevelCfg;
    if (lvlCfg && lvlCfg.isChestLevel) {
      nav.toChest(rollChest(), 'map');
    } else {
      nav.toMap();
    }
  };
  $('btn-result-retry').onclick = () => nav.toGame(G.currentLevel, G.practiceMode);
}

export function showResult(won) {
  if (!won) return;

  SFX.levelWin();

  const correct   = G.correctAnswers || 0;
  const answered  = G.questionsAnswered || 0;
  const hits      = G.missileHitsReceived || 0;
  const isBoss    = G.currentLevel % 10 === 0;

  const xp    = calcXP(correct);
  const stars = calcStars(correct, answered, hits);

  _prevHighestLevel = G.highestLevel || 0;

  if (!G.practiceMode) {
    G.xp += xp;
    G.levelStars[G.currentLevel] = Math.max(G.levelStars[G.currentLevel] || 0, stars);

    // Update highest level
    if (G.currentLevel > (G.highestLevel || 0)) {
      G.highestLevel = G.currentLevel;
      save('highestLevel', G.highestLevel);
    }

    saveProgress(G.currentLevel, stars, G.xp);
    window._currentLevelCfg = { isChestLevel: isBoss };
  }

  $('result-title').textContent = G.practiceMode ? t('practiceComplete') : t('missionComplete');
  $('result-stars').innerHTML =
    [...Array(3)].map((_, i) =>
      `<span style="color:${i < stars ? '#fbbf24' : '#334155'};font-size:44px">★</span>`
    ).join('');

  // Star achievement details
  const pct      = answered > 0 ? correct / answered : 0;
  const got2Star = pct >= 0.7;
  const got3Star = pct >= 1 && hits === 0;
  const detailEl = $('result-star-detail');
  if (detailEl) {
    const pctLabel = Math.round(pct * 100);
    detailEl.innerHTML = `
      <span class="${got2Star ? 'rsd-good' : 'rsd-miss'}">
        ${got2Star ? '✓' : '✗'} 70%+ correct (${pctLabel}%)
      </span>
      <span class="${hits === 0 ? 'rsd-good' : 'rsd-miss'}">
        ${hits === 0 ? '✓' : '✗'} Never hit by missiles
      </span>
    `;
  }

  $('result-xp').textContent      = G.practiceMode ? t('noXpPractice') : `+ ${xp} XP`;
  const total = isBoss ? answered : 10;
  $('result-correct').textContent = `${correct} / ${total} ${t('correct')}`;

  // Pilot grade promotion banner
  const promoBanner = $('result-promo-banner');
  if (promoBanner && !G.practiceMode) {
    const prevGrade = getPilotGrade(_prevHighestLevel);
    const newGrade  = getPilotGrade(G.highestLevel);
    if (prevGrade.name !== newGrade.name) {
      promoBanner.textContent = `${newGrade.emoji} PROMOTED: ${newGrade.name}!`;
      promoBanner.style.color = newGrade.color;
      promoBanner.classList.remove('hidden');
      SFX.promoted?.();
    } else {
      promoBanner.classList.add('hidden');
    }
  }
}
