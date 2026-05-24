import { $, showScreen } from '../utils/dom.js';
import { G, loadSave, saveAll } from '../state.js';
import { LOGIN_REWARDS, claimDailyReward, getMissions, claimMission,
         hasPendingMissionClaim, getPlayerRank,
         getSr71MissionState, claimSr71Mission } from '../systems/daily.js';
import { save, load } from '../utils/storage.js';
import { getPilotInfo } from '../data/pilots.js';
import { getPrestigeTier, getPrestigeBadgeHTML } from '../data/prestige.js';
import { t, getLang, setLang, applyI18n } from '../i18n.js';

// ── GOOGLE SIGN-IN ───────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = '182729505930-rulb73m14t9qvfpjfbplknrcgn0fqvci.apps.googleusercontent.com';
let _gsiReady = false;

function _ensureGSI() {
  if (_gsiReady) return true;
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

function _handleLogin(provider) {
  if (provider !== 'google') return;
  if (_googleLoginPending) return;
  _googleLoginPending = true;

  if (!_ensureGSI()) {
    _showToast(t('googleNotAvail'));
    _googleLoginPending = false;
    return;
  }

  google.accounts.id.prompt(notification => {
    _googleLoginPending = false;
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      _showGsiFallback();
    }
  });
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

function _updateProfile() {
  const wrap       = document.getElementById('menu-profile');
  const photoEl    = document.getElementById('menu-profile-photo');
  const initialEl  = document.getElementById('menu-profile-initial');
  const nameEl     = document.getElementById('menu-profile-name');
  const loginDiv   = document.querySelector('.login-divider');
  const gBtn       = document.getElementById('btn-login-google');
  const authRow    = document.getElementById('login-auth-row');

  const isLoggedIn = !!G.playerRegistered;
  const hasPhoto   = !!G.playerPhoto;

  if (wrap) wrap.classList.toggle('hidden', !isLoggedIn);

  if (photoEl) {
    photoEl.src   = hasPhoto ? G.playerPhoto : '';
    photoEl.style.display = hasPhoto ? 'block' : 'none';
  }
  if (initialEl) {
    initialEl.textContent = (G.playerName || 'P')[0].toUpperCase();
    initialEl.style.display = hasPhoto ? 'none' : 'flex';
  }
  if (nameEl) nameEl.textContent = G.playerName || 'PILOT';

  if (loginDiv) loginDiv.style.display = isLoggedIn ? 'none' : '';
  if (gBtn)     { gBtn.style.display   = isLoggedIn ? 'none' : ''; gBtn.classList.toggle('hidden', isLoggedIn); }
  if (authRow)  authRow.style.display  = isLoggedIn ? 'none' : '';

  // P2 blue profile border
  const avatarBtn = document.getElementById('btn-menu-profile-avatar');
  if (avatarBtn) avatarBtn.classList.toggle('prestige-border-p2', G.prestige >= 2);

  document.getElementById('menu-profile-dropdown')?.classList.add('hidden');
}

function _handleSignOut() {
  G.playerPhoto      = '';
  G.playerRegistered = false;
  save('playerPhoto',      '');
  save('playerRegistered', false);
  _gsiReady = false;
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.disableAutoSelect();
  }
  renderMenu();
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

function _handleLoginSubmit() {
  const emailIn = document.getElementById('login-modal-email').value.trim().toLowerCase();
  const pwIn    = document.getElementById('login-modal-password').value;
  const errEl   = document.getElementById('login-modal-error');

  if (!emailIn || !emailIn.includes('@')) { errEl.textContent = t('loginErrEmail'); return; }
  if (!pwIn)                              { errEl.textContent = t('loginErrPw');    return; }

  const storedEmail = (load('playerEmail', '') || '').toLowerCase();
  const storedPw    = load('playerPassword', '');

  if (!storedEmail)                                  { errEl.textContent = t('loginErrNone');  return; }
  if (emailIn !== storedEmail || pwIn !== storedPw)  { errEl.textContent = t('loginErrWrong'); return; }

  _closeLoginOverlay();
  G.playerRegistered = true;
  save('playerRegistered', true);
  loadSave();
  renderMenu();
  _showToast(t('welcomeBack').replace('{name}', G.playerName || 'PILOT'));
}

// ── ASSETS ────────────────────────────────────────────────────────────────────
const PLANE_PATH  = '/assets/menu/anim-3.png';
const FIRE_PATH   = '/assets/menu/engine-fire.png';
const FIRE_FRAMES = 4;

const _isMenuMobile = /iPhone|iPad|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

let _planeImg    = null;
let _fireImg     = null;
let _raf         = null;
let _tick        = 0;
let _activeVid   = 'v1'; // which video is currently primary
let _xfadeT      = -1;   // -1 = idle, 0..1 = crossfade progress

function loadAssets() {
  if (_planeImg) return;
  _planeImg = new Image(); _planeImg.src = PLANE_PATH;

  if (_isMenuMobile) return; // skip video and fire assets on mobile

  _fireImg = new Image(); _fireImg.src = FIRE_PATH;

  const vid = document.getElementById('menu-bg-video');
  if (vid) {
    // Clone for crossfade — both loop independently
    const vid2 = vid.cloneNode(true);
    vid2.id = 'menu-bg-video2';
    vid2.style.opacity = '0';
    vid2.removeAttribute('loop');
    vid.parentNode.insertBefore(vid2, vid.nextSibling);
    vid.removeAttribute('loop');

    vid.style.opacity  = '1';
    vid2.style.opacity = '0';
    vid.play().catch(() => {});
    _activeVid = 'v1';
    _xfadeT    = -1;
  }
}

// ── DRIFTING CLOUDS ───────────────────────────────────────────────────────────
// Mimics the 200.gif: white/light clouds scrolling right → left at varying depths
const CLOUDS = [
  { xFrac: 1.10, y: 0.08, w: 180, h: 70,  speed: 0.55, alpha: 0.82 },
  { xFrac: 1.40, y: 0.18, w: 240, h: 90,  speed: 0.40, alpha: 0.70 },
  { xFrac: 1.70, y: 0.05, w: 130, h: 55,  speed: 0.65, alpha: 0.60 },
  { xFrac: 2.00, y: 0.28, w: 200, h: 80,  speed: 0.35, alpha: 0.75 },
  { xFrac: 0.60, y: 0.14, w: 160, h: 60,  speed: 0.50, alpha: 0.65 },
  { xFrac: 0.20, y: 0.32, w: 110, h: 45,  speed: 0.70, alpha: 0.55 },
  { xFrac: 2.30, y: 0.22, w: 280, h: 100, speed: 0.30, alpha: 0.72 },
];

// Store absolute x positions, initialised on first draw
let _cloudXs = null;

function initClouds(dW) {
  _cloudXs = CLOUDS.map(c => c.xFrac * dW);
}

function drawCloud(ctx, x, y, w, h, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  // Build a puffy cloud from overlapping white ellipses
  const puffs = [
    { dx: 0,        dy: 0,       rx: w * 0.30, ry: h * 0.55 },
    { dx: w * 0.22, dy:-h * 0.12,rx: w * 0.28, ry: h * 0.50 },
    { dx:-w * 0.22, dy:-h * 0.08,rx: w * 0.25, ry: h * 0.45 },
    { dx: w * 0.42, dy: h * 0.08, rx: w * 0.20, ry: h * 0.38 },
    { dx:-w * 0.40, dy: h * 0.10, rx: w * 0.18, ry: h * 0.35 },
  ];
  const grad = ctx.createRadialGradient(x, y - h * 0.1, 0, x, y, h * 0.7);
  grad.addColorStop(0,   'rgba(255,255,255,1)');
  grad.addColorStop(0.6, 'rgba(230,242,255,0.95)');
  grad.addColorStop(1,   'rgba(200,225,255,0)');
  ctx.fillStyle = grad;
  for (const p of puffs) {
    ctx.beginPath();
    ctx.ellipse(x + p.dx, y + p.dy, p.rx, p.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function updateDrawClouds(ctx, dW, dH) {
  if (!_cloudXs) initClouds(dW);
  for (let i = 0; i < CLOUDS.length; i++) {
    const c = CLOUDS[i];
    _cloudXs[i] -= c.speed;
    if (_cloudXs[i] + c.w < 0) _cloudXs[i] = dW + c.w + Math.random() * 200;
    drawCloud(ctx, _cloudXs[i], dH * c.y + c.h / 2, c.w, c.h, c.alpha);
  }
}

// ── THREE PLANES ──────────────────────────────────────────────────────────────
const PLANES = [
  { xFrac: 0.18, startOffset: 0,   speed: 2.8, scale: 0.42, y: null, smoke: [] },
  { xFrac: 0.50, startOffset: 300, speed: 3.4, scale: 0.65, y: null, smoke: [] },
  { xFrac: 0.82, startOffset: 600, speed: 2.5, scale: 0.38, y: null, smoke: [] },
];

// ── SMOKE PARTICLES ───────────────────────────────────────────────────────────
function spawnSmoke(p, ex, ey) {
  p.smoke.push({
    x: ex + (Math.random() - 0.5) * 6,
    y: ey,
    r: 3 + Math.random() * 3,
    alpha: 0.30 + Math.random() * 0.18,
    vx: (Math.random() - 0.5) * 0.4,
    vy: 1.0 + Math.random() * 0.7,
    grow: 0.35,
  });
}

function updateDrawSmoke(ctx, p) {
  for (let i = p.smoke.length - 1; i >= 0; i--) {
    const s = p.smoke[i];
    s.x += s.vx; s.y += s.vy; s.r += s.grow; s.alpha -= 0.008;
    if (s.alpha <= 0) { p.smoke.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = s.alpha;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(200,220,240,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ── ENGINE FIRE (Legacy sprite) ───────────────────────────────────────────────
function drawEngineFire(ctx, x, y, size) {
  if (!_fireImg || !_fireImg.complete || !_fireImg.naturalWidth) return;
  const fw    = _fireImg.naturalWidth / FIRE_FRAMES;
  const fh    = _fireImg.naturalHeight;
  const frame = Math.floor(_tick / 4) % FIRE_FRAMES;
  const s     = size * 3.5;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(_fireImg, frame * fw, 0, fw, fh, x - s / 2, y - s / 2, s, s);
  ctx.restore();
}

// ── MAIN DRAW LOOP ────────────────────────────────────────────────────────────
function drawTick() {
  const canvas = document.getElementById('menu-canvas');
  if (!canvas || document.getElementById('s-menu')?.classList.contains('hidden')) {
    _raf = null; return;
  }

  const dW = canvas.clientWidth  || 360;
  const dH = canvas.clientHeight || 640;
  if (canvas.width !== dW || canvas.height !== dH) {
    canvas.width = dW; canvas.height = dH;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, dW, dH);
  _tick++;

  // 0. Video crossfade — fully RAF-driven, no timeupdate, no black flash
  // On mobile: skip crossfade entirely (video is hidden/not loaded on mobile)
  const vid  = _isMenuMobile ? null : document.getElementById('menu-bg-video');
  const vid2 = _isMenuMobile ? null : document.getElementById('menu-bg-video2');
  const FADE_DUR  = 1.5;
  const FADE_STEP = 1 / (FADE_DUR * 60);

  if (vid && vid2) {
    const primary   = _activeVid === 'v1' ? vid  : vid2;
    const secondary = _activeVid === 'v1' ? vid2 : vid;

    if (_xfadeT < 0) {
      // Idle — watch for near-end of primary
      const dur = primary.duration;
      const cur = primary.currentTime;
      if (dur > 0 && !isNaN(dur) && cur > 0 && (dur - cur) <= FADE_DUR) {
        secondary.currentTime = 0;
        secondary.play().catch(() => {});
        _xfadeT = 0;
      }
    } else {
      // Crossfade in progress: primary fades out, secondary fades in
      _xfadeT = Math.min(1, _xfadeT + FADE_STEP);
      primary.style.opacity   = 1 - _xfadeT;
      secondary.style.opacity = _xfadeT;

      if (_xfadeT >= 1) {
        // Secondary is now fully visible — make it the new primary
        _activeVid = _activeVid === 'v1' ? 'v2' : 'v1';
        primary.pause();
        primary.currentTime = 0;
        primary.style.opacity = '0';
        _xfadeT = -1;
      }
    }
  }

  // 1. Drifting clouds (right → left)
  updateDrawClouds(ctx, dW, dH);

  // 2. Planes + smoke + fire
  if (_planeImg && _planeImg.complete && _planeImg.naturalWidth) {
    const iw = _planeImg.naturalWidth, ih = _planeImg.naturalHeight;
    const visiblePlanes = _isMenuMobile ? PLANES.slice(0, 1) : PLANES;

    for (const p of visiblePlanes) {
      const drawH = dH * p.scale;
      const drawW = iw * (drawH / ih);
      const bx    = dW * p.xFrac - drawW / 2;

      if (p.y === null) p.y = dH + drawH + p.startOffset;
      p.y -= _isMenuMobile ? p.speed * 1.8 : p.speed;
      if (p.y < -drawH * 2) { p.y = dH + drawH; p.smoke = []; }

      if (!_isMenuMobile) {
        // Accelerate smoke fade as plane nears the top
        const fadeRatio = p.y < 0 ? Math.max(0, 1 + p.y / drawH) : 1;
        if (fadeRatio < 1) {
          for (const s of p.smoke) s.alpha -= 0.04 * (1 - fadeRatio);
        }

        const engineY  = p.y + drawH * 0.79;
        const engineLX = bx + drawW * 0.47;
        const engineRX = bx + drawW * 0.53;

        if (_tick % 3 === 0 && p.y < dH && p.y + drawH > 0) {
          spawnSmoke(p, engineLX, engineY);
          spawnSmoke(p, engineLX, engineY);
          spawnSmoke(p, engineRX, engineY);
          spawnSmoke(p, engineRX, engineY);
        }

        updateDrawSmoke(ctx, p);

        if (p.y < dH && p.y + drawH > 0) {
          drawEngineFire(ctx, engineLX, engineY, drawW * 0.06);
          drawEngineFire(ctx, engineRX, engineY, drawW * 0.06);
        }
      }

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(_planeImg, bx, p.y, drawW, drawH);
      ctx.restore();
    }
  }

  _raf = requestAnimationFrame(drawTick);
}

// ── LANGUAGE ─────────────────────────────────────────────────────────────────
function _applyLang() {
  const lang = getLang();
  const btn  = $('btn-lang');
  if (btn) btn.textContent = lang === 'fr' ? 'FR' : 'EN';

  const sub = document.querySelector('.menu-subtitle');
  if (sub) sub.textContent = t('subtitle');

  const map = {
    'btn-play':      'play',
    'btn-hangar':    'hangar',
    'btn-shop':      'shop',
    'btn-practice':  'practice',
  };
  for (const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  }

  // Missions button preserves its badge child
  const missionsBtn = $('btn-missions');
  if (missionsBtn) {
    const badge = missionsBtn.querySelector('.missions-badge');
    missionsBtn.textContent = t('missions');
    if (badge) missionsBtn.appendChild(badge);
  }

  const dividerSpan = document.querySelector('.login-divider span');
  if (dividerSpan) dividerSpan.textContent = t('signIn');

}

// ── PRESTIGE ─────────────────────────────────────────────────────────────────
function _updatePrestigeBadge() {
  const badgeEl = document.getElementById('menu-prestige-badge');
  if (badgeEl) badgeEl.innerHTML = getPrestigeBadgeHTML(G.prestige);

  const btn = document.getElementById('btn-prestige');
  if (btn) btn.classList.toggle('hidden', !(G.highestLevel >= 50 && G.prestige < 5));
}

function _openPrestigeConfirm() {
  const nextP  = G.prestige + 1;
  const tier   = getPrestigeTier(nextP);
  const tierEl = document.getElementById('prestige-modal-tier');
  const rewEl  = document.getElementById('prestige-modal-reward');
  const imgEl  = document.getElementById('prestige-modal-img');
  if (tierEl) { tierEl.textContent = tier.name; tierEl.style.color = tier.color || '#ffffff'; }
  if (rewEl)  rewEl.textContent = `✦ REWARD: ${tier.rewardDesc}`;
  if (imgEl) {
    if (tier.img) {
      imgEl.src = tier.img;
      imgEl.style.borderColor = tier.color || '#fff';
      imgEl.style.boxShadow   = `0 0 30px ${tier.color || '#fff'}88`;
      imgEl.classList.remove('hidden');
    } else {
      imgEl.classList.add('hidden');
    }
  }
  document.getElementById('prestige-modal')?.classList.remove('hidden');
}

function _closePrestigeModal() {
  document.getElementById('prestige-modal')?.classList.add('hidden');
}

function _openResetConfirm() {
  document.getElementById('reset-modal')?.classList.remove('hidden');
}
function _closeResetModal() {
  document.getElementById('reset-modal')?.classList.add('hidden');
}
function _doReset() {
  _closeResetModal();
  G.highestLevel  = 0;
  G.levelStars    = {};
  G.xp            = 0;
  G.coins         = 0;
  G.totalXpEarned = 0;
  save('highestLevel',  0);
  save('levelStars',    {});
  save('xp',            0);
  save('coins',         0);
  save('totalXpEarned', 0);
  _showToast('Game reset');
  renderMenu();
}

function _doPrestige() {
  _closePrestigeModal();
  G.prestige++;
  const tier = getPrestigeTier(G.prestige);
  if (tier.skinReward && !G.ownedSkins.includes(tier.skinReward)) {
    G.ownedSkins.push(tier.skinReward);
    save('ownedSkins', G.ownedSkins);
  }
  G.xp           = 0;
  G.coins        = 0;
  G.highestLevel = 0;
  save('prestige',      G.prestige);
  save('xp',            0);
  save('coins',         0);
  save('highestLevel',  0);
  _showPrestigeCelebration(tier);
}

function _showPrestigeCelebration(tier) {
  const overlay = document.getElementById('prestige-celebration');
  if (!overlay) { renderMenu(); return; }

  // Big background rank number
  const numEl = document.getElementById('prestige-cel-number');
  if (numEl) {
    numEl.textContent = `P${G.prestige}`;
    numEl.style.color = tier.color || '#fff';
  }

  // Tier image
  const celImgEl = document.getElementById('prestige-cel-img');
  if (celImgEl) {
    if (tier.img) {
      celImgEl.src = tier.img;
      celImgEl.style.borderColor = tier.color || '#fff';
      celImgEl.style.boxShadow   = `0 0 40px ${tier.color || '#fff'}aa, 0 0 80px ${tier.color || '#fff'}44`;
      celImgEl.classList.remove('hidden');
    } else {
      celImgEl.classList.add('hidden');
    }
  }

  const titleEl = document.getElementById('prestige-cel-tier');
  const rewEl   = document.getElementById('prestige-cel-reward');
  if (titleEl) {
    titleEl.textContent = `✦ ${tier.name}`;
    if (tier.color) {
      titleEl.style.color      = tier.color;
      titleEl.style.textShadow = `0 0 40px ${tier.color}, 0 0 90px ${tier.color}88`;
      titleEl.classList.remove('prestige-badge-rainbow');
    } else {
      titleEl.style.color = '';
      titleEl.classList.add('prestige-badge-rainbow');
    }
  }
  if (rewEl) rewEl.textContent = tier.rewardDesc || '';
  overlay.classList.remove('hidden');

  // White flash on entry
  overlay.style.background = 'rgba(255,255,255,0.95)';
  setTimeout(() => { overlay.style.background = ''; }, 150);

  const canvas = document.getElementById('prestige-canvas');
  let raf;
  if (canvas) {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const COLORS = tier.color
      ? [tier.color, '#fff', '#fbbf24', '#fff', tier.color, '#e2e8f0']
      : ['#ff2277', '#ff8c00', '#ffe600', '#00e84b', '#00e8ff', '#a855f7'];

    // 250 confetti pieces — 3 shapes
    const pieces = Array.from({ length: 250 }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height - canvas.height * 1.5,
      vx:    (Math.random() - 0.5) * 5,
      vy:    3 + Math.random() * 8,
      size:  5 + Math.random() * 14,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot:   Math.random() * Math.PI * 2,
      rotV:  (Math.random() - 0.5) * 0.25,
      shape: Math.floor(Math.random() * 3), // 0=rect 1=diamond 2=star
      alpha: 0.75 + Math.random() * 0.25,
    }));

    // Expanding shockwave rings from center
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy) * 1.25;
    const rings = [
      { r: 0, speed: 14, w: 7, alpha: 0.9, color: tier.color || '#fff',    delay: 0  },
      { r: 0, speed: 9,  w: 5, alpha: 0.7, color: tier.color || '#a855f7', delay: 10 },
      { r: 0, speed: 6,  w: 3, alpha: 0.5, color: '#fbbf24',               delay: 22 },
    ];

    function drawStar(x, y, r) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a  = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const ai = a + Math.PI / 5;
        if (i === 0) ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
        else         ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
        ctx.lineTo(x + r * 0.42 * Math.cos(ai), y + r * 0.42 * Math.sin(ai));
      }
      ctx.closePath();
    }

    let frame = 0;
    const start = Date.now();
    function tick() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Rings
      for (const ring of rings) {
        if (frame < ring.delay) continue;
        ring.r += ring.speed;
        if (ring.r < maxR) {
          const a = ring.alpha * (1 - ring.r / maxR);
          ctx.save();
          ctx.globalAlpha = a;
          ctx.strokeStyle = ring.color;
          ctx.lineWidth   = ring.w;
          ctx.beginPath();
          ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Confetti
      for (const p of pieces) {
        p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
        if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle  = p.color;
        ctx.globalAlpha = p.alpha;
        if (p.shape === 0) {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === 1) {
          ctx.beginPath();
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, 0);
          ctx.lineTo(0,  p.size / 2);
          ctx.lineTo(-p.size / 2, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          drawStar(0, 0, p.size / 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (Date.now() - start < 7000) raf = requestAnimationFrame(tick);
      else dismiss();
    }
    raf = requestAnimationFrame(tick);
  }

  function dismiss() {
    cancelAnimationFrame(raf);
    overlay.classList.add('hidden');
    overlay.style.background = '';
    renderMenu();
  }
  overlay.onclick = dismiss;
  setTimeout(dismiss, 7000);
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
export function initMenu(nav) {
  loadAssets();
  $('btn-play').onclick    = () => nav.toMap();
  $('btn-hangar').onclick  = () => nav.toHangar();
  $('btn-shop').onclick    = () => nav.toShop();
  $('btn-practice').onclick = () => openPracticeSelect(nav);
  $('btn-pilot-card').onclick = () => nav.toProfile();

  const googleBtn = document.getElementById('btn-login-google');
  if (googleBtn) googleBtn.onclick = () => _handleLogin('google');

  const signupBtn = document.getElementById('btn-signup');
  if (signupBtn) signupBtn.onclick = () => showScreen('s-register');

  const loginBtn = document.getElementById('btn-login');
  if (loginBtn) loginBtn.onclick = () => _openLoginOverlay();

  const loginModalClose = document.getElementById('btn-login-modal-close');
  if (loginModalClose) loginModalClose.onclick = () => _closeLoginOverlay();

  const loginModal = document.getElementById('login-modal');
  if (loginModal) loginModal.addEventListener('click', e => { if (e.target === loginModal) _closeLoginOverlay(); });

  const loginSubmitBtn = document.getElementById('btn-login-modal-submit');
  if (loginSubmitBtn) loginSubmitBtn.onclick = () => _handleLoginSubmit();

  document.getElementById('login-modal-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') _handleLoginSubmit();
  });

  // Password visibility toggles — work unlimited times
  function _makePwToggle(btnId, inputId) {
    const btn   = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type  = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁';
    });
  }
  _makePwToggle('btn-login-pw-toggle', 'login-modal-password');
  _makePwToggle('btn-reg-pw-toggle',   'reg-password');

  const prestigeBtn = document.getElementById('btn-prestige');
  if (prestigeBtn) prestigeBtn.onclick = _openPrestigeConfirm;
  document.getElementById('btn-prestige-confirm')?.addEventListener('click', _doPrestige);
  document.getElementById('btn-prestige-cancel')?.addEventListener('click', _closePrestigeModal);
  document.getElementById('prestige-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('prestige-modal')) _closePrestigeModal();
  });

  document.getElementById('btn-reset-confirm')?.addEventListener('click', _doReset);
  document.getElementById('btn-reset-cancel')?.addEventListener('click', _closeResetModal);
  document.getElementById('reset-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('reset-modal')) _closeResetModal();
  });

  $('btn-missions').onclick      = () => openMissionsPanel();
  $('btn-missions-close').onclick = () => $('missions-panel').classList.add('hidden');
  $('missions-panel').addEventListener('click', e => {
    if (e.target === $('missions-panel')) $('missions-panel').classList.add('hidden');
  });

  const fbBtn = $('btn-feedback-menu');
  if (fbBtn) fbBtn.onclick = () => window._showFeedbackPopup?.();

  const avatarBtn = document.getElementById('btn-menu-profile-avatar');
  if (avatarBtn) {
    avatarBtn.onclick = e => {
      e.stopPropagation();
      document.getElementById('menu-profile-dropdown')?.classList.toggle('hidden');
    };
  }

  document.addEventListener('click', () => {
    document.getElementById('menu-profile-dropdown')?.classList.add('hidden');
  });

  const signoutBtn = $('btn-google-signout');
  if (signoutBtn) signoutBtn.onclick = _handleSignOut;

  const langBtn = $('btn-lang');
  if (langBtn) {
    langBtn.onclick = () => {
      setLang(getLang() === 'en' ? 'fr' : 'en'); // setLang calls applyI18n() automatically
      _applyLang();
    };
  }
  applyI18n();
  _applyLang();

  // ── CHEAT CODES (keyboard only, time-window: all keys within 600ms) ──────────
  const _ct = new Map(); // key → timestamp of last press
  function _held(...keys) {
    const now = Date.now();
    return keys.every(k => _ct.has(k) && now - _ct.get(k) < 600);
  }
  function _clearKeys(...keys) { keys.forEach(k => _ct.delete(k)); }

  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    _ct.set(k, Date.now());

    // 1 + 8 + M → prestige up
    if (_held('1','8','m')) {
      _clearKeys('1','8','m');
      if (G.prestige < 5) _doPrestige();
    }
    // 1 + 9 + L → prestige down
    if (_held('1','9','l')) {
      _clearKeys('1','9','l');
      if (G.prestige > 0) {
        G.prestige--;
        save('prestige', G.prestige);
        _showToast('Prestige → P' + G.prestige);
        renderMenu();
      }
    }
    // P + 0 + L → reset everything (with confirmation)
    if (_held('p','0','l')) {
      _clearKeys('p','0','l');
      _openResetConfirm();
    }
    // P + 1 + L → +1 level
    if (_held('p','1','l')) {
      _clearKeys('p','1','l');
      G.highestLevel = Math.min((G.highestLevel || 0) + 1, 50);
      save('highestLevel', G.highestLevel);
      _showToast('Level → ' + G.highestLevel);
      renderMenu();
    }
    // P + 2 + 5 → unlock all 50 levels
    if (_held('p','2','5')) {
      _clearKeys('p','2','5');
      G.highestLevel = 50;
      save('highestLevel', 50);
      _showToast('All 50 levels unlocked');
      renderMenu();
    }
    // B + H + Q + A → +5000 coins
    if (_held('b','h','q','a')) {
      _clearKeys('b','h','q','a');
      G.coins = (G.coins || 0) + 5000;
      save('coins', G.coins);
      _showToast('◎ +5000 coins');
      renderMenu();
    }
  });
}

let _toastTimer = null;
function _showToast(msg) {
  const el = document.getElementById('login-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('toast-show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('toast-show'), 2200);
}

function openPracticeSelect(nav) {
  const panel = $('practice-select');
  panel.classList.remove('hidden');

  // Sync buttons to current G.practiceOps
  panel.querySelectorAll('.practice-op-btn').forEach(btn => {
    const on = G.practiceOps.includes(btn.dataset.op);
    btn.classList.toggle('pob-active', on);
  });

  // Op toggle
  panel.querySelectorAll('.practice-op-btn').forEach(btn => {
    btn.onclick = () => {
      const op  = btn.dataset.op;
      const idx = G.practiceOps.indexOf(op);
      if (idx === -1) {
        G.practiceOps.push(op);
        btn.classList.add('pob-active');
      } else {
        if (G.practiceOps.length === 1) return; // keep at least one
        G.practiceOps.splice(idx, 1);
        btn.classList.remove('pob-active');
      }
    };
  });

  $('btn-practice-all').onclick = () => {
    G.practiceOps = ['+', '-', '*', '/'];
    panel.querySelectorAll('.practice-op-btn').forEach(b => b.classList.add('pob-active'));
  };

  // Hearts toggle
  const heartsBtn = $('btn-practice-hearts');
  const syncHearts = () => {
    heartsBtn.textContent = G.practiceHearts ? t('on') : t('off');
    heartsBtn.classList.toggle('poh-active',  G.practiceHearts);
    heartsBtn.classList.toggle('poh-inactive', !G.practiceHearts);
  };
  syncHearts();
  heartsBtn.onclick = () => { G.practiceHearts = !G.practiceHearts; syncHearts(); };

  // Timer selection
  const syncTimerBtns = () => {
    panel.querySelectorAll('.practice-timer-btn').forEach(btn => {
      const val = btn.dataset.time === '0' ? null : Number(btn.dataset.time);
      btn.classList.toggle('ptb-active', val === G.practiceTimeLimit);
    });
  };
  syncTimerBtns();
  panel.querySelectorAll('.practice-timer-btn').forEach(btn => {
    btn.onclick = () => {
      G.practiceTimeLimit = btn.dataset.time === '0' ? null : Number(btn.dataset.time);
      save('practiceTimeLimit', G.practiceTimeLimit);
      syncTimerBtns();
    };
  });

  $('btn-practice-close').onclick = () => panel.classList.add('hidden');
  panel.onclick = e => { if (e.target === panel) panel.classList.add('hidden'); };

  $('btn-practice-start').onclick = () => {
    if (G.practiceOps.length === 0) return;
    panel.classList.add('hidden');
    nav.toGame(1, true);
  };
}

export function renderMenu() {
  for (const p of PLANES) { p.y = null; p.smoke = []; }
  _cloudXs   = null;
  _tick      = 0;
  _activeVid = 'v1';
  _xfadeT    = -1;

  const vid  = document.getElementById('menu-bg-video');
  const vid2 = document.getElementById('menu-bg-video2');
  if (vid)  { vid.style.opacity  = '1'; vid.currentTime  = 0; vid.play().catch(() => {}); }
  if (vid2) { vid2.style.opacity = '0'; vid2.currentTime = 0; vid2.pause(); }

  if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
  _raf = requestAnimationFrame(drawTick);

  _updateRankBadge();
  _updateMissionsBadge();
  _updatePrestigeBadge();
  _updateProfile();
  _applyLang();

  const offlineBanner = document.getElementById('menu-offline-banner');
  if (offlineBanner) offlineBanner.classList.toggle('hidden', !!G.playerRegistered);
}

function _updateRankBadge() {
  const el = document.getElementById('menu-rank-badge');
  if (!el) return;
  const earned = G.totalXpEarned || G.xp || 0;
  const { tier, pct } = getPilotInfo(earned);
  el.innerHTML = `
    <span class="mrb-avatar" style="color:${tier.color};text-shadow:0 0 10px ${tier.color}">${tier.avatar}</span>
    <span style="color:${tier.color}">${tier.name}</span>
    <div class="mrb-xp-bar-wrap"><div class="mrb-xp-bar" style="width:${pct}%;background:${tier.color}"></div></div>
    <span class="mrb-rank">${(G.xp || 0).toLocaleString()} XP</span>
  `;
}

function _updateMissionsBadge() {
  const btn = document.getElementById('btn-missions');
  if (!btn) return;
  const old = btn.querySelector('.missions-badge');
  if (old) old.remove();
  if (hasPendingMissionClaim()) {
    const badge = document.createElement('span');
    badge.className   = 'missions-badge';
    badge.textContent = '!';
    btn.appendChild(badge);
  }
}

// ── DAILY REWARD POPUP ────────────────────────────────────────────────────────
export function showDailyReward(reward, streak) {
  const overlay  = $('daily-reward-overlay');
  const daysRow  = $('daily-days-row');
  const showcase = $('daily-reward-showcase');

  $('daily-streak-label').textContent = getLang() === 'fr' ? `JOUR ${streak}` : `DAY ${streak}`;

  // Build 7-day cards
  daysRow.innerHTML = '';
  LOGIN_REWARDS.forEach((r, i) => {
    const day  = i + 1;
    const card = document.createElement('div');
    card.className = 'daily-day-card';
    if (day < streak)      card.classList.add('ddc-claimed');
    else if (day === streak) card.classList.add('ddc-today');
    else                     card.classList.add('ddc-future');

    card.innerHTML = `
      <span class="ddc-num">D${day}</span>
      <span class="ddc-icon">${r.icon}</span>
      ${day < streak ? '<span class="ddc-check">✓</span>' : ''}
    `;
    daysRow.appendChild(card);
  });

  // Showcase today's reward
  showcase.innerHTML = `
    <span class="drs-label">${t('todayReward')}</span>
    <span class="drs-icon">${reward.icon}</span>
    <span class="drs-value">${reward.desc}</span>
  `;

  overlay.classList.remove('hidden');

  $('btn-daily-claim').textContent = t('claimReward');
  $('btn-daily-claim').onclick = () => {
    claimDailyReward(reward);
    overlay.classList.add('hidden');
    _updateRankBadge();
  };
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  }, { once: true });
}

// ── MISSIONS PANEL ────────────────────────────────────────────────────────────
let _missionsTimerInterval = null;

function openMissionsPanel() {
  const panel = $('missions-panel');
  panel.classList.remove('hidden');
  _renderMissions();
  _startMissionsTimer();
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

  $('missions-panel').addEventListener('click', function cleanup(e) {
    if (e.target === $('missions-panel') || e.target.id === 'btn-missions-close') {
      clearInterval(_missionsTimerInterval);
      $('missions-panel').removeEventListener('click', cleanup);
    }
  });
}

function _renderMissions() {
  const list     = $('missions-list');
  const missions = getMissions();
  list.innerHTML = '';

  missions.forEach(m => {
    const pct  = Math.min(100, Math.round((m.progress / m.target) * 100));
    const done = m.progress >= m.target;

    const missionLabel = getLang() === 'fr' ? (m.labelFr || m.label) : m.label;
    const claimBtnText = m.claimed ? t('claimed') : done ? t('claim') : t('locked');

    const card = document.createElement('div');
    card.className = 'mission-card' + (m.claimed ? ' mc-claimed' : '');
    card.innerHTML = `
      <div class="mission-label">${missionLabel}</div>
      <div class="mission-progress-row">
        <div class="mission-bar-wrap">
          <div class="mission-bar-fill ${done ? 'mbf-done' : ''}" style="width:${pct}%"></div>
        </div>
        <span class="mission-count">${m.progress}/${m.target}</span>
      </div>
      <div class="mission-reward-row">
        <span class="mission-reward-text">◎ ${m.coins}  ⚡ ${m.xp} XP</span>
        <button class="mission-claim-btn ${m.claimed ? 'mcb-claimed' : done ? 'mcb-ready' : 'mcb-locked'}"
                data-id="${m.id}" ${!done || m.claimed ? 'disabled' : ''}>
          ${claimBtnText}
        </button>
      </div>
    `;
    list.appendChild(card);
  });

  // ── Permanent SR-71 challenge card ──────────────────────────────────────────
  const sr71 = getSr71MissionState();
  const sr71Done  = sr71.progress >= 1;
  const sr71Label = getLang() === 'fr' ? sr71.labelFr : sr71.label;
  const sr71BtnText = sr71.claimed ? t('claimed') : sr71Done ? t('claim') : t('locked');
  const cleanSet  = new Set(sr71.cleanLevels || []);
  const cubesHTML = Array.from({ length: 30 }, (_, i) => {
    const lvl  = i + 1;
    const done = cleanSet.has(lvl);
    return `<div class="sr71-cube${done ? ' sr71-cube-done' : ''}" title="Level ${lvl}"></div>`;
  }).join('');
  const sr71Card = document.createElement('div');
  sr71Card.className = 'mission-card mc-sr71' + (sr71.claimed ? ' mc-claimed' : '');
  sr71Card.innerHTML = `
    <div class="mission-label" style="color:#ff8c00">★ SR-71 CHALLENGE</div>
    <div class="mission-label" style="font-size:6px;opacity:0.8;margin-top:2px">${sr71Label}</div>
    <div class="sr71-cubes">${cubesHTML}</div>
    <div class="sr71-cube-count">${sr71.cleanLevels.length} / 30 levels</div>
    <div class="mission-reward-row">
      <span class="mission-reward-text">◎ ${sr71.coins}  ⚡ ${sr71.xp} XP</span>
      <button class="mission-claim-btn ${sr71.claimed ? 'mcb-claimed' : sr71Done ? 'mcb-ready' : 'mcb-locked'}"
              data-id="sr71_challenge" ${!sr71Done || sr71.claimed ? 'disabled' : ''}>
        ${sr71BtnText}
      </button>
    </div>
  `;
  if (!sr71.claimed && !G.unlockedAircraft.includes('sr71')) list.appendChild(sr71Card);

  list.querySelectorAll('.mission-claim-btn:not([disabled])').forEach(btn => {
    btn.onclick = () => {
      const claimed = btn.dataset.id === 'sr71_challenge'
        ? claimSr71Mission()
        : claimMission(btn.dataset.id);
      if (claimed) {
        _renderMissions();
        _updateMissionsBadge();
        _updateRankBadge();
      }
    };
  });
}
