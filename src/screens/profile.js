import { $, showScreen } from '../utils/dom.js';
import { G } from '../state.js';
import { clearAll, save } from '../utils/storage.js';
import { deleteCloudSave, flushCloudSave } from '../systems/cloud-save.js';
import { signOutSupabase } from '../systems/supabase-client.js';
import { SFX } from '../audio/sound.js';
import { getPilotGrade } from '../data/pilots.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { t } from '../i18n.js';

const GOOGLE_CLIENT_ID = '182729505930-rulb73m14t9qvfpjfbplknrcgn0fqvci.apps.googleusercontent.com';
let _nav = null;

export const PROFILE_EMBLEMS = ['✈', '⚡', '★', '🎯', '🔥', '🌙', '❄', '☄', '⚔', '💎', '🚀', '🛡'];

const GRADE_AVATARS = {
  'CADET':      'assets/pilots/cadet.png',
  '2ND LT':     'assets/pilots/2nd-lt.png',
  'LIEUTENANT': 'assets/pilots/lieutenant.png',
  'CAPTAIN':    'assets/pilots/captain.png',
  'MAJOR':      'assets/pilots/major.png',
  'COLONEL':    'assets/pilots/colonel.png',
  'GENERAL':    'assets/pilots/general.png',
  'AIR ACE':    'assets/pilots/air-ace.png',
};

export const PROFILE_THEMES = [
  { id: 'default', name: 'FLIGHT OPS',   accent: '#00d4ff', border: '#1e3a5f', bg: '#0a0e1a' },
  { id: 'desert',  name: 'DESERT STORM', accent: '#f59e0b', border: '#7c3a0e', bg: '#1a1206' },
  { id: 'arctic',  name: 'ARCTIC OPS',   accent: '#93c5fd', border: '#1e4a8f', bg: '#0b1a2e' },
  { id: 'stealth', name: 'STEALTH',      accent: '#a855f7', border: '#4c1d95', bg: '#080808' },
  { id: 'ace',     name: 'ACE PILOT',    accent: '#fbbf24', border: '#78350f', bg: '#150f00' },
  { id: 'inferno', name: 'INFERNO',      accent: '#ef4444', border: '#7f1d1d', bg: '#180505' },
];

let _emblem = '✈';
let _theme  = 'default';

function _getTheme() {
  return PROFILE_THEMES.find(t => t.id === _theme) || PROFILE_THEMES[0];
}

function _applyTheme() {
  const card = document.getElementById('pilot-card');
  if (!card) return;
  const th = _getTheme();
  card.style.setProperty('--tc-bg',     th.bg);
  card.style.setProperty('--tc-accent', th.accent);
  card.style.setProperty('--tc-border', th.border);
}

function _refreshCard() {
  const grade    = getPilotGrade(G.highestLevel || 0);
  const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.t6;
  const callsign = ($('prof-callsign')?.value || G.playerName || 'PILOT').trim().toUpperCase() || 'PILOT';
  const motto    = $('prof-motto')?.value?.trim() || '';

  const photoEl    = document.getElementById('pc-photo');
  const pilotImgEl = document.getElementById('pc-pilot-img');
  const initEl     = document.getElementById('pc-initial');
  const hasPhoto   = !!G.playerPhoto;

  if (photoEl)    { photoEl.src = G.playerPhoto || ''; photoEl.style.display = hasPhoto ? 'block' : 'none'; }
  if (pilotImgEl) { pilotImgEl.src = GRADE_AVATARS[grade.name] || ''; pilotImgEl.style.display = hasPhoto ? 'none' : 'block'; }
  if (initEl)     { initEl.textContent = callsign[0] || 'P'; initEl.style.display = 'none'; }

  _t('pc-emblem',   _emblem);
  _t('pc-name',     callsign);
  _t('pc-grade',    `${grade.emoji}  ${grade.name}`);
  const rankEl = document.getElementById('pc-rank');
  if (rankEl) rankEl.innerHTML = `<img class="jg-exp-icon" src="/assets/fx/Caisse/JexonGo_EXP_frame_01.png" alt="EXP"> ${(G.xp || 0).toLocaleString()}`;
  _t('pc-aircraft', (aircraft.name || G.activeAircraft).toUpperCase());
  _t('pc-stats',    `LV.${G.highestLevel || 0}`);

  const mottoEl = document.getElementById('pc-motto');
  if (mottoEl) {
    mottoEl.textContent = motto ? `"${motto}"` : '';
    mottoEl.classList.toggle('pc-motto-empty', !motto);
  }
}

function _t(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function _animCard(type) {
  const card = document.getElementById('pilot-card');
  if (!card) return;
  card.classList.remove('pca-theme', 'pca-save', 'pca-emblem');
  void card.offsetWidth;
  card.classList.add(`pca-${type}`);
}

function _buildEmblemGrid() {
  const grid = document.getElementById('emblem-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const emb of PROFILE_EMBLEMS) {
    const btn = document.createElement('button');
    btn.className   = 'emblem-btn' + (emb === _emblem ? ' emb-on' : '');
    btn.textContent = emb;
    btn.addEventListener('click', () => {
      _emblem = emb;
      grid.querySelectorAll('.emblem-btn').forEach(b => b.classList.toggle('emb-on', b.textContent === emb));
      _refreshCard();
      _animCard('emblem');
    });
    grid.appendChild(btn);
  }
}

function _buildThemeGrid() {
  const grid = document.getElementById('theme-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const th of PROFILE_THEMES) {
    const btn = document.createElement('button');
    btn.className = 'theme-btn' + (th.id === _theme ? ' th-on' : '');
    btn.style.cssText = `--th-a:${th.accent};--th-b:${th.border};--th-bg:${th.bg}`;
    btn.textContent   = th.name;
    btn.addEventListener('click', () => {
      _theme = th.id;
      grid.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('th-on'));
      btn.classList.add('th-on');
      _applyTheme();
      _animCard('theme');
    });
    grid.appendChild(btn);
  }
}

async function _signOut() {
  await flushCloudSave();
  await signOutSupabase();
  G.playerPhoto      = '';
  G.playerRegistered = false;
  save('playerPhoto',      '');
  save('playerRegistered', false);
  save('playerPassword',   '');
  if (typeof google !== 'undefined' && google?.accounts) {
    google.accounts.id.disableAutoSelect();
  }
  _nav.toMenu();
}

function _setDeleteError(message) {
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
  _setDeleteError('');
  modal.classList.remove('hidden');
}

function _closeDeleteAccountModal() {
  document.getElementById('delete-account-modal')?.classList.add('hidden');
}

async function _finishLocalAccountDeletion() {
  await signOutSupabase().catch(() => {});
  if (typeof google !== 'undefined' && google?.accounts) {
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

  if (!reason) return _setDeleteError(t('deleteAccountMissingReason'));
  if (!understand) return _setDeleteError(t('deleteAccountNeedConfirm'));
  if (confirmText !== 'DELETE') return _setDeleteError(t('deleteAccountTypeError'));

  _setDeleteError('');
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
      return _setDeleteError(t('deleteAccountDbPolicy'));
    }
    return _setDeleteError(t('deleteAccountFailed'));
  }

  await _finishLocalAccountDeletion();
}

function _triggerGoogleSignIn() {
  if (typeof google === 'undefined' || !google?.accounts?.id) return;
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback:  cred => window._onGoogleCredential?.(cred),
  });
  google.accounts.id.prompt();
}

function _openGameLoginOverlay() {
  const modal = document.getElementById('login-modal');
  if (!modal) return;
  document.getElementById('login-modal-email').value = '';
  document.getElementById('login-modal-password').value = '';
  document.getElementById('login-modal-error').textContent = '';
  modal.classList.remove('hidden');
  document.getElementById('login-modal-email').focus();
}

function _buildAccountSection() {
  const el = document.getElementById('pce-account-display');
  if (!el) return;

  if (G.playerRegistered) {
    const hasPhoto = !!G.playerPhoto;
    const avatarHTML = hasPhoto
      ? `<img class="pce-acc-photo" src="${G.playerPhoto}" referrerpolicy="no-referrer" alt="">`
      : `<div class="pce-acc-initial">${(G.playerName || 'P')[0]}</div>`;
    const badge = hasPhoto
      ? `<span class="pce-acc-badge pce-acc-badge-google">G  GOOGLE</span>`
      : `<span class="pce-acc-badge pce-acc-badge-reg">✓ REGISTERED</span>`;

    el.innerHTML = `
      <div class="pce-acc-row">
        ${avatarHTML}
        <div class="pce-acc-info">
          <div class="pce-acc-name">${G.playerName || 'PILOT'}</div>
          ${G.playerEmail ? `<div class="pce-acc-email">${G.playerEmail}</div>` : ''}
          ${badge}
        </div>
      </div>
      <button id="btn-pce-signout" class="pce-signout-btn">✕ SIGN OUT</button>
    `;
    document.getElementById('btn-pce-signout')?.addEventListener('click', _signOut);
    const deleteBtn = document.createElement('button');
    deleteBtn.id = 'btn-pce-delete-account';
    deleteBtn.className = 'pce-delete-btn';
    deleteBtn.textContent = t('deleteAccount');
    deleteBtn.addEventListener('click', _openDeleteAccountModal);
    el.appendChild(deleteBtn);
  } else {
    el.innerHTML = `
      <div class="pce-acc-guest">
        <div class="pce-acc-guest-icon">✈</div>
        <div class="pce-acc-guest-label">NOT CONNECTED</div>
        <div class="pce-acc-guest-sub">Link an account to save your pilot identity</div>
      </div>
      <div class="pce-acc-btns">
        <button id="btn-pce-google" class="pce-google-btn">G  GOOGLE</button>
        <button id="btn-pce-login" class="pce-google-btn">@  LOG IN</button>
        <button id="btn-pce-register" class="pce-register-btn">✎ REGISTER</button>
      </div>
    `;
    document.getElementById('btn-pce-google')?.addEventListener('click', _triggerGoogleSignIn);
    document.getElementById('btn-pce-login')?.addEventListener('click', _openGameLoginOverlay);
    document.getElementById('btn-pce-register')?.addEventListener('click', () => showScreen('s-register'));
  }
}

export function initProfile(nav) {
  _nav = nav;
  $('btn-profile-back').onclick = () => nav.toMenu();
  document.getElementById('btn-delete-account-cancel')?.addEventListener('click', _closeDeleteAccountModal);
  document.getElementById('btn-delete-account-confirm')?.addEventListener('click', _confirmDeleteAccount);
  document.getElementById('delete-account-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('delete-account-modal')) _closeDeleteAccountModal();
  });

  $('prof-callsign').addEventListener('input', _refreshCard);
  $('prof-motto').addEventListener('input',    _refreshCard);

  $('btn-profile-save').onclick = () => {
    const callsign = ($('prof-callsign').value.trim() || G.playerName).slice(0, 20).toUpperCase();
    const motto    = $('prof-motto').value.trim().slice(0, 40);

    G.playerName   = callsign || G.playerName;
    G.pilotEmblem  = _emblem;
    G.pilotMotto   = motto;
    G.profileTheme = _theme;

    save('playerName',   G.playerName);
    save('pilotEmblem',  G.pilotEmblem);
    save('pilotMotto',   G.pilotMotto);
    save('profileTheme', G.profileTheme);

    _animCard('save');
    SFX.purchase?.();

    const btn = $('btn-profile-save');
    btn.textContent = '✔ SAVED!';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = '▶ SAVE PILOT CARD'; btn.disabled = false; }, 1400);
  };
}

export function renderProfile() {
  _emblem = G.pilotEmblem  || '✈';
  _theme  = G.profileTheme || 'default';

  $('prof-callsign').value = G.playerName || '';
  $('prof-motto').value    = G.pilotMotto  || '';

  _applyTheme();
  _buildAccountSection();
  _buildEmblemGrid();
  _buildThemeGrid();
  _refreshCard();
}
