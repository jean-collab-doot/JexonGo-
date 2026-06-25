import { G, loadSave, saveAll } from './state.js';
import { save, load } from './utils/storage.js';
import { showScreen } from './utils/dom.js';
import { SFX } from './audio/sound.js';
import { initMenu, renderMenu } from './screens/menu.js';
import { playWorldCupIntro, stopWorldCupIntro } from './screens/worldcup-intro.js';
import { showOnboarding } from './screens/onboarding.js';
import { initLevelMap, renderLevelMap } from './screens/levelmap.js';
import { initHangar, renderHangar } from './screens/hangar.js';
import { initGame } from './screens/game.js';
import { initResult, showResult } from './screens/result.js';
import { initChest, showChest, setChestReturn } from './screens/chest.js';
import { initGameover, showGameover } from './screens/gameover.js';
import { initShop, renderShop } from './screens/shop.js';
import { initSettings, loadSettings } from './screens/settings.js';
import { initRanked, renderRankedLobby } from './screens/ranked.js';
import { initBriefing, showBriefing } from './screens/briefing.js';
import { initArena, enterArena } from './screens/arena.js';
import { resetIntroBriefing } from './screens/intro-briefing.js';
import { preloadShips } from './game/sprites.js';
import { checkDailyLogin, recordPlayMinute } from './systems/daily.js';
import { showDailyReward } from './screens/menu.js';
import { canSendFeedback, markFeedbackSent, sendFeedback, sendNewPlayerNotification, _resetNewPlayer, _testEmailNow } from './systems/feedback.js';
import { t, getLang, applyI18n } from './i18n.js';
import { syncAccountFromCloud, flushCloudSave, pushCloudSave } from './systems/cloud-save.js';
import { signInWithGoogleIdToken, signUpWithEmail } from './systems/supabase-client.js';
import { applyDeviceClasses } from './utils/device.js';

async function injectVercelInsights() {
  // Keep VS Code / Live Server launches working; Vercel analytics is optional.
  if (!/\.vercel\.app$/i.test(location.hostname)) return;
  try {
    const [{ inject }, { injectSpeedInsights }] = await Promise.all([
      import('@vercel/analytics'),
      import('@vercel/speed-insights'),
    ]);
    inject({ framework: 'vite' });
    injectSpeedInsights({ framework: 'vite' });
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

const nav = {
  toMenu() {
    cleanup();
    renderMenu();
    showScreen('s-menu');
    SFX.playMusic('menu');
    _videoResume();
  },
  toMap() {
    cleanup();
    renderLevelMap();
    showScreen('s-levelmap');
    SFX.playMusic('menu');
  },
  toGame(levelNum, practiceMode = false) {
    cleanup();
    G.practiceMode = practiceMode;
    showScreen('s-game');
    SFX.playMusic('game');
    _cleanup = initGame(levelNum, (won) => {
      cleanup();
      if (won && G.postTutorialConnectPrompt && !G.playerRegistered) {
        showMissionCompleteTransition(() => {
          renderMenu();
          showScreen('s-menu');
          SFX.playMusic('menu');
          const level = G.tutorialPlan?.startLevel || G.currentLevel || 1;
          _showLoginToast(deviceIntroLang() === 'fr'
            ? `La connexion est importante. Connecte-toi avec ton compte JexonGo pour continuer au niveau ${level}.`
            : `Connection is important. Sign in with your JexonGo account to continue at level ${level}.`, 5200);
        });
        return;
      }
      if (won) {
        showMissionCompleteTransition(() => {
          showResult(true);
          showScreen('s-result');
          SFX.stopMusic();
        });
      } else {
        showGameover();
        showScreen('s-gameover');
        SFX.stopMusic();
        SFX.gameOver();
      }
    });
  },
  toHangar() {
    cleanup();
    renderHangar();
    showScreen('s-hangar');
    SFX.playMusic('menu');
  },
  toChest(reward, returnTo = 'map') {
    cleanup();
    setChestReturn(returnTo);
    showChest(reward);
    showScreen('s-chest');
    SFX.playMusic('menu');
  },
  toShop() {
    cleanup();
    renderShop();
    showScreen('s-shop');
    SFX.playMusic('menu');
  },
  toRanked() {
    cleanup();
    renderRankedLobby();
    showScreen('s-ranked');
    SFX.playMusic('menu');
  },
  toBriefing(levelNum) {
    cleanup();
    showBriefing(levelNum);
    showScreen('s-briefing');
    SFX.playMusic('menu');
  },
  toArena() {
    cleanup();
    showScreen('s-arena');
    enterArena();
  },
  toGradeSelect() {
    cleanup();
    showScreen('s-grade');
  },
};

function showMissionCompleteTransition(onDone) {
  document.querySelector('.mission-complete-transition')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'mission-complete-transition mct-win';
  overlay.innerHTML = `
    <div class="mct-panel">
      <span class="mct-kicker">MISSION</span>
      <strong>COMPLETE</strong>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('mct-show'));
  setTimeout(() => overlay.classList.add('mct-leave'), 900);
  setTimeout(() => {
    overlay.remove();
    onDone?.();
  }, 1220);
}

function showAfterIntroPopups() {
  const _daily = checkDailyLogin();
  if (_daily.isNewDay) {
    setTimeout(() => showDailyReward(_daily.reward, _daily.streak), 600);
  }
  setTimeout(() => showFeedbackPopup(), 1200);
}

function deviceIntroLang() {
  return getLang();
}

function showNewPlayerIntroFlow(onDone = null) {
  renderMenu();
  showScreen('s-menu');
  SFX.playMusic('menu');
  playWorldCupIntro(() => {
    showOnboarding(() => {
      save('hasSeenOnboarding', true);
      if (onDone) onDone();
      else nav.toGame(G.currentLevel || 1);
    });
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
  SFX.playMusic('menu');
  showNewPlayerIntroFlow(() => nav.toGame(G.currentLevel || 1));
}
window._restartFullIntro = restartFullIntroFromStart;

function isTextEntryTarget(el) {
  return !!el?.closest?.('input, textarea, select, [contenteditable="true"]');
}

function _showLoginToast(msg, duration = 2800) {
  const el = document.getElementById('login-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('toast-show');
  setTimeout(() => el.classList.remove('toast-show'), duration);
}

window._onGoogleCredential = async function(response) {
  try {
    const raw     = response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(raw));
    const name    = (payload.name  || 'PILOT').toUpperCase().slice(0, 20);
    const email   = (payload.email || '').toLowerCase();
    const photo   = payload.picture || '';

    try {
      await signInWithGoogleIdToken(response.credential);
    } catch (err) {
      console.warn('[Supabase] Google auth failed:', err);
      _showLoginToast(deviceIntroLang() === 'fr'
        ? 'Connexion Google Supabase non configuree.'
        : 'Supabase Google login is not configured.');
      return;
    }

    const wasRegistered = G.playerRegistered;
    const previousEmail = (load('playerEmail', '') || '').toLowerCase();
    const shouldStartRecommended = !!load('postTutorialConnectPrompt', false);
    const recommendedPlan = load('tutorialPlan', null);

    // Always persist identity first so loadSave can read them back
    G.playerName       = name;
    G.playerEmail      = email;
    G.playerPhoto      = photo;
    G.playerRegistered = true;
    save('playerName',       name);
    save('playerEmail',      email);
    save('playerPhoto',      photo);
    save('playerRegistered', true);

    loadSave();
    const sync = await syncAccountFromCloud({ authType: 'google' });
    const shouldNotifyNewGooglePlayer = !sync?.merged && (!wasRegistered || previousEmail !== email);
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
      showNewPlayerIntroFlow(() => nav.toGame(G.currentLevel || 1));
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
initResult(nav);
initChest(nav);
initGameover(nav);
initShop(nav);
initSettings();
initRanked(nav);
initBriefing(nav);
initArena(nav);
initGradeScreen();
initRegistration();
initFeedback();

// ── GLOBAL BUTTON CLICK SOUND ─────────────────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (btn && btn.id !== 'btn-audio-start') SFX.click();
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
  document.getElementById('btn-menu-privacy')?.addEventListener('click', () => {
    showScreen('s-privacy');
  });
  document.getElementById('btn-privacy-back')?.addEventListener('click', () => {
    renderMenu();
    showScreen('s-menu');
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
    const err   = document.getElementById('reg-error');

    if (!name)                          { err.textContent = t('regErrName');     return; }
    if (!email || !email.includes('@')) { err.textContent = t('regErrEmail');    return; }
    if (pw.length < 6)                  { err.textContent = t('regErrPassword'); return; }
    if (pw !== pwConfirm)               { err.textContent = t('regErrPasswordMatch'); return; }
    if (!age)                           { err.textContent = t('regErrAge');      return; }
    if (!grade)                         { err.textContent = t('regErrGrade');    return; }
    if (!tos)                           { err.textContent = t('regErrTos');      return; }
    if (!privacy)                       { err.textContent = t('regErrPrivacy');  return; }

    err.textContent       = '';
    try {
      const auth = await signUpWithEmail(email, pw, {
        player_name: name,
        player_grade: grade,
        player_age: age,
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

    G.playerName          = name;
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
injectVercelInsights();
loadSave();
loadSettings();
preloadShips();

if (G.playerRegistered && G.playerEmail) {
  syncAccountFromCloud().then(sync => {
    if (sync?.merged) renderMenu();
    else if (sync?.offline && window._showToast) {
      window._showToast(t('syncOffline') || 'Account connected - progress saves on this device.');
    }
  }).catch(() => {});
}

// Auto-save every 30 seconds for registered players
setInterval(() => { if (G.playerRegistered) saveAll(); }, 30000);

// Track play minutes only while the player is actively in a game.
setInterval(() => {
  if (document.hidden) return;
  const activeScreen = document.querySelector('.screen:not(.hidden)')?.id;
  if (activeScreen === 's-game') recordPlayMinute(1);
}, 60000);

// Save when tab closes
window.addEventListener('beforeunload', () => {
  if (G.playerRegistered) {
    saveAll();
    flushCloudSave();
  }
});

document.getElementById('btn-audio-start').addEventListener('click', async () => {
  SFX.unlock();
  SFX.playMusic('menu');
  document.getElementById('audio-splash').classList.add('hidden');

  const tutorialProgress = load('tutorialProgress', null);
  const tutorialCompleted = !!load('tutorialCompleted', false);
  const tutorialMode = !!load('tutorialMode', false);
  if (tutorialCompleted && tutorialProgress?.active) {
    G.tutorialMode = false;
    G.tutorialProgress = null;
    save('tutorialMode', false);
    save('tutorialProgress', null);
  } else if (tutorialMode && tutorialProgress?.active) {
    G.tutorialMode = true;
    G.tutorialProgress = tutorialProgress;
    G.currentLevel = tutorialProgress.currentLevel || G.currentLevel || 1;
    nav.toGame(G.currentLevel || 1);
    return;
  }

  if (G.hasSeenOnboarding || load('hasSeenOnboarding', false)) {
    nav.toMenu();
    return;
  }

  showNewPlayerIntroFlow(() => {
    nav.toGame(G.currentLevel || 1);
  });
});

// Patch shop's chest button to return to shop
import('./screens/shop.js').then(() => {
  // shop.js already patches via window._nav.toChest(data, 'shop')
});
