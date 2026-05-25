import { G, loadSave, saveAll } from './state.js';
import { save, load } from './utils/storage.js';
import { showScreen } from './utils/dom.js';
import { SFX } from './audio/sound.js';
import { initMenu, renderMenu } from './screens/menu.js';
import { initLevelMap, renderLevelMap } from './screens/levelmap.js';
import { initHangar, renderHangar } from './screens/hangar.js';
import { initGame } from './screens/game.js';
import { initResult, showResult } from './screens/result.js';
import { initChest, showChest, setChestReturn } from './screens/chest.js';
import { initGameover, showGameover } from './screens/gameover.js';
import { initShop, renderShop } from './screens/shop.js';
import { initSettings, loadSettings } from './screens/settings.js';
import { initProfile, renderProfile } from './screens/profile.js';
import { initRanked, renderRankedLobby } from './screens/ranked.js';
import { initBriefing, showBriefing } from './screens/briefing.js';
import { initClassroom, renderClassroom } from './screens/classroom.js';
import { initArena, enterArena } from './screens/arena.js';
import { preloadShips } from './game/sprites.js';
import { checkDailyLogin } from './systems/daily.js';
import { showDailyReward } from './screens/menu.js';
import { canSendFeedback, markFeedbackSent, sendFeedback, sendNewPlayerNotification, _resetNewPlayer, _testEmailNow } from './systems/feedback.js';
import { t, getLang, applyI18n } from './i18n.js';
import { syncAccountFromCloud, flushCloudSave, pushCloudSave } from './systems/cloud-save.js';

// ── VIDEO BACKGROUND ─────────────────────────────────────────────────────────
const _menuVideo  = document.getElementById('menu-bg-video');
const _isMobileUA = /iPhone|iPad|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

// Video plays on all devices including mobile

function _videoPause() {
  if (_menuVideo && !_menuVideo.paused) _menuVideo.pause();
}
function _videoResume() {
  if (_menuVideo) _menuVideo.play().catch(() => {});
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
      if (won) {
        showResult(true);
        showScreen('s-result');
        SFX.stopMusic();
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
  toClassroom() {
    cleanup();
    renderClassroom();
    showScreen('s-classroom');
    SFX.playMusic('menu');
  },
  toArena() {
    cleanup();
    showScreen('s-arena');
    enterArena();
  },
  toProfile() {
    cleanup();
    renderProfile();
    showScreen('s-profile');
    SFX.playMusic('menu');
  },
  toGradeSelect() {
    cleanup();
    showScreen('s-grade');
  },
};

function cleanup() {
  _videoPause();
  if (G.animFrame)     { cancelAnimationFrame(G.animFrame); G.animFrame = null; }
  if (G.timerInterval) { clearInterval(G.timerInterval);    G.timerInterval = null; }
  if (_cleanup) { _cleanup(); _cleanup = null; }
}

window._nav = nav;
window._showFeedbackPopup  = () => showFeedbackPopup();
window._resetNewPlayer     = _resetNewPlayer;
window._testEmailNow       = _testEmailNow;

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

    const wasRegistered = G.playerRegistered;
    const hadGrade      = !!load('playerGrade', 0);

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
    await syncAccountFromCloud({ authType: 'google' });

    if (wasRegistered) {
      renderMenu();
      _showLoginToast(t('welcomeBack').replace('{name}', name));
    } else if (!G.playerGrade) {
      nav.toGradeSelect();
    } else {
      if (!hadGrade) {
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
initClassroom(nav);
initArena(nav);
initProfile(nav);
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

  document.getElementById('btn-reg-submit').addEventListener('click', async () => {
    const name  = (document.getElementById('reg-name').value  || '').trim().toUpperCase();
    const email = (document.getElementById('reg-email').value || '').trim().toLowerCase();
    const pw    = (document.getElementById('reg-password').value || '');
    const age   = parseInt(document.getElementById('reg-age').value, 10);
    const grade = parseInt(document.getElementById('reg-grade').value, 10);
    const tos   = document.getElementById('reg-tos').checked;
    const err   = document.getElementById('reg-error');

    if (!name)                          { err.textContent = t('regErrName');     return; }
    if (!email || !email.includes('@')) { err.textContent = t('regErrEmail');    return; }
    if (pw.length < 6)                  { err.textContent = t('regErrPassword'); return; }
    if (!age)                           { err.textContent = t('regErrAge');      return; }
    if (!grade)                         { err.textContent = t('regErrGrade');    return; }
    if (!tos)                           { err.textContent = t('regErrTos');      return; }

    err.textContent       = '';
    G.playerName          = name;
    G.playerEmail         = email;
    G.playerAge           = age;
    G.playerGrade         = grade;
    G.playerRegistered    = true;

    save('playerPassword',   pw);
    saveAll();
    loadSave();
    await pushCloudSave({ authType: 'email', password: pw });

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
      errEl.textContent = err?.message?.includes('not loaded')
        ? '❌ EmailJS not loaded — check CDN'
        : '❌ Send failed — check console';
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
loadSave();
loadSettings();
preloadShips();

if (G.playerRegistered && G.playerEmail) {
  syncAccountFromCloud().then(synced => {
    if (synced) renderMenu();
  }).catch(() => {});
}

// Auto-save every 30 seconds for registered players
setInterval(() => { if (G.playerRegistered) saveAll(); }, 30000);

// Save when tab closes
window.addEventListener('beforeunload', () => {
  if (G.playerRegistered) {
    saveAll();
    flushCloudSave();
  }
});

document.getElementById('btn-audio-start').addEventListener('click', () => {
  SFX.unlock();
  SFX.playMusic('menu');
  document.getElementById('audio-splash').classList.add('hidden');

  if (!G.playerGrade) {
    showScreen('s-grade');
  } else {
    renderMenu();
    showScreen('s-menu');
    const _daily = checkDailyLogin();
    if (_daily.isNewDay) {
      setTimeout(() => showDailyReward(_daily.reward, _daily.streak), 600);
    }
    setTimeout(() => showFeedbackPopup(), 1200);
  }
});

// Patch shop's chest button to return to shop
import('./screens/shop.js').then(() => {
  // shop.js already patches via window._nav.toChest(data, 'shop')
});
