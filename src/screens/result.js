import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { SFX } from '../audio/sound.js';
import { calcStars } from '../systems/xp.js';
import { saveProgress } from '../systems/progression.js';
import { rollChest } from '../systems/chest.js';
import { trackMission } from '../systems/daily.js';
import { getPilotGrade, getNextGrade } from '../data/pilots.js';
import { t } from '../i18n.js';
import { AIRCRAFT } from '../data/aircraft.js';

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

  const xp    = G.sessionXP || 0;
  const stars = calcStars(correct, answered, hits);

  // Coins earned: scale by stars and level
  const COINS_PER_STAR = [0, 15, 35, 60];
  const levelBonus     = Math.floor(G.currentLevel / 5) * 5;
  const coinsEarned    = G.practiceMode ? 0 : (COINS_PER_STAR[stars] || 0) + levelBonus;

  _prevHighestLevel = G.highestLevel || 0;

  if (!G.practiceMode) {
    G.xp            += xp;
    G.totalXpEarned  = (G.totalXpEarned || 0) + xp;
    G.coins          = (G.coins || 0) + coinsEarned;
    G.levelStars[G.currentLevel] = Math.max(G.levelStars[G.currentLevel] || 0, stars);

    // Update highest level
    if (G.currentLevel > (G.highestLevel || 0)) {
      G.highestLevel = G.currentLevel;
      save('highestLevel', G.highestLevel);
    }

    save('totalXpEarned', G.totalXpEarned);
    save('coins', G.coins);
    saveProgress(G.currentLevel, stars, G.xp);
    // Boss levels always drop a chest; non-boss levels have a 25% random chance
    const randomChest = !isBoss && Math.random() < 0.25;
    window._currentLevelCfg = { isChestLevel: isBoss || randomChest };

    // Track per-level clean completion for SR-71 progress cubes
    if (G.currentLevel >= 1 && G.currentLevel <= 30) {
      const levelClean = G.correctAnswers === G.questionsAnswered;
      const cleanSet   = new Set(G.sr71CleanLevels || []);
      if (levelClean) cleanSet.add(G.currentLevel);
      else            cleanSet.delete(G.currentLevel);
      G.sr71CleanLevels = [...cleanSet].sort((a, b) => a - b);
      save('sr71CleanLevels', G.sr71CleanLevels);
    }
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

  $('result-xp').textContent = G.practiceMode ? t('noXpPractice') : `+ ${xp} XP`;
  const coinsEl = $('result-coins');
  if (coinsEl) coinsEl.textContent = (!G.practiceMode && coinsEarned > 0) ? `◎ + ${coinsEarned}` : '';
  const total = isBoss ? answered : 10;
  $('result-correct').textContent = `${correct} / ${total} ${t('correct')}`;

  // SR-71 unlock: first-time completion of 30 levels with zero wrong answers
  const unlockBanner = $('result-unlock-banner');
  if (unlockBanner) {
    const perfectLv30 = G.currentLevel === 30
      && _prevHighestLevel < 30
      && (G.sr71WrongAnswers || 0) === 0
      && !G.practiceMode;
    if (perfectLv30) {
      trackMission('sr71_challenge', 1);
      G.sr71Earned = true;
      save('sr71Earned', true);
      if (!G.unlockedAircraft.includes('sr71')) {
        G.unlockedAircraft.push('sr71');
        save('unlockedAircraft', G.unlockedAircraft);
      }
      if (!G.ownedSkins.includes('exclusive')) {
        G.ownedSkins.push('exclusive');
        save('ownedSkins', G.ownedSkins);
      }
      unlockBanner.textContent = '★ SR-71 BLACKBIRD UNLOCKED!';
      unlockBanner.classList.remove('hidden');
    } else {
      unlockBanner.classList.add('hidden');
    }
  }

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
