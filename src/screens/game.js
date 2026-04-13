import { G, resetLevel } from '../state.js';
import { $ } from '../utils/dom.js';
import { newQuestion } from '../game/math-engine.js';
import { spawnEnemy, updateEnemies, hitEnemy } from '../game/enemies.js';
import { createMissile, updateMissiles, drawMissiles } from '../game/missiles.js';
import { spawnExplosion, spawnHitSpark, updateParticles, drawParticles } from '../game/particles.js';
import { drawAircraftSprite, drawEnemySprite } from '../game/aircraft-draw.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { getLevel } from '../data/levels.js';
import { SFX } from '../audio/sound.js';
import { preloadBiome } from '../game/sprites.js';
import { initBackground, updateBackground, drawBackground } from '../game/background.js';

let canvas, ctx, levelCfg;
let tick        = 0;
let shakeFrames = 0;
let _onComplete = null;
let spawnTimer  = 0;
let spawnRate   = 150;
let maxEnemies  = 5;
let _sessionId  = 0;
let _invincible = 0;
let _shipFrame  = 0;   // player ship animation (0–4, cycled every tick)

// ── INPUT ───────────────────────────────────────────────────────────────────
const keys = {
  ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false,
  a: false, d: false, w: false, s: false,
};
let pointerTarget = null;
let velX = 0, velY = 0;
const MOVE_SPEED = 3.5;
const ACCEL      = 0.4;
const FRICTION   = 0.80;
const LERP       = 0.08;

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
  pointerTarget = { x: src.clientX - r.left, y: src.clientY - r.top };
}
function clearPointer() { pointerTarget = null; }

function updatePlayerMovement() {
  const margin = 32;
  const minY   = canvas.height * 0.4;
  const maxY   = canvas.height - 18;

  if (pointerTarget) {
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
  canvas.addEventListener('mousedown',  canvasPointer);
  canvas.addEventListener('mousemove',  canvasPointer);
  canvas.addEventListener('mouseup',    clearPointer);
  canvas.addEventListener('mouseleave', clearPointer);
}

function detachInputListeners() {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup',   onKeyUp);
  canvas.removeEventListener('touchstart', canvasPointer);
  canvas.removeEventListener('touchmove',  canvasPointer);
  canvas.removeEventListener('touchend',   clearPointer);
  canvas.removeEventListener('mousedown',  canvasPointer);
  canvas.removeEventListener('mousemove',  canvasPointer);
  canvas.removeEventListener('mouseup',    clearPointer);
  canvas.removeEventListener('mouseleave', clearPointer);
}

// ── RESIZE ─────────────────────────────────────────────────────────────────
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width  = w;
  canvas.height = h;
  G.player.x = Math.max(32, Math.min(w - 32,  G.player.x || w / 2));
  G.player.y = Math.max(h * 0.4, Math.min(h - 18, G.player.y || h - 60));
}

function placePlayer() {
  G.player.x = canvas.width  / 2;
  G.player.y = canvas.height - 60;
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
  ctx.fillText('LOADING...', cw / 2, ch / 2);
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

  // ── Enemy spawn ────────────────────────────────────────────────────────
  spawnTimer--;
  if (spawnTimer <= 0 && G.enemies.filter(e => e.active).length < maxEnemies) {
    const types = levelCfg.enemyTypes;
    const type  = types[Math.floor(Math.random() * types.length)];
    const e     = spawnEnemy(canvas.width, type);
    e.speed        *= levelCfg.enemySpeedMult;
    e.fireRate      = Math.max(30, Math.floor(e.fireRate * levelCfg.enemyFireRateMult));
    e.fireCooldown  = e.fireRate + Math.floor(Math.random() * 40);
    G.enemies.push(e);
    spawnTimer = spawnRate;
  }
  G.enemies = G.enemies.filter(e => e.y < canvas.height + 80);

  // ── Enemies ────────────────────────────────────────────────────────────
  updateEnemies(G.enemies);
  for (const e of G.enemies) {
    if (!e.active) continue;

    e.fireCooldown--;
    if (e.fireCooldown <= 0) {
      e.fireCooldown = e.fireRate;
      G.enemyMissiles.push(createMissile(e.x, e.y, G.player.x, G.player.y, 2.5, null, '#ef4444'));
      SFX.missile();
    }

    const ox = e.shakeTick > 0 ? (Math.random() - 0.5) * 5 : 0;
    const origX = e.x;
    e.x += ox;
    drawEnemySprite(ctx, e);
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
    if (e && e.active) onMissileHit(e);
  });
  drawMissiles(ctx, G.missiles, false);

  // ── Enemy missiles ─────────────────────────────────────────────────────
  for (let i = G.enemyMissiles.length - 1; i >= 0; i--) {
    const m  = G.enemyMissiles[i];
    const dx = m.x - G.player.x, dy = m.y - G.player.y;
    if (dx * dx + dy * dy < 22 * 22) {
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
    m.boltFrame = ((m.boltFrame ?? 0) + 0.25) % 4;
  }
  drawMissiles(ctx, G.enemyMissiles, true);

  // ── Particles ──────────────────────────────────────────────────────────
  updateParticles(G.particles);
  drawParticles(ctx, G.particles);

  // ── Player ─────────────────────────────────────────────────────────────
  if (_invincible > 0) _invincible--;
  const prevX = G.player.x;
  updatePlayerMovement();
  const bankAngle  = (G.player.x - prevX) * 0.06;
  const flashAlpha = _invincible > 0
    ? (Math.floor(_invincible / 6) % 2 === 0 ? 1.0 : 0.25)
    : 1.0;

  drawAircraftSprite(ctx, G.activeAircraft, G.player.x, G.player.y, _shipFrame, flashAlpha, bankAngle);

  // Engine glow — sits just below the ship's exhaust nozzle
  const glow = 4 + Math.sin(tick * 0.22) * 2;
  ctx.beginPath();
  ctx.arc(G.player.x, G.player.y + 22, glow, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,140,0,${0.55 + Math.sin(tick * 0.3) * 0.2})`;
  ctx.fill();
  ctx.globalAlpha = 1;

  if (shaking) ctx.restore();

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

function fireEnemyMissile() {
  const enemy = nearestEnemy();
  if (!enemy) return;
  const m = createMissile(enemy.x, enemy.y, G.player.x, G.player.y, 2.5, null, '#ef4444');
  G.enemyMissiles.push(m);
  SFX.missile();
}

function onEnemyMissileHit() {
  if (G.lives <= 0 || _invincible > 0) return;
  spawnExplosion(G.particles, G.player.x, G.player.y, '#ef4444', 14);
  SFX.explode();
  shakeFrames = 14;
  loseLife();
}

function onMissileHit(enemy) {
  SFX.explode();
  const destroyed = hitEnemy(enemy);
  if (destroyed) {
    spawnExplosion(G.particles, enemy.x, enemy.y, enemy.color, 18);
    enemy.active = false;
    shakeFrames  = 6;
    G.enemies    = G.enemies.filter(e => e.active);
  } else {
    spawnHitSpark(G.particles, enemy.x, enemy.y);
  }
}

// ── QUESTION CYCLE ───────────────────────────────────────────────────────────
function nextQuestion() {
  if (G.questionsAnswered >= levelCfg.questionCount) { endLevel(true); return; }
  G.answerLocked = false;
  G.question     = newQuestion(levelCfg.ops, levelCfg.mathCap, levelCfg.mathMultCap);

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
  startTimer();
}

function startTimer() {
  if (G.timerInterval) clearInterval(G.timerInterval);
  G.timeLeft = levelCfg.timeLimit;
  const total    = G.timeLeft;
  const bar      = $('timer-bar');
  const timerSid = _sessionId;
  bar.style.width      = '100%';
  bar.style.background = 'var(--accent)';

  G.timerInterval = setInterval(() => {
    if (_sessionId !== timerSid) { clearInterval(G.timerInterval); return; }
    if (G.answerLocked) return;
    G.timeLeft -= 0.1;
    const pct = Math.max(0, G.timeLeft / total) * 100;
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

    const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.t6;
    const speed    = aircraft.ability === 'fastMissile' ? 13 : 8;
    const target   = nearestEnemy();
    if (target) {
      if (aircraft.ability === 'multiShot') {
        [-18, 0, 18].forEach(offset => {
          G.missiles.push(createMissile(G.player.x + offset, G.player.y, target.x, target.y, speed, target.id));
        });
      } else {
        G.missiles.push(createMissile(G.player.x, G.player.y, target.x, target.y, speed, target.id));
      }
      SFX.missile();
    }
  } else {
    SFX.wrong();
    G.questionsAnswered++;
    G.streak = 0;
    updateStreakHUD();
    fireEnemyMissile();
  }

  const sid = _sessionId;
  setTimeout(() => {
    if (_sessionId !== sid) return;
    if (G.questionsAnswered < levelCfg.questionCount) nextQuestion();
    else endLevel(true);
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
  const sid = _sessionId;
  setTimeout(() => { if (_sessionId === sid) loseLife(); }, 400);
}

// ── LIVES ────────────────────────────────────────────────────────────────────
function loseLife() {
  if (G.lives <= 0) return;
  G.lives--;
  G.enemyMissiles = [];
  updateLivesHUD();
  shakeFrames = 12;
  const sid = _sessionId;
  if (G.lives <= 0) {
    setTimeout(() => { if (_sessionId === sid) endLevel(false); }, 700);
    return;
  }
  _invincible = 120;
  G.enemies   = [];
  spawnTimer  = spawnRate;
  setTimeout(() => {
    if (_sessionId !== sid) return;
    if (G.questionsAnswered < levelCfg.questionCount) nextQuestion();
    else endLevel(true);
  }, 900);
}

// ── HUD ──────────────────────────────────────────────────────────────────────
function updateLivesHUD() {
  $('hud-lives').innerHTML = [0,1,2].map(i =>
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
  if (_onComplete) _onComplete(won);
}

// ── PUBLIC API ───────────────────────────────────────────────────────────────
export function initGame(levelNum, onComplete) {
  _sessionId++;
  _invincible = 0;
  shakeFrames = 0;
  tick        = 0;
  _shipFrame  = 0;
  resetLevel();
  G.currentLevel = levelNum;
  levelCfg       = getLevel(levelNum);
  _onComplete    = onComplete;

  canvas = $('game-canvas');
  ctx    = canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha = 1;

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  $('hud-level').textContent = G.practiceMode ? 'PRACTICE' : `LEVEL ${levelNum}`;
  updateLivesHUD();
  updateStreakHUD();

  const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.t6;
  if (aircraft.ability === 'extraLife') G.lives = Math.min(G.lives + 1, 5);
  updateLivesHUD();

  spawnRate  = levelCfg.spawnRate;
  maxEnemies = levelCfg.maxEnemies;
  spawnTimer = 60;

  attachInputListeners();

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
    velX = 0; velY = 0;
    Object.keys(keys).forEach(k => keys[k] = false);
    if (ctx) { ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; }
    const btns = $('answer-buttons');
    if (btns) btns.innerHTML = '';
    ro.disconnect();
  };
}

export { levelCfg as getCurrentLevelCfg };
