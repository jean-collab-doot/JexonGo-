import { $ } from '../utils/dom.js';
import { G, autoSave, clampCoins, MAX_GAME_COINS, maxGameXp, xpUpgradeMultiplier, addLifetimeXp } from '../state.js';
import { save, load } from '../utils/storage.js';
import { SFX } from '../audio/sound.js';
import { calcStars } from '../systems/xp.js';
import { saveProgress } from '../systems/progression.js';
import { rollChest } from '../systems/chest.js';
import { trackMission } from '../systems/daily.js';
import { getPilotGrade, getNextGrade } from '../data/pilots.js';
import { t, getLang } from '../i18n.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { coinIcon, expIcon, uiIcon } from '../utils/icons.js';
import { badgeXpMultiplier, badgeCoinBonus, unlockEligibleBadges } from '../data/badges.js';

let _prevHighestLevel = 0;

// New-badge reveal: the screen fades in, the badge rises smoothly into place
// and lights up (soft flash, shockwave, confetti in the badge's rarity color),
// then its name, goal and reward slide in one by one. The badge stays still
// (no drag, no scroll). Timings live in style.css (.bdg-reveal);
// BADGE_IMPACT_MS matches the moment the badge lights up.
const BADGE_IMPACT_MS = 1050;
const BADGE_CONFETTI = 30;

function showBadgeUnlockCelebrations(badges) {
  const queue = [...(badges || [])];
  const fr = getLang() === 'fr';
  const showNext = () => {
    const badge = queue.shift();
    if (!badge) return;
    const rarity = badge.rarity.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const confetti = Array.from({ length: BADGE_CONFETTI }, (_, i) => {
      const angle = (i / BADGE_CONFETTI) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 120 + Math.random() * 170;
      const dx = Math.round(Math.cos(angle) * dist);
      const dy = Math.round(Math.sin(angle) * dist * 0.75 - 40);
      const size = 5 + Math.round(Math.random() * 6);
      const alt = i % 3 === 0 ? ' bdg-confetti-alt' : '';
      return `<span class="bdg-confetti${alt}" style="--dx:${dx}px;--dy:${dy}px;--fall:${160 + Math.round(Math.random() * 140)}px;--rot:${Math.round(Math.random() * 720 - 360)}deg;--s:${size}px;--d:${(Math.random() * 0.12).toFixed(2)}s"></span>`;
    }).join('');
    const overlay = document.createElement('div');
    overlay.className = `bdg-reveal bdg-rarity-${rarity}`;
    overlay.innerHTML = `
      <div class="bdg-beam"></div>
      <div class="bdg-rays"></div>
      <div class="bdg-flash"></div>
      <div class="bdg-stage" role="dialog" aria-modal="true" aria-label="${fr ? 'Nouveau badge' : 'New badge'} : ${badge.name}">
        <div class="bdg-ribbon"><span>${fr ? 'NOUVEAU BADGE' : 'NEW BADGE'}</span></div>
        <div class="bdg-medal">
          <span class="bdg-ring"></span><span class="bdg-ring bdg-ring-2"></span>
          ${confetti}
          <div class="bdg-drop"><img class="bdg-img" src="${badge.image}" alt="${badge.name}" draggable="false"><span class="bdg-shine"></span></div>
        </div>
        <em class="bdg-rarity">${badge.rarity}</em>
        <h2 class="bdg-name">${badge.name}</h2>
        <p class="bdg-goal">${badge.goal}</p>
        <strong class="bdg-reward">${badge.reward}</strong>
        <button type="button" class="bdg-continue">${fr ? 'CONTINUER' : 'CONTINUE'}</button>
      </div>`;
    // Keep everything still on phones: no page drag / pinch / image drag.
    overlay.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    overlay.addEventListener('dragstart', e => e.preventDefault());
    document.body.appendChild(overlay);
    document.documentElement.classList.add('badge-unlock-open');
    requestAnimationFrame(() => overlay.classList.add('show'));
    const impact = setTimeout(() => SFX.promoted?.(), BADGE_IMPACT_MS);
    overlay.querySelector('.bdg-continue').onclick = () => {
      clearTimeout(impact);
      overlay.classList.add('closing');
      setTimeout(() => {
        overlay.remove();
        document.documentElement.classList.remove('badge-unlock-open');
        // A badge that gives a plane (Chasseur de Boss -> F-117): show it next.
        if (badge.unlocksAircraft && AIRCRAFT[badge.unlocksAircraft]) {
          showAircraftUnlockReveal(badge, showNext);
        } else {
          showNext();
        }
      }, 360);
    };
  };
  showNext();
}

// Plane given by a badge: the badge flies into a black "???" silhouette,
// which flashes and lights up as the real plane, then its name and ability
// slide in. Same stage as the badge reveal (.bdg-reveal + .bdg-plane-reveal).
function showAircraftUnlockReveal(badge, onDone) {
  const id = badge.unlocksAircraft;
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
        <img class="bpr-badge" src="${badge.image}" alt="" draggable="false">
        <span class="bdg-ring"></span><span class="bdg-ring bdg-ring-2"></span>
      </div>
      <em class="bdg-rarity">${fr ? `GRÂCE AU BADGE ${badge.name.toUpperCase()}` : `THANKS TO THE ${badge.name.toUpperCase()} BADGE`}</em>
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

// Preview hook used by the Hangar. It never unlocks a badge or grants rewards.
window._previewBadgeUnlock = badgeOrBadges => showBadgeUnlockCelebrations(
  Array.isArray(badgeOrBadges) ? badgeOrBadges : (badgeOrBadges ? [badgeOrBadges] : [])
);

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
  const xp    = Math.min(Math.round((G.sessionXP || 0) * badgeXpMultiplier() * xpUpgradeMultiplier()), Math.max(0, maxGameXp() - collectedXpSoFar));
  const stars = calcStars(correct, answered, hits);
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const finalScore = (correct * 100) + (stars * 250) + Math.max(0, xp) + Math.max(0, G.streak || 0) * 25 - hits * 100;

  // Coins earned: scale by stars and level
  const COINS_PER_STAR = [0, 15, 35, 60];
  const levelBonus     = Math.floor(G.currentLevel / 5) * 5;
  const collectedCoins = G.practiceMode ? 0 : Math.max(0, G.airdropSessionCoins || 0);
  const coinsEarned    = canEarnRewards
    ? Math.min((COINS_PER_STAR[stars] || 0) + levelBonus, Math.max(0, MAX_GAME_COINS - collectedCoins))
      + badgeCoinBonus()
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
    const startingLives = 3 + (G.activeBadge === 'steady_recruit' ? 1 : 0) + (AIRCRAFT[G.activeAircraft]?.ability?.extraLives || 0)
      + Math.max(0, Math.min(3, G.planeUpgrades?.[G.activeAircraft]?.lives | 0)); // hangar UPGRADE (same as resetLevel)
    const livesLost = Math.max(0, startingLives - (G.lives || 0));
    // "Sans-Faute" badge: levels finished without losing a life (2 needed).
    if (livesLost === 0) {
      G.flawlessLevels = (G.flawlessLevels || 0) + 1;
      save('flawlessLevels', G.flawlessLevels);
    }
    const newlyUnlockedBadges = unlockEligibleBadges({ won: true, isBoss, accuracy, averageResponseTime, livesLost });
    if (newlyUnlockedBadges.length) {
      setTimeout(() => showBadgeUnlockCelebrations(newlyUnlockedBadges), 500);
    }
  } else if (!G.practiceMode) {
    window._currentLevelCfg = { isChestLevel: false };
  }

  const fr = getLang() === 'fr';
  $('rs-title').textContent = G.practiceMode ? t('practiceComplete') : t('missionComplete');
  $('rs-level').textContent = G.practiceMode
    ? (fr ? 'ENTRAÎNEMENT' : 'PRACTICE')
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
    + goal(got3Star, fr ? '100 % de bonnes réponses sans être touché' : '100% correct without being hit');

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

  // Stats
  const total = isBoss ? answered : 10;
  $('rs-stats').innerHTML = [
    ['SCORE', `<span data-count="${finalScore}" data-plain="1">0</span>`],
    [fr ? 'RÉPONSES' : 'ANSWERS', `${correct}/${total}`],
    [fr ? 'PRÉCISION' : 'ACCURACY', `${accuracy}%`],
    [fr ? 'TOUCHÉ' : 'HITS', String(hits)],
  ].map(([label, value]) => `<div class="rs-stat"><small>${label}</small><b>${value}</b></div>`).join('');

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
