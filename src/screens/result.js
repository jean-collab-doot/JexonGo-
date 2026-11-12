import { $ } from '../utils/dom.js';
import { G, autoSave, clampCoins, MAX_GAME_COINS, maxGameXp, xpUpgradeMultiplier, addLifetimeXp } from '../state.js';
import { save, load } from '../utils/storage.js';
import { SFX } from '../audio/sound.js';
import { calcStars } from '../systems/xp.js';
import { saveProgress } from '../systems/progression.js';
import { rollChest, skinChest } from '../systems/chest.js';
import { trackMission } from '../systems/daily.js';
import { getPilotGrade, getNextGrade } from '../data/pilots.js';
import { t, getLang } from '../i18n.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { coinIcon, expIcon, uiIcon } from '../utils/icons.js';
import { unlockBossAircraft } from '../systems/secret-aircraft.js';
import { earnHalloweenSkin } from '../data/skins.js';
import { reportTiles, mountReportDetails } from './mistake-review.js';
import { notebookSize } from '../systems/session-report.js';

let _prevHighestLevel = 0;

// BADGE_IMPACT_MS matches the moment the plane reveal lights up
// (timings in style.css, .bdg-reveal).
const BADGE_IMPACT_MS = 1050;

// Secret plane won (F-117, first boss beaten): a black "???" silhouette
// flashes and lights up as the real plane, then its name and ability slide in.
function showAircraftUnlockReveal(id, onDone) {
  const plane = AIRCRAFT[id];
  const fr = getLang() === 'fr';
  const lang = fr ? 'fr' : 'en';
  const owned = G.unlockedAircraft.includes(id);
  const overlay = document.createElement('div');
  overlay.className = 'bdg-reveal bdg-rarity-epique bdg-plane-reveal';
  overlay.innerHTML = `
    <div class="bdg-beam"></div>
    <div class="bdg-rays"></div>
    <div class="bdg-flash"></div>
    <div class="bdg-stage" role="dialog" aria-modal="true" aria-label="${fr ? 'Avion secret débloqué' : 'Secret plane unlocked'} : ${plane.name}">
      <div class="bdg-ribbon"><span>${fr ? 'AVION SECRET DÉBLOQUÉ' : 'SECRET PLANE UNLOCKED'}</span></div>
      <div class="bpr-stage">
        <img class="bpr-plane" src="/assets/hangar/${id}.webp" alt="${plane.name}" draggable="false">
        <span class="bpr-mystery" aria-hidden="true">???</span>
        <span class="bdg-ring"></span><span class="bdg-ring bdg-ring-2"></span>
      </div>
      <em class="bdg-rarity">${fr ? 'BOSS VAINCU' : 'BOSS DEFEATED'}</em>
      <h2 class="bdg-name">${plane.name}</h2>
      <p class="bdg-goal">${uiIcon(plane.ability?.icon)} ${plane.ability?.name?.[lang] || ''} : ${plane.ability?.description?.[lang] || ''}</p>
      <strong class="bdg-reward">${fr ? 'DANS TON HANGAR, POUR TOUJOURS' : 'IN YOUR HANGAR, FOR GOOD'}</strong>
      <div class="bpr-actions">
        ${owned && G.activeAircraft !== id ? `<button type="button" class="bdg-continue bpr-equip">${fr ? 'ÉQUIPER' : 'EQUIP'}</button>` : ''}
        <button type="button" class="bdg-continue bpr-close">${fr ? 'CONTINUER' : 'CONTINUE'}</button>
      </div>
    </div>`;
  overlay.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  overlay.addEventListener('dragstart', e => e.preventDefault());
  document.body.appendChild(overlay);
  document.documentElement.classList.add('badge-unlock-open');
  requestAnimationFrame(() => overlay.classList.add('show'));
  const impact = setTimeout(() => SFX.promoted?.(), BADGE_IMPACT_MS);
  const close = () => {
    clearTimeout(impact);
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.remove();
      document.documentElement.classList.remove('badge-unlock-open');
      onDone?.();
    }, 360);
  };
  overlay.querySelector('.bpr-close').onclick = close;
  const equip = overlay.querySelector('.bpr-equip');
  if (equip) equip.onclick = () => {
    G.activeAircraft = id;
    save('activeAircraft', id);
    SFX.click?.();
    close();
  };
}

export function initResult(nav) {
  $('btn-result-continue').onclick = () => {
    // Event skin earned (perfect level / tutorial): its LEGENDARY chest first
    // (a level chest, if any, follows it: see screens/chest.js).
    const lvlCfg = window._currentLevelCfg;
    const levelChest = !G.practiceMode && lvlCfg && lvlCfg.isChestLevel;
    if (G.pendingSkinChest && !levelChest) { nav.toChest(skinChest(G.pendingSkinChest), G.practiceMode ? 'menu' : 'map'); return; }
    if (G.practiceMode) { nav.toMenu(); return; }
    if (levelChest) {
      nav.toChest(rollChest(), 'map');
    } else {
      nav.toMap();
    }
  };
  $('btn-result-retry').onclick = () => {
    // Mistake review (lobby ERREURS): again with the mistakes left, or the
    // lobby when there are none.
    if (G.mistakesReviewRun) {
      if (!notebookSize()) { nav.toMenu(); return; }
      G.mistakesReview = true;
    }
    nav.toGame(G.currentLevel, G.practiceMode);
  };
}

// Numbers in the result card count up from 0 once the card has appeared.
function animateResultCounters(root) {
  const els = [...root.querySelectorAll('[data-count]')];
  const startAt = performance.now() + 650;
  const duration = 900;
  const step = now => {
    const k = Math.max(0, Math.min(1, (now - startAt) / duration));
    const ease = 1 - Math.pow(1 - k, 3);
    for (const el of els) {
      const value = Math.round(Number(el.dataset.count || 0) * ease);
      el.textContent = el.dataset.plain ? value.toLocaleString() : `+${value.toLocaleString()}`;
    }
    if (k < 1 && !root.classList.contains('hidden')) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function showResult(won) {
  if (!won) return;

  SFX.levelWin();

  const correct   = G.correctAnswers || 0;
  const answered  = G.questionsAnswered || 0;
  const hits      = G.missileHitsReceived || 0;
  const isBoss    = G.currentLevel % 10 === 0;
  const isChestMilestone = G.currentLevel % 5 === 0 || G.currentLevel % 5 === 3;
  const isConnected = !!G.playerRegistered;
  const guestGamesPlayed = Number(load('guestGamesPlayed', 0)) || 0;
  const shouldAskGuestConnect = !isConnected && !G.practiceMode && guestGamesPlayed >= 5;
  const canEarnRewards = !G.practiceMode;

  // The end-of-level bonus only fills what is left under the per-game caps
  // (MAX_GAME_COINS / maxGameXp()), after what was picked up during play. The
  // hangar XP upgrade raises both the bonus and the cap.
  const collectedXpSoFar = G.practiceMode ? 0 : Math.max(0, G.airdropSessionXP || 0);
  const xp    = Math.min(Math.round((G.sessionXP || 0) * xpUpgradeMultiplier()), Math.max(0, maxGameXp() - collectedXpSoFar));
  const stars = calcStars(correct, answered, hits);

  // Coins earned: scale by stars and level
  const COINS_PER_STAR = [0, 15, 35, 60];
  const levelBonus     = Math.floor(G.currentLevel / 5) * 5;
  const collectedCoins = G.practiceMode ? 0 : Math.max(0, G.airdropSessionCoins || 0);
  const coinsEarned    = canEarnRewards
    ? Math.min((COINS_PER_STAR[stars] || 0) + levelBonus, Math.max(0, MAX_GAME_COINS - collectedCoins))
    : 0;
  const collectedXp = G.practiceMode ? 0 : Math.max(0, G.airdropSessionXP || 0);
  const totalCoinsGained = coinsEarned + collectedCoins;
  const totalXpGained = xp + collectedXp;

  _prevHighestLevel = G.highestLevel || 0;

  if (canEarnRewards) {
    G.totalCorrectAnswers = (G.totalCorrectAnswers || 0) + correct;
    save('totalCorrectAnswers', G.totalCorrectAnswers);
    G.xp            += xp;
    G.totalXpEarned  = (G.totalXpEarned || 0) + xp;
    addLifetimeXp(xp);
    G.coins          = clampCoins((G.coins || 0) + coinsEarned);
    G.levelStars[G.currentLevel] = Math.max(G.levelStars[G.currentLevel] || 0, stars);

    // Update highest level
    if (G.currentLevel > (G.highestLevel || 0)) {
      G.highestLevel = G.currentLevel;
      save('highestLevel', G.highestLevel);
    }

    save('totalXpEarned', G.totalXpEarned);
    save('coins', G.coins);
    saveProgress(G.currentLevel, stars, G.xp);
    // 20 chests across the 50-level campaign: 2 per 5-level block
    // (…3,5, 8,10, 13,15…), boss levels included.
    window._currentLevelCfg = { isChestLevel: isChestMilestone };

    // Track per-level clean completion for SR-71 progress cubes
    if (G.currentLevel >= 1 && G.currentLevel <= 30) {
      const levelClean = G.correctAnswers === G.questionsAnswered;
      const cleanSet   = new Set(G.sr71CleanLevels || []);
      if (levelClean) cleanSet.add(G.currentLevel);
      else            cleanSet.delete(G.currentLevel);
      G.sr71CleanLevels = [...cleanSet].sort((a, b) => a - b);
      save('sr71CleanLevels', G.sr71CleanLevels);
    }
    autoSave();
    const averageResponseTime = (G.sessionResponseCount || 0) > 0 ? (G.sessionResponseTimeTotal || 0) / G.sessionResponseCount : Infinity;
    const startingLives = 3 + (AIRCRAFT[G.activeAircraft]?.ability?.extraLives || 0)
      + Math.max(0, Math.min(3, G.planeUpgrades?.[G.activeAircraft]?.lives | 0)); // hangar UPGRADE (same as resetLevel)
    const livesLost = Math.max(0, startingLives - (G.lives || 0));
    // Levels finished without losing a life (kept for stats / cloud save).
    if (livesLost === 0) {
      G.flawlessLevels = (G.flawlessLevels || 0) + 1;
      save('flawlessLevels', G.flawlessLevels);
    }
    // Halloween 2026 livery: a level cleared without a single wrong answer.
    if (G.questionsAnswered > 0 && G.correctAnswers === G.questionsAnswered) earnHalloweenSkin();
    if (unlockBossAircraft({ won: true, isBoss })) {
      setTimeout(() => showAircraftUnlockReveal('f117'), 500);
    }
  } else if (!G.practiceMode) {
    window._currentLevelCfg = { isChestLevel: false };
  }

  const fr = getLang() === 'fr';
  $('rs-title').textContent = G.mistakesReviewRun ? (fr ? 'RÉVISION TERMINÉE' : 'REVIEW COMPLETE')
    : G.practiceMode ? t('practiceComplete') : t('missionComplete');
  $('rs-level').textContent = G.mistakesReviewRun ? (fr ? 'MES ERREURS' : 'MY MISTAKES')
    : G.practiceMode ? (fr ? 'ENTRAÎNEMENT' : 'PRACTICE')
    : `${fr ? 'NIVEAU' : 'LEVEL'} ${G.currentLevel}`;
  $('rs-stars').innerHTML = [0, 1, 2].map(i =>
    `<span class="rs-star ${i < stars ? 'is-on' : ''}" style="--i:${i}">${uiIcon('star')}</span>`).join('');

  // Star goals
  const pct      = answered > 0 ? correct / answered : 0;
  const got2Star = pct >= 0.7;
  const got3Star = pct >= 1 && hits === 0;
  const goal = (ok, text) => `<div class="rs-goal ${ok ? 'is-ok' : 'is-miss'}"><i>${uiIcon(ok ? 'check' : 'x')}</i><span>${text}</span></div>`;
  $('rs-goals').innerHTML =
    goal(got2Star, fr ? `70 %+ de bonnes réponses (${Math.round(pct * 100)} %)` : `70%+ correct answers (${Math.round(pct * 100)}%)`)
    + goal(got3Star, (fr ? '100 % de bonnes réponses sans être touché' : '100% correct without being hit')
      + (hits ? (fr ? ` (touché ${hits}×)` : ` (hit ${hits}×)`) : ''));

  // Rewards: coins + EXP tiles (counting up), plus a chest tile on chest levels.
  const rewardLockLabel = fr ? 'CONNECTE-TOI POUR GAGNER' : 'SIGN IN TO EARN';
  const guestTrialLabel = fr ? `ESSAI INVITÉ ${Math.min(guestGamesPlayed, 5)}/5` : `GUEST TRIAL ${Math.min(guestGamesPlayed, 5)}/5`;
  const rewardsEl = $('rs-rewards');
  if (G.practiceMode) {
    rewardsEl.innerHTML = `<div class="rs-reward-note">${t('noXpPractice')}</div>`;
  } else if (!canEarnRewards) {
    rewardsEl.innerHTML = `<div class="rs-reward-note">${shouldAskGuestConnect ? rewardLockLabel : guestTrialLabel}</div>`;
  } else {
    rewardsEl.innerHTML = `
      <div class="rs-reward rs-reward-coins">${coinIcon('jg-coin-icon-large')}<b data-count="${totalCoinsGained}">+0</b><small>${fr ? 'PIÈCES' : 'COINS'}</small></div>
      <div class="rs-reward rs-reward-xp">${expIcon()}<b data-count="${totalXpGained}">+0</b><small>EXP</small></div>
      ${window._currentLevelCfg?.isChestLevel
        ? `<div class="rs-reward rs-reward-chest"><img src="/assets/chest/chest-purple.png" alt=""><b>${fr ? 'COFFRE' : 'CHEST'}</b><small>${fr ? 'À OUVRIR' : 'TO OPEN'}</small></div>`
        : ''}`;
  }

  // End-of-game report (screens/mistake-review.js): questions, success,
  // average time; then best theme, theme to work on and the mistake replay.
  // (Hits are in the 3-star goal above.)
  $('rs-stats').innerHTML = reportTiles()
    .map(([label, value]) => `<div class="rs-stat"><small>${label}</small><b>${value}</b></div>`).join('');
  mountReportDetails($('rs-report'));

  const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.t6;
  const playerName = (G.playerName && G.playerName !== 'PILOT') ? G.playerName : (fr ? 'PILOTE JEXONGO' : 'JEXONGO PILOT');
  $('rs-foot').textContent = `${playerName} · ${aircraft.name || 'T-6 Texan II'}`;

  animateResultCounters($('s-result'));

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
      unlockBanner.textContent = t('sr71Unlocked');
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
      promoBanner.textContent = `${t('promoted')}: ${newGrade.name}!`;
      promoBanner.style.color = newGrade.color;
      promoBanner.classList.remove('hidden');
      SFX.promoted?.();
    } else {
      promoBanner.classList.add('hidden');
    }
  }
}
