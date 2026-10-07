import { G, loadSave, saveAll } from './state.js';
import { save, load, clearAccountData } from './utils/storage.js';
import { showScreen } from './utils/dom.js';
import { SFX } from './audio/sound.js';
import { initMenu, renderMenu, handleGoogleLogin } from './screens/menu.js';
import { showConnectPrompt } from './screens/connect-prompt.js';
import { playWorldCupIntro, stopWorldCupIntro } from './screens/worldcup-intro.js';
import { showOnboarding, showBriefingEquationOptions } from './screens/onboarding.js';
import { playNewPlayerIntro } from './screens/new-player-intro.js';
import { showIntroBriefing } from './screens/intro-briefing.js';
import { initLevelMap, renderLevelMap, setMapFocusLevel, setLevelMapPicker, getLevelMapPicker } from './screens/levelmap.js';
import { initHangar, renderHangar } from './screens/hangar.js';
import { initShop, renderShop } from './screens/shop.js';
import { initTraining, renderTraining, practiceLevelNumber } from './screens/training.js';
import { initGame, leaveCoopLink } from './screens/game.js';
import { initResult, showResult } from './screens/result.js';
import { initChest, showChest, setChestReturn } from './screens/chest.js';
import { initGameover, showGameover } from './screens/gameover.js';
import { initSettings, loadSettings } from './screens/settings.js';
import { initRanked, renderRankedLobby } from './screens/ranked.js';
import { initBriefing, showBriefing } from './screens/briefing.js';
import { initArena, enterArena } from './screens/arena.js';
import { initMultiplayer, enterMultiplayer, exitMultiplayer, isMultiLobby } from './screens/multiplayer.js';
import { initLeaderboard, closeLeaderboard } from './screens/leaderboard.js';
import { resetIntroBriefing } from './screens/intro-briefing.js';
import { preloadShips } from './game/sprites.js';
import { checkDailyLogin, recordPlayMinute, LOGIN_REWARDS, DAILY_INTERVAL_MS } from './systems/daily.js';
import { showDailyReward } from './screens/menu.js';
import { canSendFeedback, markFeedbackSent, sendFeedback, sendNewPlayerNotification, _resetNewPlayer, _testEmailNow } from './systems/feedback.js';
import { t, getLang, applyI18n } from './i18n.js';
import { syncAccountFromCloud, flushCloudSave, pushCloudSave, fetchCloudSave } from './systems/cloud-save.js';
import { signInWithGoogleIdToken, signUpWithEmail, signOutSupabase } from './systems/supabase-client.js';
import { claimSessionOrBlock, sessionBlockedMessage, sessionLostMessage, askTakeover, onSessionLost } from './systems/session-guard.js';
import { applyDeviceClasses } from './utils/device.js';
import { isLevelUnlocked } from './systems/progression.js';
import { isPilotNameAllowed } from './utils/pilot-name.js';
import { showPilotNamePrompt } from './screens/pilot-name-prompt.js';

const ANALYTICS_OPT_OUT_KEY = 'jexongoAnalyticsOptOut';
let _analyticsTrack = null;
let _analyticsPageview = null;
const _analyticsQueue = [];
let _trackedFirstInteraction = false;

function analyticsOptedOut() {
  try {
    return localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === '1';
  } catch {
    return true;
  }
}

function trackAnalytics(name, properties = {}) {
  if (analyticsOptedOut()) return;
  const payload = { name, properties };
  if (_analyticsTrack) {
    _analyticsTrack(name, properties);
    return;
  }
  if (_analyticsQueue.length < 24) _analyticsQueue.push(payload);
}

function trackVirtualPage(route, properties = {}) {
  if (analyticsOptedOut()) return;
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
  if (_analyticsPageview) {
    _analyticsPageview({ route: normalizedRoute, path: normalizedRoute });
  }
  trackAnalytics('Game Screen View', { screen: normalizedRoute, ...properties });
}

async function injectVercelInsights() {
  // Keep VS Code / Live Server launches working; Vercel analytics is optional.
  const host = location.hostname.toLowerCase();
  const isVercelHosted =
    host === 'jexongo.app' ||
    host === 'www.jexongo.app' ||
    host.endsWith('.vercel.app');
  if (!isVercelHosted) return;

  const analyticsParam = new URLSearchParams(location.search).get('analytics');
  if (analyticsParam === 'off') {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, '1');
    console.info('[Vercel] Analytics disabled on this browser.');
    return;
  }
  if (analyticsParam === 'on') {
    localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
    console.info('[Vercel] Analytics enabled on this browser.');
  }
  if (analyticsOptedOut()) return;

  try {
    const [{ inject, track, pageview }, { injectSpeedInsights }] = await Promise.all([
      import('@vercel/analytics'),
      import('@vercel/speed-insights'),
    ]);
    inject({ framework: 'vite' });
    injectSpeedInsights({ framework: 'vite' });
    _analyticsTrack = track;
    _analyticsPageview = pageview;
    trackVirtualPage('/lobby');
    while (_analyticsQueue.length) {
      const event = _analyticsQueue.shift();
      _analyticsTrack(event.name, event.properties);
    }
  } catch (err) {
    console.warn('[Vercel] Insights unavailable:', err);
  }
}

// ── VIDEO BACKGROUND ─────────────────────────────────────────────────────────
const _isMobileUA = /iPhone|iPad|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

// Video plays on all devices including mobile

function _menuVideos() {
  return ['menu-bg-video', 'menu-bg-video2']
    .map(id => document.getElementById(id))
    .filter(Boolean);
}

function _videoPause() {
  _menuVideos().forEach(video => {
    if (!video.paused) video.pause();
  });
}
function _videoResume() {
  _menuVideos().forEach(video => {
    if (video.readyState === 0) video.load();
    if (video.paused || video.ended) video.play().catch(() => {});
  });
}

// ── SESSION TIMER ────────────────────────────────────────────────────────────
const _sessionStart = Date.now();
function _playtimeStr() {
  return Math.max(1, Math.round((Date.now() - _sessionStart) / 60000)) + ' min';
}

// ── NAVIGATION ──────────────────────────────────────────────────────────────
let _cleanup = null;
let _audioSplashStarted = false;

const nav = {
  toMenu(dir) {
    cleanup();
    leaveCoopLink();
    G.lastCoopSession = null;
    G.coopWinXp = false;
    exitMultiplayer();
    closeLeaderboard();
    setLevelMapPicker(null);
    // Back in the lobby: the next map visit starts on PACIFIQUE again.
    setMapFocusLevel(null);
    renderMenu();
    showScreen('s-menu', dir);
    trackVirtualPage('/lobby');
    SFX.playMusic('menu');
    _videoResume();
  },
  toMap() {
    cleanup();
    setLevelMapPicker(null);
    renderLevelMap();
    showScreen('s-levelmap');
    trackVirtualPage('/levels');
    SFX.playMusic('menu');
  },
  toGame(levelNum, practiceMode = false) {
    // A co-op teammate plays the host's level even if it is not unlocked yet.
    if (!practiceMode && !G.tutorialMode && !G.coopSession && !isLevelUnlocked(levelNum, G.levelStars, G.highestLevel, G.tutorialPlan?.startLevel || 1)) {
      nav.toMap();
      return;
    }
    cleanup();
    // RETRY in MULTI: same teammate again (bot or real player), back to life.
    if (G.coopRetry && G.lastCoopSession && !practiceMode) G.coopSession = G.lastCoopSession;
    G.coopRetry = false;
    if (!G.coopSession) leaveCoopLink();
    G.practiceMode = practiceMode;
    if (!practiceMode && !G.tutorialMode) setMapFocusLevel(levelNum);
    showScreen('s-game');
    trackVirtualPage(practiceMode ? '/practice/game' : `/level/${levelNum}`, {
      level: levelNum,
      mode: practiceMode ? 'practice' : 'level',
    });
    trackAnalytics('Game Started', {
      level: levelNum,
      mode: practiceMode ? 'practice' : 'level',
    });
    // A level (new or replayed) always starts its music from the beginning.
    SFX.playMusic([10, 20, 30, 40, 50].includes(levelNum) ? 'dialogue' : 'game', { restart: true });
    _cleanup = initGame(levelNum, (won) => {
      cleanup();
      if (_practiceNumberMaxBeforeRun !== null) {
        G.practiceNumberMax = _practiceNumberMaxBeforeRun;
        _practiceNumberMaxBeforeRun = null;
      }
      // Beginner practice finished: invite a guest to sign in with Google.
      const beginnerPracticeDone = won && G.beginnerPracticeDone && !_skipConnectPromptAfterRun;
      G.beginnerPracticeDone = false;
      _skipConnectPromptAfterRun = false;
      if (beginnerPracticeDone && !G.playerRegistered) {
        renderMenu();
        showScreen('s-menu');
        trackVirtualPage('/lobby', { source: 'beginner-practice' });
        SFX.playMusic('menu');
        openConnectPrompt();
        return;
      }
      if (won && G.postTutorialConnectPrompt && !G.playerRegistered && guestTrialUsed()) {
        renderMenu();
        showScreen('s-menu');
        trackVirtualPage('/lobby', { source: 'guest-limit' });
        SFX.playMusic('menu');
        const level = G.tutorialPlan?.startLevel || G.currentLevel || 1;
        _showLoginToast(deviceIntroLang() === 'fr'
          ? `La connexion est importante. Connecte-toi avec ton compte JexonGo pour continuer au niveau ${level}.`
          : `Connection is important. Sign in with your JexonGo account to continue at level ${level}.`, 5200);
        return;
      }
      if (won) {
        showResult(true);
        showScreen('s-result');
        trackVirtualPage('/result', { level: G.currentLevel || levelNum, won: true });
        trackAnalytics('Game Finished', {
          level: G.currentLevel || levelNum,
          won: true,
          mode: G.practiceMode ? 'practice' : 'level',
        });
        SFX.stopMusic();
        // The first daily gift appears only after the complete tutorial has
        // ended. checkDailyLogin also enforces registration and one claim/day.
        const daily = checkDailyLogin();
        if (daily.isNewDay) {
          setTimeout(() => showDailyReward(daily.reward, daily.streak), 700);
        }
      } else {
        showGameover();
        showScreen('s-gameover');
        trackVirtualPage('/gameover', { level: G.currentLevel || levelNum, won: false });
        trackAnalytics('Game Finished', {
          level: G.currentLevel || levelNum,
          won: false,
          mode: G.practiceMode ? 'practice' : 'level',
        });
        SFX.stopMusic();
        SFX.gameOver();
      }
    });
  },
  toHangar(dir) {
    cleanup();
    renderHangar();
    showScreen('s-hangar', dir);
    trackVirtualPage('/hangar');
    SFX.playMusic('menu');
  },
  toShop(dir) {
    cleanup();
    renderShop();
    showScreen('s-shop', dir);
    trackVirtualPage('/shop');
    SFX.playMusic('menu');
  },
  toTraining(dir) {
    cleanup();
    renderTraining();
    showScreen('s-training', dir);
    trackVirtualPage('/training');
    SFX.playMusic('menu');
  },
  toChest(reward, returnTo = 'map') {
    cleanup();
    setChestReturn(returnTo);
    showChest(reward);
    showScreen('s-chest');
    trackVirtualPage('/chest', { returnTo });
    SFX.playMusic('menu');
  },
  toRanked() {
    cleanup();
    renderRankedLobby();
    showScreen('s-ranked');
    trackVirtualPage('/ranked');
    SFX.playMusic('menu');
  },
  toBriefing(levelNum) {
    if (!G.tutorialMode && !isLevelUnlocked(levelNum, G.levelStars, G.highestLevel, G.tutorialPlan?.startLevel || 1)) {
      nav.toMap();
      return;
    }
    cleanup();
    setMapFocusLevel(levelNum);
    showBriefing(levelNum);
    showScreen('s-briefing');
    trackVirtualPage('/briefing', { level: levelNum });
    SFX.playMusic('menu');
  },
  toArena(opts = {}) {
    cleanup();
    showScreen('s-arena');
    trackVirtualPage('/arena', { mode: opts.mode || 'ranked' });
    enterArena(opts);
  },
  // MULTI: the solo level map picks the co-op level (only unlocked levels).
  toMapPicker(onPick, onBack) {
    cleanup();
    setLevelMapPicker({ onPick, onBack });
    renderLevelMap();
    showScreen('s-levelmap');
    trackVirtualPage('/multiplayer/levels');
    SFX.playMusic('menu');
  },
  // MULTI: the same lobby screen, in multiplayer mode (multiplayer.js).
  toMulti() {
    cleanup();
    renderMenu();
    showScreen('s-menu');
    trackVirtualPage('/multiplayer');
    enterMultiplayer();
    SFX.playMusic('menu');
  },
  toGradeSelect() {
    cleanup();
    showScreen('s-grade');
    trackVirtualPage('/pilot-setup');
  },
};

// Called by the first-level visual introduction. The countdown waits until the
// welcome gift is claimed, so the reward is clearly shown after the intro.
window._showDailyRewardAfterIntro = (onDone) => {
  const daily = checkDailyLogin();
  if (!daily.isNewDay) {
    onDone?.();
    return;
  }
  showDailyReward(daily.reward, daily.streak, () => onDone?.());
};

function deviceIntroLang() {
  return getLang();
}

function guestTrialUsed() {
  return !G.playerRegistered && (Number(load('guestGamesPlayed', 0)) || 0) >= 5;
}

function showNewPlayerIntroFlow(onDone = null, options = {}) {
  renderMenu();
  showScreen('s-menu');   // no music: the questionnaire and briefing are silent
  stopWorldCupIntro();
  showOnboarding(() => {
    save('hasSeenOnboarding', true);
    if (onDone) onDone();
    else nav.toGame(G.currentLevel || 1);
  }, options);
}

// Every new-player entry (first visit, restart intro, new Google account):
// the yellow T-6 animation, then the questionnaire, then the first level.
// After the briefing a new player goes straight into a PRACTICE game, set up
// from the questionnaire: chosen topics (+ - x / exponent algebra) and number
// range. Placement / tutorial levels stay pending for the normal levels.
let _practiceNumberMaxBeforeRun = null;
let _skipConnectPromptAfterRun = false;   // run started from the BRIFING button
function startPracticeFromOnboarding({ skipConnectPrompt = false } = {}) {
  _skipConnectPromptAfterRun = skipConnectPrompt;
  const extra = { exponent: '^', algebra: 'alg' };
  const ops = [...new Set((G.focusTopics || []).map(t => extra[t] || t)
    .filter(op => ['+', '-', '*', '/', '^', 'alg'].includes(op)))];
  G.practiceOps = ops.length ? ops : ['+', '-', '*', '/'];
  // Only for this run: the player's own practice number range comes back
  // when the game ends (see the toGame end callback).
  _practiceNumberMaxBeforeRun = G.practiceNumberMax;
  G.practiceNumberMax = G.numberRangeMax || 0;
  G.onboardingPracticeRun = true;   // game.js: 5 free questions, then timer + 3 lives
  nav.toGame(practiceLevelNumber(), true);
}

// Questionnaire done -> straight into the "how to play" briefing (no level
// loading in between), then practice.
function startNewPlayerAnimation(onDone = startPracticeFromOnboarding) {
  playNewPlayerIntro(() => {
    _audioSplashStarted = true;
    SFX.unlock();
    showNewPlayerIntroFlow(() => showIntroBriefing(onDone), { skipWelcome: true });
  });
}

// Google sign-in invitation (end of the beginner practice). Its terms /
// privacy links open those pages; their back button brings it back.
let _reopenConnectPrompt = false;

// Lobby BRIFING button (settings.js): briefing, then the beginner practice
// (5 free questions, 5 s break, 5 timed questions with 3 lives, then the
// Google invitation for guests) — the same run as new players get.
window._startBriefingPractice = () =>
  showBriefingEquationOptions(() => showIntroBriefing(() =>
    startPracticeFromOnboarding({ skipConnectPrompt: true })));   // no Google invitation here
function openConnectPrompt(reason = '') {
  showConnectPrompt({
    reason,
    onGoogle: () => handleGoogleLogin('google'),
    onLegal: kind => {
      _reopenConnectPrompt = true;
      showScreen(kind === 'terms' ? 's-terms' : 's-privacy');
    },
  });
}

function cleanup() {
  _videoPause();
  if (G.animFrame)     { cancelAnimationFrame(G.animFrame); G.animFrame = null; }
  if (G.mobileLoop)    { clearInterval(G.mobileLoop);       G.mobileLoop = null; }
  if (G.timerInterval) { clearInterval(G.timerInterval);    G.timerInterval = null; }
  if (_cleanup) { _cleanup(); _cleanup = null; }
}

window._nav = nav;
// No account: tapping a level after level 1 opens the sign-in invitation.
window._openConnectPrompt = () => openConnectPrompt('levels');
window._showFeedbackPopup  = () => showFeedbackPopup();
window._resetNewPlayer     = _resetNewPlayer;
window._testEmailNow       = _testEmailNow;
window._resetIntroBriefing = resetIntroBriefing;

function restartFullIntroFromStart() {
  cleanup();
  stopWorldCupIntro();
  document.getElementById('onboarding-overlay')?.remove();
  document.getElementById('brief-overlay')?.remove();
  resetIntroBriefing();
  G.hasSeenOnboarding = false;
  G.tutorialMode = false;
  G.tutorialCompleted = false;
  G.tutorialProgress = null;
  save('hasSeenOnboarding', false);
  save('tutorialMode', false);
  save('tutorialCompleted', false);
  save('tutorialProgress', null);
  renderMenu();
  showScreen('s-menu');
  startNewPlayerAnimation();
}
window._restartFullIntro = restartFullIntroFromStart;

function _showLoginToast(msg, duration = 2800) {
  const el = document.getElementById('login-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('toast-show');
  setTimeout(() => el.classList.remove('toast-show'), duration);
}

// Pilot name prompt (cannot be skipped); saves locally and to the account.
function askPilotName(realNames) {
  return new Promise(resolve => showPilotNamePrompt({
    realNames,
    onDone: pilotName => {
      G.playerName = pilotName;
      G.pilotNameChosen = true;
      save('playerName', pilotName);
      save('pilotNameChosen', true);
      pushCloudSave().catch(() => {});
      renderMenu();
      resolve(pilotName);
    },
  }));
}

window._onGoogleCredential = async function(response) {
  try {
    const raw     = response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(raw));
    const email   = (payload.email || '').toLowerCase();
    // The real name from Google is never used as the pilot name (other
    // players see it): the player types a nickname, which may not contain it.
    const realNames = [payload.given_name, payload.family_name, payload.name, email.split('@')[0]];
    const photo   = payload.picture || '';

    try {
      await signInWithGoogleIdToken(response.credential);
    } catch (err) {
      console.warn('[Supabase] Google auth failed:', err);
      _showLoginToast(getLang() === 'fr'
        ? 'Connexion Google Supabase non configuree. Utilisez un compte JexonGO.'
        : 'Supabase Google login is not configured. Use a JexonGO account.', 4200);
      return;
    }

    // Open on another device: continue here (that device signs out) or cancel.
    let { blocked } = await claimSessionOrBlock();
    if (blocked && await askTakeover()) ({ blocked } = await claimSessionOrBlock({ takeover: true }));
    if (blocked) {
      await signOutSupabase().catch(() => {});
      _showLoginToast(sessionBlockedMessage(), 4200);
      return;
    }

    const wasRegistered = G.playerRegistered;
    const previousEmail = (load('playerEmail', '') || '').toLowerCase();
    const shouldStartRecommended = !!load('postTutorialConnectPrompt', false);
    const recommendedPlan = load('tutorialPlan', null);

    // Same account on this device with a nickname already chosen: keep it.
    const keepPilotName = previousEmail === email && G.pilotNameChosen;
    let name = keepPilotName ? G.playerName : 'PILOT';
    G.pilotNameChosen = keepPilotName;
    save('pilotNameChosen', keepPilotName);

    // Always persist identity first so loadSave can read them back
    G.playerName       = name;
    G.playerEmail      = email;
    G.playerAuthType   = 'google';
    G.playerPhoto      = photo;
    G.playerRegistered = true;
    save('playerName',       name);
    save('playerEmail',      email);
    save('playerAuthType',   'google');
    save('playerPhoto',      photo);
    save('playerRegistered', true);

    loadSave();
    const sync = await syncAccountFromCloud({ authType: 'google', onApplied: () => renderMenu() });
    const shouldNotifyNewGooglePlayer = !sync?.merged && (!wasRegistered || previousEmail !== email);
    if (!G.pilotNameChosen) await askPilotName(realNames);
    name = G.playerName;
    if (sync.offline) _showLoginToast(t('syncOffline') || 'Account connected - progress saves on this device.');
    else if (sync.merged) _showLoginToast(t('syncOk') || 'Progress synced from your account.');

    if (shouldStartRecommended && recommendedPlan?.startLevel) {
      G.currentLevel = recommendedPlan.startLevel;
      G.postTutorialConnectPrompt = false;
      save('currentLevel', G.currentLevel);
      save('postTutorialConnectPrompt', false);
      _showLoginToast(deviceIntroLang() === 'fr'
        ? `Connecte. Debut de ton niveau recommande ${G.currentLevel}.`
        : `Connected. Starting your recommended level ${G.currentLevel}.`, 3600);
      nav.toGame(G.currentLevel || 1);
      return;
    }

    if (wasRegistered) {
      renderMenu();
      _showLoginToast(t('welcomeBack').replace('{name}', name));
    } else if (!G.playerGrade) {
      startNewPlayerAnimation();
    } else {
      if (shouldNotifyNewGooglePlayer) {
        sendNewPlayerNotification({ playerName: name, playerEmail: email, playerGrade: G.playerGrade });
      }
      nav.toMenu();
      setTimeout(() => _showLoginToast(t('welcomeNew').replace('{name}', name)), 300);
      const _daily = checkDailyLogin();
      if (_daily.isNewDay) setTimeout(() => showDailyReward(_daily.reward, _daily.streak), 700);
    }
  } catch (_) {
    console.warn('[GSI] Credential parse error');
  }
};

// ── GRADE SELECTION SCREEN ───────────────────────────────────────────────────
function initGradeScreen() {
  document.querySelectorAll('.grade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const grade = parseInt(btn.dataset.grade, 10);
      G.playerGrade = grade;
      save('playerGrade', grade);
      saveAll(); // persist full state now that grade is confirmed
      // Send new player emails now that grade is confirmed
      sendNewPlayerNotification({ playerName: G.playerName, playerEmail: G.playerEmail, playerGrade: grade });
      nav.toMenu();
      SFX.playMusic('menu');
      setTimeout(() => _showLoginToast(t('welcomeNew').replace('{name}', G.playerName || 'PILOT'), 3500), 300);
    });
  });
}

// ── INIT ALL SCREENS ─────────────────────────────────────────────────────────
initMenu(nav);
initLevelMap(nav);
initHangar(nav);
initShop(nav);
initTraining(nav);
initResult(nav);
initChest(nav);
initGameover(nav);
initSettings();
initRanked(nav);
initBriefing(nav);
initArena(nav);
initMultiplayer(nav);
initLeaderboard();
// MULTI enters multiplayer mode; in that mode the same button reads SOLO.
document.getElementById('btn-lobby-multi')?.addEventListener('click', () => {
  if (isMultiLobby()) exitMultiplayer();
  else nav.toMulti();
});
initGradeScreen();
initRegistration();
initFeedback();

if (!document.getElementById('s-menu')?.classList.contains('hidden')) {
  renderMenu();
}

document.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  // MULTI level pick: the map / briefing back buttons return to MULTI
  // (their own handlers in levelmap.js / briefing.js).
  if (getLevelMapPicker() && (btn.id === 'btn-map-back' || btn.id === 'btn-briefing-back')) return;

  if (
    btn.id === 'btn-map-back' ||
    btn.id === 'btn-hangar-back' ||
    btn.id === 'btn-ranked-back' ||
    btn.id === 'btn-profile-back'
  ) {
    e.preventDefault();
    nav.toMenu();
    return;
  }

  if (btn.id === 'btn-briefing-back') {
    e.preventDefault();
    nav.toMap();
    return;
  }

  if (btn.id === 'btn-privacy-back' || btn.id === 'btn-terms-back' || btn.id === 'btn-reg-close') {
    e.preventDefault();
    nav.toMenu();
    if (_reopenConnectPrompt && btn.id !== 'btn-reg-close') {
      _reopenConnectPrompt = false;
      openConnectPrompt();
    }
  }
}, true);

// ── GLOBAL BUTTON CLICK SOUND ─────────────────────────────────────────────────
// A drag that ends on a button (pulling the HANGAR sheet up/down, swiping a
// list) is not a click: no sound for it. Tracked on pointerdown/move.
let _pressX = 0, _pressY = 0, _pressDragged = false;
document.addEventListener('pointerdown', e => {
  _pressX = e.clientX; _pressY = e.clientY; _pressDragged = false;
}, true);
document.addEventListener('pointermove', e => {
  if (!_pressDragged && Math.hypot(e.clientX - _pressX, e.clientY - _pressY) > 8) _pressDragged = true;
}, true);

document.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (!_audioSplashStarted) {
    _audioSplashStarted = true;
    SFX.unlock();
    // Not over the new-player intro / questionnaire / briefing (no music there).
    if (!document.querySelector('#np-intro, #onboarding-overlay, #brief-overlay')) SFX.playMusic('menu');
    document.getElementById('audio-splash')?.classList.add('hidden');
  }
  // The takeoff button (level briefing) plays its own sound instead.
  if (btn.id !== 'btn-audio-start' && btn.id !== 'btn-briefing-fly'
    && !_pressDragged) SFX.click();
  if (!_trackedFirstInteraction) {
    _trackedFirstInteraction = true;
    trackAnalytics('Game Interaction', { action: 'first_button_click', button: btn.id || 'button' });
  }
}, true);

// ── REGISTRATION SCREEN ───────────────────────────────────────────────────────
function initRegistration() {
  document.getElementById('btn-reg-close').addEventListener('click', () => {
    renderMenu();
    showScreen('s-menu');
  });
  document.getElementById('btn-reg-privacy')?.addEventListener('click', () => {
    showScreen('s-privacy');
  });
  document.getElementById('btn-reg-terms')?.addEventListener('click', () => {
    showScreen('s-terms');
  });
  document.getElementById('btn-menu-privacy')?.addEventListener('click', () => {
    showScreen('s-privacy');
  });
  document.getElementById('btn-menu-terms')?.addEventListener('click', () => {
    showScreen('s-terms');
  });
  document.getElementById('btn-privacy-back')?.addEventListener('click', () => {
    renderMenu();
    showScreen('s-menu');
  });
  document.getElementById('btn-terms-back')?.addEventListener('click', () => {
    renderMenu();
    showScreen('s-menu');
  });

  // Under 13, a parent or guardian must agree before the account is created.
  const PARENT_CONSENT_AGE = 13;
  document.getElementById('reg-age')?.addEventListener('change', e => {
    const age = parseInt(e.target.value, 10);
    const needsParent = !!age && age < PARENT_CONSENT_AGE;
    document.getElementById('reg-parent-row')?.classList.toggle('hidden', !needsParent);
    if (!needsParent) document.getElementById('reg-parent').checked = false;
  });

  document.getElementById('btn-reg-submit').addEventListener('click', async () => {
    const name  = (document.getElementById('reg-name').value  || '').trim().toUpperCase();
    const email = (document.getElementById('reg-email').value || '').trim().toLowerCase();
    const pw    = (document.getElementById('reg-password').value || '');
    const pwConfirm = (document.getElementById('reg-password-confirm').value || '');
    const age   = parseInt(document.getElementById('reg-age').value, 10);
    const grade = parseInt(document.getElementById('reg-grade').value, 10);
    const tos   = document.getElementById('reg-tos').checked;
    const privacy = document.getElementById('reg-privacy').checked;
    const parentOk = !!document.getElementById('reg-parent')?.checked;
    const err   = document.getElementById('reg-error');

    if (!name)                          { err.textContent = t('regErrName');     return; }
    if (!isPilotNameAllowed(name))      { err.textContent = t('regErrNameBad');  return; }
    if (!email || !email.includes('@')) { err.textContent = t('regErrEmail');    return; }
    if (pw.length < 6)                  { err.textContent = t('regErrPassword'); return; }
    if (pw !== pwConfirm)               { err.textContent = t('regErrPasswordMatch'); return; }
    if (!age)                           { err.textContent = t('regErrAge');      return; }
    if (!grade)                         { err.textContent = t('regErrGrade');    return; }
    if (!tos)                           { err.textContent = t('regErrTos');      return; }
    if (!privacy)                       { err.textContent = t('regErrPrivacy');  return; }
    if (age < PARENT_CONSENT_AGE && !parentOk) { err.textContent = t('regErrParent'); return; }

    err.textContent       = '';
    try {
      const auth = await signUpWithEmail(email, pw, {
        player_name: name,
        player_grade: grade,
        player_age: age,
        // Record when a parent agreed for an under-13 account.
        ...(age < PARENT_CONSENT_AGE ? { parent_consent_at: new Date().toISOString() } : {}),
      });
      if (!auth?.session) {
        err.textContent = getLang() === 'fr'
          ? 'CONFIRMEZ VOTRE EMAIL AVANT DE JOUER'
          : 'CONFIRM YOUR EMAIL BEFORE PLAYING';
        return;
      }
    } catch (authErr) {
      err.textContent = authErr?.message || (getLang() === 'fr' ? 'COMPTE IMPOSSIBLE A CREER' : 'ACCOUNT CREATION FAILED');
      return;
    }

    await claimSessionOrBlock();

    G.playerName          = name;
    G.pilotNameChosen     = true;
    G.playerEmail         = email;
    G.playerAge           = age;
    G.playerGrade         = grade;
    G.playerRegistered    = true;

    saveAll();
    loadSave();
    await pushCloudSave({ authType: 'email' });

    sendNewPlayerNotification({ playerName: name, playerEmail: email, playerGrade: grade });

    renderMenu();
    showScreen('s-menu');
    SFX.playMusic('menu');
    const _daily = checkDailyLogin();
    if (_daily.isNewDay) {
      setTimeout(() => showDailyReward(_daily.reward, _daily.streak), 600);
    }
    setTimeout(() => showFeedbackPopup(), 1500);
  });
}

// ── FEEDBACK POPUP ────────────────────────────────────────────────────────────
let _fbRating = 0;

function initFeedback() {
  const stars = document.querySelectorAll('.fb-star');

  function highlight(n) {
    stars.forEach(s => s.classList.toggle('fb-star-on', Number(s.dataset.v) <= n));
  }

  stars.forEach(s => {
    s.addEventListener('mouseover', () => highlight(Number(s.dataset.v)));
    s.addEventListener('mouseout',  () => highlight(_fbRating));
    s.addEventListener('click',     () => { _fbRating = Number(s.dataset.v); highlight(_fbRating); });
  });

  document.getElementById('btn-feedback-submit').addEventListener('click', async () => {
    const errEl = document.getElementById('feedback-error');
    if (!_fbRating) { errEl.textContent = t('feedbackErrRating'); return; }
    errEl.textContent = '';

    // Already sent today — show thanks without re-sending
    if (!canSendFeedback()) {
      document.getElementById('feedback-btns').classList.add('hidden');
      document.getElementById('feedback-comment').classList.add('hidden');
      const thanksEl = document.getElementById('feedback-thanks');
      thanksEl.innerHTML = t('feedbackThanks').replace('\n', '<br>');
      thanksEl.classList.remove('hidden');
      setTimeout(() => document.getElementById('feedback-overlay').classList.add('hidden'), 3000);
      return;
    }

    const btn = document.getElementById('btn-feedback-submit');
    btn.disabled = true;
    btn.textContent = t('feedbackSending');
    try {
      await sendFeedback({
        playerName:  G.playerName,
        playerEmail: G.playerEmail,
        grade:       G.playerGrade,
        rating:      _fbRating,
        comment:     document.getElementById('feedback-comment').value.trim(),
        level:       G.highestLevel,
        xp:          G.xp,
        aircraft:    G.unlockedAircraft,
        playtime:    _playtimeStr(),
      });
      markFeedbackSent();
      document.getElementById('feedback-btns').classList.add('hidden');
      document.getElementById('feedback-comment').classList.add('hidden');
      const thanksEl = document.getElementById('feedback-thanks');
      thanksEl.innerHTML = t('feedbackThanks').replace('\n', '<br>');
      thanksEl.classList.remove('hidden');
      setTimeout(() => {
        document.getElementById('feedback-overlay').classList.add('hidden');
      }, 3000);
    } catch (err) {
      console.error('[Feedback] Send failed:', err);
      errEl.textContent = t('feedbackErrConn');
      btn.disabled = false;
      btn.textContent = t('feedbackSubmit');
    }
  });

  document.getElementById('btn-feedback-skip').addEventListener('click', () => {
    document.getElementById('feedback-overlay').classList.add('hidden');
  });
}

function showFeedbackPopup() {
  _fbRating = 0;
  document.querySelectorAll('.fb-star').forEach(s => s.classList.remove('fb-star-on'));
  document.getElementById('feedback-comment').value    = '';
  document.getElementById('feedback-error').textContent = '';
  document.getElementById('feedback-thanks').classList.add('hidden');
  document.getElementById('feedback-btns').classList.remove('hidden');
  document.getElementById('feedback-comment').classList.remove('hidden');
  const btn = document.getElementById('btn-feedback-submit');
  btn.disabled    = false;
  btn.textContent = '▶ SEND FEEDBACK';
  document.getElementById('feedback-overlay').classList.remove('hidden');
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
applyDeviceClasses();
window.addEventListener('resize', applyDeviceClasses);
window.addEventListener('orientationchange', applyDeviceClasses);
window.visualViewport?.addEventListener('resize', applyDeviceClasses);
window.visualViewport?.addEventListener('scroll', applyDeviceClasses);
// Keyboard closed: measure the screen again (skipped while typing).
document.addEventListener('focusout', () => setTimeout(applyDeviceClasses, 350));
// Keyboard opened: keep the field being typed in visible above it.
function _keepFocusedFieldVisible() {
  const el = document.activeElement;
  if (!el || !/^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
}
window.visualViewport?.addEventListener('resize', _keepFocusedFieldVisible);
window.addEventListener('resize', _keepFocusedFieldVisible);
injectVercelInsights();
loadSave();
loadSettings();
// Players whose questionnaire turned on the old training rounds (before the
// beginner practice existed) were stuck in training on real levels: turn it
// off. A placement chosen on purpose in the equation settings is kept.
if (G.tutorialMode && G.onboardingStartMode !== 'placement') {
  G.tutorialMode = false;
  G.tutorialCompleted = true;
  G.tutorialProgress = null;
  save('tutorialMode', false);
  save('tutorialCompleted', true);
  save('tutorialProgress', null);
}
preloadShips(G.activeAircraft);

// A page load that opens on the lobby shows the 7-day rewards only when a
// reward is ready to unlock (signed in, tutorial done, 24 h since the last
// claim). Nothing pops up while waiting, once all 7 days are done, or for
// players without an account.
// Local test only: http://localhost:5173/?daily (or ?daily=3 for day 3)
// always shows it, view-only, without granting anything.
function showDailyRewardOnPageLoad() {
  if (document.getElementById('s-menu')?.classList.contains('hidden')) return;
  if (document.getElementById('onboarding-overlay') || document.getElementById('np-intro')) return;
  const dailyTest = import.meta.env?.DEV ? new URLSearchParams(location.search).get('daily') : null;
  if (dailyTest !== null) {
    const day = Math.max(1, Math.min(7, Number(dailyTest) || G.dailyStreak || 1));
    showDailyReward(LOGIN_REWARDS[day - 1], day, null, true, day < 7 ? Date.now() + DAILY_INTERVAL_MS : 0);
    return;
  }
  const daily = checkDailyLogin();
  if (daily.isNewDay) showDailyReward(daily.reward, daily.streak);
}

// The yellow T-6 intro opens JexonGo every time. New players (onboarding
// never done) go on into the onboarding questions, then the first level;
// everyone else sees it fade into the lobby. No button to tap: audio starts
// on the player's first touch (sound.js resumes it on pointerdown).
// Local test only: http://localhost:5173/?intro plays the new-player version.
const forceNewPlayerIntro = import.meta.env?.DEV && new URLSearchParams(location.search).has('intro');
const knownAccount = G.playerRegistered && G.playerGrade;   // returning account on a new device
if (forceNewPlayerIntro || (!knownAccount && !(G.hasSeenOnboarding || load('hasSeenOnboarding', false)))) {
  startNewPlayerAnimation();
} else {
  playNewPlayerIntro(() => setTimeout(showDailyRewardOnPageLoad, 600), { leave: true });
}
// Local test only: http://localhost:5173/?coop=bot starts level 1 with a bot
// teammate (same as MULTI -> WITH A BOT).
if (import.meta.env?.DEV && new URLSearchParams(location.search).get('coop') === 'bot') {
  setTimeout(() => {
    G.coopSession = { mode: 'bot', partnerName: 'BOT', partnerAircraft: G.botUpgrades?.aircraft || 't6' };
    nav.toGame(G.currentLevel || 1);
  }, 800);
}

// Local test only: http://localhost:5173/?connect shows the Google sign-in
// invitation of the end of the beginner practice.
if (import.meta.env?.DEV && new URLSearchParams(location.search).has('connect')) {
  setTimeout(openConnectPrompt, 600);
}

// The intro has taken over the page: let the rest show normally again.
document.documentElement.classList.remove('np-boot');

function _forceSignOutBlocked(message = sessionBlockedMessage()) {
  _showLoginToast(message, 4000);
  signOutSupabase().catch(() => {}).then(() => {
    G.playerRegistered = false;
    G.playerEmail = '';
    G.playerPhoto = '';
    G.playerName = 'PILOT';
    // Back to the lobby after the reload (not the new-player intro).
    clearAccountData();
    setTimeout(() => location.reload(), 4000);
  });
}

if (G.playerRegistered && G.playerEmail) {
  // Read the account while the session is claimed (both at once), then show
  // its coins / EXP in the lobby right away.
  const remoteSave = fetchCloudSave(G.playerEmail, '', G.playerAuthType || 'supabase');
  claimSessionOrBlock().then(async ({ blocked }) => {
    const tookOver = blocked;
    // Another device has the account: continue here, or sign out here.
    if (blocked) {
      while (document.getElementById('np-intro')) await new Promise(r => setTimeout(r, 300));
      if (await askTakeover()) ({ blocked } = await claimSessionOrBlock({ takeover: true }));
    }
    if (blocked) { _forceSignOutBlocked(); return; }
    return syncAccountFromCloud({ remote: tookOver ? null : remoteSave, onApplied: () => renderMenu() }).then(async sync => {
      // Google players from before the nickname existed still show their
      // real first name: ask them once for a pilot name.
      if (G.playerAuthType === 'google' && !G.pilotNameChosen) {
        // Let the yellow intro finish first.
        while (document.getElementById('np-intro')) await new Promise(r => setTimeout(r, 300));
        await askPilotName([G.playerName, G.playerEmail.split('@')[0]]);
      }
      if (sync?.merged) renderMenu();
      else if (sync?.forbidden) {
        // The account's sign-in expired (or was ended): progress stays on
        // this device and merges with the account when signing in again.
        while (document.getElementById('np-intro')) await new Promise(r => setTimeout(r, 300));
        _showLoginToast(getLang() === 'fr'
          ? 'Ta connexion a expiré. Reconnecte-toi pour retrouver ta progression du compte.'
          : 'Your sign-in expired. Sign in again to get your account progress back.', 4200);
        if (G.playerAuthType === 'google') setTimeout(openConnectPrompt, 1200);
      }
      else if (sync?.offline && window._showToast) {
        window._showToast(t('syncOffline') || 'Account connected - progress saves on this device.');
      }
    });
  }).catch(() => {});
}

// Another device took this account over: sign out here (the progress is
// in the cloud save, which that device loaded).
onSessionLost(() => _forceSignOutBlocked(sessionLostMessage()));

// Auto-save every 30 seconds for registered players
setInterval(() => { if (G.playerRegistered) saveAll(); }, 30000);

// Track play minutes for any time spent in the app (lobby, hangar, shop,
// training, levels, etc.) - not just while a level is actually running.
setInterval(() => {
  if (document.hidden) return;
  recordPlayMinute(1);
}, 60000);

// Save when tab closes
window.addEventListener('beforeunload', () => {
  if (G.playerRegistered) {
    saveAll();
    flushCloudSave();
  }
});

async function startAudioSplash() {
  if (_audioSplashStarted) return;
  _audioSplashStarted = true;
  SFX.unlock();
  SFX.playMusic('menu');
  document.getElementById('audio-splash')?.classList.add('hidden');
  renderMenu();
  showScreen('s-menu');

  const tutorialProgress = load('tutorialProgress', null);
  const tutorialCompleted = !!load('tutorialCompleted', false);
  const tutorialMode = !!load('tutorialMode', false);

  const continueAfterOpeningAnimation = () => {
    if (G.hasSeenOnboarding || load('hasSeenOnboarding', false)) {
      nav.toMenu();
      return;
    }

    startNewPlayerAnimation();
  };

  if (tutorialCompleted && tutorialProgress?.active) {
    G.tutorialMode = false;
    G.tutorialProgress = null;
    save('tutorialMode', false);
    save('tutorialProgress', null);
  } else if (tutorialMode && tutorialProgress?.active) {
    G.tutorialMode = true;
    G.tutorialProgress = tutorialProgress;
    G.currentLevel = tutorialProgress.currentLevel || G.currentLevel || 1;
    playWorldCupIntro(() => nav.toGame(G.currentLevel || 1));
    return;
  }

  playWorldCupIntro(continueAfterOpeningAnimation);
}

document.getElementById('btn-audio-start')?.addEventListener('click', startAudioSplash);
document.getElementById('audio-splash')?.addEventListener('click', startAudioSplash);
