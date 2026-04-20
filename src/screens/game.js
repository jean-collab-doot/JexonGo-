import { G, resetLevel } from '../state.js';
import { $ } from '../utils/dom.js';
import { newQuestion } from '../game/math-engine.js';
import { spawnEnemy, updateEnemies, hitEnemy } from '../game/enemies.js';
import { createMissile, updateMissiles, drawMissiles } from '../game/missiles.js';
import { spawnExplosion, spawnHitSpark, updateParticles, drawParticles } from '../game/particles.js';
import { drawAircraftSprite, drawEnemySprite } from '../game/aircraft-draw.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { SKINS } from '../data/skins.js';
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
let _sessionId    = 0;
let _invincible   = 0;
let _revealTimer  = null;
let _skipHandler  = null;
let _transitioning = false;
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
  const margin  = 32;
  const minY    = canvas.height * 0.4;
  const qboxH   = $('question-box').offsetHeight || 180;
  const maxY    = canvas.height - qboxH - 24;

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

  // ── Speed lines ────────────────────────────────────────────────────────
  if (_speedLines.length === 0) initSpeedLines(canvas.width, canvas.height);
  drawSpeedLines(ctx, canvas.width, canvas.height);

  // ── Enemy spawn ────────────────────────────────────────────────────────
  spawnTimer--;
  if (spawnTimer <= 0 && G.enemies.filter(e => e.type !== 'boss' && e.active).length < maxEnemies) {
    const types = levelCfg.isBossLevel ? levelCfg.bossCompanionTypes : levelCfg.enemyTypes;
    const type  = types[Math.floor(Math.random() * types.length)];
    const e     = spawnEnemy(canvas.width, type);
    e.speed        *= levelCfg.enemySpeedMult;
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
      if (e.fireCooldown <= 0 && inFireZone) {
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
    m.boltFrame = 0;
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

  const activeSkinData = SKINS.find(s => s.id === G.activeSkin);
  const skinFilter  = activeSkinData?.filter || '';
  const skinAircraft = activeSkinData?.aircraft ?? G.activeAircraft;

  if (activeSkinData?.offerImg) {
    // Draw the skin artwork image directly as the player plane
    const cached = _skinImgCache[activeSkinData.offerImg];
    if (cached?.complete) {
      const sz = 180;
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
        [-14, 14].forEach(offset => {
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
    revealCorrectAnswer();
  }

  const sid = _sessionId;
  const delay = correct ? 600 : 10000;
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

  s1.textContent = `✗ Wrong — let's see how to solve it`;
  s2.textContent = buildExplanation(G.question);
  s3.textContent = `✓ Answer: ${correct}`;

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
  _invincible = 0;
  shakeFrames = 0;
  tick        = 0;
  _shipFrame  = 0;
  _speedLines = [];
  const snap = G.continueState;
  G.continueState = null;
  resetLevel();
  G.currentLevel = levelNum;
  levelCfg       = getLevel(levelNum);
  if (snap) {
    G.lives             = snap.lives;
    G.correctAnswers    = snap.correctAnswers;
    G.questionsAnswered = snap.questionsAnswered;
    G.streak            = snap.streak;
  }
  _onComplete    = onComplete;

  canvas = $('game-canvas');
  ctx    = canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha = 1;

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  $('hud-level').textContent = G.practiceMode ? 'PRACTICE'
    : levelCfg.isBossLevel ? `⚠ BOSS LV${levelNum}` : `LEVEL ${levelNum}`;

  if (G.practiceMode && !G.practiceHearts) {
    $('hud-lives').innerHTML = '<span style="opacity:0.3">∞</span>';
  } else {
    updateLivesHUD();
    const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.t6;
    if (aircraft.ability === 'extraLife') G.lives = Math.min(G.lives + 1, 5);
    updateLivesHUD();
  }
  updateStreakHUD();

  spawnRate  = levelCfg.spawnRate;
  maxEnemies = levelCfg.maxEnemies;
  spawnTimer = 60;

  attachInputListeners();

  const quitBtn = $('btn-quit-game');
  quitBtn.onclick = () => endLevel(false);



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
    velX = 0; velY = 0;
    Object.keys(keys).forEach(k => keys[k] = false);
    if (ctx) { ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; }
    const btns = $('answer-buttons');
    if (btns) btns.innerHTML = '';
    ro.disconnect();
  };
}

export { levelCfg as getCurrentLevelCfg };
