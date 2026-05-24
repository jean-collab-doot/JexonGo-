import { G, resetLevel } from '../state.js';
import { $, showScreen } from '../utils/dom.js';
import { newQuestion } from '../game/math-engine.js';
import { spawnEnemy, updateEnemies, hitEnemy } from '../game/enemies.js';
import { createMissile, updateMissiles, drawMissiles } from '../game/missiles.js';
import { spawnExplosion, spawnHitSpark, updateParticles, drawParticles } from '../game/particles.js';
import { drawAircraftSprite, drawEnemySprite, drawEngineFire, getPlayerSize } from '../game/aircraft-draw.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { SKINS } from '../data/skins.js';
import { getPrestigeBadgeHTML } from '../data/prestige.js';
import { getLevel } from '../data/levels.js';
import { SFX } from '../audio/sound.js';
import { preloadBiome } from '../game/sprites.js';
import { initBackground, updateBackground, drawBackground } from '../game/background.js';
import { trackMission } from '../systems/daily.js';
import { getPilotGrade } from '../data/pilots.js';
import { applyAgeModifiers } from '../systems/age-modifiers.js';
import { calcSpeedXP } from '../systems/xp.js';
import { save } from '../utils/storage.js';
import { t } from '../i18n.js';

// ── GRADE-BASED MATH FILTER ───────────────────────────────────────────────────
// Each grade has its own ops, number cap, and multiplication cap.
// Level config values are clamped DOWN to the grade ceiling — never up.
const GRADE_PROFILES = {
  1: { ops: ['+'],              cap: 10,  mCap: 0  },  // 1+9, simple addition
  2: { ops: ['+', '-'],         cap: 20,  mCap: 0  },  // 15-7, add/sub to 20
  3: { ops: ['+', '-', '*'],    cap: 50,  mCap: 5  },  // ×2–×5 times tables
  4: { ops: ['+', '-', '*', '/'], cap: 100, mCap: 10 }, // full ×10 tables
  5: { ops: ['+', '-', '*', '/'], cap: 200, mCap: 12 }, // ×12 tables, bigger sums
  6: { ops: ['+', '-', '*', '/'], cap: 500, mCap: 15 }, // challenge level
};

function applyGradeToQuestion(ops, cap, mCap, grade) {
  if (!grade) return { ops, cap, mCap };
  const p = GRADE_PROFILES[grade] || GRADE_PROFILES[6];
  const allowedOps = ops.filter(o => p.ops.includes(o));
  return {
    ops:  allowedOps.length ? allowedOps : ['+'],
    cap:  Math.min(cap,  p.cap),
    mCap: Math.min(mCap, p.mCap),
  };
}

let canvas, ctx, levelCfg;
let _timerTotal = 10;
let tick        = 0;
let shakeFrames = 0;
let _onComplete = null;
let spawnTimer  = 0;
let _cutsceneActive = false;
let _maxLives = 3;
let _fireTick    = 0;
let _bankTilt    = 0;   // current tilt in radians (smoothed)
let _resizeTimer = null;
let _topGrad     = null;
let _topGradH    = 0;
let _cachedSkinData   = null;
let _cachedLiveryData = null;
let _lastSkinId       = null;
let _lastLiveryId     = null;
let spawnRate   = 150;
let maxEnemies  = 5;
let _sessionId    = 0;
let _invincible   = 0;
let _stealthActive  = false;
let _stealthTicks   = 0;   // 60 ticks = 1 second
let _stealthAnswers = 0;   // correct-answer counter for stealth trigger
let _mgActive       = false;
let _mgTicks        = 0;
let _mgAnswers      = 0;
let _mgFireTimer    = 0;   // frames until next machine-gun shot
let _nukeAnim       = 0;   // counts down from 90 while nuke animation plays
let _nukeApplied    = false;
let _nukeAnswers    = 0;
let _revealTimer  = null;
let _skipHandler  = null;
let _transitioning = false;
let _shipFrame  = 0;   // player ship animation (0–4, cycled every tick)
let _godMode    = false;
const _gameCT   = new Map(); // cheat key timestamps

// ── INPUT ───────────────────────────────────────────────────────────────────
const keys = {
  ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false,
  a: false, d: false, w: false, s: false,
};
let pointerTarget  = null;   // desktop mouse follow
let _jsOrigin      = null;   // virtual joystick: touch-start position
let _jsCurrent     = null;   // virtual joystick: current touch position
let _jsVelX        = 0;
let _jsVelY        = 0;
let velX = 0, velY = 0;
const MOVE_SPEED   = 3.5;
const ACCEL        = 0.4;
const FRICTION     = 0.80;
const LERP         = 0.12;
const JS_RADIUS    = 72;     // max joystick drag radius (px on screen)

function normaliseKey(k) { return k.length === 1 ? k.toLowerCase() : k; }

function _gameCheatHeld(keys) {
  const now = Date.now();
  return keys.every(k => _gameCT.has(k) && now - _gameCT.get(k) < 600);
}
function onKeyDown(e) {
  const k = normaliseKey(e.key);
  if (k in keys) { keys[k] = true; pointerTarget = null; e.preventDefault(); }
  _gameCT.set(k, Date.now());
  if (_gameCheatHeld(['y', 'u']))             _toggleGodMode();
  if (_gameCheatHeld(['q', 'w', 'e']))        _killBoss();
  if (_gameCheatHeld(['r', 'm', 'h', 'u']))   _winLevel();
}
function onKeyUp(e) {
  const k = normaliseKey(e.key);
  if (k in keys) keys[k] = false;
}
function _toggleGodMode() {
  _gameCT.delete('y'); _gameCT.delete('u');
  _godMode = !_godMode;
  const badge = document.getElementById('hud-godmode');
  if (badge) badge.classList.toggle('hidden', !_godMode);
}
function _winLevel() {
  _gameCT.delete('r'); _gameCT.delete('m'); _gameCT.delete('h'); _gameCT.delete('u');
  endLevel(true);
}
function _killBoss() {
  _gameCT.delete('q'); _gameCT.delete('w'); _gameCT.delete('e');
  const boss = G.enemies.find(e => e.type === 'boss' && e.active);
  if (!boss) return;
  spawnExplosion(G.particles, boss.x, boss.y, boss.color || '#fbbf24', 40);
  SFX.explode();
  boss.active = false;
  G.enemies = G.enemies.filter(e => e.active);
  shakeFrames = 20;
  if (levelCfg.isBossLevel) setTimeout(() => endLevel(true), 800);
}

function canvasPointer(e) {
  const r   = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  const x   = src.clientX - r.left;
  const y   = src.clientY - r.top;

  if (e.touches) {
    // ── Virtual joystick ────────────────────────────────────────────────
    if (e.type === 'touchstart') {
      _jsOrigin  = { x, y };
      _jsCurrent = { x, y };
      _jsVelX = _jsVelY = 0;
      pointerTarget = null;
    } else if (_jsOrigin) {
      _jsCurrent = { x, y };
      const dx   = x - _jsOrigin.x;
      const dy   = y - _jsOrigin.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const ratio = Math.min(dist, JS_RADIUS) / JS_RADIUS;
        _jsVelX = (dx / dist) * ratio * MOVE_SPEED;
        _jsVelY = (dy / dist) * ratio * MOVE_SPEED;
      } else {
        _jsVelX = _jsVelY = 0;
      }
    }
  } else {
    // Desktop mouse — direct follow (unchanged)
    pointerTarget = { x, y };
  }
}

function clearPointer() {
  pointerTarget = null;
  _jsOrigin = _jsCurrent = null;
  _jsVelX = _jsVelY = 0;
}

function updatePlayerMovement() {
  const margin  = 16;
  const minY    = canvas.height * 0.08;
  const maxY    = canvas.height - _qboxH - 80;

  if (_jsOrigin) {
    // Joystick touch: apply velocity directly, no lerp lag
    G.player.x += _jsVelX;
    G.player.y += _jsVelY;
    velX = velY = 0;
  } else if (pointerTarget) {
    velX = 0; velY = 0;
    G.player.x += (pointerTarget.x - G.player.x) * LERP;
    G.player.y += (pointerTarget.y - G.player.y) * LERP;
  } else {
    if (keys.ArrowLeft  || keys.a) velX = Math.max(velX - ACCEL, -MOVE_SPEED);
    else if (velX < 0)             velX *= FRICTION;
    if (keys.ArrowRight || keys.d) velX = Math.min(velX + ACCEL,  MOVE_SPEED);
    else if (velX > 0)             velX *= FRICTION;
    if (keys.ArrowUp    || keys.w) velY = Math.max(velY - ACCEL, -MOVE_SPEED);
    else if (velY < 0)             velY *= FRICTION;
    if (keys.ArrowDown  || keys.s) velY = Math.min(velY + ACCEL,  MOVE_SPEED);
    else if (velY > 0)             velY *= FRICTION;
    if (Math.abs(velX) < 0.05) velX = 0;
    if (Math.abs(velY) < 0.05) velY = 0;
    G.player.x += velX;
    G.player.y += velY;
  }
  G.player.x = Math.max(margin, Math.min(canvas.width  - margin, G.player.x));
  G.player.y = Math.max(minY,   Math.min(maxY,                   G.player.y));
}

function attachInputListeners() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup',   onKeyUp);
  canvas.addEventListener('touchstart', canvasPointer, { passive: true });
  canvas.addEventListener('touchmove',  canvasPointer, { passive: true });
  canvas.addEventListener('touchend',   clearPointer);
}

function detachInputListeners() {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup',   onKeyUp);
  canvas.removeEventListener('touchstart', canvasPointer);
  canvas.removeEventListener('touchmove',  canvasPointer);
  canvas.removeEventListener('touchend',   clearPointer);
}

// ── RESIZE ─────────────────────────────────────────────────────────────────
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  if (G.animFrame) { cancelAnimationFrame(G.animFrame); G.animFrame = null; }
  // Tablet: render at 65% resolution, scale up smoothly — fewer pixels, no sprite deformation
  const dpr = _isTablet ? 0.65 : _isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1);
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  if (_isTablet) {
    canvas.style.width          = w + 'px';
    canvas.style.height         = h + 'px';
    canvas.style.imageRendering = 'auto';
    ctx.imageSmoothingEnabled   = true;
    ctx.imageSmoothingQuality   = 'low';
  } else {
    canvas.style.width = canvas.style.height = canvas.style.imageRendering = '';
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  _qboxH = $('question-box').offsetHeight || 180;
  G.player.x = Math.max(16, Math.min(w - 16,  G.player.x || w / 2));
  G.player.y = Math.max(h * 0.08, Math.min(h - _qboxH - 80, G.player.y || h - _qboxH - 60));
  if (!_cutsceneActive) G.animFrame = requestAnimationFrame(frame);
}

function placePlayer() {
  G.player.x = canvas.width  / 2;
  G.player.y = canvas.height - _qboxH - 160;
}

// ── LOADING SCREEN ──────────────────────────────────────────────────────────
function drawLoadingScreen() {
  const cw = canvas.width, ch = canvas.height;
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, cw, ch);
  const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.004);
  ctx.save();
  ctx.globalAlpha  = pulse;
  ctx.fillStyle    = '#00d4ff';
  ctx.font         = 'bold 18px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t('loading'), cw / 2, ch / 2);
  ctx.restore();
}

// ── GAME LOOP ───────────────────────────────────────────────────────────────
function frame(ts = 0) {
  if (_frameInterval) {
    const elapsed = ts - _lastFrameTs;
    if (elapsed < _frameInterval) {
      if (!_cutsceneActive) G.animFrame = requestAnimationFrame(frame);
      return;
    }
    // Subtract overshoot so timing doesn't drift over time
    _lastFrameTs = ts - (elapsed % _frameInterval);
  } else {
    _lastFrameTs = ts;
  }

  tick++;
  _shipFrame = (_shipFrame + 0.08) % 5;

  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const shaking = shakeFrames > 0;
  if (shaking) {
    ctx.save();
    ctx.translate((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7);
    shakeFrames--;
  }

  // ── Background ─────────────────────────────────────────────────────────
  updateBackground();
  drawBackground(ctx, canvas);

  // ── Weather overlay ────────────────────────────────────────────────────
  if (levelCfg.weather?.overlay) {
    ctx.fillStyle = levelCfg.weather.overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ── Speed lines ────────────────────────────────────────────────────────
  if (!_isMobile && !_isTablet) {
    if (_speedLines.length === 0) initSpeedLines(canvas.width, canvas.height);
    drawSpeedLines(ctx, canvas.width, canvas.height);
  }

  // ── Enemy spawn ────────────────────────────────────────────────────────
  spawnTimer--;
  if (spawnTimer <= 0 && G.enemies.filter(e => e.type !== 'boss' && e.active).length < maxEnemies) {
    const types = levelCfg.isBossLevel ? levelCfg.bossCompanionTypes : levelCfg.enemyTypes;
    const type  = types[Math.floor(Math.random() * types.length)];
    const e     = spawnEnemy(canvas.width, type);
    e.speed        *= levelCfg.enemySpeedMult * (canvas.width < 500 ? 1.45 : 1);
    e.fireRate      = Math.max(30, Math.floor(e.fireRate * levelCfg.enemyFireRateMult));
    e.fireCooldown  = e.fireRate + Math.floor(Math.random() * 40);
    G.enemies.push(e);
    spawnTimer = spawnRate;
  }
  G.enemies = G.enemies.filter(e => e.type === 'boss' || e.y < canvas.height + 80);

  // Level-based missile guidance strength and homing probability
  const _guideF = G.currentLevel >= 50 ? 0.10
                : G.currentLevel >= 26 ? 0.06
                : G.currentLevel >= 11 ? 0.03
                : 0.015;
  const _homingChance = G.currentLevel >= 50 ? 0.70
                      : G.currentLevel >= 26 ? 0.55
                      : G.currentLevel >= 11 ? 0.35
                      : 0.20;

  // ── Enemies ────────────────────────────────────────────────────────────
  updateEnemies(G.enemies, canvas.width);
  for (const e of G.enemies) {
    if (!e.active) continue;

    if (e.type === 'boss') {
      // Boss fires in bursts then pauses; timing/speed/color vary by milestone
      if (e.bossPhase === 'pause') {
        e.bossPauseTimer--;
        if (e.bossPauseTimer <= 0) {
          e.bossPhase    = 'burst';
          e.bossBurstFired = 0;
          e.bossBurstTimer = 0;
        }
      } else {
        e.bossBurstTimer--;
        if (e.bossBurstTimer <= 0 && e.bossBurstFired < e.bossBurstMax) {
          const ms = e._missileSpd  ?? 2.5;
          const mc = e._missileColor ?? '#ef4444';
          { const em = createMissile(e.x, e.y, G.player.x, G.player.y, ms, null, mc); em.guideTick = 180; G.enemyMissiles.push(em); }
          SFX.missile();
          e.bossBurstFired++;
          e.bossBurstTimer = e._burstInterval ?? 28;
        }
        if (e.bossBurstFired >= e.bossBurstMax) {
          e.bossPhase      = 'pause';
          e.bossPauseTimer = e._pauseFrames ?? 300;
        }
      }

      // ── Boss movement ──────────────────────────────────────────────────
      e._moveTimer--;
      if (e._moveTimer <= 0) {
        const m     = canvas.width * (1 - e._xRange) / 2;
        const randX = m + Math.random() * (canvas.width - m * 2);
        // Higher milestones blend target toward player X (more threatening)
        e._targetX  = randX + (G.player.x - randX) * (e._trackX ?? 0);
        const yLo   = canvas.height * (e._yMinF ?? 0.08);
        const yHi   = canvas.height * (e._yMaxF ?? 0.28);
        e._targetY  = yLo + Math.random() * (yHi - yLo);
        e._moveTimer = (e._moveInterval ?? 110) + Math.floor(Math.random() * 20) - 10;
      }
      // Velocity + damping — gradual acceleration and natural deceleration
      const spd = e._moveSpeed ?? 0.010;
      e._vx = (e._vx ?? 0) * 0.90 + (e._targetX - e.x) * spd;
      e._vy = (e._vy ?? 0) * 0.90 + (e._targetY - e.y) * spd;
      e.x += e._vx;
      e.y += e._vy;
      // Hard constraint: boss always stays in front of (above) the player
      const frontY = G.player.y - 110;
      if (e.y > frontY) {
        e.y = frontY;
        if (e._targetY > frontY) e._targetY = frontY * 0.8;
      }
      e.x = Math.max(44, Math.min(canvas.width - 44, e.x));

    } else {
      e.fireCooldown--;
      const inFireZone = e.y > canvas.height * 0.25 && e.y < canvas.height * 0.78 && e.y < G.player.y;
      if (e.fireCooldown <= 0 && inFireZone && !_stealthActive) {
        e.fireCooldown = e.fireRate;
        const _homing = Math.random() < _homingChance;
        const em = createMissile(e.x, e.y, G.player.x, G.player.y, 2.5, null, _homing ? '#f97316' : '#ef4444');
        if (_homing) em.guideTick = 180;
        G.enemyMissiles.push(em);
        SFX.missile();
      } else if (e.fireCooldown <= 0) {
        e.fireCooldown = e.fireRate;
      }
    }

    const ox = e.shakeTick > 0 ? (Math.random() - 0.5) * 5 : 0;
    const origX = e.x;
    e.x += ox;
    const bankAngle = (e.vx || 0) * 0.13;
    drawEnemySprite(ctx, e, bankAngle);
    e.x = origX;

    if (e.label) {
      ctx.fillStyle    = 'rgba(255,255,255,0.8)';
      ctx.font         = 'bold 9px monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(e.label, e.x + ox, e.y - e.size - 6);
    }
  }

  // ── Player missiles — re-aim at enemy's current position each frame ────────
  for (const m of G.missiles) {
    const enemy = G.enemies.find(e => e.id === m.enemyId && e.active);
    if (enemy) {
      const dx  = enemy.x - m.x, dy = enemy.y - m.y;
      const d   = Math.sqrt(dx * dx + dy * dy) || 1;
      const spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      m.tx = enemy.x; m.ty = enemy.y;
      m.vx = (dx / d) * spd;
      m.vy = (dy / d) * spd;
    }
  }
  updateMissiles(G.missiles, m => {
    const e = G.enemies.find(en => en.id === m.enemyId);
    if (e && e.active) onMissileHit(e, m);
  });
  drawMissiles(ctx, G.missiles, false);

  // ── Enemy missiles (with level-based guidance) ─────────────────────────
  for (let i = G.enemyMissiles.length - 1; i >= 0; i--) {
    const m  = G.enemyMissiles[i];
    const dx = m.x - G.player.x, dy = m.y - G.player.y;
    if (!_stealthActive && dx * dx + dy * dy < 22 * 22) {
      G.enemyMissiles.splice(i, 1);
      onEnemyMissileHit();
      break;
    }
    if (m.y > canvas.height + 40 || m.x < -60 || m.x > canvas.width + 60) {
      G.enemyMissiles.splice(i, 1); continue;
    }
    // Guidance: steer toward player for up to 5 s (300 frames)
    if (_guideF > 0 && m.guideTick > 0) {
      m.guideTick--;
      const tdx = G.player.x - m.x, tdy = G.player.y - m.y;
      const td  = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
      if (!m._spd) m._spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      m.vx = m.vx * (1 - _guideF) + (tdx / td) * m._spd * _guideF;
      m.vy = m.vy * (1 - _guideF) + (tdy / td) * m._spd * _guideF;
    }
    m.x += m.vx;
    m.y += m.vy;
    m.boltFrame = 0;

  }
  drawMissiles(ctx, G.enemyMissiles, true);

  // ── Machine gun (F/A-18) ───────────────────────────────────────────────
  if (_mgActive) {
    if (--_mgTicks <= 0) _mgActive = false;
    if (--_mgFireTimer <= 0) {
      const t = nearestEnemy();
      if (t) {
        G.missiles.push(createMissile(G.player.x, G.player.y, t.x, t.y, 16, t.id, '#f97316'));
        SFX.missile();
      }
      _mgFireTimer = 8; // ~7 shots/sec at 60 fps
    }
  }

  // ── Particles ──────────────────────────────────────────────────────────
  updateParticles(G.particles);
  drawParticles(ctx, G.particles);

  // ── Player ─────────────────────────────────────────────────────────────
  if (_invincible > 0) _invincible--;
  if (_stealthActive && --_stealthTicks <= 0) _stealthActive = false;
  const prevX = G.player.x;
  updatePlayerMovement();
  const _moveDelta = G.player.x - prevX;
  const _targetTilt = _moveDelta > 0.5 ? 0.349 : _moveDelta < -0.5 ? -0.349 : 0;
  _bankTilt += (_targetTilt - _bankTilt) * 0.1;
  if (Math.abs(_bankTilt) < 0.001) _bankTilt = 0;
  const bankAngle = _bankTilt;
  const flashAlpha = _invincible > 0
    ? (Math.floor(_invincible / 6) % 2 === 0 ? 1.0 : 0.25)
    : _stealthActive
      ? 0.28 + 0.12 * Math.sin(tick * 0.18)  // slow ghost pulse
      : 1.0;

  if (G.activeSkin    !== _lastSkinId)    { _cachedSkinData   = SKINS.find(s => s.id === G.activeSkin);    _lastSkinId    = G.activeSkin; }
  if (G.activeLivery  !== _lastLiveryId)  { _cachedLiveryData = SKINS.find(s => s.id === G.activeLivery);  _lastLiveryId  = G.activeLivery; }
  const activeSkinData   = _cachedSkinData;
  const activeLiveryData = _cachedLiveryData;
  const skinFilter    = activeLiveryData?.filter || '';
  const skinAircraft  = (activeSkinData ?? activeLiveryData)?.aircraft ?? G.activeAircraft;

  if (!_isMobile && !_isTablet) {
    _fireTick++;
    drawEngineFire(ctx, G.activeAircraft, G.player.x, G.player.y, _fireTick, bankAngle);
  }

  const _inGameImg = activeSkinData?.skinImg || activeSkinData?.offerImg;
  if (_inGameImg) {
    // Draw the skin artwork image directly as the player plane
    const cached = _skinImgCache[_inGameImg];
    if (cached?.complete) {
      const sz = getPlayerSize();
      ctx.save();
      if (flashAlpha !== 1) ctx.globalAlpha = flashAlpha;
      ctx.translate(G.player.x, G.player.y);
      if (bankAngle) ctx.rotate(bankAngle);
      ctx.drawImage(cached, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    } else {
      drawAircraftSprite(ctx, skinAircraft, G.player.x, G.player.y, _shipFrame, flashAlpha, bankAngle, skinFilter);
    }
  } else {
    drawAircraftSprite(ctx, skinAircraft, G.player.x, G.player.y, _shipFrame, flashAlpha, bankAngle, skinFilter);
  }

  ctx.globalAlpha = 1;

  if (shaking) ctx.restore();

  // ── Virtual joystick indicator (touch only) ────────────────────────────
  if (_jsOrigin && _jsCurrent) {
    const dx   = _jsCurrent.x - _jsOrigin.x;
    const dy   = _jsCurrent.y - _jsOrigin.y;
    const dist = Math.min(Math.hypot(dx, dy), JS_RADIUS);
    const knobX = _jsOrigin.x + (dist > 0 ? (dx / Math.hypot(dx, dy)) * dist : 0);
    const knobY = _jsOrigin.y + (dist > 0 ? (dy / Math.hypot(dx, dy)) * dist : 0);
    ctx.save();
    // Outer ring
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.arc(_jsOrigin.x, _jsOrigin.y, JS_RADIUS, 0, Math.PI * 2); ctx.stroke();
    // Knob
    ctx.globalAlpha = 0.38;
    ctx.fillStyle   = '#00d4ff';
    ctx.beginPath(); ctx.arc(knobX, knobY, 22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ── Nuke animation overlay ─────────────────────────────────────────────
  if (_nukeAnim > 0) {
    if (_nukeAnim === 55 && !_nukeApplied) { _nukeApplied = true; applyNuke(); }
    const t  = 1 - _nukeAnim / 90;          // 0 → 1 over the animation
    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;

    // Flash overlay
    let fl = t < 0.33 ? t / 0.33 : t < 0.55 ? 1 : 1 - (t - 0.55) / 0.25;
    fl = Math.max(0, Math.min(1, fl)) * 0.85;
    ctx.fillStyle = `rgba(255,200,60,${fl})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Expanding shockwave ring
    if (t > 0.1 && t < 0.95) {
      const rt  = (t - 0.1) / 0.85;
      const r   = Math.hypot(canvas.width, canvas.height) * rt;
      const ra  = (1 - rt) * 0.9;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,80,0,${ra})`;
      ctx.lineWidth = 20;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,220,0,${ra * 0.55})`;
      ctx.lineWidth = 9;
      ctx.stroke();
    }

    // ☢ NUKE label
    if (t > 0.04 && t < 0.78) {
      const ta = t < 0.15 ? t / 0.15 : t > 0.62 ? (0.78 - t) / 0.16 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, ta);
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(canvas.height * 0.11)}px sans-serif`;
      ctx.fillStyle = t < 0.5 ? '#1a0000' : '#ff4400';
      ctx.fillText('☢ NUKE', cx, cy);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    _nukeAnim--;
  }

  // Top-edge fade — drawn last so it overlays all game elements
  const fadeH = Math.round(canvas.height * 0.13);
  if (!_topGrad || _topGradH !== fadeH) {
    _topGrad  = ctx.createLinearGradient(0, 0, 0, fadeH);
    _topGrad.addColorStop(0, 'rgba(0,0,0,0.82)');
    _topGrad.addColorStop(1, 'rgba(0,0,0,0)');
    _topGradH = fadeH;
  }
  ctx.fillStyle = _topGrad;
  ctx.fillRect(0, 0, canvas.width, fadeH);

  if (!_cutsceneActive) G.animFrame = requestAnimationFrame(frame);
}

// ── COMBAT ──────────────────────────────────────────────────────────────────
function nearestEnemy() {
  let best = null, bestDist = Infinity;
  for (const e of G.enemies) {
    if (!e.active) continue;
    const dx = e.x - G.player.x, dy = e.y - G.player.y;
    const d  = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

function nearestEnemies(n) {
  return G.enemies
    .filter(e => e.active)
    .sort((a, b) => {
      const da = (a.x - G.player.x) ** 2 + (a.y - G.player.y) ** 2;
      const db = (b.x - G.player.x) ** 2 + (b.y - G.player.y) ** 2;
      return da - db;
    })
    .slice(0, n);
}

function fireEnemyMissile() {
  const enemy = nearestEnemy();
  if (!enemy) return;
  const m = createMissile(enemy.x, enemy.y, G.player.x, G.player.y, 2.5, null, '#ef4444');
  G.enemyMissiles.push(m);
  SFX.missile();
}

function applyNuke() {
  const toRemove = [];
  for (const e of G.enemies) {
    if (!e.active) continue;
    if (e.type === 'boss') {
      e.currentHp = Math.max(1, Math.floor((e.maxHp || e.currentHp) / 2));
      e.shakeTick  = 30;
      spawnExplosion(G.particles, e.x, e.y, '#ff6600', 24);
      SFX.explode();
    } else {
      spawnExplosion(G.particles, e.x, e.y, e.color, 22);
      SFX.explode();
      toRemove.push(e);
    }
  }
  toRemove.forEach(e => { e.active = false; });
  G.enemies = G.enemies.filter(e => e.active);
}

function onEnemyMissileHit() {
  if (G.lives <= 0 || _invincible > 0) return;
  G.missileHitsReceived = (G.missileHitsReceived || 0) + 1;
  if (!G.practiceMode && G.currentLevel <= 30) {
    G.sr71MissileHits = (G.sr71MissileHits || 0) + 1;
    save('sr71MissileHits', G.sr71MissileHits);
  }
  spawnExplosion(G.particles, G.player.x, G.player.y, '#ef4444', 14);
  SFX.explode();
  shakeFrames = 14;
  loseLife();
}

function onMissileHit(enemy, missile) {
  SFX.explode();
  const destroyed = hitEnemy(enemy, missile?.damage ?? 1);
  if (destroyed) {
    spawnExplosion(G.particles, enemy.x, enemy.y, enemy.color, 18);
    enemy.active = false;
    shakeFrames  = 6;
    G.enemies    = G.enemies.filter(e => e.active);
    // Boss killed → win the boss level immediately
    if (enemy.type === 'boss' && levelCfg.isBossLevel) {
      setTimeout(() => endLevel(true), 800);
    }
  } else {
    spawnHitSpark(G.particles, enemy.x, enemy.y);
  }
}

// ── QUESTION CYCLE ───────────────────────────────────────────────────────────
function nextQuestion() {
  if (_transitioning) return;
  if (!levelCfg.isBossLevel && G.questionsAnswered >= levelCfg.questionCount) { endLevel(true); return; }
  _transitioning = true;
  G.answerLocked = false;
  const _nqSid = _sessionId; // capture session at start of transition

  // Remove any pending skip listener
  if (_skipHandler) {
    document.removeEventListener('pointerdown', _skipHandler, true);
    _skipHandler = null;
  }
  clearTimeout(_revealTimer);
  _revealTimer = null;

  // Undim and resume game loop
  const overlay = $('game-pause-overlay');
  overlay.classList.remove('dimmed');
  if (!G.animFrame && !_cutsceneActive) G.animFrame = requestAnimationFrame(frame);

  const reveal = $('correct-answer-reveal');
  const qbox   = $('question-box');

  qbox.classList.add('fading');

  setTimeout(() => {
    // If the level ended while we were transitioning, abort
    if (_sessionId !== _nqSid) { _transitioning = false; return; }

    // Hide reveal banner
    reveal.classList.add('hidden');
    reveal.classList.remove('hiding');

    // Swap in new question — apply grade filter
    const rawOps  = G.practiceMode ? G.practiceOps : levelCfg.ops;
    const rawCap  = G.practiceMode ? 20 : levelCfg.mathCap;
    const rawMCap = G.practiceMode ? 12 : levelCfg.mathMultCap;
    const { ops, cap, mCap } = applyGradeToQuestion(rawOps, rawCap, rawMCap, G.playerGrade);
    G.question = newQuestion(ops, cap, mCap);
    $('question-text').textContent = G.question.text;
    const btns = $('answer-buttons');
    btns.innerHTML = '';
    G.question.choices.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = c;
      btn.addEventListener('click', () => handleAnswer(c, btn));
      btns.appendChild(btn);
    });

    // Fade back in
    qbox.classList.remove('fading');
    qbox.classList.add('appearing');
    setTimeout(() => { qbox.classList.remove('appearing'); _transitioning = false; }, 730);
    startTimer();
  }, 620);
}

function startTimer() {
  if (G.timerInterval) clearInterval(G.timerInterval);

  // Practice unlimited mode — freeze timer bar, no countdown
  if (G.practiceMode && G.practiceTimeLimit === null) {
    G.timeLeft  = 9999;
    _timerTotal = 9999;
    $('timer-bar').style.width      = '100%';
    $('timer-bar').style.background = 'var(--dim, #334155)';
    return;
  }

  const aircraft   = AIRCRAFT[G.activeAircraft] || AIRCRAFT.t6;
  const baseTime   = G.practiceMode
    ? G.practiceTimeLimit
    : levelCfg.timeLimit + (levelCfg.weather?.timeMod || 0);
  const timerLimit = aircraft.timerOverride != null
    ? Math.min(aircraft.timerOverride, baseTime)
    : baseTime;
  G.timeLeft  = Math.max(3, timerLimit);
  _timerTotal = G.timeLeft;
  $('timer-bar').style.width      = '100%';
  $('timer-bar').style.background = 'var(--accent)';
  _runTimer();
}

function _runTimer() {
  if (G.timerInterval) clearInterval(G.timerInterval);
  const bar      = $('timer-bar');
  const timerSid = _sessionId;
  G.timerInterval = setInterval(() => {
    if (_sessionId !== timerSid) { clearInterval(G.timerInterval); return; }
    if (G.answerLocked) return;
    G.timeLeft -= 0.1;
    const pct = Math.max(0, G.timeLeft / _timerTotal) * 100;
    bar.style.width = pct + '%';
    if (pct < 25)      bar.style.background = 'var(--red)';
    else if (pct < 55) bar.style.background = 'var(--yellow)';
    if (pct < 25 && Math.floor(G.timeLeft * 10) % 5 === 0) SFX.timerWarn();
    if (G.timeLeft <= 0) { clearInterval(G.timerInterval); handleTimeout(); }
  }, 100);
}

// ── ANSWER HANDLING ──────────────────────────────────────────────────────────
function handleAnswer(choice, btn) {
  if (G.answerLocked) return;
  G.answerLocked = true;
  clearInterval(G.timerInterval);
  document.querySelectorAll('.answer-btn').forEach(b => b.disabled = true);

  const correct = choice === G.question.answer;
  btn.classList.add(correct ? 'correct' : 'wrong');

  if (correct) {
    SFX.correct();
    G.correctAnswers++;
    G.questionsAnswered++;
    G.sessionXP += calcSpeedXP(G.timeLeft, _timerTotal);
    G.streak++;
    updateStreakHUD();
    if (G.streak === 3 || G.streak === 5) SFX.streak();
    trackMission('correct_answers', 1);
    trackMission('max_streak', G.streak);

    const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.t6;

    if (aircraft.ability === 'stealth') {
      _stealthAnswers++;
      if (_stealthAnswers % 5 === 0) {
        _stealthActive = true;
        _stealthTicks  = 600; // 10 s at 60 fps
      }
    }

    if (aircraft.ability === 'multiStealth') {
      _stealthAnswers++;
      if (_stealthAnswers % 3 === 0) {
        _stealthActive = true;
        _stealthTicks  = 600; // 10 s at 60 fps
      }
    }

    if (aircraft.ability === 'machineGun') {
      _mgAnswers++;
      if (_mgAnswers % 5 === 0) {
        _mgActive    = true;
        _mgTicks     = 300; // 5 s at 60 fps
        _mgFireTimer = 0;
      }
    }

    if (aircraft.ability === 'nuke') {
      _nukeAnswers++;
      if (_nukeAnswers % 10 === 0) {
        _nukeAnim    = 90;
        _nukeApplied = false;
      }
    }

    const baseSpeed    = aircraft.ability === 'fastMissile' ? 13 : 8;
    const speed        = baseSpeed * (aircraft.missileSpdMult ?? 1);
    const damage       = aircraft.ability === 'doubleDamage' ? 2
                       : aircraft.ability === 'heavyMissile' ? 1.4
                       : aircraft.ability === 'tripleShot'  ? 1.25
                       : 1;
    const missileColor = G.prestige >= 3 ? '#a855f7' : '#00d4ff';
    const target       = nearestEnemy();
    if (target) {
      if (aircraft.ability === 'multiShot' || aircraft.ability === 'multiStealth') {
        nearestEnemies(2).forEach((t, i) => {
          G.missiles.push(createMissile(G.player.x, G.player.y, t.x, t.y, speed, t.id, missileColor, damage));
          setTimeout(() => SFX.missile(), i * 60);
        });
      } else if (aircraft.ability === 'tripleShot') {
        nearestEnemies(3).forEach((t, i) => {
          G.missiles.push(createMissile(G.player.x, G.player.y, t.x, t.y, speed, t.id, missileColor, damage));
          setTimeout(() => SFX.missile(), i * 60);
        });
      } else {
        G.missiles.push(createMissile(G.player.x, G.player.y, target.x, target.y, speed, target.id, missileColor, damage));
        SFX.missile();
      }
    }
  } else {
    SFX.wrong();
    G.questionsAnswered++;
    G.streak = 0;
    updateStreakHUD();
    revealCorrectAnswer();
    // Wrong answer breaks the SR-71 run — reset all cube progress
    if (!G.practiceMode && G.currentLevel <= 30) {
      G.sr71WrongAnswers = (G.sr71WrongAnswers || 0) + 1;
      G.sr71CleanLevels  = [];
      save('sr71WrongAnswers', G.sr71WrongAnswers);
      save('sr71CleanLevels',  []);
    }
  }

  const sid = _sessionId;
  const delay = correct ? (_nukeAnim > 0 ? 2000 : 600) : 10000;
  _revealTimer = setTimeout(() => {
    if (_sessionId !== sid) return;
    if (correct) {
      if (levelCfg.isBossLevel || G.questionsAnswered < levelCfg.questionCount) nextQuestion();
      else endLevel(true);
    } else {
      loseLife();
    }
  }, delay);

  if (!correct) {
    _skipHandler = () => {
      document.removeEventListener('pointerdown', _skipHandler, true);
      _skipHandler = null;
      clearTimeout(_revealTimer);
      _revealTimer = null;
      if (_sessionId !== sid) return;
      loseLife();
    };
    setTimeout(() => {
      if (_skipHandler) document.addEventListener('pointerdown', _skipHandler, true);
    }, 50);
  }
}

function buildExplanation(q) {
  const { a, b, op, answer } = q;
  const keyMap = { '+': 'explainAdd', '-': 'explainSub', '*': 'explainMul', '/': 'explainDiv' };
  const key = keyMap[op];
  if (!key) {
    const sym = op === '*' ? '×' : op === '/' ? '÷' : op;
    return `${a} ${sym} ${b} = ${answer}`;
  }
  return t(key).replace(/\{(\w+)\}/g, (_, k) => ({ a, b, answer })[k] ?? k);
}

function revealCorrectAnswer() {
  const correct = String(G.question.answer).trim();
  document.querySelectorAll('.answer-btn').forEach(b => {
    b.disabled = false;
    if (b.textContent.trim() === correct) {
      b.classList.remove('wrong');
      b.classList.add('correct');
    }
    b.disabled = true;
  });

  const banner = $('correct-answer-reveal');
  banner.classList.remove('hidden', 'hiding');

  const s1 = $('car-step1'), s2 = $('car-step2'), s3 = $('car-step3');
  s1.className = 'car-step car-step-wrong';
  s2.className = 'car-step car-step-how';
  s3.className = 'car-step car-step-answer';

  s1.textContent = t('wrongReveal');
  s2.textContent = buildExplanation(G.question);
  s3.textContent = `${t('answerReveal')} ${correct}`;

  [s1, s2, s3].forEach(s => s.classList.remove('visible'));
  setTimeout(() => s1.classList.add('visible'), 80);
  setTimeout(() => s2.classList.add('visible'), 340);
  setTimeout(() => s3.classList.add('visible'), 620);

  // Smoothly dim + freeze the game
  const overlay = $('game-pause-overlay');
  overlay.classList.add('dimmed');
  setTimeout(() => {
    cancelAnimationFrame(G.animFrame);
    G.animFrame = null;
  }, 600);
}

function handleTimeout() {
  if (G.answerLocked) return;
  G.answerLocked = true;
  G.questionsAnswered++;
  G.streak = 0;
  updateStreakHUD();
  SFX.wrong();
  document.querySelectorAll('.answer-btn').forEach(b => { b.classList.add('wrong'); b.disabled = true; });
  revealCorrectAnswer();
  const sid = _sessionId;
  _revealTimer = setTimeout(() => { if (_sessionId === sid) loseLife(); }, 10000);
  _skipHandler = () => {
    document.removeEventListener('pointerdown', _skipHandler, true);
    _skipHandler = null;
    clearTimeout(_revealTimer);
    _revealTimer = null;
    if (_sessionId !== sid) return;
    loseLife();
  };
  setTimeout(() => {
    if (_skipHandler) document.addEventListener('pointerdown', _skipHandler, true);
  }, 50);
}

// ── LIVES ────────────────────────────────────────────────────────────────────
// ── DEATH CUTSCENE ────────────────────────────────────────────────────────────
function _loadFrames(base, count) {
  return Array.from({ length: count }, (_, i) => {
    const img = new Image();
    img.src = base + (i + 1) + '.png';
    return img;
  });
}

function playDeathCutscene(onDone) {
  _cutsceneActive = true;
  SFX.stopMusic();
  $('question-box').style.visibility = 'hidden';
  $('game-hud').style.visibility = 'hidden';
  $('timer-bar-wrap').style.visibility = 'hidden';
  const cw = canvas.width;
  const ch = canvas.height;
  const px = G.player.x;
  const py = G.player.y;

  // Snapshot the live game frame so the transition flows seamlessly
  const snapshot = new Image();
  snapshot.src = canvas.toDataURL();

  const activeSkinData   = SKINS.find(s => s.id === G.activeSkin);
  const activeLiveryData = SKINS.find(s => s.id === G.activeLivery);
  const skinFilter   = activeLiveryData?.filter || '';
  const skinAircraft = (activeSkinData ?? activeLiveryData)?.aircraft ?? G.activeAircraft;
  const skinImgKey   = activeSkinData?.skinImg || activeSkinData?.offerImg;
  const skinImgEl    = skinImgKey ? _skinImgCache[skinImgKey] : null;
  const playerSz     = getPlayerSize();

  // Retro sprite frames from Legacy Collection
  const impactFrames  = _loadFrames('/assets/fx/enemy-death/enemy-death', 8);
  const bigExFrames   = _loadFrames('/assets/fx/explosion-e/explosion-e', 22);

  // Cinematic missile
  let mx = px + (Math.random() > 0.5 ? 90 : -90);
  let my = py - 150;
  const mdx = px - mx, mdy = py - my;
  const mlen = Math.sqrt(mdx * mdx + mdy * mdy);
  const mvx = (mdx / mlen) * 2.8;
  const mvy = (mdy / mlen) * 2.8;

  let phase = 'slowmo', phaseTick = 0;
  let zoomT = 0;      // normalized [0,1] for easing
  let zoom  = 1;
  let cutRaf;

  function _easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function _drawPlayer() {
    if (skinImgEl?.complete) {
      ctx.save();
      ctx.translate(px, py);
      ctx.drawImage(skinImgEl, -playerSz / 2, -playerSz / 2, playerSz, playerSz);
      ctx.restore();
    } else {
      drawAircraftSprite(ctx, skinAircraft, px, py, 0, 1, 0, skinFilter);
    }
  }

  function _drawRetroFrame(frames, idx, cx, cy, size) {
    const f = frames[Math.min(Math.max(idx, 0), frames.length - 1)];
    if (!f?.complete || !f.naturalWidth) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(f, cx - size / 2, cy - size / 2, size, size);
  }

  function step() {
    phaseTick++;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, cw, ch);

    // ── Phase 1: slow-motion zoom from live game snapshot ─────────────
    if (phase === 'slowmo') {
      // Smooth cubic ease-in-out zoom over ~120 frames (2 s)
      zoomT = Math.min(1, zoomT + 0.008);
      zoom  = 1 + _easeInOut(zoomT) * 1.8;  // 1 → 2.8

      // Zoom the game snapshot centered on the player
      if (snapshot.complete && snapshot.naturalWidth) {
        ctx.save();
        ctx.translate(px, py);
        ctx.scale(zoom, zoom);
        ctx.translate(-px, -py);
        ctx.drawImage(snapshot, 0, 0, cw, ch);
        ctx.restore();
      } else {
        ctx.fillStyle = '#06060f';
        ctx.fillRect(0, 0, cw, ch);
      }

      // Fade to black smoothly as zoom builds
      const darken = _easeInOut(Math.min(1, zoomT * 1.15));
      ctx.fillStyle = `rgba(0,0,10,${darken})`;
      ctx.fillRect(0, 0, cw, ch);

      // Draw fresh sharp player + missile on top (in zoomed space)
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(zoom, zoom);
      ctx.translate(-px, -py);
      _drawPlayer();
      drawMissiles(ctx, [{ x: mx, y: my, vx: mvx, vy: mvy, boltFrame: 0, tx: px, ty: py }], true);
      ctx.restore();

      // Cinematic vignette
      const vig = ctx.createRadialGradient(cw/2, ch/2, ch*0.2, cw/2, ch/2, ch*0.85);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,20,0.65)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, cw, ch);

      mx += mvx; my += mvy;
      const dx = mx - px, dy = my - py;
      if (dx*dx + dy*dy < 18*18 || phaseTick > 240) {
        phase = 'impact'; phaseTick = 0;
        SFX.explode?.();
      }
    }

    // ── Phase 2: retro impact sprite (enemy-death, 8 frames) ──────────
    else if (phase === 'impact') {
      ctx.fillStyle = '#06060f';
      ctx.fillRect(0, 0, cw, ch);

      if (phaseTick < 6) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 1 - phaseTick / 6;
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalAlpha = 1;
      }

      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-px, -py);
      const impactFrame = Math.floor(phaseTick / 3);
      _drawRetroFrame(impactFrames, impactFrame, px, py, playerSz * 3.5);
      ctx.restore();

      if (phaseTick >= impactFrames.length * 3) {
        phase = 'explode'; phaseTick = 0;
        SFX.explode?.();
      }
    }

    // ── Phase 3: big retro explosion (explosion-e, 22 frames) ─────────
    else if (phase === 'explode') {
      ctx.fillStyle = '#06060f';
      ctx.fillRect(0, 0, cw, ch);

      const exFrame = Math.floor(phaseTick / 3);
      const exSize  = Math.max(cw, ch) * 2.2;
      _drawRetroFrame(bigExFrames, exFrame, cw / 2, ch / 2, exSize);

      if (phaseTick >= bigExFrames.length * 3) {
        phase = 'text'; phaseTick = 0;
      }
    }

    // ── Phase 4: KABOOM text + earthquake shake ────────────────────────
    else if (phase === 'text') {
      // Earthquake: strong at start, fades out over ~60 frames
      const shakeStr  = Math.max(0, 1 - phaseTick / 60);
      const shakeAmp  = 18 * shakeStr;
      const sx = (Math.random() * 2 - 1) * shakeAmp;
      const sy = (Math.random() * 2 - 1) * shakeAmp;

      ctx.save();
      ctx.translate(sx, sy);

      ctx.fillStyle = 'rgba(3,3,15,0.92)';
      ctx.fillRect(-Math.abs(sx) - 4, -Math.abs(sy) - 4, cw + 8, ch + 8);

      const fade = Math.min(1, phaseTick / 12);
      ctx.globalAlpha  = fade;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      const emojiSz = Math.min(cw * 0.35, 110);
      ctx.font = `${emojiSz}px serif`;
      ctx.fillText('💥', cw / 2, ch / 2 - emojiSz * 0.9);

      // Pulse scale on KABOOM — bounces in on first few frames
      const popT   = Math.min(1, phaseTick / 10);
      const popScale = 0.4 + _easeInOut(popT) * 0.6 + Math.sin(phaseTick * 0.4) * 0.04 * shakeStr;
      const bigSz  = Math.min(cw * 0.14, 52) * popScale;
      ctx.font        = `${bigSz}px 'Press Start 2P', monospace`;
      ctx.fillStyle   = '#ff2200';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur  = 40 + shakeStr * 20;
      ctx.fillText('KABOOM!', cw / 2, ch / 2 + 10);

      const subSz = Math.min(cw * 0.045, 15);
      ctx.font        = `${subSz}px 'Press Start 2P', monospace`;
      ctx.fillStyle   = '#ffffff';
      ctx.shadowColor = '#aaaaff';
      ctx.shadowBlur  = 8;
      ctx.fillText('YOUR PLANE CRASHED! 🛸', cw / 2, ch / 2 + Math.min(cw * 0.14, 52) + 28);

      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;
      ctx.restore();

      if (phaseTick > 130) {
        cancelAnimationFrame(cutRaf);
        onDone();
        return;
      }
    }

    cutRaf = requestAnimationFrame(step);
  }

  cutRaf = requestAnimationFrame(step);
}

function loseLife() {
  if (_godMode) {
    shakeFrames = 8;
    _invincible = 120;
    const sid = _sessionId;
    setTimeout(() => {
      if (_sessionId !== sid) return;
      if (levelCfg.isBossLevel || G.questionsAnswered < levelCfg.questionCount) nextQuestion();
      else endLevel(true);
    }, 900);
    return;
  }
  // Practice without hearts — just shake, next question
  if (G.practiceMode && !G.practiceHearts) {
    shakeFrames = 8;
    G.streak = 0;
    updateStreakHUD();
    const sid = _sessionId;
    setTimeout(() => { if (_sessionId === sid) nextQuestion(); }, 900);
    return;
  }
  if (G.lives <= 0) return;
  G.lives--;
  // Do NOT clear G.enemyMissiles — each missile is independent (invincibility frames protect the player)
  updateLivesHUD();
  shakeFrames = 12;
  const sid = _sessionId;
  if (G.lives <= 0) {
    G.continueState = {
      lives:             1,
      correctAnswers:    G.correctAnswers,
      questionsAnswered: G.questionsAnswered,
      streak:            G.streak,
    };
    cancelAnimationFrame(G.animFrame);
    G.animFrame = null;
    const sid2 = _sessionId;
    playDeathCutscene(() => { if (_sessionId === sid2) endLevel(false); });
    return;
  }
  _invincible = 120;
  spawnTimer  = spawnRate;
  setTimeout(() => {
    if (_sessionId !== sid) return;
    if (levelCfg.isBossLevel || G.questionsAnswered < levelCfg.questionCount) nextQuestion();
    else endLevel(true);
  }, 900);
}

// ── HUD ──────────────────────────────────────────────────────────────────────
function updateLivesHUD() {
  $('hud-lives').innerHTML = Array.from({ length: _maxLives }, (_, i) =>
    `<img src="/assets/fx/heart-full.png" style="width:28px;height:28px;image-rendering:pixelated;opacity:${i < G.lives ? '1' : '0.3'}">`
  ).join('');
}

function updateStreakHUD() {
  $('hud-streak').textContent = '';
}

// ── LEVEL END ────────────────────────────────────────────────────────────────
function endLevel(won) {
  _cutsceneActive = false;
  _sessionId++;
  clearInterval(G.timerInterval);
  cancelAnimationFrame(G.animFrame);
  G.timerInterval = null;
  G.animFrame     = null;
  G.answerLocked  = true;
  if (ctx) { ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; }
  if (won) trackMission('levels_won', 1);
  if (_onComplete) _onComplete(won);
}

// ── PUBLIC API ───────────────────────────────────────────────────────────────
// Speed lines — initialised per session, used in frame()
let _speedLines   = [];
const _skinImgCache = {};
// ── DEVICE DETECTION ─────────────────────────────────────────────────────────
const _ua       = navigator.userAgent;
// Universal tablet detection — any iPad (any iOS), Android tablet, or touch device at tablet size
const _isTablet = /iPad/i.test(_ua)
               || (/Macintosh/i.test(_ua) && navigator.maxTouchPoints > 1)
               || (/Android/i.test(_ua) && !/Mobile/i.test(_ua))
               || (navigator.maxTouchPoints > 1 && window.innerWidth >= 768 && window.innerWidth <= 1400);
const _isPhone  = !_isTablet && (window.innerWidth <= 480 || (('ontouchstart' in window) && window.innerWidth <= 768));
const _isMobile = _isPhone || _isTablet;
// Frame-rate caps: 30 fps phone, 30 fps tablet, native on desktop
const _frameInterval = _isPhone ? 1000 / 30 : _isTablet ? 1000 / 30 : 0;
let   _lastFrameTs   = 0;
let   _qboxH         = 180;  // cached question-box height — updated in resize()
function initSpeedLines(cw, ch) {
  const count = window.innerWidth <= 768 ? 12 : 28;
  _speedLines = Array.from({ length: count }, () => ({
    x:      Math.random() * cw,
    y:      Math.random() * ch,
    len:    30 + Math.random() * 80,
    speed:  8  + Math.random() * 10,
    alpha:  0.08 + Math.random() * 0.14,
    width:  0.5 + Math.random() * 1.0,
  }));
}

function drawSpeedLines(ctx, cw, ch) {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap     = 'round';
  ctx.lineWidth   = 0.8;
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  for (const l of _speedLines) {
    l.y += l.speed;
    if (l.y > ch + l.len) { l.y = -l.len; l.x = Math.random() * cw; }
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(l.x, l.y + l.len);
  }
  ctx.stroke();
  ctx.restore();
}

export function initGame(levelNum, onComplete) {
  _sessionId++;
  _cutsceneActive = false;
  $('question-box').style.visibility  = '';
  $('game-hud').style.visibility      = '';
  $('timer-bar-wrap').style.visibility = '';
  _invincible    = 0;
  _bankTilt      = 0;
  _stealthActive = false;
  _stealthTicks  = 0;
  _stealthAnswers = 0;
  _mgActive    = false;
  _mgTicks     = 0;
  _mgAnswers   = 0;
  _mgFireTimer = 0;
  _nukeAnim    = 0;
  _nukeApplied = false;
  _nukeAnswers = 0;
  _godMode     = false;
  _gameCT.clear();
  const godBadge = document.getElementById('hud-godmode');
  if (godBadge) godBadge.classList.add('hidden');
  shakeFrames = 0;
  tick        = 0;
  _shipFrame  = 0;
  _speedLines = [];
  trackMission('games_played', 1);
  const snap = G.continueState;
  G.continueState = null;
  resetLevel();
  G.currentLevel = levelNum;
  // Reset SR-71 run tracker when starting level 1 (non-practice)
  if (levelNum === 1 && !G.practiceMode) {
    G.sr71WrongAnswers = 0;
    G.sr71MissileHits  = 0;
    G.sr71CleanLevels  = [];
    save('sr71WrongAnswers', 0);
    save('sr71MissileHits',  0);
    save('sr71CleanLevels',  []);
  }
  levelCfg       = applyAgeModifiers(getLevel(levelNum), G.playerAge);
  const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.t6;
  if (!snap && aircraft.lives) G.lives = aircraft.lives;
  _maxLives = G.lives;
  if (snap) {
    G.lives             = snap.lives;
    G.correctAnswers    = snap.correctAnswers;
    G.questionsAnswered = snap.questionsAnswered;
    G.streak            = snap.streak;
  }
  _onComplete    = onComplete;
  G.currentWeather = levelCfg.weather || null;

  canvas = $('game-canvas');
  ctx    = canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha = 1;

  const ro = new ResizeObserver(() => {
    if (_resizeTimer) return;
    _resizeTimer = setTimeout(() => { _resizeTimer = null; resize(); }, 200);
  });
  ro.observe(canvas);

  $('hud-level').textContent = G.practiceMode ? t('practice_label')
    : levelCfg.isBossLevel ? `${t('bossLevel')}${levelNum}` : `${t('level')} ${levelNum}`;
  const _hudPrestige = document.getElementById('hud-prestige');
  if (_hudPrestige) _hudPrestige.innerHTML = getPrestigeBadgeHTML(G.prestige);

  if (G.practiceMode && !G.practiceHearts) {
    $('hud-lives').innerHTML = '<span style="opacity:0.3">∞</span>';
  } else {
    updateLivesHUD();
    if (aircraft.ability === 'extraLife') G.lives = Math.min(G.lives + 1, 5);
    _maxLives = G.lives;
    updateLivesHUD();
  }
  updateStreakHUD();

  spawnRate  = _isPhone  ? Math.round(levelCfg.spawnRate * 1.5)
             : _isTablet ? Math.round(levelCfg.spawnRate * 1.3)
             : levelCfg.spawnRate;
  maxEnemies = _isPhone ? Math.min(levelCfg.maxEnemies, 3) : _isTablet ? Math.min(levelCfg.maxEnemies, 3) : levelCfg.maxEnemies;
  spawnTimer = 60;

  attachInputListeners();

  const quitBtn = $('btn-quit-game');
  quitBtn.onclick = () => {
    clearInterval(G.timerInterval);
    G.timerInterval = null;
    cancelAnimationFrame(G.animFrame);
    G.animFrame = null;
    SFX.stopSFX();
    SFX.quitGame();
    window._gameResume = () => {
      window._gameResume = null;
      SFX.stopSFX();
      showScreen('s-game');
      SFX.playMusic('game');
      _runTimer();
      G.animFrame = requestAnimationFrame(frame);
    };
    $('gameover-title').textContent = 'PAUSED';
    $('gameover-score').textContent = '';
    $('btn-retry').textContent = 'CONTINUE';
    $('btn-go-map').textContent = 'LOBBY';
    showScreen('s-gameover');
  };



  const sid = _sessionId;

  function tryStart() {
    if (_sessionId !== sid) return;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) { requestAnimationFrame(tryStart); return; }
    const _dpr = _isTablet ? 0.65 : _isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1);
    canvas.width  = Math.round(cw * _dpr);
    canvas.height = Math.round(ch * _dpr);
    if (_isTablet) {
      canvas.style.width          = cw + 'px';
      canvas.style.height         = ch + 'px';
      canvas.style.imageRendering = 'auto';
      ctx.imageSmoothingEnabled   = true;
      ctx.imageSmoothingQuality   = 'low';
    } else {
      canvas.style.width = canvas.style.height = canvas.style.imageRendering = '';
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Animate loading screen while sprites download
    let _loadRaf = requestAnimationFrame(function loadTick() {
      if (_sessionId !== sid) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawLoadingScreen();
      _loadRaf = requestAnimationFrame(loadTick);
    });

    preloadBiome(levelCfg.biome).then(() => {
      cancelAnimationFrame(_loadRaf);
      if (_sessionId !== sid) return;
      initBackground(levelCfg.biome);
      placePlayer();

      // Pre-load skin artwork if needed
      const _skinData = SKINS.find(s => s.id === G.activeSkin);
      const _skinSrc  = _skinData?.skinImg || _skinData?.offerImg;
      if (_skinSrc && !_skinImgCache[_skinSrc]) {
        const _img = new Image();
        _img.src = _skinSrc;
        _skinImgCache[_skinSrc] = _img;
      }

      // Boss level: spawn one static boss centred near top, infinite questions
      if (levelCfg.isBossLevel) {
        maxEnemies = 0; // prevent re-spawning via timer
        const boss = spawnEnemy(canvas.width, 'boss');
        const milestone = levelNum / 10;
        boss.hp       = 4 + milestone * 4;   // 8, 12, 16, 20, 24 for lv10-50
        boss.currentHp = boss.hp;
        boss.maxHp     = boss.hp;
        boss.x         = canvas.width / 2;
        boss.y         = canvas.height * 0.18;
        boss.speed        = 0;
        boss.bossPhase      = 'pause';
        boss.bossPauseTimer = 150;
        boss.bossBurstMax   = 2 + milestone;
        boss.bossBurstFired = 0;
        boss.bossBurstTimer = 0;

        // Per-milestone theme: visuals + attack cadence
        // Difficulty scales via bossBurstMax (more missiles/burst), NOT via speed spam
        const BOSS_THEMES = [
          null,
          { color: '#94a3b8', filter: 'grayscale(80%) brightness(1.1)',                               pauseF: 320, burstI: 32, missileSpd: 2.5, missileColor: '#94a3b8' }, // lv10
          { color: '#d97706', filter: 'sepia(70%) brightness(1.1)',                                    pauseF: 310, burstI: 31, missileSpd: 2.6, missileColor: '#f59e0b' }, // lv20
          { color: '#e2e8f0', filter: 'brightness(2.5) saturate(0.15)',                                pauseF: 295, burstI: 30, missileSpd: 2.7, missileColor: '#e2e8f0' }, // lv30
          { color: '#a855f7', filter: 'hue-rotate(260deg) saturate(180%) brightness(0.75)',            pauseF: 280, burstI: 30, missileSpd: 2.8, missileColor: '#c084fc' }, // lv40
          { color: '#fbbf24', filter: 'sepia(100%) saturate(500%) brightness(1.3) hue-rotate(-20deg)', pauseF: 260, burstI: 28, missileSpd: 3.0, missileColor: '#fbbf24' }, // lv50
        ];
        const theme = BOSS_THEMES[milestone] ?? BOSS_THEMES[1];
        boss.color         = theme.color;
        boss.spriteFilter  = theme.filter;
        boss._pauseFrames  = theme.pauseF;
        boss._burstInterval = theme.burstI;
        boss._missileSpd   = theme.missileSpd;
        boss._missileColor = theme.missileColor;

        // Per-milestone movement profile
        // Higher milestones = faster, wider range, more player tracking
        const BOSS_MOVES = [
          null,
          { speed: 0.005, interval: 240, xRange: 0.60, yMinF: 0.08, yMaxF: 0.25, trackX: 0.00 }, // lv10
          { speed: 0.007, interval: 210, xRange: 0.68, yMinF: 0.07, yMaxF: 0.28, trackX: 0.12 }, // lv20
          { speed: 0.009, interval: 185, xRange: 0.75, yMinF: 0.06, yMaxF: 0.30, trackX: 0.22 }, // lv30
          { speed: 0.012, interval: 160, xRange: 0.82, yMinF: 0.05, yMaxF: 0.32, trackX: 0.33 }, // lv40
          { speed: 0.015, interval: 135, xRange: 0.86, yMinF: 0.05, yMaxF: 0.34, trackX: 0.42 }, // lv50
        ];
        const bm           = BOSS_MOVES[milestone] ?? BOSS_MOVES[1];
        boss._moveSpeed    = bm.speed;
        boss._moveInterval = bm.interval;
        boss._xRange       = bm.xRange;
        boss._yMinF        = bm.yMinF;
        boss._yMaxF        = bm.yMaxF;
        boss._trackX       = bm.trackX;
        boss._targetX      = boss.x;
        boss._targetY      = boss.y;
        boss._moveTimer    = bm.interval;
        boss._vx           = 0;
        boss._vy           = 0;

        G.enemies.push(boss);
        // Companions spawn via normal timer — set maxEnemies to companion count
        maxEnemies = levelCfg.bossCompanionMax;
      }

      G.animFrame = requestAnimationFrame(frame);
      nextQuestion();
    });
  }
  requestAnimationFrame(tryStart);

  // Pause loop when tab is hidden, resume when visible again
  const _onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(G.animFrame);
      G.animFrame = null;
    } else if (!G.animFrame && !_cutsceneActive) {
      _lastFrameTs = 0;
      G.animFrame = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', _onVisibility);

  return () => {
    _sessionId++;
    clearInterval(G.timerInterval);
    cancelAnimationFrame(G.animFrame);
    document.removeEventListener('visibilitychange', _onVisibility);
    G.timerInterval = null;
    G.animFrame     = null;
    detachInputListeners();
    pointerTarget = null;
    _jsOrigin = _jsCurrent = null;
    _jsVelX = _jsVelY = 0;
    velX = 0; velY = 0;
    Object.keys(keys).forEach(k => keys[k] = false);
    if (ctx) { ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; }
    const btns = $('answer-buttons');
    if (btns) btns.innerHTML = '';
    ro.disconnect();
  };
}

export { levelCfg as getCurrentLevelCfg };
