import { G, resetLevel } from '../state.js';
import { $, showScreen } from '../utils/dom.js';
import { newQuestion } from '../game/math-engine.js';
import { spawnEnemy, updateEnemies, hitEnemy } from '../game/enemies.js';
import { createMissile, updateMissiles, drawMissiles } from '../game/missiles.js';
import { spawnExplosion, spawnHitSpark, updateParticles, drawParticles } from '../game/particles.js';
import { drawAircraftSprite, drawEnemySprite, getPlayerSize } from '../game/aircraft-draw.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { SKINS } from '../data/skins.js';
import { getLevel } from '../data/levels.js';
import { SFX } from '../audio/sound.js';
import { preloadBiome } from '../game/sprites.js';
import { initBackground, updateBackground, drawBackground } from '../game/background.js';
import { trackMission } from '../systems/daily.js';
import { t } from '../i18n.js';

let canvas, ctx, levelCfg;
let _timerTotal = 10;
let tick        = 0;
let shakeFrames = 0;
let _onComplete = null;
let spawnTimer  = 0;
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
function onKeyDown(e) {
  const k = normaliseKey(e.key);
  if (k in keys) { keys[k] = true; pointerTarget = null; e.preventDefault(); }
}
function onKeyUp(e) {
  const k = normaliseKey(e.key);
  if (k in keys) keys[k] = false;
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
  const margin  = 32;
  const minY    = canvas.height * 0.4;
  const qboxH   = $('question-box').offsetHeight || 180;
  const maxY    = canvas.height - qboxH - 24;

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
  canvas.width  = w;
  canvas.height = h;
  G.player.x = Math.max(32, Math.min(w - 32,  G.player.x || w / 2));
  const qH = $('question-box').offsetHeight || 180;
  G.player.y = Math.max(h * 0.4, Math.min(h - qH - 24, G.player.y || h - qH - 60));
}

function placePlayer() {
  G.player.x = canvas.width  / 2;
  const qboxHeight = $('question-box').offsetHeight || 180;
  G.player.y = canvas.height - qboxHeight - 160;
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
function frame() {
  tick++;
  _shipFrame = (_shipFrame + 0.08) % 5;

  ctx.globalAlpha = 1;
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
  if (_speedLines.length === 0) initSpeedLines(canvas.width, canvas.height);
  drawSpeedLines(ctx, canvas.width, canvas.height);

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

  // ── Enemies ────────────────────────────────────────────────────────────
  updateEnemies(G.enemies, canvas.width);
  for (const e of G.enemies) {
    if (!e.active) continue;

    if (e.type === 'boss') {
      // Boss fires in bursts then pauses 5 s
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
          G.enemyMissiles.push(createMissile(e.x, e.y, G.player.x, G.player.y, 2.5, null, '#ef4444'));
          SFX.missile();
          e.bossBurstFired++;
          e.bossBurstTimer = 28; // ~0.5 s between shots in burst
        }
        if (e.bossBurstFired >= e.bossBurstMax) {
          e.bossPhase      = 'pause';
          e.bossPauseTimer = 300; // 5 s at 60 fps
        }
      }
    } else {
      e.fireCooldown--;
      const inFireZone = e.y > canvas.height * 0.25 && e.y < canvas.height * 0.78 && e.y < G.player.y;
      if (e.fireCooldown <= 0 && inFireZone && !_stealthActive) {
        e.fireCooldown = e.fireRate;
        G.enemyMissiles.push(createMissile(e.x, e.y, G.player.x, G.player.y, 2.5, null, '#ef4444'));
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

  // ── Player missiles ────────────────────────────────────────────────────
  updateMissiles(G.missiles, m => {
    const e = G.enemies.find(en => en.id === m.enemyId);
    if (e && e.active) onMissileHit(e, m);
  });
  drawMissiles(ctx, G.missiles, false);

  // ── Enemy missiles ─────────────────────────────────────────────────────
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
    m.trail.push({ x: m.x, y: m.y });
    if (m.trail.length > 8) m.trail.shift();
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
  const bankAngle  = (G.player.x - prevX) * 0.06;
  const flashAlpha = _invincible > 0
    ? (Math.floor(_invincible / 6) % 2 === 0 ? 1.0 : 0.25)
    : _stealthActive
      ? 0.28 + 0.12 * Math.sin(tick * 0.18)  // slow ghost pulse
      : 1.0;

  const activeSkinData = SKINS.find(s => s.id === G.activeSkin);
  const skinFilter  = activeSkinData?.filter || '';
  const skinAircraft = activeSkinData?.aircraft ?? G.activeAircraft;

  if (activeSkinData?.offerImg) {
    // Draw the skin artwork image directly as the player plane
    const cached = _skinImgCache[activeSkinData.offerImg];
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
  const topGrad = ctx.createLinearGradient(0, 0, 0, fadeH);
  topGrad.addColorStop(0, 'rgba(0,0,0,0.82)');
  topGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, canvas.width, fadeH);

  G.animFrame = requestAnimationFrame(frame);
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
      e.currentHp = Math.max(1, Math.floor(e.currentHp / 2));
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

  // Remove any pending skip listener
  if (_skipHandler) {
    $('game-canvas-wrap').removeEventListener('click', _skipHandler, true);
    _skipHandler = null;
  }
  clearTimeout(_revealTimer);
  _revealTimer = null;

  // Undim and resume game loop
  const overlay = $('game-pause-overlay');
  overlay.classList.remove('dimmed');
  if (!G.animFrame) G.animFrame = requestAnimationFrame(frame);

  const reveal = $('correct-answer-reveal');
  const qbox   = $('question-box');

  qbox.classList.add('fading');

  setTimeout(() => {

    // Hide reveal banner
    reveal.classList.add('hidden');
    reveal.classList.remove('hiding');

    // Swap in new question
    const ops    = G.practiceMode ? G.practiceOps : levelCfg.ops;
    const cap    = G.practiceMode ? 20 : levelCfg.mathCap;
    const mCap   = G.practiceMode ? 12 : levelCfg.mathMultCap;
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
  G.timeLeft  = Math.max(5, levelCfg.timeLimit + (levelCfg.weather?.timeMod || 0));
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

    const speed    = aircraft.ability === 'fastMissile' ? 13 : 8;
    const damage   = aircraft.ability === 'heavyMissile' ? 1.4
                   : aircraft.ability === 'tripleShot'  ? 1.25
                   : 1;
    const target   = nearestEnemy();
    if (target) {
      if (aircraft.ability === 'multiShot' || aircraft.ability === 'multiStealth') {
        nearestEnemies(2).forEach((t, i) => {
          G.missiles.push(createMissile(G.player.x, G.player.y, t.x, t.y, speed, t.id, '#00d4ff', damage));
          setTimeout(() => SFX.missile(), i * 60);
        });
      } else if (aircraft.ability === 'tripleShot') {
        nearestEnemies(3).forEach((t, i) => {
          G.missiles.push(createMissile(G.player.x, G.player.y, t.x, t.y, speed, t.id, '#00d4ff', damage));
          setTimeout(() => SFX.missile(), i * 60);
        });
      } else {
        G.missiles.push(createMissile(G.player.x, G.player.y, target.x, target.y, speed, target.id, '#00d4ff', damage));
        SFX.missile();
      }
    }
  } else {
    SFX.wrong();
    G.questionsAnswered++;
    G.streak = 0;
    updateStreakHUD();
    revealCorrectAnswer();
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
    const wrap = $('game-canvas-wrap');
    _skipHandler = () => {
      wrap.removeEventListener('click', _skipHandler, true);
      _skipHandler = null;
      clearTimeout(_revealTimer);
      _revealTimer = null;
      if (_sessionId !== sid) return;
      loseLife();
    };
    setTimeout(() => { if (_skipHandler) wrap.addEventListener('click', _skipHandler, true); }, 700);
  }
}

function buildExplanation(q) {
  const { a, b, op, answer } = q;
  const sym = op === '*' ? '×' : op === '/' ? '÷' : op;
  switch (op) {
    case '+': return `Start at ${a}, then add ${b}  →  ${a} + ${b} = ${answer}`;
    case '-': return `Start at ${a}, then subtract ${b}  →  ${a} − ${b} = ${answer}`;
    case '*': return `${a} groups of ${b}  →  ${a} × ${b} = ${answer}`;
    case '/': return `How many ${b}s fit in ${a}?  →  ${a} ÷ ${b} = ${answer}`;
    default:  return `${a} ${sym} ${b} = ${answer}`;
  }
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
  setTimeout(() => { if (_sessionId === sid) loseLife(); }, 10000);
}

// ── LIVES ────────────────────────────────────────────────────────────────────
function loseLife() {
  // Practice without hearts — just clear missiles, shake, next question
  if (G.practiceMode && !G.practiceHearts) {
    G.enemyMissiles = [];
    shakeFrames = 8;
    G.streak = 0;
    updateStreakHUD();
    const sid = _sessionId;
    setTimeout(() => { if (_sessionId === sid) nextQuestion(); }, 900);
    return;
  }
  if (G.lives <= 0) return;
  G.lives--;
  G.enemyMissiles = [];
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
    setTimeout(() => { if (_sessionId === sid) endLevel(false); }, 700);
    return;
  }
  _invincible = 120;
  // On boss levels keep the boss alive; on normal levels clear all enemies
  G.enemies   = levelCfg.isBossLevel ? G.enemies.filter(e => e.type === 'boss') : [];
  spawnTimer  = spawnRate;
  setTimeout(() => {
    if (_sessionId !== sid) return;
    if (levelCfg.isBossLevel || G.questionsAnswered < levelCfg.questionCount) nextQuestion();
    else endLevel(true);
  }, 900);
}

// ── HUD ──────────────────────────────────────────────────────────────────────
function updateLivesHUD() {
  const maxSlots = Math.max(3, G.lives);
  $('hud-lives').innerHTML = Array.from({ length: maxSlots }, (_, i) =>
    `<span style="opacity:${i < G.lives ? '1' : '0.2'}">&#10084;&#65039;</span>`
  ).join('');
}

function updateStreakHUD() {
  $('hud-streak').textContent = G.streak >= 3 ? `&#128293; ${G.streak}` : '';
}

// ── LEVEL END ────────────────────────────────────────────────────────────────
function endLevel(won) {
  _sessionId++;
  clearInterval(G.timerInterval);
  cancelAnimationFrame(G.animFrame);
  G.timerInterval = null;
  G.animFrame     = null;
  if (ctx) { ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; }
  if (won) trackMission('levels_won', 1);
  if (_onComplete) _onComplete(won);
}

// ── PUBLIC API ───────────────────────────────────────────────────────────────
// Speed lines — initialised per session, used in frame()
let _speedLines   = [];
const _skinImgCache = {};
function initSpeedLines(cw, ch) {
  _speedLines = Array.from({ length: 28 }, () => ({
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
  ctx.lineCap = 'round';
  for (const l of _speedLines) {
    l.y += l.speed;
    if (l.y > ch + l.len) { l.y = -l.len; l.x = Math.random() * cw; }
    ctx.globalAlpha = l.alpha;
    ctx.lineWidth   = l.width;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(l.x, l.y + l.len);
    ctx.stroke();
  }
  ctx.restore();
}

export function initGame(levelNum, onComplete) {
  _sessionId++;
  _invincible    = 0;
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
  shakeFrames = 0;
  tick        = 0;
  _shipFrame  = 0;
  _speedLines = [];
  trackMission('games_played', 1);
  const snap = G.continueState;
  G.continueState = null;
  resetLevel();
  G.currentLevel = levelNum;
  levelCfg       = getLevel(levelNum);
  const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.t6;
  if (!snap && aircraft.lives) G.lives = aircraft.lives;
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

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  $('hud-level').textContent = G.practiceMode ? t('practice_label')
    : levelCfg.isBossLevel ? `${t('bossLevel')}${levelNum}` : `${t('level')} ${levelNum}`;

  if (G.practiceMode && !G.practiceHearts) {
    $('hud-lives').innerHTML = '<span style="opacity:0.3">∞</span>';
  } else {
    updateLivesHUD();
    if (aircraft.ability === 'extraLife') G.lives = Math.min(G.lives + 1, 5);
    updateLivesHUD();
  }
  updateStreakHUD();

  spawnRate  = levelCfg.spawnRate;
  maxEnemies = levelCfg.maxEnemies;
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
    canvas.width  = cw;
    canvas.height = ch;

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
      if (_skinData?.offerImg && !_skinImgCache[_skinData.offerImg]) {
        const _img = new Image();
        _img.src = _skinData.offerImg;
        _skinImgCache[_skinData.offerImg] = _img;
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
        G.enemies.push(boss);
        // Companions spawn via normal timer — set maxEnemies to companion count
        maxEnemies = levelCfg.bossCompanionMax;
      }

      G.animFrame = requestAnimationFrame(frame);
      nextQuestion();
    });
  }
  requestAnimationFrame(tryStart);

  return () => {
    _sessionId++;
    clearInterval(G.timerInterval);
    cancelAnimationFrame(G.animFrame);
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
