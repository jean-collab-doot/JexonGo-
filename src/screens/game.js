import { G, resetLevel } from '../state.js';
import { $ } from '../utils/dom.js';
import { newQuestion } from '../game/math-engine.js';
import { spawnEnemy, updateEnemies, hitEnemy } from '../game/enemies.js';
import { createMissile, updateMissiles, drawMissiles } from '../game/missiles.js';
import { spawnExplosion, spawnHitSpark, updateParticles, drawParticles } from '../game/particles.js';
import { drawAircraft, drawEnemy } from '../game/aircraft-draw.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { getLevel } from '../data/levels.js';
import { SFX } from '../audio/sound.js';

let canvas, ctx, levelCfg;
let tick = 0;
let shakeFrames  = 0;
let _onComplete  = null;
let spawnTimer   = 0;
let spawnRate    = 150;
let maxEnemies   = 5;
let _sessionId   = 0; // incremented each initGame; stale timeouts compare and bail
let _invincible  = 0; // frames of invincibility remaining after a hit

// ── INPUT ───────────────────────────────────────────────────────────────────
const keys = { ArrowLeft:false, ArrowRight:false, ArrowUp:false, ArrowDown:false,
               a:false, d:false, w:false, s:false };
let pointerTarget = null; // { x, y } when touch/mouse active
const MOVE_SPEED  = 5;
const LERP        = 0.14;

function onKeyDown(e) { if (e.key in keys) { keys[e.key] = true; e.preventDefault(); } }
function onKeyUp(e)   { if (e.key in keys) keys[e.key] = false; }

function canvasPointer(e) {
  const r = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  pointerTarget = { x: src.clientX - r.left, y: src.clientY - r.top };
}
function clearPointer() { pointerTarget = null; }

function updatePlayerMovement() {
  const margin = 32;
  const minY   = canvas.height * 0.4;
  const maxY   = canvas.height - 18;

  if (pointerTarget) {
    // Touch / mouse: lerp directly toward finger
    G.player.x += (pointerTarget.x - G.player.x) * LERP;
    G.player.y += (pointerTarget.y - G.player.y) * LERP;
  } else {
    // Keyboard: move target then lerp
    if (keys.ArrowLeft  || keys.a) G.player.x -= MOVE_SPEED;
    if (keys.ArrowRight || keys.d) G.player.x += MOVE_SPEED;
    if (keys.ArrowUp    || keys.w) G.player.y -= MOVE_SPEED;
    if (keys.ArrowDown  || keys.s) G.player.y += MOVE_SPEED;
  }

  // Clamp to canvas bounds (player zone)
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
  canvas.addEventListener('mousemove',  e => { if (e.buttons) canvasPointer(e); });
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
  canvas.removeEventListener('mouseup',    clearPointer);
  canvas.removeEventListener('mouseleave', clearPointer);
}

// ── RESIZE ─────────────────────────────────────────────────────────────────
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return; // canvas not visible yet — skip
  canvas.width  = w;
  canvas.height = h;
  // Keep player inside new bounds without teleporting them to center every resize
  G.player.x = Math.max(32, Math.min(w - 32,  G.player.x || w / 2));
  G.player.y = Math.max(h * 0.4, Math.min(h - 18, G.player.y || h - 60));
}

// Called once at game start — always places player at center-bottom
function placePlayer() {
  G.player.x = canvas.width  / 2;
  G.player.y = canvas.height - 60;
}

// ── BACKGROUND ─────────────────────────────────────────────────────────────
function drawBg() {
  const c = levelCfg.colors;
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, c.sky);
  g.addColorStop(1, c.horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (levelCfg.biome === 'space') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 80; i++) {
      const sx = (i * 137 + 31) % canvas.width;
      const sy = (i * 97  + 17) % (canvas.height * 0.9);
      const r  = i % 4 === 0 ? 1.5 : 1;
      ctx.fillRect(sx, sy, r, r);
    }
  } else {
    const alpha = levelCfg.biome === 'arctic' ? 0.13 : 0.07;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 260 + tick * 0.35) % (canvas.width + 220)) - 110;
      const cy = 25 + i * 55;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 55 + i * 18, 16 + i * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── GAME LOOP ───────────────────────────────────────────────────────────────
function frame() {
  tick++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const shaking = shakeFrames > 0;
  if (shaking) {
    ctx.save();
    ctx.translate((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7);
    shakeFrames--;
  }

  drawBg();

  // Spawn timer — continuously add enemies up to MAX_ENEMIES
  spawnTimer--;
  if (spawnTimer <= 0 && G.enemies.filter(e => e.active).length < maxEnemies) {
    const types = levelCfg.enemyTypes;
    const type  = types[Math.floor(Math.random() * types.length)];
    const e     = spawnEnemy(canvas.width, type);
    e.speed    *= levelCfg.enemySpeedMult;
    e.fireRate  = Math.max(30, Math.floor(e.fireRate * levelCfg.enemyFireRateMult));
    e.fireCooldown = e.fireRate + Math.floor(Math.random() * 40);
    G.enemies.push(e);
    spawnTimer = spawnRate;
  }
  // Remove enemies that flew past the bottom
  G.enemies = G.enemies.filter(e => e.y < canvas.height + 80);

  // Enemies
  updateEnemies(G.enemies);
  for (const e of G.enemies) {
    if (!e.active) continue;

    // Continuous enemy fire
    e.fireCooldown--;
    if (e.fireCooldown <= 0) {
      e.fireCooldown = e.fireRate;
      G.enemyMissiles.push(createMissile(e.x, e.y, G.player.x, G.player.y, 5, null, '#ef4444'));
      SFX.missile();
    }

    const ox = e.shakeTick > 0 ? (Math.random() - 0.5) * 5 : 0;
    drawEnemy(ctx, e.x + ox, e.y, e.size, e.color, e.currentHp, e.maxHp);
    if (e.label) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.label, e.x + ox, e.y - e.size - 6);
    }
  }

  // Player missiles
  updateMissiles(G.missiles, m => {
    const e = G.enemies.find(en => en.id === m.enemyId);
    if (e && e.active) onMissileHit(e);
  });
  drawMissiles(ctx, G.missiles);

  // Enemy missiles — hit only if close to CURRENT player position
  for (let i = G.enemyMissiles.length - 1; i >= 0; i--) {
    const m  = G.enemyMissiles[i];
    const dx = m.x - G.player.x;
    const dy = m.y - G.player.y;
    if (dx * dx + dy * dy < 22 * 22) {
      G.enemyMissiles.splice(i, 1);
      onEnemyMissileHit();
      continue;
    }
    // Missile reached original target without hitting → miss, remove silently
    const tdx = m.x - m.tx, tdy = m.y - m.ty;
    if (tdx * tdx + tdy * tdy < 18 * 18) { G.enemyMissiles.splice(i, 1); continue; }
    // Out of bounds
    if (m.y > canvas.height + 40 || m.x < -60 || m.x > canvas.width + 60) {
      G.enemyMissiles.splice(i, 1); continue;
    }
    // Advance missile
    m.trail.push({ x: m.x, y: m.y });
    if (m.trail.length > 8) m.trail.shift();
    m.x += m.vx;
    m.y += m.vy;
  }
  drawMissiles(ctx, G.enemyMissiles);

  // Particles
  updateParticles(G.particles);
  drawParticles(ctx, G.particles);

  // Player — controlled movement
  if (_invincible > 0) _invincible--;
  const prevX = G.player.x;
  updatePlayerMovement();
  const bankAngle = (G.player.x - prevX) * 0.06;

  const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.f22;
  // Flash during invincibility: visible 4 frames, hidden 4 frames
  if (_invincible === 0 || Math.floor(_invincible / 4) % 2 === 0) {
    ctx.save();
    ctx.translate(G.player.x, G.player.y);
    ctx.rotate(bankAngle);
    drawAircraft(ctx, aircraft.type, 0, 0, 14, aircraft.color);
    ctx.restore();
    // Engine glow
    const glow = 4 + Math.sin(tick * 0.22) * 2;
    ctx.beginPath();
    ctx.arc(G.player.x, G.player.y + 17, glow, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,130,0,${0.45 + Math.sin(tick * 0.3) * 0.15})`;
    ctx.fill();
  }

  if (shaking) ctx.restore();

  G.animFrame = requestAnimationFrame(frame);
}

// ── NEAREST ENEMY ───────────────────────────────────────────────────────────
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

// ── ENEMY MISSILE ───────────────────────────────────────────────────────────
function fireEnemyMissile() {
  const enemy = nearestEnemy();
  if (!enemy) return; // no enemy to fire from, skip
  const m = createMissile(enemy.x, enemy.y, G.player.x, G.player.y, 6, null, '#ef4444');
  // Store target as player position (no enemyId needed)
  m.tx = G.player.x;
  m.ty = G.player.y;
  G.enemyMissiles.push(m);
  SFX.missile();
}

function onEnemyMissileHit() {
  if (G.lives <= 0 || _invincible > 0) return; // dead or still flashing from previous hit
  spawnExplosion(G.particles, G.player.x, G.player.y, '#ef4444', 14);
  SFX.explode();
  shakeFrames = 14;
  loseLife();
}

// ── PLAYER MISSILE HIT ──────────────────────────────────────────────────────
function onMissileHit(enemy) {
  SFX.explode();
  const destroyed = hitEnemy(enemy);
  spawnExplosion(G.particles, enemy.x, enemy.y, enemy.color, destroyed ? 18 : 7);
  if (!destroyed) { spawnHitSpark(G.particles, enemy.x, enemy.y); return; }
  enemy.active = false;
  shakeFrames = 6;
  G.enemies = G.enemies.filter(e => e.active);
  // Enemies spawn continuously — no question trigger here
}

// ── QUESTION CYCLE ────────────────────────────────────────────────────────────
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

// ── TIMER ─────────────────────────────────────────────────────────────────────
function startTimer() {
  if (G.timerInterval) clearInterval(G.timerInterval);
  G.timeLeft = levelCfg.timeLimit;
  const total = G.timeLeft;
  const bar   = $('timer-bar');
  bar.style.width      = '100%';
  bar.style.background = 'var(--accent)';

  G.timerInterval = setInterval(() => {
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

// ── ANSWER HANDLING ────────────────────────────────────────────────────────────
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

    // Fire at nearest active enemy
    const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.f22;
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

  // Advance to next question regardless of missile outcome
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

// ── LIVES ──────────────────────────────────────────────────────────────────────
function loseLife() {
  if (G.lives <= 0) return; // prevent double-processing from simultaneous hits
  G.lives--;
  G.enemyMissiles = [];
  updateLivesHUD();
  shakeFrames = 12;
  const sid = _sessionId;
  if (G.lives <= 0) {
    setTimeout(() => { if (_sessionId === sid) endLevel(false); }, 700);
    return;
  }
  _invincible = 120; // 2 s grace period while screen clears and next question loads
  G.enemies  = [];
  spawnTimer = spawnRate;
  setTimeout(() => {
    if (_sessionId !== sid) return; // stale — new game already started
    if (G.questionsAnswered < levelCfg.questionCount) nextQuestion();
    else endLevel(true);
  }, 900);
}

// ── HUD UPDATES ────────────────────────────────────────────────────────────────
function updateLivesHUD() {
  $('hud-lives').innerHTML = [0,1,2].map(i =>
    `<span style="opacity:${i < G.lives ? '1' : '0.2'}">&#10084;&#65039;</span>`
  ).join('');
}

function updateStreakHUD() {
  const h = $('hud-streak');
  h.textContent = G.streak >= 3 ? `&#128293; ${G.streak}` : '';
}

// ── LEVEL END ──────────────────────────────────────────────────────────────────
function endLevel(won) {
  clearInterval(G.timerInterval);
  cancelAnimationFrame(G.animFrame);
  G.timerInterval = null;
  G.animFrame     = null;

  if (_onComplete) _onComplete(won);
}

// ── PUBLIC API ──────────────────────────────────────────────────────────────────
export function initGame(levelNum, onComplete) {
  _sessionId++;            // invalidate all pending timeouts from previous game
  _invincible = 0;
  resetLevel();
  G.currentLevel = levelNum;
  levelCfg       = getLevel(levelNum);
  _onComplete    = onComplete;

  canvas = $('game-canvas');
  ctx    = canvas.getContext('2d');

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  $('hud-level').textContent = `LEVEL ${levelNum}`;
  updateLivesHUD();
  updateStreakHUD();

  const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.f22;
  if (aircraft.ability === 'extraLife') G.lives = Math.min(G.lives + 1, 5);
  updateLivesHUD();

  spawnRate  = levelCfg.spawnRate;
  maxEnemies = levelCfg.maxEnemies;
  spawnTimer = 60;

  attachInputListeners();

  // Retry every frame until the canvas has real dimensions (showScreen CSS may
  // not have been laid out yet on the very first rAF after display:none → visible)
  const sid = _sessionId;
  function tryStart() {
    if (_sessionId !== sid) return; // cleaned up before canvas was ready
    resize();
    if (!canvas.width || !canvas.height) { requestAnimationFrame(tryStart); return; }
    placePlayer(); // always start at center-bottom
    G.animFrame = requestAnimationFrame(frame);
    nextQuestion();
  }
  requestAnimationFrame(tryStart);

  return () => {
    _sessionId++;           // also invalidate on manual cleanup
    clearInterval(G.timerInterval);
    cancelAnimationFrame(G.animFrame);
    detachInputListeners();
    pointerTarget = null;
    Object.keys(keys).forEach(k => keys[k] = false);
    ro.disconnect();
  };
}

export { levelCfg as getCurrentLevelCfg };
