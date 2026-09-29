import { $, showScreen } from '../utils/dom.js';
import { rollChestTier } from '../systems/chest.js';
import { G, loadSave, saveAll, clampCoins, MAX_COINS } from '../state.js';
import { LOGIN_REWARDS, claimDailyReward, getMissions, claimMission,
         hasPendingMissionClaim, getPlayMinuteStats, getMonthlyConfigChallenge } from '../systems/daily.js';
import { clearAll, save, load } from '../utils/storage.js';
import { AIRCRAFT, AIRCRAFT_ORDER } from '../data/aircraft.js';
import { t, getLang, setLang, applyI18n } from '../i18n.js';
import { syncAccountFromCloud, deleteCloudSave, flushCloudSave, fetchCloudSave,
         mergeSaveSnapshots, exportSaveSnapshot, applySaveSnapshot } from '../systems/cloud-save.js';
import { signInWithEmail, signOutSupabase } from '../systems/supabase-client.js';
import { claimSessionOrBlock, releaseSession, sessionBlockedMessage } from '../systems/session-guard.js';
import { SFX } from '../audio/sound.js';
import { coinIcon, expIcon, uiIcon } from '../utils/icons.js';
import { makeBottomSheet } from '../utils/bottomsheet.js';
import { bindHangarTabs, renderHangarPanels, buyAircraftFromLobby, planeCost, meetsGradeRequirement } from './hangar.js';
import { isMultiLobby, openMultiChoices } from './multiplayer.js';
import { refreshBadgeAlerts } from '../data/badges.js';

// ── GOOGLE SIGN-IN ───────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = '182729505930-rulb73m14t9qvfpjfbplknrcgn0fqvci.apps.googleusercontent.com';
let _gsiReady = false;
let _gsiLoadPromise = null;

function _loadGsiScript() {
  if (typeof google !== 'undefined' && google.accounts) return Promise.resolve(true);
  if (_gsiLoadPromise) return _gsiLoadPromise;

  _gsiLoadPromise = new Promise(resolve => {
    const existing = document.querySelector('script[data-jexongo-gsi="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.jexongoGsi = '1';
    script.onload = () => resolve(true);
    script.onerror = () => {
      _gsiLoadPromise = null;
      script.remove();
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return _gsiLoadPromise;
}

async function _ensureGSI() {
  if (_gsiReady) return true;
  const loaded = await _loadGsiScript();
  if (!loaded) return false;
  if (typeof google === 'undefined' || !google.accounts) return false;
  google.accounts.id.initialize({
    client_id:             GOOGLE_CLIENT_ID,
    callback:              cred => { _hideGsiFallback(); window._onGoogleCredential?.(cred); },
    auto_select:           false,
    cancel_on_tap_outside: true,
  });
  _gsiReady = true;
  return true;
}

let _googleLoginPending = false;

async function _handleLogin(provider) {
  if (provider !== 'google') return;
  if (_googleLoginPending) return;
  _googleLoginPending = true;

  if (!(await _ensureGSI())) {
    _showToast(t('googleNotAvail'));
    _googleLoginPending = false;
    return;
  }
  _googleLoginPending = false;
  _showGsiFallback();
}

function _showGsiFallback() {
  let overlay = document.getElementById('gsi-fallback-overlay');
  if (overlay) { overlay.classList.remove('hidden'); return; }

  overlay = document.createElement('div');
  overlay.id = 'gsi-fallback-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;';

  const box = document.createElement('div');
  box.style.cssText = 'background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px 32px;text-align:center;min-width:280px;';

  const title = document.createElement('p');
  title.textContent = t('signInGoogle');
  title.style.cssText = 'color:#fff;font-family:monospace;font-size:13px;letter-spacing:1px;margin:0 0 20px;';
  box.appendChild(title);

  const btnWrap = document.createElement('div');
  btnWrap.style.cssText = 'display:flex;justify-content:center;';
  box.appendChild(btnWrap);

  const cancel = document.createElement('button');
  cancel.textContent = getLang() === 'fr' ? '× ANNULER' : '× CANCEL';
  cancel.style.cssText = 'display:block;margin:18px auto 0;background:none;border:none;color:#64748b;cursor:pointer;font-size:11px;letter-spacing:1px;';
  cancel.onclick = () => overlay.classList.add('hidden');
  box.appendChild(cancel);

  overlay.appendChild(box);
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.add('hidden'); };
  document.body.appendChild(overlay);

  google.accounts.id.renderButton(btnWrap, {
    type: 'standard', size: 'large', text: 'signin_with',
    theme: 'filled_blue', shape: 'pill',
  });
}

function _hideGsiFallback() {
  document.getElementById('gsi-fallback-overlay')?.classList.add('hidden');
}

async function _handleSignOut() {
  await flushCloudSave();
  await releaseSession();
  await signOutSupabase();
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.disableAutoSelect();
  }
  G.playerRegistered = false;
  G.playerEmail = '';
  G.playerPhoto = '';
  G.playerName = 'PILOT';
  const lang = localStorage.getItem('jexongo_lang');
  const settings = localStorage.getItem('jexongo_settings');
  clearAll();
  if (lang) localStorage.setItem('jexongo_lang', lang);
  if (settings) localStorage.setItem('jexongo_settings', settings);
  location.reload();
}

function _setDeleteAccountError(message) {
  const el = document.getElementById('delete-account-error');
  if (el) el.textContent = message || '';
}

function _openDeleteAccountModal() {
  if (!G.playerRegistered) return;
  const modal = document.getElementById('delete-account-modal');
  if (!modal) return;
  const reason = document.getElementById('delete-account-reason');
  const feedback = document.getElementById('delete-account-feedback');
  const understand = document.getElementById('delete-account-understand');
  const confirm = document.getElementById('delete-account-confirm-text');
  if (reason) reason.value = '';
  if (feedback) feedback.value = '';
  if (understand) understand.checked = false;
  if (confirm) confirm.value = '';
  _setDeleteAccountError('');
  modal.classList.remove('hidden');
}

function _closeDeleteAccountModal() {
  document.getElementById('delete-account-modal')?.classList.add('hidden');
}

async function _finishLocalAccountDeletion() {
  await signOutSupabase().catch(() => {});
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.disableAutoSelect();
  }
  G.playerRegistered = false;
  G.playerEmail = '';
  G.playerPhoto = '';
  G.playerName = 'PILOT';
  G.xp = 0;
  G.coins = 0;
  G.highestLevel = 0;
  G.levelStars = {};
  const lang = localStorage.getItem('jexongo_lang');
  clearAll();
  if (lang) localStorage.setItem('jexongo_lang', lang);
  location.reload();
}

async function _confirmDeleteAccount() {
  const reason = document.getElementById('delete-account-reason')?.value || '';
  const feedback = document.getElementById('delete-account-feedback')?.value.trim() || '';
  const understand = !!document.getElementById('delete-account-understand')?.checked;
  const confirmText = (document.getElementById('delete-account-confirm-text')?.value || '').trim().toUpperCase();
  const btn = document.getElementById('btn-delete-account-confirm');

  if (!reason) return _setDeleteAccountError(t('deleteAccountMissingReason'));
  if (!understand) return _setDeleteAccountError(t('deleteAccountNeedConfirm'));
  if (confirmText !== 'DELETE') return _setDeleteAccountError(t('deleteAccountTypeError'));

  _setDeleteAccountError('');
  if (btn) {
    btn.disabled = true;
    btn.textContent = t('deleteAccountDeleting');
  }

  const result = await deleteCloudSave({
    reason,
    feedback,
    playerName: G.playerName || '',
    playerEmail: G.playerEmail || '',
    at: new Date().toISOString(),
  });

  if (!result?.ok) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = t('deleteAccountConfirm');
    }
    if (result?.forbidden) {
      await _finishLocalAccountDeletion();
      return;
    }
    if (/row-level security|permission|policy|violates/i.test(result?.error || '')) {
      return _setDeleteAccountError(t('deleteAccountDbPolicy'));
    }
    return _setDeleteAccountError(t('deleteAccountFailed'));
  }

  await _finishLocalAccountDeletion();
}

function _openLoginOverlay() {
  const modal = document.getElementById('login-modal');
  if (!modal) return;
  document.getElementById('login-modal-email').value    = '';
  document.getElementById('login-modal-password').value = '';
  document.getElementById('login-modal-error').textContent = '';
  modal.classList.remove('hidden');
  document.getElementById('login-modal-email').focus();
}

function _closeLoginOverlay() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.add('hidden');
}

async function _handleLoginSubmit() {
  const emailIn = document.getElementById('login-modal-email').value.trim().toLowerCase();
  const pwIn    = document.getElementById('login-modal-password').value;
  const errEl   = document.getElementById('login-modal-error');

  if (!emailIn || !emailIn.includes('@')) { errEl.textContent = t('loginErrEmail'); return; }
  if (!pwIn)                              { errEl.textContent = t('loginErrPw');    return; }

  try {
    await signInWithEmail(emailIn, pwIn);
  } catch (_) {
    errEl.textContent = t('loginErrWrong');
    return;
  }

  const { blocked } = await claimSessionOrBlock();
  if (blocked) {
    await signOutSupabase().catch(() => {});
    errEl.textContent = sessionBlockedMessage();
    return;
  }

  const remote = await fetchCloudSave(emailIn, '', 'email');

  if (remote?.forbidden) { errEl.textContent = t('loginErrWrong'); return; }

  if (remote?.offline) {
    const storedEmail = (load('playerEmail', '') || '').toLowerCase();
    if (!storedEmail)                                  { errEl.textContent = t('loginErrNone');  return; }
    if (emailIn !== storedEmail)                       { errEl.textContent = t('loginErrWrong'); return; }
  } else if (remote?.notFound) {
    errEl.textContent = t('loginErrNone');
    return;
  }

  _closeLoginOverlay();
  G.playerRegistered = true;
  G.playerEmail      = emailIn;
  G.playerAuthType   = 'email';
  save('playerRegistered', true);
  save('playerEmail',      emailIn);
  save('playerAuthType',   'email');
  loadSave();
  if (remote?.data) {
    applySaveSnapshot(mergeSaveSnapshots(exportSaveSnapshot(), remote.data));
    saveAll();
  }
  const sync = await syncAccountFromCloud({ authType: 'email' });
  if (sync.offline) _showToast(t('syncOffline') || 'Account connected - progress saves on this device.');
  renderMenu();
  _showToast(t('welcomeBack').replace('{name}', G.playerName || 'PILOT'));
}

// ── TOAST ────────────────────────────────────────────────────────────────────
let _toastTimer = null;
function _showToast(msg) {
  const el = document.getElementById('login-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('toast-show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('toast-show'), 2200);
}
window._showToast = _showToast;

// ── LANGUAGE ─────────────────────────────────────────────────────────────────
function _applyLang() {
  applyI18n();
}

// ── LOBBY: HANGAR DOOR OPENING ANIMATION ────────────────────────────────────
// Plays frames 1-19 of the hangar door rolling open (frame 20 exists on disk
// but is deliberately unused - the door is held open at frame 19 instead),
// shown once when the game first loads, then held on frame 19 — same
// resting shot the background used to be permanently. Replays whenever the
// player switches plane. All 19 are preloaded so the swap never stalls
// waiting on the network.
const HANGAR_DOOR_FRAME_COUNT = 19;
const HANGAR_DOOR_FRAMES = Array.from({ length: HANGAR_DOOR_FRAME_COUNT }, (_, i) =>
  `/assets/hangar/hangar-door/frame-${String(i + 1).padStart(2, '0')}.webp`);
const HANGAR_DOOR_FRAME_MS = 45; // 20 frames × 45ms ≈ same ~900ms total as the original 10-frame spec
let _hangarDoorPreloaded = false;
let _hangarDoorTimer = null;
let _hangarDoorPlayedOnBoot = false;

function _preloadHangarDoorFrames() {
  if (_hangarDoorPreloaded) return;
  _hangarDoorPreloaded = true;
  HANGAR_DOOR_FRAMES.forEach(src => { const img = new Image(); img.src = src; });
}

export function playHangarDoorAnimation() {
  const bg = $('menu-hangar-bg');
  if (!bg) return;
  _preloadHangarDoorFrames();
  if (_hangarDoorTimer) { clearInterval(_hangarDoorTimer); _hangarDoorTimer = null; }
  let i = 0;
  bg.src = HANGAR_DOOR_FRAMES[0];
  _hangarDoorTimer = setInterval(() => {
    i++;
    if (i >= HANGAR_DOOR_FRAME_COUNT) {
      bg.src = HANGAR_DOOR_FRAMES[HANGAR_DOOR_FRAME_COUNT - 1];
      clearInterval(_hangarDoorTimer);
      _hangarDoorTimer = null;
      return;
    }
    bg.src = HANGAR_DOOR_FRAMES[i];
  }, HANGAR_DOOR_FRAME_MS);
}

// ── LOBBY: PLANE SHOWCASE + CYCLE ───────────────────────────────────────────
export function updateSelectedPlaneShowcase(imgEl, nameEl) {
  const aircraftId = G.activeAircraft || 't6';
  const aircraft = AIRCRAFT[aircraftId] || AIRCRAFT.t6;
  if (imgEl) {
    imgEl.src = `/assets/hangar/${aircraftId}.webp`;
    imgEl.style.filter = '';
    imgEl.dataset.plane = aircraftId; // lets CSS give specific planes (e.g. the C-130) a bigger showcase size
  }
  if (nameEl) nameEl.textContent = aircraft.name.toUpperCase();
}

// Lobby ◀︎ ▶︎: every plane (the secret F-117 only once owned). An owned plane
// becomes the active one; a plane not owned yet is only shown (grey), with a
// button under it to buy it. The game always uses G.activeAircraft.
let _lobbyPreview = null;

function lobbyPlanes() {
  return AIRCRAFT_ORDER.filter(id => AIRCRAFT[id] && (!AIRCRAFT[id].secret || G.unlockedAircraft.includes(id)));
}

function renderLobbyPlane() {
  const img = $('menu-selected-plane');
  const btn = $('btn-lobby-plane-buy');
  if (_lobbyPreview && G.unlockedAircraft.includes(_lobbyPreview)) _lobbyPreview = null;
  const id = _lobbyPreview || G.activeAircraft || 't6';
  if (img) {
    img.src = `/assets/hangar/${id}.webp`;
    img.dataset.plane = id;
    img.classList.toggle('is-locked', !!_lobbyPreview);
  }
  if (!btn) return;
  btn.classList.toggle('hidden', !_lobbyPreview);
  if (!_lobbyPreview) return;
  const plane = AIRCRAFT[id];
  const fr = getLang() === 'fr';
  const gradeOk = meetsGradeRequirement(plane);
  const cost = planeCost(plane);
  btn.innerHTML = `<span>${plane.name.toUpperCase()}</span><b>${gradeOk
    ? `${cost.toLocaleString()} XP`
    : (fr ? `NIVEAU ${plane.gradeRequired} REQUIS` : `LEVEL ${plane.gradeRequired} REQUIRED`)}</b>`;
  btn.classList.toggle('is-disabled', !gradeOk || (G.xp || 0) < cost);
}

function buyLobbyPreview() {
  const id = _lobbyPreview;
  if (!id) return;
  const fr = getLang() === 'fr';
  const result = buyAircraftFromLobby(id);
  if (result === 'bought') {
    G.activeAircraft = id;
    save('activeAircraft', id);
    _lobbyPreview = null;
    renderMenu();
    playHangarDoorAnimation();
    return;
  }
  SFX.noMoney();
  const plane = AIRCRAFT[id];
  _showToast(result === 'grade'
    ? (fr ? `Atteins le niveau ${plane.gradeRequired} pour débloquer ${plane.name}.` : `Reach level ${plane.gradeRequired} to unlock ${plane.name}.`)
    : (fr ? `Il te manque ${(planeCost(plane) - (G.xp || 0)).toLocaleString()} XP.` : `You need ${(planeCost(plane) - (G.xp || 0)).toLocaleString()} more XP.`));
}

// Moves to the previous/next plane, wrapping around. { ownedOnly: true } (the
// training screen) keeps to the planes the player owns.
export function cyclePlane(dir, { ownedOnly = false } = {}) {
  if (!ownedOnly) {
    const list = lobbyPlanes();
    const cur = list.indexOf(_lobbyPreview || G.activeAircraft);
    const next = list[((cur === -1 ? 0 : cur) + dir + list.length) % list.length];
    if (G.unlockedAircraft.includes(next)) {
      G.activeAircraft = next;
      save('activeAircraft', next);
      _lobbyPreview = null;
    } else {
      _lobbyPreview = next;
    }
    renderLobbyPlane();
    updateSelectedPlaneShowcase($('training-selected-plane'), null);
    playHangarDoorAnimation();
    return;
  }
  const unlocked = AIRCRAFT_ORDER.filter(id => G.unlockedAircraft.includes(id));
  if (unlocked.length < 2) return;
  const curIdx = unlocked.indexOf(G.activeAircraft);
  const nextIdx = ((curIdx === -1 ? 0 : curIdx) + dir + unlocked.length) % unlocked.length;
  G.activeAircraft = unlocked[nextIdx];
  save('activeAircraft', G.activeAircraft);
  updateSelectedPlaneShowcase($('menu-selected-plane'), null);
  updateSelectedPlaneShowcase($('training-selected-plane'), null);
  playHangarDoorAnimation();
}

// ── DEV CHEATS ───────────────────────────────────────────────────────────────
function _grantDevCoins(amount = MAX_COINS) {
  G.coins = clampCoins((G.coins || 0) + amount);
  save('coins', G.coins);
  saveAll();
  _showToast(`+${amount.toLocaleString()} coins`);
  renderMenu();
}
function _openResetConfirm() { document.getElementById('reset-modal')?.classList.remove('hidden'); }
function _closeResetModal()  { document.getElementById('reset-modal')?.classList.add('hidden'); }
function _doReset() {
  _closeResetModal();
  G.highestLevel = 0; G.levelStars = {}; G.xp = 0; G.coins = 0; G.totalXpEarned = 0;
  save('highestLevel', 0); save('levelStars', {}); save('xp', 0);
  save('coins', 0); save('totalXpEarned', 0);
  // Shop / hangar purchases too: missiles, shot types, upgrades.
  G.ownedMissileTypes = []; G.activeMissileType = 'default';
  G.ownedShootingPlans = ['default']; G.activeShootingPlan = 'default';
  G.planeUpgrades = {};
  save('ownedMissileTypes', []); save('activeMissileType', 'default');
  save('ownedShootingPlans', ['default']); save('activeShootingPlan', 'default');
  save('planeUpgrades', {});
  saveAll();
  _showToast('Game reset');
  renderMenu();
}

// ── PUBLIC API ───────────────────────────────────────────────────────────────
export function initMenu(nav) {
  window._jexongoNav = nav;

  $('btn-play').onclick = () => {
    // Leave with the active plane on show, not a grey one being looked at.
    if (_lobbyPreview) { _lobbyPreview = null; renderLobbyPlane(); }
    if (isMultiLobby()) openMultiChoices(); else nav.toMap();
  };
  $('btn-lobby-plane-buy')?.addEventListener('click', buyLobbyPreview);

  // Carousel arrows: ‹ opens the Mission page, › goes to the Shop
  $('btn-jx-nav-prev')?.addEventListener('click', openMissionsPanel);
  $('btn-jx-nav-next')?.addEventListener('click', () => nav.toShop('next'));

  // Bottom sheet → pull-up hangar drawer (drag the grip up to see it)
  const lobbySheet = $('lobby-sheet');
  if (lobbySheet) {
    bindHangarTabs('#lobby-sheet');
    makeBottomSheet(lobbySheet, { onOpen: () => renderHangarPanels() });
  }

  // Plane cycle
  $('btn-lobby-plane-prev')?.addEventListener('click', () => cyclePlane(-1));
  $('btn-lobby-plane-next')?.addEventListener('click', () => cyclePlane(1));

  // Mission panel: back arrow leaves the whole panel; tapping the war-room
  // scene itself (not the tablet or the mission popup) also leaves it; the
  // tablet pops the mission list up, and its own X / tapping outside the
  // popup card closes just that popup, back to the room.
  $('btn-missions-close')?.addEventListener('click', closeMissionsPanel);
  $('missions-panel')?.addEventListener('click', e => {
    if (e.target.closest('.jx-scroll') || e.target.closest('#missions-scroll-backdrop') || e.target.closest('#btn-missions-tablet')) return;
    closeMissionsPanel();
  });
  $('btn-missions-tablet')?.addEventListener('click', openMissionsScroll);
  $('btn-missions-scroll-close')?.addEventListener('click', closeMissionsScroll);
  $('missions-scroll-backdrop')?.addEventListener('click', e => {
    if (e.target === $('missions-scroll-backdrop')) closeMissionsScroll();
  });

  // Day/play-time tab in the lobby corner → full weekly tracker popup.
  document.querySelector('.jx-daytab')?.addEventListener('click', openWeekTracker);
  $('btn-week-close')?.addEventListener('click', closeWeekTracker);
  $('week-overlay')?.addEventListener('click', e => {
    if (e.target === $('week-overlay')) closeWeekTracker();
  });

  // Hamburger → settings drawer is wired in settings.js.

  // Drawer profile / account
  document.getElementById('btn-login-google')?.addEventListener('click', () => _handleLogin('google'));
  document.getElementById('btn-google-signout')?.addEventListener('click', _handleSignOut);
  document.getElementById('btn-menu-delete-account')?.addEventListener('click', e => {
    e.stopPropagation();
    _openDeleteAccountModal();
  });

  // Login / delete-account modals (kept from the old flow)
  document.getElementById('btn-login-modal-close')?.addEventListener('click', _closeLoginOverlay);
  document.getElementById('login-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('login-modal')) _closeLoginOverlay();
  });
  document.getElementById('btn-login-modal-submit')?.addEventListener('click', _handleLoginSubmit);
  document.getElementById('login-modal-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') _handleLoginSubmit();
  });
  function _makePwToggle(btnId, inputId) {
    const btn   = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type  = show ? 'text' : 'password';
      btn.innerHTML = uiIcon(show ? 'eyeOff' : 'eye');
    });
  }
  _makePwToggle('btn-login-pw-toggle', 'login-modal-password');
  _makePwToggle('btn-reg-pw-toggle',   'reg-password');
  _makePwToggle('btn-reg-confirm-pw-toggle', 'reg-password-confirm');

  document.getElementById('btn-delete-account-cancel')?.addEventListener('click', _closeDeleteAccountModal);
  document.getElementById('btn-delete-account-confirm')?.addEventListener('click', _confirmDeleteAccount);
  document.getElementById('delete-account-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('delete-account-modal')) _closeDeleteAccountModal();
  });

  document.getElementById('btn-reset-confirm')?.addEventListener('click', _doReset);
  document.getElementById('btn-reset-cancel')?.addEventListener('click', _closeResetModal);
  document.getElementById('reset-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('reset-modal')) _closeResetModal();
  });

  applyI18n();

  // ── CHEAT CODES (keyboard only, all keys within 600ms) ──────────────────────
  // Local dev server only (`npm run dev`): never in the published game.
  // P+0+L reset · P+1+L next level · P+2+5 all levels · B+H+Q+A coins.
  const _ct = new Map();
  function _held(...keys) {
    const now = Date.now();
    return keys.every(k => _ct.has(k) && now - _ct.get(k) < 600);
  }
  function _clearKeys(...keys) { keys.forEach(k => _ct.delete(k)); }

  if (import.meta.env?.DEV) document.addEventListener('keydown', e => {
    const k = String(e.key || '').toLowerCase();
    if (!k) return;
    _ct.set(k, Date.now());

    if (_held('p', '0', 'l')) { _clearKeys('p', '0', 'l'); _openResetConfirm(); }
    if (_held('p', '1', 'l')) {
      _clearKeys('p', '1', 'l');
      G.highestLevel = Math.min((G.highestLevel || 0) + 1, 50);
      save('highestLevel', G.highestLevel);
      _showToast('Level → ' + G.highestLevel);
      renderMenu();
    }
    if (_held('p', '2', '5')) {
      _clearKeys('p', '2', '5');
      G.highestLevel = 50;
      save('highestLevel', 50);
      _showToast('All 50 levels unlocked');
      renderMenu();
    }
    if (_held('b', 'h', 'q', 'a')) { _clearKeys('b', 'h', 'q', 'a'); _grantDevCoins(); }
  });
}

export function renderMenu() {
  _updateLobbyHud();
  _updateMissionsBadge();
  refreshBadgeAlerts();
  _updateFeatureLocks();
  _applyLang();
  const sheet = $('lobby-sheet');
  if (sheet) { sheet.style.transform = ''; sheet.classList.add('is-collapsed'); sheet.classList.remove('is-open'); }
  // Door-opening animation plays once per app launch — the first time the
  // lobby is ever shown, whichever flow gets there first (returning player,
  // new player, tutorial, etc.). Later returns to the lobby just keep
  // showing frame 10, already left in place by that first run.
  if (!_hangarDoorPlayedOnBoot) {
    _hangarDoorPlayedOnBoot = true;
    playHangarDoorAnimation();
  }
}

function _updateLobbyHud() {
  const coinsEl = $('menu-hud-coins');
  const xpEl = $('menu-hud-xp');
  if (coinsEl) coinsEl.textContent = (G.coins || 0).toLocaleString();
  if (xpEl) xpEl.textContent = (G.xp || 0).toLocaleString();

  renderLobbyPlane();

  // Day / play-time tab — always visible, even at 0 minutes today; its blue
  // half fills up (0% empty → 100% at the daily goal) as minutes are logged.
  const dayTab = document.querySelector('.jx-daytab');
  const minEl = $('menu-daytab-min');
  const fillEl = $('menu-daytab-fill');
  const stats = getPlayMinuteStats(getLang());
  const todayStats = stats.days.find(d => d.isToday);
  const today = todayStats?.minutes || 0;
  if (dayTab) dayTab.hidden = false;
  if (minEl) minEl.textContent = `${today} MIN`;
  if (fillEl) fillEl.style.height = `${todayStats?.pct || 0}%`;
}

// MULTI opens once level 3 is completed, the TOP 20 once level 5 is (same
// rule as the planes' "LEVEL N REQUIRED": G.highestLevel = last level won).
// Before that the button is greyed with a padlock and a tap explains why.
export const MULTI_UNLOCK_LEVEL = 3;
export const TOP20_UNLOCK_LEVEL = 5;
const FEATURE_LOCKS = [
  { id: 'btn-lobby-multi', level: MULTI_UNLOCK_LEVEL, fr: 'Le multijoueur se débloque au niveau', en: 'Multiplayer unlocks at level' },
  { id: 'btn-lobby-top20', level: TOP20_UNLOCK_LEVEL, fr: 'Le TOP 20 se débloque au niveau', en: 'The TOP 20 unlocks at level' },
];

function featureLocked(lock) {
  // Never lock the way back out of MULTI mode (the button then reads SOLO).
  if (lock.id === 'btn-lobby-multi' && isMultiLobby()) return false;
  return (G.highestLevel || 0) < lock.level;
}

function _updateFeatureLocks() {
  const fr = getLang() === 'fr';
  for (const lock of FEATURE_LOCKS) {
    const btn = $(lock.id);
    if (!btn) continue;
    const locked = featureLocked(lock);
    btn.classList.toggle('is-locked', locked);
    btn.querySelector('.jx-lock-tag')?.remove();
    if (locked) {
      const tag = document.createElement('span');
      tag.className = 'jx-lock-tag';
      tag.innerHTML = `${uiIcon('lock')}${fr ? 'NIV' : 'LV'} ${lock.level}`;
      btn.appendChild(tag);
    }
  }
}

// Capture phase: runs before the buttons' own handlers (main.js /
// leaderboard.js) and stops them while the feature is locked.
document.addEventListener('click', e => {
  const btn = e.target.closest?.('#btn-lobby-multi, #btn-lobby-top20');
  if (!btn) return;
  const lock = FEATURE_LOCKS.find(l => l.id === btn.id);
  if (!lock || !featureLocked(lock)) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  SFX.noMoney?.();
  const fr = getLang() === 'fr';
  _showToast(`${fr ? lock.fr : lock.en} ${lock.level}`);
}, true);

function _updateMissionsBadge() {
  // The "!" now rides on the left carousel arrow (which opens the Mission page).
  const btn = document.getElementById('btn-jx-nav-prev');
  if (!btn) return;
  btn.querySelector('.missions-badge')?.remove();
  if (hasPendingMissionClaim()) {
    const badge = document.createElement('span');
    badge.className   = 'missions-badge';
    badge.textContent = '!';
    btn.appendChild(badge);
  }
}

// ── WEEK TRACKER popup (opened by tapping the day/play-time tab) ─────────────
function openWeekTracker() {
  const isFr = getLang() === 'fr';
  const stats = getPlayMinuteStats(getLang());
  const today = stats.days.find(d => d.isToday);

  const subtitle = $('jx-week-subtitle');
  if (subtitle) {
    subtitle.textContent = isFr
      ? `Objectif jour : ${stats.goal} min`
      : `Daily goal: ${stats.goal} min`;
  }
  const badgeValue = $('jx-week-badge-value');
  if (badgeValue) badgeValue.textContent = today?.minutes || 0;

  const row = $('jx-week-row');
  if (row) {
    row.innerHTML = stats.days.map(d => `
      <div class="jx-week-day">
        <div class="jx-week-pill${d.isToday ? ' is-today' : ''}">
          <div class="jx-week-pill-fill" style="height:${d.pct || 0}%"></div>
        </div>
        <span class="jx-week-day-value">${d.minutes}</span>
        <span class="jx-week-day-label">${d.isToday ? (isFr ? 'auj' : 'today') : d.label}</span>
      </div>
    `).join('');
  }

  const challenge = getMonthlyConfigChallenge(getLang());
  const goalTitle = $('jx-week-goal-title');
  if (goalTitle) goalTitle.textContent = challenge.title;
  const goalConfig = $('jx-week-goal-config');
  if (goalConfig) goalConfig.textContent = challenge.config;
  const label = $('jx-week-goal-label');
  if (label) label.textContent = challenge.subtitle;
  const fill = $('jx-week-goal-fill');
  if (fill) fill.style.width = `${challenge.pct || 0}%`;

  $('week-overlay')?.classList.remove('hidden');
}
function closeWeekTracker() { $('week-overlay')?.classList.add('hidden'); }

// ── DRAWER PROFILE (called from settings.js when the drawer opens) ───────────
export function updateDrawerProfile() {
  const loginBtn  = document.getElementById('btn-login-google');
  const nameEl    = document.getElementById('menu-profile-name');
  const signoutEl = document.getElementById('btn-google-signout');
  const deleteEl  = document.getElementById('btn-menu-delete-account');
  const isLoggedIn = !!G.playerRegistered;

  if (loginBtn)  loginBtn.hidden  = isLoggedIn;
  if (signoutEl) signoutEl.hidden = !isLoggedIn;
  if (deleteEl)  deleteEl.hidden  = !isLoggedIn;
  if (nameEl) {
    nameEl.hidden = !isLoggedIn;
    nameEl.textContent = isLoggedIn ? (G.playerName || 'PILOT') : '';
  }
}
export { _handleLogin as handleGoogleLogin };

// ── DAILY REWARD POPUP ───────────────────────────────────────────────────────
// viewOnly: today's reward is already claimed — the calendar is only shown,
// with today ticked, and the button just closes it.
export function showDailyReward(reward, streak, onClaim = null, viewOnly = false, nextAt = 0) {
  const overlay  = $('daily-reward-overlay');
  const daysRow  = $('daily-days-row');
  const showcase = $('daily-reward-showcase');

  $('daily-streak-label').textContent = getLang() === 'fr' ? `JOUR ${streak}` : `DAY ${streak}`;

  daysRow.innerHTML = '';
  LOGIN_REWARDS.forEach((r, i) => {
    const day  = i + 1;
    const card = document.createElement('div');
    card.className = 'daily-day-card';
    if (day < streak || (viewOnly && day === streak)) card.classList.add('ddc-claimed');
    else if (day === streak) card.classList.add('ddc-today');
    else                     card.classList.add('ddc-future');

    card.innerHTML = `
      <span class="ddc-num">D${day}</span>
      <span class="ddc-icon">${r.icon === 'coin' ? coinIcon('jg-coin-icon-small') : r.icon}</span>
      ${day < streak || (viewOnly && day === streak) ? `<span class="ddc-check">${uiIcon('check')}</span>` : ''}
    `;
    daysRow.appendChild(card);
  });

  showcase.innerHTML = `
    <span class="drs-label">${t('todayReward')}</span>
    <span class="drs-icon">${reward.icon === 'coin' ? coinIcon('jg-coin-icon-large') : reward.icon}</span>
    <span class="drs-value">${getLang() === 'fr' ? (reward.descFr || reward.desc) : reward.desc}</span>
  `;

  overlay.classList.remove('hidden');

  if (viewOnly) {
    const fr = getLang() === 'fr';
    showcase.querySelector('.drs-label').textContent = fr ? 'RÉCOMPENSE RÉCUPÉRÉE' : 'REWARD CLAIMED';
    // Round the whole wait up to the minute first, so 23 h 59.5 min reads
    // 24H 00MIN, never 23H 60MIN.
    const totalMinutes = Math.ceil(Math.max(0, nextAt - Date.now()) / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const wait = hours > 0 ? `${hours}H ${String(minutes).padStart(2, '0')}MIN` : `${Math.max(1, minutes)} MIN`;
    $('btn-daily-claim').textContent = nextAt > 0
      ? (fr ? `PROCHAIN JOUR DANS ${wait}` : `NEXT DAY IN ${wait}`)
      : (fr ? 'FERMER' : 'CLOSE');
    $('btn-daily-claim').onclick = () => {
      overlay.classList.add('hidden');
      onClaim?.({ claimed: false, badges: [] });
    };
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.add('hidden');
    }, { once: true });
    return;
  }

  // Not signed in: the calendar is shown too; claiming needs a Google account.
  if (!G.playerRegistered) {
    const fr = getLang() === 'fr';
    $('btn-daily-claim').textContent = fr ? 'CONNECTE-TOI POUR RÉCUPÉRER' : 'SIGN IN TO CLAIM';
    $('btn-daily-claim').onclick = () => {
      overlay.classList.add('hidden');
      _handleLogin('google');
      onClaim?.({ claimed: false, requiresConnection: true, badges: [] });
    };
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.add('hidden');
    }, { once: true });
    return;
  }

  $('btn-daily-claim').textContent = t('claimReward');
  $('btn-daily-claim').onclick = () => {
    const result = claimDailyReward();
    if (!result.claimed) return;
    SFX.bonusHeart?.();
    overlay.classList.add('hidden');
    // Chest days: open that chest (roulette) right away, then back to the lobby.
    if (reward.chestTier !== undefined && window._nav?.toChest) {
      window._nav.toChest(rollChestTier(reward.chestTier), 'menu');
    }
    if (result.badges?.length) {
      setTimeout(() => window._previewBadgeUnlock?.(result.badges), 250);
    }
    onClaim?.(result);
  };
  overlay.addEventListener('click', e => {
    if (e.target === overlay && !onClaim) overlay.classList.add('hidden');
  }, { once: true });
}

// ── MISSIONS: full-page war-room background, tap the tablet to see missions ─
let _missionsTimerInterval = null;

// Desk-lamp glow pulse: 10 frames of the SAME war-room art, palindromic
// (frame-01≈frame-10, frame-02≈frame-09, ...) so looping 1→10 then
// restarting at 1 reads as one continuous breathing glow with no seam/jump.
// Loops for as long as the missions panel stays open; self-stops once it's
// hidden (same pattern as shop.js's startArsenalBlink).
const MISSION_LAMP_FRAME_COUNT = 10;
const MISSION_LAMP_FRAMES = Array.from({ length: MISSION_LAMP_FRAME_COUNT }, (_, i) =>
  `/assets/hangar/mission-lamp-loop/frame-${String(i + 1).padStart(2, '0')}.webp`);
const MISSION_LAMP_FRAME_MS = 90;
let _missionLampPreloaded = false;
let _missionLampTimer = null;

function _preloadMissionLampFrames() {
  if (_missionLampPreloaded) return;
  _missionLampPreloaded = true;
  MISSION_LAMP_FRAMES.forEach(src => { const img = new Image(); img.src = src; });
}

function startMissionLampLoop() {
  const bg = document.querySelector('#missions-panel .jx-bg');
  if (!bg) return;
  _preloadMissionLampFrames();
  if (_missionLampTimer) { clearInterval(_missionLampTimer); _missionLampTimer = null; }
  let i = 0;
  bg.src = MISSION_LAMP_FRAMES[0];
  _missionLampTimer = setInterval(() => {
    if ($('missions-panel')?.classList.contains('hidden')) {
      clearInterval(_missionLampTimer);
      _missionLampTimer = null;
      return;
    }
    i = (i + 1) % MISSION_LAMP_FRAME_COUNT;
    bg.src = MISSION_LAMP_FRAMES[i];
  }, MISSION_LAMP_FRAME_MS);
}

function stopMissionLampLoop() {
  if (_missionLampTimer) { clearInterval(_missionLampTimer); _missionLampTimer = null; }
}

// Same slide-in feel as the lobby/shop/training/hangar carousel arrows
// (see SWIPE_MS in dom.js) — the ‹ button that opens this panel is the
// carousel's "prev" arrow, so the panel enters from the left and leaves
// back the same way.
const MISSIONS_SWIPE_MS = 320;

export function openMissionsPanel() {
  const panel = $('missions-panel');
  if (!panel) return;
  panel.classList.remove('hidden');
  panel.style.transition = 'none';
  panel.style.transform = 'translateX(-100%)';
  void panel.offsetWidth; // flush the "no transition" jump before animating in
  requestAnimationFrame(() => {
    panel.style.transition = `transform ${MISSIONS_SWIPE_MS}ms ease`;
    panel.style.transform = 'translateX(0)';
  });
  $('missions-scroll-backdrop')?.classList.remove('is-open'); // always start on the room, not the popup
  $('btn-missions-close')?.classList.remove('is-hidden');
  _renderMissions();
  _startMissionsTimer();
  positionMissionTablet();
  startMissionLampLoop();
}

// The tablet hotspot's (fx,fy) as a fraction of the background art's own
// 1536x1024 canvas (measured from the tablet screen's glowing bezel).
// #missions-panel .jx-bg is a full-bleed object-fit:cover image, so it's
// scaled/cropped differently per screen shape — this replicates the browser's
// own cover-fit math to convert that fraction into real on-screen px, the
// same trick used for the shop's missile buttons (see positionArsenalButtons
// in shop.js). Re-run on resize while the panel is open.
const MISSION_TABLET_POS = { fx: 0.499, fy: 0.489 };
function positionMissionTablet() {
  const bg  = document.querySelector('#missions-panel .jx-bg');
  const btn = $('btn-missions-tablet');
  if (!bg || !btn) return;
  const place = () => {
    const iw = bg.naturalWidth, ih = bg.naturalHeight;
    if (!iw || !ih) return false;
    const rect = bg.parentElement.getBoundingClientRect();
    const vw = rect.width, vh = rect.height;
    if (!vw || !vh) return false;
    const scale = Math.max(vw / iw, vh / ih);
    const dw = iw * scale, dh = ih * scale;
    const offsetX = (vw - dw) / 2, offsetY = (vh - dh) / 2;
    btn.style.left = `${offsetX + MISSION_TABLET_POS.fx * dw}px`;
    btn.style.top  = `${offsetY + MISSION_TABLET_POS.fy * dh}px`;
    return true;
  };
  const tryPlace = () => { if (!place()) requestAnimationFrame(place); };
  if (bg.complete) requestAnimationFrame(tryPlace);
  else bg.addEventListener('load', () => requestAnimationFrame(tryPlace), { once: true });
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    if (!$('missions-panel')?.classList.contains('hidden')) positionMissionTablet();
  });
}

function closeMissionsPanel() {
  const panel = $('missions-panel');
  if (_missionsTimerInterval) { clearInterval(_missionsTimerInterval); _missionsTimerInterval = null; }
  stopMissionLampLoop();
  if (!panel || panel.classList.contains('hidden')) return;
  panel.style.transition = `transform ${MISSIONS_SWIPE_MS}ms ease`;
  panel.style.transform = 'translateX(-100%)';
  let done = false;
  const finish = e => {
    if (e && e.target !== panel) return; // ignore a child's own transition bubbling up
    if (done) return;
    done = true;
    panel.classList.add('hidden');
    panel.style.transition = '';
    panel.style.transform = '';
    panel.removeEventListener('transitionend', finish);
  };
  panel.addEventListener('transitionend', finish);
  setTimeout(finish, MISSIONS_SWIPE_MS + 120); // safety net if transitionend never fires
}

// No swingPlates() here on purpose: this popup's tight overflow:hidden
// scroll box has no room for a full pendulum swing - mid-animation the
// plate visibly clips against the box edges and looks broken/off-center,
// unlike the full-screen Training/Shop headers where it has space to play.
// The room's own "leave missions" arrow sits behind the tablet popup and
// otherwise keeps poking out past its edges - hide it while the tablet
// screen is up, same as tapping outside the popup no longer being able to
// leave the room by mistake mid-read.
function openMissionsScroll() {
  $('missions-scroll-backdrop')?.classList.add('is-open');
  $('btn-missions-close')?.classList.add('is-hidden');
}
function closeMissionsScroll() {
  $('missions-scroll-backdrop')?.classList.remove('is-open');
  $('btn-missions-close')?.classList.remove('is-hidden');
}

function _startMissionsTimer() {
  if (_missionsTimerInterval) clearInterval(_missionsTimerInterval);
  const el = $('missions-timer');
  const tick = () => {
    const now      = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;
    const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    if (el) el.textContent = `${t('resetsIn')}  ${h}:${m}:${s}`;
  };
  tick();
  _missionsTimerInterval = setInterval(tick, 1000);
}

function _renderMissions() {
  const list = $('missions-list');
  if (!list) return;
  const missions = getMissions();
  const isConnected = !!G.playerRegistered;
  const isFr = getLang() === 'fr';
  const connectLabel = isFr ? 'CONNEXION' : 'SIGN IN';

  list.innerHTML = missions.map(m => {
    const done  = m.progress >= m.target;
    const label = isFr ? (m.labelFr || m.label) : m.label;
    const tag = m.group === 'coop' ? 'MULTI' : m.group === 'practice' ? (isFr ? 'PRATIQUE' : 'PRACTICE') : '';
    const btnText = !isConnected ? connectLabel : m.claimed ? t('claimed') : done ? t('claim') : `${m.progress}/${m.target}`;
    const disabled = !done || m.claimed || !isConnected;
    return `
      <div class="jx-mission${m.claimed ? ' is-claimed' : ''}">
        <div class="jx-mission-label">${tag ? `<span class="jx-mission-tag is-${m.group}">${tag}</span>` : ''}${label}</div>
        <div class="jx-mission-rewards">
          <span>${coinIcon()} ${m.coins}</span>
          <span>${expIcon()} ${m.xp}</span>
        </div>
        <button data-id="${m.id}" ${disabled ? 'disabled' : ''}>${btnText}</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('button:not([disabled])').forEach(btn => {
    btn.onclick = () => {
      if (claimMission(btn.dataset.id)) {
        SFX.buy?.();
        _renderMissions();
        _updateMissionsBadge();
      }
    };
  });
}
