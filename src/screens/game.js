import { G, resetLevel } from '../state.js';
import { $, showScreen } from '../utils/dom.js';
import { save } from '../utils/storage.js';
import { newQuestion } from '../game/math-engine.js';
import { spawnEnemy, updateEnemies, hitEnemy } from '../game/enemies.js';
import { createMissile, updateMissiles, drawMissiles } from '../game/missiles.js';
import { spawnExplosion, spawnHitSpark, updateParticles, drawParticles } from '../game/particles.js';
import { drawAircraft, drawEnemy } from '../game/aircraft-draw.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { getLevel, BIOME_META } from '../data/levels.js';
import { SFX } from '../audio/sound.js';
import { calcXP, calcStars } from '../systems/xp.js';
import { saveProgress } from '../systems/progression.js';
import { rollChest } from '../systems/chest.js';

let canvas, ctx, levelCfg;
let tick = 0;
let shakeFrames = 0;
let _onComplete = null; // callback(won)

// ── RESIZE ─────────────────────────────────────────────────────────────────
function resize() {
  canvas.width  = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  G.player.baseX = canvas.width / 2;
  G.player.baseY = canvas.height - 60;
  G.player.x     = G.player.baseX;
  G.player.y     = G.player.baseY;
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

  // Enemies
  updateEnemies(G.enemies);
  for (const e of G.enemies) {
    if (!e.active) continue;
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

  // Enemy missiles
  updateMissiles(G.enemyMissiles, () => onEnemyMissileHit());
  drawMissiles(ctx, G.enemyMissiles);

  // Particles
  updateParticles(G.particles);
  drawParticles(ctx, G.particles);

  // Player — smooth idle drift
  const driftX   = Math.sin(tick * 0.018) * 22;          // left / right
  const driftY   = Math.sin(tick * 0.011) * 10;          // forward / back
  const bankAngle = Math.cos(tick * 0.018) * 0.18;       // tilt in drift direction
  G.player.x = G.player.baseX + driftX;
  G.player.y = G.player.baseY + driftY;

  const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.f22;
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

  if (shaking) ctx.restore();

  G.animFrame = requestAnimationFrame(frame);
}

// ── ENEMY MISSILE ───────────────────────────────────────────────────────────
function fireEnemyMissile() {
  const enemy = G.enemies[0];
  if (!enemy) { loseLife(); return; }
  const m = createMissile(enemy.x, enemy.y, G.player.x, G.player.y, 6, null, '#ef4444');
  // Store target as player position (no enemyId needed)
  m.tx = G.player.x;
  m.ty = G.player.y;
  G.enemyMissiles.push(m);
  SFX.missile();
}

function onEnemyMissileHit() {
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
  if (!destroyed) {
    spawnHitSpark(G.particles, enemy.x, enemy.y);
    return;
  }
  enemy.active = false;
  shakeFrames = 6;
  G.enemies = G.enemies.filter(e => e.active);
  setTimeout(() => {
    if (G.questionsAnswered < levelCfg.questionCount) nextQuestion();
    else endLevel(true);
  }, 350);
}

// ── ENEMY SPAWN ──────────────────────────────────────────────────────────────
function spawnNextEnemy() {
  const types = levelCfg.enemyTypes;
  const type  = types[Math.floor(Math.random() * types.length)];
  const e     = spawnEnemy(canvas.width, type);
  G.enemies   = [e];
  return e;
}

// ── QUESTION CYCLE ────────────────────────────────────────────────────────────
function nextQuestion() {
  if (G.questionsAnswered >= levelCfg.questionCount) { endLevel(true); return; }
  G.answerLocked = false;
  const enemy    = spawnNextEnemy();
  G.question     = newQuestion(levelCfg.ops, levelCfg.num);

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

  startTimer(enemy.timeMod);
}

// ── TIMER ─────────────────────────────────────────────────────────────────────
function startTimer(timeMod = 1) {
  if (G.timerInterval) clearInterval(G.timerInterval);
  G.timeLeft = levelCfg.timeLimit * timeMod;
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

    // Fire missile(s)
    const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.f22;
    const speed    = aircraft.ability === 'fastMissile' ? 13 : 8;
    const enemy    = G.enemies[0];
    if (enemy) {
      if (aircraft.ability === 'multiShot') {
        // Three missiles fanned
        [-18, 0, 18].forEach(offset => {
          G.missiles.push(createMissile(G.player.x + offset, G.player.y, enemy.x, enemy.y, speed, enemy.id));
        });
      } else {
        G.missiles.push(createMissile(G.player.x, G.player.y, enemy.x, enemy.y, speed, enemy.id));
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
}

function handleTimeout() {
  if (G.answerLocked) return;
  G.answerLocked = true;
  G.questionsAnswered++;
  G.streak = 0;
  updateStreakHUD();
  SFX.wrong();
  document.querySelectorAll('.answer-btn').forEach(b => { b.classList.add('wrong'); b.disabled = true; });
  setTimeout(() => fireEnemyMissile(), 300);
}

// ── LIVES ──────────────────────────────────────────────────────────────────────
function loseLife() {
  G.lives--;
  G.enemyMissiles = [];
  updateLivesHUD();
  shakeFrames = 12;
  if (G.lives <= 0) { setTimeout(() => endLevel(false), 700); return; }
  G.enemies = [];
  setTimeout(() => {
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
  resetLevel();
  G.currentLevel = levelNum;
  levelCfg       = getLevel(levelNum);
  _onComplete    = onComplete;

  canvas = $('game-canvas');
  ctx    = canvas.getContext('2d');
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  $('hud-level').textContent = `LEVEL ${levelNum}`;
  updateLivesHUD();
  updateStreakHUD();

  // Extra life from C-130 ability
  const aircraft = AIRCRAFT[G.activeAircraft] || AIRCRAFT.f22;
  if (aircraft.ability === 'extraLife') G.lives = Math.min(G.lives + 1, 5);
  updateLivesHUD();

  G.animFrame = requestAnimationFrame(frame);
  nextQuestion();

  return () => {
    clearInterval(G.timerInterval);
    cancelAnimationFrame(G.animFrame);
    ro.disconnect();
  };
}

export { levelCfg as getCurrentLevelCfg };
