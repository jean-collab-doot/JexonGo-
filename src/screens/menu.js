import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { LOGIN_REWARDS, claimDailyReward, getMissions, claimMission,
         hasPendingMissionClaim, getPlayerRank } from '../systems/daily.js';
import { save } from '../utils/storage.js';
import { getPilotInfo } from '../data/pilots.js';
import { t, getLang, setLang, applyI18n } from '../i18n.js';

// ── GOOGLE SIGN-IN ───────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = '182729505930-rulb73m14t9qvfpjfbplknrcgn0fqvci.apps.googleusercontent.com';
let _gsiReady = false;

function _ensureGSI() {
  if (_gsiReady) return true;
  if (typeof google === 'undefined' || !google.accounts) return false;
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback:  cred => window._onGoogleCredential?.(cred),
  });
  _gsiReady = true;
  return true;
}

function _updateProfile() {
  const wrap    = document.getElementById('menu-profile');
  const photoEl = document.getElementById('menu-profile-photo');
  const nameEl  = document.getElementById('menu-profile-name');
  const loginDiv = document.querySelector('.login-divider');
  const gBtn    = document.getElementById('btn-login-google');
  const aBtn    = document.getElementById('btn-login-apple');
  const hasGoogle = !!G.playerPhoto;
  if (wrap)      wrap.classList.toggle('hidden', !hasGoogle);
  if (photoEl)   photoEl.src          = G.playerPhoto || '';
  if (nameEl)    nameEl.textContent   = G.playerName  || 'PILOT';
  if (loginDiv)  loginDiv.style.display = hasGoogle ? 'none' : '';
  if (gBtn)      gBtn.style.display   = hasGoogle ? 'none' : '';
  if (aBtn)      aBtn.style.display   = hasGoogle ? 'none' : '';
}

function _handleSignOut() {
  G.playerPhoto = '';
  save('playerPhoto', '');
  _gsiReady = false;
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.disableAutoSelect();
  }
  renderMenu();
}

// ── ASSETS ────────────────────────────────────────────────────────────────────
const PLANE_PATH  = '/assets/menu/anim-3.png';
const FIRE_PATH   = '/assets/menu/engine-fire.png';
const FIRE_FRAMES = 4;

let _planeImg    = null;
let _fireImg     = null;
let _raf         = null;
let _tick        = 0;
let _activeVid   = 'v1'; // which video is currently primary
let _xfadeT      = -1;   // -1 = idle, 0..1 = crossfade progress

function loadAssets() {
  if (_planeImg) return;
  _planeImg = new Image(); _planeImg.src = PLANE_PATH;
  _fireImg  = new Image(); _fireImg.src  = FIRE_PATH;

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
  const vid  = document.getElementById('menu-bg-video');
  const vid2 = document.getElementById('menu-bg-video2');
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

    for (const p of PLANES) {
      const drawH = dH * p.scale;
      const drawW = iw * (drawH / ih);
      const bx    = dW * p.xFrac - drawW / 2;

      if (p.y === null) p.y = dH + drawH + p.startOffset;
      p.y -= p.speed;
      if (p.y < -drawH * 2) { p.y = dH + drawH; p.smoke = []; }

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

  const googleText = document.querySelector('#btn-login-google .login-btn-text');
  if (googleText) googleText.textContent = t('signInGoogle');
  const appleText  = document.querySelector('#btn-login-apple .login-btn-text');
  if (appleText)  appleText.textContent  = t('signInApple');
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
export function initMenu(nav) {
  loadAssets();
  $('btn-play').onclick    = () => nav.toMap();
  $('btn-hangar').onclick  = () => nav.toHangar();
  $('btn-shop').onclick    = () => nav.toShop();
  $('btn-practice').onclick = () => openPracticeSelect(nav);

  $('btn-login-google').onclick  = () => _handleLogin('google');
  $('btn-login-apple').onclick   = () => _handleLogin('apple');
  $('btn-missions').onclick      = () => openMissionsPanel();
  $('btn-missions-close').onclick = () => $('missions-panel').classList.add('hidden');
  $('missions-panel').addEventListener('click', e => {
    if (e.target === $('missions-panel')) $('missions-panel').classList.add('hidden');
  });

  const fbBtn = $('btn-feedback-menu');
  if (fbBtn) fbBtn.onclick = () => window._showFeedbackPopup?.();

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

function _handleLogin(provider) {
  const btn = document.getElementById('btn-login-' + provider);
  if (btn) {
    btn.classList.remove('login-tapped');
    void btn.offsetWidth;
    btn.classList.add('login-tapped');
    btn.addEventListener('animationend', () => btn.classList.remove('login-tapped'), { once: true });
  }
  if (provider === 'google') {
    if (!_ensureGSI()) { _showToast('■ Google not available'); return; }
    google.accounts.id.prompt(n => {
      if (n.isNotDisplayed?.() || n.isSkippedMoment?.()) {
        _showToast('■ Google popup blocked\nTry disabling ad blocker');
      }
    });
    return;
  }
  _showToast('■ Apple sign-in\nCOMING SOON');
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
  _updateProfile();
  _applyLang();
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

  list.querySelectorAll('.mission-claim-btn:not([disabled])').forEach(btn => {
    btn.onclick = () => {
      if (claimMission(btn.dataset.id)) {
        _renderMissions();
        _updateMissionsBadge();
        _updateRankBadge();
      }
    };
  });
}
