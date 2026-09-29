import { G, resetLevel, clampCoins, addSessionCoins, addSessionXp, addLifetimeXp } from '../state.js';
import { uiIcon } from '../utils/icons.js';
import { $, showScreen } from '../utils/dom.js';
import { newQuestion } from '../game/math-engine.js';
import { spawnEnemy, updateEnemies, hitEnemy, KAMIKAZE_LOCK_FRAMES } from '../game/enemies.js';
import { shotDelaySeconds, activeWeapon, homingUpgradeOwned } from '../data/upgrades.js';
import { createMissile, updateMissiles, drawMissiles } from '../game/missiles.js';
import { spawnExplosion, spawnHitSpark, spawnMissileExplosion, updateParticles, drawParticles } from '../game/particles.js';
import {
  drawAircraftSprite,
  drawAircraftSpriteSized,
  drawEnemySprite,
  getEnemyDrawSize,
  getPlayerSize,
} from '../game/aircraft-draw.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { getLevel } from '../data/levels.js';
import { SFX } from '../audio/sound.js';
import { preloadBiome, drawFrame, hasTurnArt, SPRITE_DEFS, AIRCRAFT_SPRITE, preloadSprite } from '../game/sprites.js';
import { shouldShowIntroBriefing, showIntroBriefing } from './intro-briefing.js';
import { SHOOTING_PLANS } from './shop.js';
import { initBackground, updateBackground, drawBackground } from '../game/background.js';
import { initClouds, updateClouds, drawClouds } from '../game/clouds.js';
import { initWeatherFx, drawWeatherFx, windForce, windIntensity } from '../game/weather-fx.js';
import { WEATHER_TYPES } from '../data/weather.js';
import {
  initAirdrop, updateAirdrop, drawAirdrop, handleAirdropPointer,
  rollAirdropForLevel, hitAirdrop,
} from '../game/airdrop.js';
import { trackMission } from '../systems/daily.js';
import { getPilotGrade } from '../data/pilots.js';
import { applyAgeModifiers } from '../systems/age-modifiers.js';
import { calcSpeedXP } from '../systems/xp.js';
import { load, save } from '../utils/storage.js';
import { t, getLang } from '../i18n.js';
import {
  isTouchMobile, gameCanvasDpr,
} from '../utils/device.js';
import { setSpriteCanvasWidth } from '../game/aircraft-draw.js';
import { wsOn, wsSend, wsDisconnect } from '../online/ws-client.js';

const ENEMY_MOVEMENT_SPEED_SCALE = 0.82;
// Phones and tablets: enemy planes fly 60% faster (they looked slow there).
const TOUCH_ENEMY_SPEED_MULT = 1.6;
const TOUCH_F5_EXTRA_SPEED = 1.35;   // F-5s: 35% more on top of that
const ENEMY_SPAWN_INTERVAL_SCALE = 0.9;
// Frames between shots (60 fps): F-15 = 5 s, F-5 ('fast') = 5 s,
// Eurofighter ('turner') = 3 s.
const FIXED_ENEMY_FIRE_RATE = { basic: 300, fast: 300, turner: 180 };
const MISSILE_SPEED_SCALE = 0.8;
const PLAYER_SHIELD_DURATION_MS = 10000;
const PLAYER_SHIELD_COOLDOWN_MS = 30000;
let _playerShieldUntil = 0;
let _playerShieldReadyAt = 0;
let _playerShieldButtonHandler = null;
let _lastShieldHudSecond = -1;
let _shieldPausedAt = 0;   // paused during an equation (see syncAbilityPause)

function playerShieldActive(now = performance.now()) {
  return (G.activeBadge === 'good_student' && now < _playerShieldUntil && !_shieldPausedAt)
    || now < (G.airdropShieldUntil || 0);   // airdrop "champ de protection"
}

function updatePlayerShieldButton(now = performance.now(), force = false) {
  const button = document.getElementById('btn-player-shield');
  const label = document.getElementById('player-shield-status');
  if (!button || !label) return;
  const available = G.activeBadge === 'good_student' && !isTutorialActive();
  button.classList.toggle('hidden', !available);
  if (!available) return;
  const at = _shieldPausedAt || now;
  const activeMs = Math.max(0, _playerShieldUntil - at);
  const cooldownMs = Math.max(0, _playerShieldReadyAt - at);
  const displaySecond = Math.ceil((activeMs || cooldownMs) / 1000);
  if (!force && displaySecond === _lastShieldHudSecond) return;
  _lastShieldHudSecond = displaySecond;
  button.classList.toggle('active', activeMs > 0);
  button.classList.toggle('paused', activeMs > 0 && Boolean(_shieldPausedAt));
  button.classList.toggle('cooldown', activeMs <= 0 && cooldownMs > 0);
  button.disabled = cooldownMs > 0;
  label.textContent = activeMs > 0 ? `${Math.ceil(activeMs / 1000)}s` : cooldownMs > 0 ? `${Math.ceil(cooldownMs / 1000)}s` : 'SHIELD';
}

function activatePlayerShield() {
  const now = performance.now();
  if (G.activeBadge !== 'good_student' || now < _playerShieldReadyAt) return;
  _shieldPausedAt = 0;
  _playerShieldUntil = now + PLAYER_SHIELD_DURATION_MS;
  // The 30-second recharge begins after the 10-second shield effect ends.
  // Previously both timers started together, so the HUD showed only 20 seconds.
  _playerShieldReadyAt = _playerShieldUntil + PLAYER_SHIELD_COOLDOWN_MS;
  _lastShieldHudSecond = -1;
  updatePlayerShieldButton(now, true);
}

// ── AIRCRAFT ABILITIES ──────────────────────────────────────────────────────
// Activatable aircraft skills share one round button (#btn-aircraft-turbo),
// same pattern as the "good_student" badge shield above. The recharge starts
// once the effect ends.
//   SR-71 TURBO   — speed boost
//   F-16 ESQUIVE  — enemy missiles swerve around the aircraft
//   B-2 FURTIF    — invisible: enemies stop firing and nothing can hit it
const AIRCRAFT_SKILLS = {
  turbo:   { durationMs: 10000, cooldownMs: 14000, icon: 'bolt', label: { fr: 'TURBO',   en: 'TURBO' } },
  evade:   { durationMs: 10000, cooldownMs: 30000, icon: 'rotate', label: { fr: 'ESQUIVE', en: 'EVADE' } },
  stealth: { durationMs: 10000, cooldownMs: 30000, icon: 'stealth', label: { fr: 'FURTIF',  en: 'STEALTH' } },
};
const SR71_TURBO_SPEED_MULT = 1.55;
const F16_EVADE_RADIUS = 90;
let _turboUntil = 0;
let _turboReadyAt = 0;
let _turboButtonHandler = null;
let _lastTurboHudSecond = -1;
// A running skill pauses while an equation waits for its answer (and during
// the correction): its effect stops and its seconds stop counting, then it
// picks up where it was. 0 = not paused.
let _skillPausedAt = 0;

function aircraftSkill() {
  const id = AIRCRAFT[G.activeAircraft]?.ability?.skill;
  return id && AIRCRAFT_SKILLS[id] ? { id, ...AIRCRAFT_SKILLS[id] } : null;
}

function aircraftSkillActive(skillId, now = performance.now()) {
  return aircraftSkill()?.id === skillId && now < _turboUntil && !_skillPausedAt;
}

// Called every frame: starts or ends the pause of the aircraft skill and of
// the "good_student" badge shield. On resume each one's end (and its cooldown
// after it) moves later by the time spent on the equation.
function syncAbilityPause(paused, now = performance.now()) {
  if (paused) {
    if (!_skillPausedAt && now < _turboUntil) {
      _skillPausedAt = now;
      _lastTurboHudSecond = -1;
    }
    if (!_shieldPausedAt && now < _playerShieldUntil) {
      _shieldPausedAt = now;
      _lastShieldHudSecond = -1;
    }
    return;
  }
  if (_skillPausedAt) {
    const pausedMs = now - _skillPausedAt;
    _turboUntil += pausedMs;
    _turboReadyAt += pausedMs;
    _skillPausedAt = 0;
    _lastTurboHudSecond = -1;
  }
  if (_shieldPausedAt) {
    const pausedMs = now - _shieldPausedAt;
    _playerShieldUntil += pausedMs;
    _playerShieldReadyAt += pausedMs;
    _shieldPausedAt = 0;
    _lastShieldHudSecond = -1;
  }
}

function aircraftTurboActive(now = performance.now()) {
  return aircraftSkillActive('turbo', now);
}

function updateAircraftTurboButton(now = performance.now(), force = false) {
  const button = document.getElementById('btn-aircraft-turbo');
  const label = document.getElementById('aircraft-turbo-status');
  if (!button || !label) return;
  const skill = aircraftSkill();
  const available = Boolean(skill) && !isTutorialActive();
  button.classList.toggle('hidden', !available);
  if (!available) return;
  // Paused: the seconds shown stay where they were when the equation came up.
  const at = _skillPausedAt || now;
  const activeMs = Math.max(0, _turboUntil - at);
  const cooldownMs = Math.max(0, _turboReadyAt - at);
  const displaySecond = Math.ceil((activeMs || cooldownMs) / 1000);
  if (!force && displaySecond === _lastTurboHudSecond) return;
  _lastTurboHudSecond = displaySecond;
  const icon = button.querySelector('.aircraft-turbo-icon');
  if (icon) icon.innerHTML = uiIcon(skill.icon);
  button.classList.toggle('active', activeMs > 0);
  button.classList.toggle('paused', activeMs > 0 && Boolean(_skillPausedAt));
  button.classList.toggle('cooldown', activeMs <= 0 && cooldownMs > 0);
  button.disabled = cooldownMs > 0;
  label.textContent = activeMs > 0 ? `${Math.ceil(activeMs / 1000)}s`
    : cooldownMs > 0 ? `${Math.ceil(cooldownMs / 1000)}s`
    : skill.label[getLang() === 'fr' ? 'fr' : 'en'];
}

function activateAircraftTurbo() {
  const now = performance.now();
  const skill = aircraftSkill();
  if (!skill || now < _turboReadyAt) return;
  _skillPausedAt = 0;
  _turboUntil = now + skill.durationMs;
  _turboReadyAt = _turboUntil + skill.cooldownMs;
  if (skill.id === 'stealth') {
    // Reuse the game's stealth state; it ends when _turboUntil passes.
    _stealthActive = true;
  }
  _lastTurboHudSecond = -1;
  SFX.click?.();
  updateAircraftTurboButton(now, true);
}

// B-2 NUCLEAR BOMB: dropped automatically on every Nth correct answer.
function maybeLaunchB2Nuke() {
  const every = AIRCRAFT[G.activeAircraft]?.ability?.nukeEveryCorrect;
  if (!every || isTutorialActive() || !G.correctAnswers || G.correctAnswers % every !== 0) return;
  launchNuke({ spareBosses: true });
}

// SR-71 HACK: every 3 correct answers, the 3 enemy planes closest to the
// player (never a boss) switch sides. They turn around (same sprite and
// animation frames), fly into a V just ahead of the player, fire at their
// former teammates for 10 s, then explode. Like the other abilities, their
// 10 s and their fire stop while an equation waits for its answer.
const TURNCOAT_COUNT = 3;
const TURNCOAT_MS = 10000;
const TURNCOAT_TURN_MS = 700;

// Each switched plane keeps its own weapon, now aimed at the enemies:
//   F-15 / Eurofighter / others: red missiles     F-15 (homing): homing missile
//   F-5: blue laser dots     F-14: red laser volleys (3 s on / 3 s off)
//   Apache: machine-gun bursts     kamikaze F-5: rams the nearest enemy
// (Faster than when they were enemies, so they help in their 10 seconds.)
function turncoatWeapon(e) {
  if (e.turncoatKamikaze) return 'ram';
  if (e.type === 'interceptor') return 'laser';
  if (e.pathType === 'apache-ambush') return 'gun';
  if (e.homingShooter) return 'homing';
  if (e.type === 'fast') return 'dots';
  return 'missile';
}

function fireTurncoatWeapon(e, target) {
  const muzzleY = e.y - getEnemyDrawSize(e) * 0.3;
  const mobile = isTouchMobile();
  const push = (speed, type, color, { homing = false, spread = 0 } = {}) => {
    const shot = createMissile(e.x + spread * 0.3, muzzleY, target.x + spread, target.y, speed * MISSILE_SPEED_SCALE, null, color, 1, homing);
    shot.fromPlayer = true;
    shot.type = type;
    if (homing) shot.allyHoming = true;
    G.missiles.push(shot);
    return shot;
  };
  switch (turncoatWeapon(e)) {
    case 'laser':
      e.turncoatCycle = ((e.turncoatCycle || 0) + 12) % 360;
      if (e.turncoatCycle >= 180) return 12;          // resting half of the cycle
      push(mobile ? 8.8 : 7.4, 'enemy-laser', '#ff2020');
      SFX.missile('laser');
      return 12;
    case 'gun':
      if (!e.turncoatBurst) e.turncoatBurst = 7;
      push(8.5, 'enemy-machine-gun', '#ffd34d', { spread: (Math.random() - 0.5) * 26 });
      SFX.missile('gun');
      e.turncoatBurst--;
      return e.turncoatBurst > 0 ? 5 : 60;
    case 'homing':
      push(mobile ? 6 : 5, 'enemy-homing', '#ff3b30', { homing: true });
      SFX.missile('missile');
      return 70;
    case 'dots':
      push((mobile ? 9.8 : 8.4) * 1.2, 'enemy-blue-dot', '#38bdf8');
      SFX.missile('laser');
      return 26;
    default: {
      const shot = push(mobile ? 9.8 : 8.4, 'ally-missile', '#ef4444');
      shot.enemyStyle = true;
      SFX.missile('missile');
      return 40;
    }
  }
}

// Kamikaze F-5 on our side: charges the nearest enemy and blows up with it.
function updateTurncoatRam(e) {
  const target = (e.ramTarget?.active && !e.ramTarget.turncoat) ? e.ramTarget : nearestEnemyTo(e.x, e.y);
  e.ramTarget = target;
  if (!target) return false;
  const dx = target.x - e.x, dy = target.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.ramSpeed = Math.min(canvas.height * 0.016, (e.ramSpeed || 2) + 0.25 * _frameStep);
  e.x += (dx / d) * e.ramSpeed * _frameStep;
  e.y += (dy / d) * e.ramSpeed * _frameStep;
  e.headingAngle = Math.atan2(dy, dx) - Math.PI / 2;
  const reach = (getEnemyDrawSize(e) + getEnemyDrawSize(target)) * 0.3;
  if (d < reach) {
    onMissileHit(target, { damage: 3, type: 'default' });
    spawnMissileExplosion(G.particles, e.x, e.y, 'default', 18);
    e.active = false;
  }
  return true;
}

function maybeTurnEnemies() {
  const every = AIRCRAFT[G.activeAircraft]?.ability?.turncoatEveryCorrect;
  if (!every || isTutorialActive() || !G.correctAnswers || G.correctAnswers % every !== 0) return;
  const candidates = G.enemies
    .filter(e => e.active && !e.turncoat && e.type !== 'boss' && !e.holdEntry
      && e.y > 0 && e.y < canvas.height && e.x > 0 && e.x < canvas.width)
    .sort((a, b) => ((a.x - G.player.x) ** 2 + (a.y - G.player.y) ** 2)
      - ((b.x - G.player.x) ** 2 + (b.y - G.player.y) ** 2))
    .slice(0, TURNCOAT_COUNT);
  if (!candidates.length) return;
  const taken = new Set(G.enemies.filter(e => e.active && e.turncoat).map(e => e.turncoatSlot));
  const freeSlots = [0, 1, 2, 3, 4].filter(slot => !taken.has(slot));
  candidates.forEach((e, i) => {
    e.turncoat = true;
    e.turncoatLeftMs = TURNCOAT_MS;
    e.turncoatAge = 0;
    e.turncoatShotCd = 20 + i * 10;
    e.turncoatSlot = freeSlots[i] ?? i;
    e.turncoatFromAngle = Number.isFinite(e.headingAngle) ? e.headingAngle : 0;
    e.homingLockT = null;
    e.turncoatKamikaze = !!e.kamikaze;   // its weapon is itself: it rams an enemy
    e.kamikaze = false;
    e.vx = 0;
    e.bankVis = 0;
    spawnHitSpark(G.particles, e.x, e.y);
  });
  // Their shots already in the air no longer threaten the player.
  const turned = new Set(candidates.map(e => e.id));
  G.enemyMissiles = G.enemyMissiles.filter(m => !turned.has(m.enemyId));
  SFX.turncoat?.();
}

// Slot in the V ahead of the player: 0 = tip, then left / right, wider.
function turncoatSlotPos(slot) {
  const size = getPlayerSize();
  const rank = Math.ceil(slot / 2);
  const side = slot === 0 ? 0 : (slot % 2 ? -1 : 1);
  const x = G.player.x + side * rank * size * 1.45;
  const y = G.player.y - size * 2.7 + rank * size * 0.55;
  return {
    x: Math.max(size * 0.6, Math.min(canvas.width - size * 0.6, x)),
    y: Math.max(size * 0.8, y),
  };
}

function updateAndDrawTurncoat(e, frameMs) {
  const paused = isQuestionAwaitingAnswer() || _correctionWaiting || _cutsceneActive;
  e.turncoatAge += frameMs;
  if (!paused) e.turncoatLeftMs -= frameMs;
  if (e.turncoatLeftMs <= 0) {
    // Time is up: the plane blows up (no coin, it was on our side).
    spawnMissileExplosion(G.particles, e.x, e.y, 'default', 18);
    SFX.explode();
    e.active = false;
    return;
  }
  const turnT = Math.min(1, e.turncoatAge / TURNCOAT_TURN_MS);
  // Kamikaze: once turned, it charges instead of holding a slot in the V.
  if (e.turncoatKamikaze && turnT >= 1 && !paused && updateTurncoatRam(e)) {
    if (!e.active) return;
    drawTurncoat(e);
    return;
  }
  // Fly to its slot in the V (ease), turn around to face the enemies.
  const slot = turncoatSlotPos(e.turncoatSlot);
  const k = Math.min(1, 0.06 * _frameStep);
  const prevX = e.x;
  e.x += (slot.x - e.x) * k;
  e.y += (slot.y - e.y) * k;
  e.vx = 0;
  e.bankVis = 0;
  const eased = turnT * turnT * (3 - 2 * turnT);
  const bank = Math.max(-0.35, Math.min(0.35, (e.x - prevX) * 0.05));
  e.headingAngle = e.turncoatFromAngle + (Math.PI - e.turncoatFromAngle) * eased + bank;
  // Same animation frames as before (the path code no longer runs for it).
  if (e.pathType === 'interceptor' && !e.entryAnimationComplete) {
    e.entryAnimationComplete = true;
    e.spriteKey = e.normalSpriteKey || e.spriteKey;
    e.animFrame = 0;
    e.interpolateFrames = false;
  }
  // Fire its own weapon at the nearest real enemy (after the turn, not
  // during equations).
  if (!paused && turnT >= 1 && !e.turncoatKamikaze) {
    e.turncoatShotCd -= _frameStep;
    if (e.turncoatShotCd <= 0) {
      const target = nearestEnemyTo(e.x, e.y);
      e.turncoatShotCd = target ? fireTurncoatWeapon(e, target) : 12;
    }
  }
  drawTurncoat(e);
}

function drawTurncoat(e) {
  if (e.animFrames) e.animFrame = ((e.animFrame || 0) + (e.animRate || 0) * _frameStep) % e.animFrames;
  if (e.shakeTick > 0) e.shakeTick -= _frameStep;
  // Green ring: this plane is on our side; the ring empties with its time.
  const size = getEnemyDrawSize(e);
  const left = Math.max(0, e.turncoatLeftMs / TURNCOAT_MS);
  ctx.save();
  ctx.strokeStyle = 'rgba(124,252,0,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(e.x, e.y, size * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#7CFC00';
  ctx.shadowColor = '#7CFC00';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(e.x, e.y, size * 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
  ctx.stroke();
  ctx.restore();
  drawEnemySprite(ctx, e, 0);
  if (e.turncoatAge < 1800) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1800 - e.turncoatAge) / 400);
    ctx.textAlign = 'center';
    ctx.font = `bold ${isTouchMobile() ? 8 : 10}px 'Press Start 2P', monospace`;
    ctx.fillStyle = '#7CFC00';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 5;
    ctx.fillText(getLang() === 'fr' ? 'ALLIÉ' : 'ALLY', e.x, e.y - size * 0.7);
    ctx.restore();
  }
}

// PC-21 REGEN: recovers one life every interval, up to the level's starting
// life count.
const PC21_REGEN_INTERVAL_MS = 18000;
let _nextRegenAt = 0;

function updateAircraftRegen(now = performance.now()) {
  if (!AIRCRAFT[G.activeAircraft]?.ability?.regen) return;
  if (isTutorialActive() || (G.practiceMode && !G.practiceHearts) || _godMode) return;
  if (G.lives <= 0 || G.lives >= _maxLives) { _nextRegenAt = now + PC21_REGEN_INTERVAL_MS; return; }
  if (now < _nextRegenAt) return;
  G.lives = Math.min(_maxLives, G.lives + 1);
  updateLivesHUD();
  SFX.coinClaim?.();
  _nextRegenAt = now + PC21_REGEN_INTERVAL_MS;
}

// F-117 JAMMING: slows enemies within range of the player.
const F117_JAM_RADIUS = 260;
const F117_JAM_FACTOR = 0.55;

function enemySpeedMultFor(enemy) {
  const dx = enemy.x - G.player.x, dy = enemy.y - G.player.y;
  if (dx * dx + dy * dy > F117_JAM_RADIUS * F117_JAM_RADIUS) return 1;
  return F117_JAM_FACTOR;
}

// C-130 MAGNET: pulls map coins and the revealed airdrop reward toward the
// player once they are within range.
const C130_MAGNET_RADIUS = 260;

// F/A-18 BURST: fires two shots instead of one for a few seconds every cycle.
const F18_BURST_CYCLE_MS = 6000;
const F18_BURST_ACTIVE_MS = 1500;

function burstActiveNow(now = performance.now()) {
  return (now % F18_BURST_CYCLE_MS) < F18_BURST_ACTIVE_MS;
}

// F-22 PRECISION: player missiles marked `homing` steer toward whichever
// active enemy is still ahead of them, so they cannot miss it.
function nearestEnemyAheadOf(missile) {
  let best = null, bestD = Infinity;
  for (const e of G.enemies) {
    if (!e.active || e.turncoat || e.y > missile.y + 20) continue;
    const dx = e.x - missile.x, dy = e.y - missile.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best ? { x: best.x, y: best.y } : null;
}
// Every regular aircraft has the same chance to be selected on every level.
// Its own movement behavior still controls whether it spawns alone or as a
// complete pair/formation.
// 'fast' (F-5) is listed three times so its crossing waves show up more often.
const RANDOM_ENEMY_TYPES = ['basic', 'fast', 'fast', 'fast', 'tank', 'turner', 'interceptor'];

function hasGuestTrialLeft(levelNum = G.currentLevel || 1) {
  return true;
}

function recordGuestGamePlayed() {
  if (G.playerRegistered || G.practiceMode || isTutorialActive()) return;
}

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

const REASONABLE_GRADE_PROFILES = {
  1: { ops: ['+'],                cap: 20,  mCap: 4  },
  2: { ops: ['+', '-'],           cap: 30,  mCap: 5  },
  3: { ops: ['+', '-', '*'],      cap: 45,  mCap: 7  },
  4: { ops: ['+', '-', '*', '/'], cap: 70,  mCap: 9  },
  5: { ops: ['+', '-', '*', '/'], cap: 100, mCap: 11 },
  6: { ops: ['+', '-', '*', '/'], cap: 140, mCap: 12 },
};

function normalizeOps(ops) {
  const map = {
    '+': '+', add: '+', addition: '+',
    '-': '-', sub: '-', subtraction: '-',
    '*': '*', x: '*', '×': '*', mul: '*', multiplication: '*',
    '/': '/', '÷': '/', div: '/', division: '/',
  };
  const list = Array.isArray(ops) ? ops : [ops];
  return [...new Set(list.map(op => map[String(op || '').toLowerCase().trim()]).filter(Boolean))];
}

function applyGradeToQuestion(ops, cap, mCap, grade) {
  const selectedOps = G.practiceMode ? normalizeOps(ops) : selectedFocusOperations();
  const selectedAllowedOps = selectedOps.filter(op => ['+', '-', '*', '/'].includes(op));
  // The player's "weak topic" focus (picked once at onboarding) may only
  // narrow which of THIS level's own operations get asked — it must never
  // introduce an operation the level hasn't unlocked yet (e.g. level 1 must
  // stay addition-only even if the player once flagged subtraction/division
  // as their weak spot).
  const focusInLevel = G.practiceMode ? selectedAllowedOps : selectedAllowedOps.filter(op => ops.includes(op));
  if (!grade && !focusInLevel.length) return { ops, cap, mCap };
  const p = REASONABLE_GRADE_PROFILES[grade] || REASONABLE_GRADE_PROFILES[6];
  // Pilot setup choices apply for every grade; grade only keeps the numbers reasonable.
  const allowedOps = focusInLevel.length
    ? focusInLevel
    : ops.filter(o => p.ops.includes(o));
  const needsTables = allowedOps.some(op => op === '*' || op === '/');
  const selectedCap = Math.min(cap, p.cap);
  const selectedMCap = needsTables
    ? Math.max(2, Math.min(mCap || p.mCap || 12, p.mCap))
    : Math.min(mCap, p.mCap);
  return {
    ops:  allowedOps.length ? allowedOps : ['+'],
    cap:  selectedCap,
    mCap: selectedMCap,
  };
}

// Exponent / algebra: chosen at onboarding (G.focusTopics) or in the
// practice setup (G.practiceOps). Not part of any level's own op set, so they
// are mixed in on top of it (see nextQuestion).
const EXTRA_TOPIC_OPS = { exponent: '^', algebra: 'alg' };
const EXTRA_TOPIC_SHARE = 0.4;   // share of level questions from those topics

function selectedExtraTopicOps() {
  if (G.practiceMode) return (G.practiceOps || []).filter(op => op === '^' || op === 'alg');
  if (isTutorialActive()) return [];   // placement rounds stay on + - x /
  return [...new Set((G.focusTopics || []).map(topic => EXTRA_TOPIC_OPS[topic]).filter(Boolean))];
}

// School year (1-12) from the onboarding class (qc-sec2, fr-4e, us-8...).
function schoolYearOf(level = G.schoolLevel || '') {
  const qc = level.match(/^qc-(prim|sec)(\d)/);
  if (qc) return qc[1] === 'sec' ? 6 + Number(qc[2]) : Number(qc[2]);
  const us = level.match(/^us-(\d+)/);
  if (us) return Number(us[1]);
  const fr = { 'fr-cp': 1, 'fr-ce1': 2, 'fr-ce2': 3, 'fr-cm1': 4, 'fr-cm2': 5, 'fr-6e': 6, 'fr-5e': 7, 'fr-4e': 8, 'fr-3e': 9, 'fr-2nde': 10, 'fr-1re': 11, 'fr-term': 12 };
  return fr[level] || 0;
}

// Size of exponent / algebra questions in levels: the level's own number cap,
// raised for secondary-school players so early levels are not trivial.
function extraTopicCap(levelCap) {
  const year = schoolYearOf();
  return Math.max(levelCap || 10, year >= 9 ? 40 : year >= 7 ? 25 : 0);
}

function selectedFocusOperations() {
  const list = Array.isArray(G.focusOperations) && G.focusOperations.length
    ? G.focusOperations
    : G.focusOperation ? [G.focusOperation] : [];
  return [...new Set(list.filter(Boolean))];
}

function applyOnboardingFocus(ops) {
  const selectedOps = selectedFocusOperations();
  // Same rule as applyGradeToQuestion(): only weight towards the focus
  // operation(s) that this level's own op set already includes.
  const focusOps = selectedOps.filter(op => ops.includes(op));
  if (G.practiceMode || !focusOps.length) return ops;
  return [...focusOps, ...focusOps, ...focusOps];
}

// Practice difficulty also sets the size of the numbers in the equations.
const PRACTICE_MATH_RANGE = {
  easy:   { cap: 10, mCap: 5 },
  normal: { cap: 20, mCap: 12 },
  hard:   { cap: 40, mCap: 12 },
};

function applyOnboardingLevelLength(cfg) {
  if (G.practiceMode || cfg.isBossLevel) return cfg;
  const next = { ...cfg };
  if (G.onboardingLevelLength === 'short') {
    next.questionCount = Math.max(3, cfg.questionCount - 2);
  } else if (G.onboardingLevelLength === 'long') {
    next.questionCount = cfg.questionCount + 2;
  }
  return next;
}

function getOnboardingTimerBonus() {
  let bonus = 0;
  if (G.likesMath === false) bonus += 4;
  if (G.pendingPlacement) bonus += 2;
  return bonus;
}

function isTutorialActive() {
  return _tutorialActive && G.tutorialMode;
}

function shouldForceIntroBriefingBeforeFirstRound() {
  if (!isTutorialActive()) return false;
  // Already shown right after the questionnaire (main.js startNewPlayerAnimation).
  if (G.hasSeenBriefing) return false;
  const progress = G.tutorialProgress || load('tutorialProgress', null);
  const round = progress?.round || _tutorialRound || 1;
  const answered = progress?.questionsAnswered || G.questionsAnswered || 0;
  return round === 1 && answered === 0;
}

function introLang() {
  return getLang();
}

const TUTORIAL_COPY = {
  en: {
    round1Label: 'TUTORIAL ROUND 1 - EASY',
    round2Label: 'TUTORIAL ROUND 2 - SPEED',
    round1Hint: 'No timer. No game over. Choose the best answer.',
    livesNow: 'Timer on and 3 LIVES! Watch your mistakes.',
    guidedBreak: 'Well done! 5 questions done. 5-second break, then timer and 3 lives!',
    restart: 'Out of lives! Starting again at 0.',
    infinite: 'LIVES',
    round2Hint: 'Timer on. Harder questions. Show your level.',
    good: ['Nice shot!', 'Good answer!', 'Captain Jexongo approves!'],
    bad: ['Not this one. Look at the equation.', 'Good try. Captain shows the answer.'],
    timeout: ['Time is up. Watch the board.', 'Too slow. Try the next one.'],
    captain: 'CAPTAIN JEXONGO',
    starting: 'TUTORIAL STARTING',
    lookBoard: 'Look at the equation board.',
    tapAnswer: 'Tap the correct answer case to shoot.',
    round1Rules: 'Round 1 has no timer and no game over.',
    computer: 'COMPUTER',
    phone: 'PHONE',
    hudLevel: 'TUTORIAL',
    training: 'TRAINING',
    arrows: 'or arrow keys',
    phoneMove: 'move with the fighter',
    continue: 'CONTINUE',
    round1Complete: 'ROUND 1 COMPLETE',
    round2Harder: 'Round 2 is faster and harder.',
    round2Detail: 'Timer is ON. Questions use bigger numbers and more mixed operations.',
    startRound2: 'START ROUND 2',
    planMessage: (level, weakName) => `Plan JexonGo: start level ${level}, practice ${weakName}, then increase speed.`,
    tipSlow: 'Take extra time first, then train speed.',
    tipReady: 'Accuracy is ready. Train speed next.',
    ops: { '+': 'additions', '-': 'subtractions', '*': 'multiplications', '/': 'divisions' },
  },
  fr: {
    round1Label: 'TUTORIEL ROUND 1 - FACILE',
    round2Label: 'TUTORIEL ROUND 2 - VITESSE',
    round1Hint: 'Pas de timer. Pas de game over. Choisis la bonne reponse.',
    livesNow: 'Timer active et 3 VIES! Attention aux erreurs.',
    guidedBreak: 'Bravo! 5 questions faites. Petite pause de 5 secondes, puis timer et 3 vies!',
    restart: 'Plus de vies! On recommence a 0.',
    infinite: 'VIES',
    round2Hint: 'Timer active. Questions plus difficiles. Montre ton niveau.',
    good: ['Beau tir!', 'Bonne reponse!', 'Capitaine Jexongo approuve!'],
    bad: ["Pas celle-la. Regarde l'equation.", 'Bon essai. Le capitaine montre la reponse.'],
    timeout: ['Temps termine. Regarde le tableau.', 'Trop lent. Essaie la prochaine.'],
    captain: 'CAPITAINE JEXONGO',
    starting: 'DEBUT DU TUTORIEL',
    lookBoard: "Regarde le tableau d'equation.",
    tapAnswer: 'Tape la bonne case pour tirer.',
    round1Rules: 'Round 1 sans timer et sans game over.',
    computer: 'ORDINATEUR',
    phone: 'TELEPHONE',
    hudLevel: 'TUTORIEL',
    training: 'ENTRAINEMENT',
    arrows: 'ou les fleches',
    phoneMove: "bouge avec l'avion",
    continue: 'CONTINUER',
    round1Complete: 'ROUND 1 COMPLETE',
    round2Harder: 'Le round 2 est plus rapide et plus difficile.',
    round2Detail: 'Timer active. Questions avec plus grands nombres et operations melangees.',
    startRound2: 'COMMENCER ROUND 2',
    planMessage: (level, weakName) => `Plan JexonGo: commence niveau ${level}, pratique ${weakName}, puis augmente la vitesse.`,
    tipSlow: "Prends plus de temps d'abord, puis entraine la vitesse.",
    tipReady: 'La precision est prete. Entraine la vitesse maintenant.',
    ops: { '+': 'additions', '-': 'soustractions', '*': 'multiplications', '/': 'divisions' },
  },
};

function tutorialCopy() {
  return TUTORIAL_COPY[introLang()] || TUTORIAL_COPY.en;
}

function emptyTutorialStats() {
  return { total: 0, correct: 0, timeouts: 0, ops: {} };
}

function getStoredTutorialProgress() {
  const progress = G.tutorialProgress || load('tutorialProgress', null);
  if (G.tutorialCompleted || load('tutorialCompleted', false)) return null;
  return progress?.active ? progress : null;
}

function saveTutorialProgress() {
  if (!isTutorialActive()) return;
  G.tutorialProgress = {
    active: true,
    round: _tutorialRound,
    questionsAnswered: G.questionsAnswered,
    correctAnswers: G.correctAnswers,
    stats: _tutorialStats || emptyTutorialStats(),
    currentLevel: G.currentLevel,
  };
  save('tutorialProgress', G.tutorialProgress);
  save('tutorialMode', true);
}

function clearTutorialProgress(completed = false) {
  G.tutorialProgress = null;
  if (completed) {
    G.tutorialCompleted = true;
    save('tutorialCompleted', true);
  }
  save('tutorialProgress', null);
}

function tutorialQuestionTarget() {
  return 10;
}

// New-player practice run (first game after the questionnaire + briefing):
// ONE part of 10 questions. Questions 1-5: no timer, infinite lives.
// Questions 6-10: timer and 3 lives; losing them restarts the run at 0.
const GUIDED_QUESTIONS = 10;
const GUIDED_FREE_QUESTIONS = 5;
const GUIDED_LIVES = 3;
const GUIDED_TIME_S = 20;   // timer of questions 6-10 (generous for beginners)
const GUIDED_ENEMY_SPEED = 0.7;    // enemies fly 30% slower
const GUIDED_FIRE_SLOWER = 2;      // and shoot half as often
let _guidedRun = false;
let _guidedLives = GUIDED_LIVES;

// True once the free questions are done (the next question uses the 3 lives).
function guidedLivesPhase() {
  return _guidedRun && G.questionsAnswered >= GUIDED_FREE_QUESTIONS;
}

function showTutorialNotice(text, good = false, durationMs = 2200) {
  const panel = $('tutorial-feedback');
  if (!panel) return;
  panel.innerHTML = `
    <div class="tutorial-feedback-card ${good ? 'tutorial-feedback-good' : 'tutorial-feedback-bad'}">
      <span class="tutorial-feedback-title">${tutorialCopy().captain}</span>
      <span>${text}</span>
    </div>`;
  panel.classList.remove('hidden');
  clearTimeout(panel._hideTimer);
  panel._hideTimer = setTimeout(() => panel.classList.add('hidden'), durationMs);
}

// After question 5: enemies stop appearing and the ones on screen vanish, the
// player flies alone for 5 s, then a new 3-2-1 countdown starts questions 6-10.
const GUIDED_BREAK_MS = 5000;
let _guidedBreakDone = false;
let _guidedBreakUntil = 0;

function guidedBreakActive(now = performance.now()) {
  return _guidedRun && now < _guidedBreakUntil;
}

// True when the answer just given was question 5: the break starts right away
// (no 10-second shooting window first).
function guidedBreakDue() {
  return _guidedRun && G.questionsAnswered === GUIDED_FREE_QUESTIONS && !_guidedBreakDone;
}

function startGuidedBreak() {
  const sid = _sessionId;
  _guidedBreakDone = true;
  _guidedBreakUntil = performance.now() + GUIDED_BREAK_MS;
  stopShootingWindow();
  clearTimeout(_revealTimer);
  _revealTimer = null;
  // No question during the break (hide any leftover one).
  G.answerLocked = true;
  if (G.timerInterval) { clearInterval(G.timerInterval); G.timerInterval = null; }
  const questionBox = document.getElementById('question-box');
  if (questionBox) {
    questionBox.classList.remove('fading', 'appearing', 'resume-appearing');
    questionBox.classList.add('question-inactive');
    questionBox.style.visibility = 'hidden';
  }
  G.enemyMissiles = [];
  for (const enemy of G.enemies) {
    if (!enemy.active || enemy.type === 'boss') continue;
    spawnHitSpark(G.particles, enemy.x, enemy.y);
    enemy.active = false;
  }
  showGuidedLivesBanner();
  // Then the 3-2-1 countdown with the plane staying where it is (no climb-in).
  setTimeout(() => {
    if (_sessionId !== sid) return;
    _guidedBreakUntil = 0;
    _skipPracticeBannerOnce = true;
    showStartCountdown(nextQuestion, { keepPlane: true });
  }, GUIDED_BREAK_MS);
}

// Switch to timer + 3 lives, announced like the START banner (letters drop in,
// light sweep, speed streaks, zoom-out), held during the break.
const GUIDED_LIVES_BANNER_MS = 3800;
function showGuidedLivesBanner() {
  const host = $('tutorial-countdown')?.parentElement;
  if (!host) return;
  clearAnswerCelebration();
  host.querySelector('.guided-lives-banner')?.remove();
  const fr = getLang() === 'fr';
  const word = fr ? '3 VIES' : '3 LIVES';
  const letters = [...word]
    .map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
  const streaks = Array.from({ length: 8 }, (_, i) => `<i style="--s:${i}"></i>`).join('');
  const banner = document.createElement('div');
  banner.className = 'level-start-banner streak-banner guided-lives-banner';
  banner.setAttribute('aria-hidden', 'true');
  banner.innerHTML = `
    <div class="lsb-streaks">${streaks}</div>
    <div class="lsb-stack">
      <div class="lsb-sub glb-kicker">${fr ? 'BRAVO ! 5 QUESTIONS FAITES' : 'WELL DONE! 5 QUESTIONS DONE'}</div>
      <div class="lsb-word lsb-word-long" style="--n:${word.length}">${letters}</div>
      <div class="lsb-sub">${fr ? 'TIMER ACTIVÉ · ATTENTION AUX ERREURS !' : 'TIMER ON · WATCH YOUR MISTAKES!'}</div>
    </div>`;
  host.appendChild(banner);
  SFX.startBanner(word.length);
  setTimeout(() => banner.remove(), GUIDED_LIVES_BANNER_MS + 500);
}

// All 3 lives lost: back to question 0 (free again), new countdown.
function restartGuidedRun() {
  const sid = _sessionId;
  showTutorialNotice(tutorialCopy().restart);
  G.questionsAnswered = 0;
  G.correctAnswers = 0;
  G.streak = 0;
  _guidedLives = GUIDED_LIVES;
  _guidedBreakDone = false;
  _guidedBreakUntil = 0;
  updateLivesHUD();
  setTimeout(() => {
    if (_sessionId !== sid) return;
    _skipPracticeBannerOnce = true;
    showStartCountdown(nextQuestion);
  }, 1600);
}
let _skipPracticeBannerOnce = false;

function tutorialAgeProfile() {
  const grade = Math.min(6, Math.max(1, Number(G.onboardingGrade || G.playerGrade || 1)));
  const profiles = {
    1: [
      { ops: ['+'], cap: 5, mCap: 0 },
      { ops: ['+'], cap: 8, mCap: 0 },
    ],
    2: [
      { ops: ['+'], cap: 8, mCap: 0 },
      { ops: ['+', '-'], cap: 12, mCap: 0 },
    ],
    3: [
      { ops: ['+', '-'], cap: 15, mCap: 0 },
      { ops: ['+', '-', '*'], cap: 20, mCap: 4 },
    ],
    4: [
      { ops: ['+', '-', '*'], cap: 25, mCap: 5 },
      { ops: ['+', '-', '*', '/'], cap: 35, mCap: 6 },
    ],
    5: [
      { ops: ['+', '-', '*', '/'], cap: 45, mCap: 7 },
      { ops: ['+', '-', '*', '/'], cap: 60, mCap: 8 },
    ],
    6: [
      { ops: ['+', '-', '*', '/'], cap: 60, mCap: 8 },
      { ops: ['+', '-', '*', '/'], cap: 80, mCap: 10 },
    ],
  };
  return profiles[grade][_tutorialRound === 1 ? 0 : 1];
}

function addReasonableFocusOp(ops) {
  const missingFocus = selectedFocusOperations().filter(op => !ops.includes(op));
  if (!missingFocus.length) return ops;
  return [...ops, ...missingFocus];
}

function focusWeightedOps(ops) {
  const withFocus = addReasonableFocusOp(ops);
  const focusOps = selectedFocusOperations().filter(op => withFocus.includes(op));
  if (!focusOps.length) return withFocus;
  return [...focusOps, ...focusOps, ...focusOps, ...focusOps];
}

function tutorialMathConfig(ops, cap, mCap) {
  if (!isTutorialActive()) return { ops: applyOnboardingFocus(ops), cap, mCap };
  const profile = tutorialAgeProfile();
  const selectedOps = selectedFocusOperations();
  const questionOps = selectedOps.length ? selectedOps : focusWeightedOps(profile.ops);
  const needsTables = questionOps.some(op => op === '*' || op === '/');
  return {
    ops: questionOps,
    cap: profile.cap,
    mCap: needsTables ? Math.max(2, profile.mCap || Math.min(4, profile.cap)) : profile.mCap,
  };
}

function updateTutorialHUD() {
  const hud = document.getElementById('tutorial-hud');
  if (!hud) return;
  // The training banner (round label, 0/10 bar, hint) is no longer shown.
  hud.classList.add('hidden');
  if (!isTutorialActive()) return;
  const copy = tutorialCopy();
  const target = tutorialQuestionTarget();
  const progress = Math.min(target, G.questionsAnswered);
  const pct = Math.min(100, (progress / target) * 100);
  $('tutorial-round-label').textContent = _tutorialRound === 1 ? copy.round1Label : copy.round2Label;
  $('tutorial-progress-label').textContent = `${progress}/${target}`;
  $('tutorial-progress-fill').style.width = `${pct}%`;
  $('tutorial-hint').textContent = _tutorialRound === 1 ? copy.round1Hint : copy.round2Hint;
}

function recordTutorialAnswer(op, correct, timedOut = false) {
  if (!isTutorialActive() || !_tutorialStats) return;
  _tutorialStats.total++;
  const bucket = _tutorialStats.ops[op] || { total: 0, correct: 0 };
  bucket.total++;
  if (correct) bucket.correct++;
  _tutorialStats.ops[op] = bucket;
  if (correct) _tutorialStats.correct++;
  if (timedOut) _tutorialStats.timeouts++;
  saveTutorialProgress();
}

function tutorialRoundProgress() {
  const target = tutorialQuestionTarget();
  const correct = Math.max(0, Math.min(target, G.correctAnswers));
  const answered = Math.max(0, Math.min(target, G.questionsAnswered));
  const pct = Math.round((correct / Math.max(1, answered || target)) * 100);
  return { target, correct, answered, pct };
}

function showTutorialFeedback(correct, timedOut = false) {
  if (!isTutorialActive()) return;
  const copy = tutorialCopy();
  const panel = $('tutorial-feedback');
  const messages = correct
    ? copy.good
    : timedOut
      ? copy.timeout
      : copy.bad;
  const msg = messages[Math.floor(Math.random() * messages.length)];
  panel.innerHTML = `
    <div class="tutorial-feedback-card ${correct ? 'tutorial-feedback-good' : 'tutorial-feedback-bad'}">
      <span class="tutorial-feedback-title">${copy.captain}</span>
      <span>${msg}</span>
    </div>
  `;
  panel.classList.remove('hidden');
  clearTimeout(panel._hideTimer);
  panel._hideTimer = setTimeout(() => panel.classList.add('hidden'), 1300);
}

// "START" banner shown right after the 3-2-1 countdown: letters drop in one by
// one, a light sweep crosses them, speed streaks shoot out, then it zooms away.
const START_BANNER_MS = 1600;
function showStartBanner(host) {
  if (!host) return;
  host.querySelector('.level-start-banner')?.remove();
  const banner = document.createElement('div');
  banner.className = 'level-start-banner';
  const word = getLang() === 'fr' ? 'DÉPART' : 'START';
  const letters = [...word]
    .map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');
  SFX.startBanner(word.length);
  const streaks = Array.from({ length: 8 }, (_, i) => `<i style="--s:${i}"></i>`).join('');
  banner.innerHTML = `<div class="lsb-streaks">${streaks}</div><div class="lsb-word">${letters}</div>`;
  host.appendChild(banner);
  setTimeout(() => banner.remove(), 1700);
}

// Boss levels: after START, a red "BOSS ALERT" banner names the boss with a
// line about it (hazard strips slide in, name slams down, screen flashes).
const BOSS_ALERT_MS = 2900;
const BOSS_ALERT_INFO = {
  10: { name: 'A330', fr: 'Son bouclier bloque tes missiles !', en: 'Its shield blocks your missiles!' },
  20: { name: 'B-52', fr: 'Le géant du désert et ses lasers !', en: 'The desert giant and its lasers!' },
  30: { name: 'KAWASAKI C-2', fr: 'Deux tourelles, zéro répit !', en: 'Two turrets, zero rest!' },
  40: { name: 'C-5 GALAXY', fr: 'Le colosse du blizzard arrive !', en: 'The blizzard colossus is coming!' },
  50: { name: 'NAVETTE STS', nameEn: 'SPACE SHUTTLE', fr: 'Combat final dans l’espace !', en: 'Final battle in space!' },
};
function showBossAlert(levelNum, done) {
  const info = BOSS_ALERT_INFO[levelNum];
  const host = $('tutorial-countdown')?.parentElement;
  if (!info || !host) { done(); return; }
  const fr = getLang() === 'fr';
  host.querySelector('.boss-alert-banner')?.remove();
  const banner = document.createElement('div');
  banner.className = 'boss-alert-banner';
  const nameText = (!fr && info.nameEn) || info.name;
  const name = [...nameText]
    .map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
  banner.innerHTML = `
    <div class="bab-flash"></div>
    <div class="bab-strip bab-strip-top"></div>
    <div class="bab-strip bab-strip-bottom"></div>
    <div class="bab-content">
      <div class="bab-warning">${uiIcon('warning')} ${fr ? 'ALERTE BOSS' : 'BOSS ALERT'} ${uiIcon('warning')}</div>
      <div class="bab-name" style="--n:${nameText.length}">${name}</div>
      <div class="bab-tagline">${fr ? info.fr : info.en}</div>
    </div>`;
  host.appendChild(banner);
  SFX.bossAlert(nameText.length);
  const sid = _sessionId;
  setTimeout(() => {
    banner.remove();
    if (sid === _sessionId) done();
  }, BOSS_ALERT_MS);
}

// Practice games: a "PRACTICE MODE" banner between the countdown and START
// (the practice tag drops in, the words slide in from both sides, a green
// scan line sweeps across, then it all zooms away).
const PRACTICE_BANNER_MS = 1900;
function showPracticeBanner(done) {
  const host = $('tutorial-countdown')?.parentElement;
  if (!host) { done(); return; }
  const fr = getLang() === 'fr';
  host.querySelector('.practice-banner')?.remove();
  const banner = document.createElement('div');
  banner.className = 'practice-banner';
  banner.innerHTML = `
    <div class="pb-band"></div>
    <div class="pb-content">
      <div class="pb-tag">${fr ? 'ENTRAÎNEMENT' : 'TRAINING'}</div>
      <div class="pb-words">
        <span class="pb-w1">${fr ? 'MODE' : 'PRACTICE'}</span>
        <span class="pb-w2">${fr ? 'PRATIQUE' : 'MODE'}</span>
      </div>
      <div class="pb-sub">${fr ? 'Aucune pression : entraîne-toi!' : 'No pressure: just train!'}</div>
    </div>`;
  host.appendChild(banner);
  SFX.practiceBanner();
  const sid = _sessionId;
  setTimeout(() => {
    banner.remove();
    if (sid === _sessionId) done();
  }, PRACTICE_BANNER_MS);
}

// keepPlane: the aircraft stays where it is during the countdown instead of
// climbing in from the bottom (beginner practice, after the 5-second break).
function showStartCountdown(done, { keepPlane = false } = {}) {
  window.dispatchEvent(new Event('jexongo:countdown'));   // e.g. hides the briefing
  _cutsceneActive = true;
  _stopGameLoop();
  stopCountdownDraw();
  G.enemyMissiles = [];
  // `placePlayer()` has already calculated the normal gameplay spawn point.
  // End the entrance there instead of replacing it with the middle of the
  // canvas, otherwise the aircraft stays at the countdown position when play
  // begins.
  const targetX = G.player.x;
  const targetY = G.player.y;
  _countdownPlaneAnim = {
    start: performance.now(),
    duration: 2600,
    fromX: targetX,
    fromY: keepPlane ? targetY : canvas.height + getPlayerSize() * 0.9,
    toX: targetX,
    toY: targetY,
  };
  startCountdownDraw(_sessionId);
  if (!keepPlane) SFX.engineStart(G.activeAircraft);   // the plane climbs in during the countdown
  const el = $('tutorial-countdown');
  const copy = isTutorialActive()
    ? tutorialCopy()
    : {
        starting: getLang() === 'fr' ? 'MISSION EN APPROCHE' : 'MISSION STARTING',
        captain: getLang() === 'fr' ? 'GO' : 'GO',
      };
  let count = 3;
  el.innerHTML = `<span class="tutorial-count-caption">${copy.starting}</span><strong>${count}</strong>`;
  SFX.countNumber(count);
  el.classList.remove('hidden');
  const tickDown = () => {
    count--;
    if (count <= 0) {
      // Countdown over: (boss levels) BOSS ALERT, then the START banner. The
      // aircraft stays locked (cutscene) until both have played.
      el.classList.add('hidden');
      const sid = _sessionId;
      const beginPlay = () => {
        if (sid !== _sessionId) return;
        if (_countdownPlaneAnim) {
          G.player.x = _countdownPlaneAnim.toX;
          G.player.y = _countdownPlaneAnim.toY;
        }
        _countdownPlaneAnim = null;
        _cutsceneActive = false;
        stopCountdownDraw();
        _lastFrameTs = 0;
        _startGameLoop(_sessionId);
        done();
      };
      const playStart = () => {
        if (sid !== _sessionId) return;
        showStartBanner(el.parentElement);
        setTimeout(beginPlay, START_BANNER_MS);
      };
      if (G.practiceMode && !_skipPracticeBannerOnce) showPracticeBanner(playStart);
      else if (!isTutorialActive() && BOSS_ALERT_INFO[levelCfg?.num]) showBossAlert(levelCfg.num, playStart);
      else playStart();
      _skipPracticeBannerOnce = false;
      return;
    }
    el.classList.remove('tutorial-count-pop');
    void el.offsetWidth;
    el.innerHTML = `<span class="tutorial-count-caption">${copy.starting}</span><strong>${count}</strong>`;
    el.classList.add('tutorial-count-pop');
    SFX.countNumber(count);
    setTimeout(tickDown, 760);
  };
  setTimeout(tickDown, 760);
}

// Shows frame 0 of a sprite sheet as a CSS background (boss dialogue portraits).
function setDialoguePortrait(el, spriteKey) {
  const def = SPRITE_DEFS[spriteKey];
  if (!el || !def) return;
  const cols = def.frameCols || def.frames || 1;
  const rows = def.frameRows || 1;
  el.style.backgroundImage = `url("${def.path}")`;
  el.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
  el.style.backgroundPosition = '0 0';
}

function startA330BossIntro(done) {
  const panel = document.getElementById('boss-dialogue');
  const speaker = document.getElementById('boss-dialogue-speaker');
  const text = document.getElementById('boss-dialogue-text');
  const continueButton = document.getElementById('boss-dialogue-continue');
  const boss = G.enemies.find(enemy => enemy.active && (enemy.a330Boss || enemy.b52Boss || enemy.kawasakiBoss || enemy.c5Boss || enemy.spaceShuttleBoss));
  if (boss) boss.holdEntry = false;
  if (!panel || !speaker || !text || !continueButton || !boss) {
    if (boss) {
      boss.combatActive = true;
      boss.firstShotAt = performance.now() + BOSS_FIRST_SHOT_DELAY_MS;
      boss.healthBarShown = true;
      updateBossHealthBar(boss);
    }
    SFX.playMusic(levelMusicKey(), { restart: true });
    done();
    return;
  }

  const fr = getLang() === 'fr';
  const lines = boss.spaceShuttleBoss
    ? (fr ? [
        ['NAVETTE STS', 'Dans l espace, ma tourelle ne te perdra pas de vue !', false],
        ['PILOTE', 'Je surveillerai son mouvement avant chaque tir !', true],
        ['NAVETTE STS', 'Alors essaie d echapper a mon verrouillage final.', false],
      ] : [
        ['SPACE SHUTTLE STS', 'In space, my turret will never lose sight of you!', false],
        ['PILOT', 'I will watch its movement before every shot!', true],
        ['SPACE SHUTTLE STS', 'Then try to escape my final targeting lock.', false],
      ])
    : boss.c5Boss
    ? (fr ? [
        ['C-5 GALAXY', 'Ma tourelle arriere te suivra jusque dans le blizzard !', false],
        ['PILOTE', 'Je vais changer de cap avant chacun de tes tirs !', true],
        ['C-5 GALAXY', 'Alors montre-moi si tu peux briser mon verrouillage.', false],
      ] : [
        ['C-5 GALAXY', 'My rear turret will track you through the blizzard!', false],
        ['PILOT', 'I will change course before every shot!', true],
        ['C-5 GALAXY', 'Then show me if you can break my targeting lock.', false],
      ])
    : boss.kawasakiBoss
    ? (fr ? [
        ['C-2', 'Mes tourelles jumelles suivront chacun de tes mouvements !', false],
        ['PILOTE', 'Alors je vais rester mobile et garder mon cap !', true],
        ['C-2', 'Voyons si tu peux echapper a mon verrouillage.', false],
      ] : [
        ['C-2', 'My twin turrets will track your every movement!', false],
        ['PILOT', 'Then I will keep moving and hold my course!', true],
        ['C-2', 'Let us see if you can escape my targeting lock.', false],
      ])
    : boss.b52Boss
    ? (fr ? [
        ['B-52', 'Bienvenue dans le d\u00e9sert, pilote ! Mes lasers vont tester tes r\u00e9flexes.', false],
        ['PILOTE', 'Je resterai calme et j\u2019utiliserai mes maths pour passer !', true],
        ['B-52', 'Bonne chance ! Observe bien mes pauses et reste prudent.', false],
      ] : [
        ['B-52', 'Welcome to the desert, pilot! My lasers will test your reflexes.', false],
        ['PILOT', 'I will stay calm and use my math skills to get through!', true],
        ['B-52', 'Good luck! Watch for my pauses and fly carefully.', false],
      ])
    : (fr ? [
        ['A330', 'Salut, petit pilote ! Je suis le rival farceur du ciel. Je vais essayer d\u2019arr\u00eater ta mission !', false],
        ['PILOTE', 'Je vais te d\u00e9passer avec mon courage et mes maths !', true],
        ['A330', 'Alors, montre-moi ce que tu sais faire. Pr\u00eat ?', false],
      ] : [
        ['A330', 'Hello, little pilot! I am the tricky sky rival. I will try to stop your mission!', false],
        ['PILOT', 'I will get past you with courage and math!', true],
        ['A330', 'Then show me what you can do. Ready?', false],
      ]);
  const sid = _sessionId;
  boss.combatActive = false;
  // Capture the exact position where the boss animation begins. Every
  // cutscene frame and the return to gameplay reuse this same anchor.
  _bossPlayerAnchor = { x: G.player.x, y: G.player.y };
  _bossDialogueActive = true;
  _cutsceneActive = true;
  _bossDialogueEntrance = {
    start: performance.now(),
    duration: 1650,
  };
  panel.classList.add('hidden');
  continueButton.textContent = fr ? 'CONTINUER' : 'CONTINUE';
  // Portraits: first frame of the boss sprite and of the player's aircraft.
  const bossSpriteKey = boss.spaceShuttleBoss ? 'boss-space-shuttle'
    : boss.c5Boss ? 'boss-c5-galaxy'
    : boss.kawasakiBoss ? 'boss-kawasaki-c2'
    : boss.b52Boss ? 'boss-b52'
    : 'boss-a330';
  setDialoguePortrait(document.getElementById('boss-dialogue-boss-img'), bossSpriteKey);
  setDialoguePortrait(document.getElementById('boss-dialogue-player-img'), AIRCRAFT_SPRITE[G.activeAircraft] || 'ship-t6');
  let index = 0;
  const showLine = () => {
    if (!_isActiveSid(sid)) return;
    if (!_bossDialogueSpeechStartedAt) _bossDialogueSpeechStartedAt = performance.now();
    const [name, message, playerSpeaking] = lines[index];
    _bossDialogueSpeakerIsPlayer = playerSpeaking;
    speaker.textContent = name;
    text.textContent = message;
    panel.classList.toggle('player-speaking', playerSpeaking);
    panel.classList.remove('hidden');
    // Replay the bubble's small pop for every new line.
    const bubble = panel.querySelector('.bd-bubble');
    if (bubble) { bubble.style.animation = 'none'; void bubble.offsetWidth; bubble.style.animation = ''; }
  };
  continueButton.onclick = () => {
    if (!_isActiveSid(sid)) return;
    index++;
    if (index < lines.length) {
      showLine();
      return;
    }
    panel.classList.add('hidden');
    panel.classList.remove('player-speaking');
    continueButton.onclick = null;
    _bossDialogueExit = { start: performance.now(), duration: 850 };
    // Fade the dialogue theme out while the panel exits, then fade the boss
    // fight theme of this world in (from its beginning) as combat begins.
    SFX.playMusic(levelMusicKey(), { restart: true });
    setTimeout(() => {
      if (!_isActiveSid(sid)) return;
      _bossDialogueActive = false;
      _bossDialogueEntrance = null;
      _bossDialogueExit = null;
      _bossDialogueSpeakerIsPlayer = false;
      _bossDialogueSpeechStartedAt = 0;
      if (_bossPlayerAnchor) {
        G.player.x = _bossPlayerAnchor.x;
        G.player.y = _bossPlayerAnchor.y;
      }
      // Bug fix: touch/mouse move events keep updating pointerTarget (and the
      // virtual joystick) even while the cutscene is active, since only the
      // per-frame movement update — not the raw input listeners — was frozen.
      // Left stale, that target could be far from the anchor (e.g. a kid's
      // finger drifted during the dialogue), so the very first movement frame
      // after combat resumed would yank the plane hard toward it. Clearing
      // the tracked input here means the plane simply waits for a fresh
      // touch/drag once gameplay resumes, instead of snapping to an old one.
      pointerTarget = null;
      _jsOrigin = _jsCurrent = null;
      _jsVelX = _jsVelY = 0;
      velX = velY = 0;
      _cutsceneActive = false;
      _lastFrameTs = 0;
      boss.entryActive = false;
      boss.entryProgress = 1;
      boss.spawnAlpha = 1;
      boss.x = canvas.width / 2;
      boss.y = boss.entryTargetY || canvas.height * 0.19;
      boss._targetX = boss.x;
      boss._targetY = boss.y;
      boss.combatActive = true;
      boss.healthBarShown = true;
      updateBossHealthBar(boss);
      // Give the player a real five-second grace period after the boss
      // animation finishes, independent of frame rate or question slow-motion.
      boss.firstShotAt = performance.now() + BOSS_FIRST_SHOT_DELAY_MS;
      if (boss.a330Boss) {
        boss.antiMissileCycle = 0;
        boss.antiMissileActive = true;
        boss.a330SalvoCooldown = 300;
      } else {
        boss.antiMissileActive = false;
        boss.b52LaserCycle = 0;
        boss.b52LaserCooldown = 18;
        boss.b52TurretAim = 0;
      }
      done();
    }, 880);
  };
  setTimeout(() => {
    if (!_isActiveSid(sid)) return;
    _bossDialogueEntrance = null;
    showLine();
  }, 1700);
}

const showTutorialCountdown = showStartCountdown;

function showRoundOneSummary(done) {
  if (!isTutorialActive()) {
    done();
    return;
  }
  _cutsceneActive = true;
  _stopGameLoop();
  if (G.timerInterval) {
    clearInterval(G.timerInterval);
    G.timerInterval = null;
  }
  saveTutorialProgress();
  const copy = tutorialCopy();
  const panel = $('tutorial-round-summary');
  const progress = tutorialRoundProgress();
  panel.innerHTML = `
    <div class="tutorial-summary-card">
      <div class="tutorial-captain-title">${copy.round1Complete}</div>
      <div class="tutorial-summary-score">${progress.correct}/${progress.target}</div>
      <div class="tutorial-summary-bar"><span style="width:${Math.min(100, progress.pct)}%"></span></div>
      <p>${copy.round2Harder}</p>
      <p>${copy.round2Detail}</p>
      <button id="tutorial-summary-continue" class="btn btn-primary" type="button">${copy.startRound2}</button>
    </div>
  `;
  panel.classList.remove('hidden');
  $('tutorial-summary-continue').onclick = () => {
    panel.classList.add('hidden');
    _cutsceneActive = false;
    _lastFrameTs = 0;
    _startGameLoop(_sessionId);
    done();
  };
}

function buildTutorialPlan() {
  const stats = _tutorialStats || { total: G.questionsAnswered, correct: G.correctAnswers, timeouts: 0, ops: {} };
  const copy = tutorialCopy();
  const total = Math.max(1, stats.total || G.questionsAnswered);
  const score = Math.round((stats.correct / total) * 100);
  const weak = Object.entries(stats.ops)
    .sort((a, b) => (a[1].correct / Math.max(1, a[1].total)) - (b[1].correct / Math.max(1, b[1].total)))[0]?.[0] || selectedFocusOperations()[0] || '+';
  const weakName = copy.ops[weak] || 'math';
  const grade = Math.min(6, Math.max(1, Number(G.onboardingGrade || G.playerGrade || 1)));
  const levelByGrade = {
    1: { low: 1,  mid: 3,  high: 5  },
    2: { low: 2,  mid: 5,  high: 8  },
    3: { low: 4,  mid: 8,  high: 12 },
    4: { low: 6,  mid: 11, high: 16 },
    5: { low: 8,  mid: 14, high: 20 },
    6: { low: 10, mid: 18, high: 26 },
  };
  const gradeLevels = levelByGrade[grade];
  const startLevel = score >= 80 ? gradeLevels.high : score >= 55 ? gradeLevels.mid : gradeLevels.low;
  return {
    score,
    focusOperation: weak,
    startLevel,
    message: copy.planMessage(startLevel, weakName),
    tips: stats.timeouts > 1 ? copy.tipSlow : copy.tipReady,
  };
}

function showTutorialAnalysis() {
  const plan = buildTutorialPlan();
  const originalFocusOps = selectedFocusOperations();
  const shouldConnectAfterTutorial = !G.playerRegistered && guestGamesPlayed() + 1 >= GUEST_FREE_GAMES;
  G.tutorialPlan = plan;
  G.focusOperation = plan.focusOperation;
  G.focusOperations = originalFocusOps.length ? originalFocusOps : [plan.focusOperation];
  G.currentLevel = plan.startLevel;
  G.pendingPlacement = false;
  G.tutorialMode = false;
  G.postTutorialConnectPrompt = shouldConnectAfterTutorial;
  clearTutorialProgress(true);
  save('tutorialPlan', plan);
  save('focusOperation', G.focusOperation || '');
  save('focusOperations', G.focusOperations || []);
  save('currentLevel', G.currentLevel);
  save('pendingPlacement', false);
  save('tutorialMode', false);
  save('tutorialCompleted', true);
  save('postTutorialConnectPrompt', shouldConnectAfterTutorial);
  endLevel(true);
}

let canvas, ctx, levelCfg;
let _timerTotal = 10;
let tick        = 0;
let shakeFrames = 0;
let _onComplete = null;
let spawnTimer  = 0;
let _cutsceneActive = false;
let _bossDialogueActive = false;
let _bossDialogueEntrance = null;
let _bossDialogueSpeakerIsPlayer = false;
let _bossDialogueDim = 0;
let _bossDialogueSpeechStartedAt = 0;
let _bossDialogueExit = null;
let _bossPlayerAnchor = null;
let _countdownPlaneAnim = null;
let _finishPlaneAnim = null;
let _levelEnding = false;
let _countdownRaf = null;
let _maxLives = 3;
let _lastHudLives = null;
let _fireTick    = 0;
let _bankTilt    = 0;   // current tilt in radians (smoothed)
let _resizeTimer = null;
let _topGrad     = null;
let _topGradH    = 0;
let spawnRate   = 150;
let maxEnemies  = 5;
let baseSpawnRate = 150;
let baseMaxEnemies = 5;
let _sessionId    = 0;
let _activeSessionId = 0;
let _gamePausedFromQuit = false;
let _tutorialActive = false;
let _tutorialRound = 1;
let _tutorialStats = null;
let _invincible   = 0;
let _stealthActive  = false;
let _stealthAnswers = 0;   // correct-answer counter for stealth trigger
let _nukeAnim       = 0;
let _nukeApplied    = false;
let _nukeSweepUntil = 0;
let _nukeReadyAt    = 0;
let _nukedBosses    = new Set();
let _nextPlayerShotAt = 0;
let _shootingWindowUntil = 0;
let _timedXpElapsedMs = 0;
let _mapCoins = [];
let _mapCoinsReleased = 0;

function awardGameplayCoins(amount) {
  const reward = Math.max(1, Math.floor(amount || 1));
  addSessionCoins(reward);
}

function resetMapCoins() {
  _mapCoins = [];
  _mapCoinsReleased = 0;
}

function releaseCorrectAnswerCoins() {
  const total = Math.max(0, Math.floor(levelCfg?.mapCoinCount || 0));
  const remaining = total - _mapCoinsReleased;
  if (remaining <= 0) return;
  const rewardCount = Math.min(remaining, levelCfg?.isBossLevel ? 3 : 2);
  const laneCount = 5;
  const laneWidth = canvas.width / (laneCount + 1);
  for (let i = 0; i < rewardCount; i++) {
    const coinIndex = _mapCoinsReleased + i;
    const lane = (coinIndex * 2 + Math.floor(coinIndex / laneCount)) % laneCount;
    const x = laneWidth * (lane + 1);
    // Separate coins from the same answer so each one is clearly collectible.
    spawnMapCoin(canvas.width, -45 - i * 72, x, 1);
  }
  _mapCoinsReleased += rewardCount;
}

function spawnMapCoin(cw, y = -35, x = null, value = null) {
  const margin = Math.min(70, cw * 0.14);
  _mapCoins.push({
    x: x == null
      ? margin + Math.random() * Math.max(1, cw - margin * 2)
      : Math.max(margin, Math.min(cw - margin, x)),
    y,
    phase: Math.random() * Math.PI * 2,
    spinOffset: Math.floor(Math.random() * MAP_COIN_SPIN.length),
    value: Math.max(1, Math.floor(value || 1)),
  });
}

const MAP_COIN_SPIN = [0, 1, 2, 3, 7, 6, 5, 4, 5, 6, 7, 8, 9, 10, 11];
const MAP_COIN_SIZE = 46;
const MAP_COIN_SIZE_PHONE = 30;
function updateAndDrawMapCoins(ctx, cw, ch, step, magnetRadius = 0) {
  const playerRadius = Math.max(24, getPlayerSize() * 0.38);
  for (let i = _mapCoins.length - 1; i >= 0; i--) {
    const coin = _mapCoins[i];
    coin.phase += 0.035 * step;
    coin.y += 1.05 * step;
    if (magnetRadius > 0) {
      const mdx = G.player.x - coin.x, mdy = G.player.y - coin.y;
      const dist = Math.hypot(mdx, mdy) || 1;
      if (dist <= magnetRadius) {
        const pull = Math.min(1, (0.1 * step) + (1 - dist / magnetRadius) * 0.14 * step);
        coin.x += mdx * pull;
        coin.y += mdy * pull;
      }
    }
    const drawX = coin.x + Math.sin(coin.phase) * 6;
    // Smaller on phones (46 px was too big on a narrow screen).
    const size = isTouchMobile() ? MAP_COIN_SIZE_PHONE : MAP_COIN_SIZE;
    // 3D spin: front → edge → back → edge → front (aligned sheet frames).
    const spinFrame = MAP_COIN_SPIN[Math.floor(performance.now() / 70 + coin.spinOffset) % MAP_COIN_SPIN.length];
    drawFrame(ctx, 'map-coin-spin', spinFrame, drawX, coin.y, size, size);

    const dx = drawX - G.player.x;
    const dy = coin.y - G.player.y;
    if (dx * dx + dy * dy <= (playerRadius + size * 0.34) ** 2 || coopMagnetCoin(coin, step, getPlayerSize())) {
      awardGameplayCoins(coin.value);
      SFX.coinClaim?.();
      _mapCoins.splice(i, 1);
    } else if (coin.y > ch + size) {
      _mapCoins.splice(i, 1);
    }
  }
}
let _revealTimer  = null;
let _answerCelebrationTimer = null;
let _skipHandler  = null;
let _correctionWaiting = false;
// Picture of the playfield taken when the correction opens. A resize clears
// the canvas while the loop is frozen, so it is redrawn from this copy
// instead of leaving a black screen behind the correction.
let _correctionSnapshot = null;

function takeCorrectionSnapshot() {
  if (!canvas || !canvas.width || !canvas.height) { _correctionSnapshot = null; return; }
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext('2d').drawImage(canvas, 0, 0);
  _correctionSnapshot = copy;
}

function drawCorrectionSnapshot() {
  const snap = _correctionSnapshot;
  if (!snap || !ctx || !canvas.width || !canvas.height) return;
  // Cover the whole canvas, keeping the picture's proportions.
  const scale = Math.max(canvas.width / snap.width, canvas.height / snap.height);
  const w = snap.width * scale;
  const h = snap.height * scale;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(snap, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  ctx.restore();
}
let _smoothResumeAfterCorrection = false;
let _resumeSlowStart = 0;
let _resumeSlowDuration = 0;
let _resumePlaneStart = 0;
let _resumePlaneDuration = 0;
let _questionReturnAnim = null;
let _transitioning = false;
let _playerDestroyed = false;
const SHIP_ANIM_FRAMES = 12;
const SHIP_ANIM_FPS = 12;
const BOSS_FIRST_SHOT_DELAY_MS = 5000;
// Laser bosses (B-52, C-2, C-5, STS): firing / resting phases, in 60 fps frames.
const BOSS_LASER_FIRE_FRAMES = 300;   // 5 s
const BOSS_LASER_REST_FRAMES = 600;   // 10 s
const NUKE_COOLDOWN_MS = 60_000;
const NUKE_SWEEP_MS = 10_000;
const GOOD_ANSWER_SHOOTING_WINDOW_MS = 10_000;
const CORRECT_ANSWER_SAFETY_RADIUS = 110;
const CORRECT_ANSWER_INVINCIBLE_FRAMES = 75;
let _shipFrame  = 0;   // player ship animation frame, cycled every tick
let _shipAnimLastTs = 0;
let _turnRightFrame = 0; // T-6 prototype: full-roll animation frame while turning right
let _turnLeftFrame  = 0; // T-6 prototype: full-roll animation frame while turning left
let _godMode    = false;
const _gameCT   = new Map(); // cheat key timestamps

function activeRegularEnemyCount() {
  let count = 0;
  for (const e of G.enemies) {
    if (e.active && !e.turncoat && e.type !== 'boss') count++;
  }
  return count;
}

// F-5 formation flying straight down the screen (its "forward").
// 'v': lead plane at the front tip, wings trailing behind on both sides.
// 'w': planes spread along a W, its two low points leading.
function spawnF5Formation(shape, count) {
  const planes = Array.from({ length: count }, () => spawnEnemy(canvas.width, 'fast'));
  const size = getEnemyDrawSize(planes[0]);
  const usable = Math.max(size, canvas.width - size * 1.4);

  // Each slot: x in formation units, back = rows behind the front line.
  let slots, xUnit, backUnit;
  if (shape === 'v') {
    const ranks = (count - 1) / 2;
    slots = [{ x: 0, back: 0 }];
    for (let r = 1; r <= ranks; r++) slots.push({ x: -r, back: r }, { x: r, back: r });
    xUnit = Math.min(size * 0.95, usable / (2 * ranks));
    backUnit = size * 0.9;
  } else {
    // Sample the W polyline: tops at 0, 2, 4 and leading points at 1, 3.
    slots = Array.from({ length: count }, (_, i) => {
      const s = (4 * i) / (count - 1);
      return { x: s - 2, back: Math.abs((s % 2) - 1) };
    });
    xUnit = Math.min(size * 0.9, usable / 4);
    backUnit = size * 1.4;
  }

  const halfWidth = Math.max(...slots.map(s => Math.abs(s.x))) * xUnit;
  const minX = size * 0.7 + halfWidth;
  const maxX = canvas.width - size * 0.7 - halfWidth;
  const cx = maxX > minX ? minX + Math.random() * (maxX - minX) : canvas.width / 2;
  const frontY = -size * 0.6;

  planes.forEach((e, i) => {
    e.x = cx + slots[i].x * xUnit;
    e.y = frontY - slots[i].back * backUnit;
    e.vx = 0;
    e.bankVis = 0;
  });
  return planes;
}

// F-14 formation: `count` interceptors flying side by side on one line.
// They share the same speed, so the line stays aligned down the screen.
function spawnF14Line(count) {
  const planes = Array.from({ length: count }, () => spawnEnemy(canvas.width, 'interceptor'));
  if (count === 1) return planes;
  const size = getEnemyDrawSize(planes[0]);
  const usable = Math.max(size, canvas.width - size * 1.4);
  const gap = Math.min(size * 1.35, usable / (count - 1));
  const halfWidth = gap * (count - 1) / 2;
  const minX = size * 0.7 + halfWidth;
  const maxX = canvas.width - size * 0.7 - halfWidth;
  const cx = maxX > minX ? minX + Math.random() * (maxX - minX) : canvas.width / 2;
  const startY = planes[0].y;
  planes.forEach((e, i) => {
    e.x = cx + (i - (count - 1) / 2) * gap;
    e.y = startY;
  });
  return planes;
}

// Blinking red target ring that tightens while an enemy locks on (kamikaze
// F-5 before its charge, homing F-15 before it fires).
function drawLockRing(e, timer, total) {
  const size = getEnemyDrawSize(e);
  const on = Math.floor(timer / 7) % 2 === 0;
  const r = size * (0.78 - 0.18 * Math.min(1, timer / total));
  ctx.save();
  ctx.strokeStyle = on ? 'rgba(255,48,48,0.95)' : 'rgba(255,48,48,0.4)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    ctx.moveTo(e.x + Math.cos(a) * r * 0.75, e.y + Math.sin(a) * r * 0.75);
    ctx.lineTo(e.x + Math.cos(a) * r * 1.3, e.y + Math.sin(a) * r * 1.3);
  }
  ctx.stroke();
  ctx.restore();
}

// Kamikaze F-5 warning: a blinking red target ring while it locks on, then a
// red speed streak behind it during the charge. Plain strokes, no shadowBlur.
function drawKamikazeMark(e) {
  const size = getEnemyDrawSize(e);
  ctx.save();
  if (e.kamikazePhase === 'lock') {
    ctx.restore();
    drawLockRing(e, e.kamikazeTimer, KAMIKAZE_LOCK_FRAMES);
    return;
  } else {
    const len = size * 1.4;
    const bx = Math.sin(e.headingAngle) * len;
    const by = -Math.cos(e.headingAngle) * len;
    const grad = ctx.createLinearGradient(e.x, e.y, e.x + bx, e.y + by);
    grad.addColorStop(0, 'rgba(255,70,40,0.75)');
    grad.addColorStop(1, 'rgba(255,70,40,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = size * 0.28;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + bx, e.y + by);
    ctx.stroke();
  }
  ctx.restore();
}

// ── HOMING F-15 ──────────────────────────────────────────────────────────────
// Some F-15s lock on (red ring, ~0.8 s) then fire a missile that follows the
// player, like the kamikaze F-5: it turns slowly, stops steering over the
// last third of the screen (a sidestep makes it miss), and gives up after
// ~3.5 s or while the F-117 is stealthed.
const HOMING_F15_CHANCE = 0.35;
const HOMING_LOCK_FRAMES = 48;
const HOMING_TURN = 0.022;          // max heading change per frame (rad)
const HOMING_MAX_AGE = 210;         // frames of guidance

function steerHomingMissile(m) {
  m.age = (m.age || 0) + _frameStep;
  if (_stealthActive || m.age > HOMING_MAX_AGE) return;
  const p = G.player;
  if (m.y >= p.y - canvas.height * 0.32) return;   // committed to its line
  const heading = Math.atan2(m.vy, m.vx);
  let diff = Math.atan2(p.y - m.y, p.x - m.x) - heading;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const turn = HOMING_TURN * _frameStep;
  const next = heading + Math.max(-turn, Math.min(turn, diff));
  const speed = Math.hypot(m.vx, m.vy);
  m.vx = Math.cos(next) * speed;
  m.vy = Math.sin(next) * speed;
}

function pruneEnemies(limitY = Infinity) {
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (!e.active || (e.type !== 'boss' && e.y >= limitY)) G.enemies.splice(i, 1);
  }
}

function updateBossHealthBar(boss = G.enemies.find(e => e.type === 'boss' && e.active)) {
  const wrap = document.getElementById('boss-health-wrap');
  if (!wrap) return;
  const show = !!boss && [10, 20, 30, 40, 50].includes(G.currentLevel);
  wrap.classList.toggle('hidden', !show);
  if (!show) return;
  // Keeps its layout space (no canvas resize) but stays invisible until the
  // boss intro dialogue is over, then slides in.
  const pending = !boss.healthBarShown;
  if (!pending && wrap.classList.contains('bhw-pending')) {
    wrap.classList.remove('bhw-reveal');
    void wrap.offsetWidth;
    wrap.classList.add('bhw-reveal');
  }
  wrap.classList.toggle('bhw-pending', pending);
  const hp = Math.max(0, boss.currentHp || 0);
  const maxHp = Math.max(1, boss.maxHp || 1);
  const fill = document.getElementById('boss-health-fill');
  const value = document.getElementById('boss-health-value');
  const name = document.getElementById('boss-health-name');
  if (name) name.textContent = boss.spaceShuttleBoss ? 'SPACE SHUTTLE STS' : boss.c5Boss ? 'C-5 GALAXY' : boss.kawasakiBoss ? 'KAWASAKI C-2' : boss.b52Boss ? 'B-52' : 'A330 MRTT';
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, hp / maxHp * 100))}%`;
  if (value) value.textContent = `${hp} / ${maxHp}`;
}

function clearAnswerCelebration() {
  clearTimeout(_answerCelebrationTimer);
  _answerCelebrationTimer = null;
  document.querySelectorAll('.streak-banner').forEach(el => el.remove());
}

function clearQuestionUI() {
  const qText = document.getElementById('question-text');
  const btns = document.getElementById('answer-buttons');
  const reveal = document.getElementById('correct-answer-reveal');
  const qbox = document.getElementById('question-box');
  const timerBar = document.getElementById('timer-bar');
  if (qText) qText.textContent = '';
  if (btns) btns.innerHTML = '';
  if (reveal) {
    reveal.classList.add('hidden');
    reveal.classList.remove('hiding');
    reveal.style.display = '';
    reveal.style.visibility = '';
    reveal.style.opacity = '';
    reveal.querySelectorAll('.car-step').forEach(step => {
      step.textContent = '';
      step.classList.remove('visible');
    });
    const continueBtn = reveal.querySelector('#btn-correction-continue');
    if (continueBtn) {
      continueBtn.disabled = false;
      continueBtn.onclick = null;
      continueBtn.style.display = '';
    }
  }
  if (qbox) {
    qbox.classList.remove('fading', 'appearing', 'resume-appearing', 'shooting-hidden', 'correction-active');
    qbox.classList.add('question-inactive');
    qbox.style.visibility = 'hidden';
  }
  if (timerBar) {
    timerBar.style.width = '100%';
    timerBar.style.background = 'var(--accent)';
  }
  document.getElementById('game-pause-overlay')?.classList.remove('dimmed', 'correction-dimmed');
}

function clearSmoothResumeState() {
  _smoothResumeAfterCorrection = false;
  _resumeSlowStart = 0;
  _resumeSlowDuration = 0;
  _resumePlaneStart = 0;
  _resumePlaneDuration = 0;
  _questionReturnAnim = null;
}

function stopShootingWindow() {
  _nextPlayerShotAt = 0;
  _shootingWindowUntil = 0;
}

function advanceAfterCorrectAnswer(sid) {
  if (_sessionId !== sid) return;
  stopShootingWindow();
  if (isTutorialActive()) nextQuestion();
  else if (levelCfg.isBossLevel || G.questionsAnswered < levelCfg.questionCount) nextQuestion();
  else endLevel(true);
}

// Every 5 good answers: same dynamic banner as the level START (letters drop
// in, light sweep, speed streaks, zoom-out) with the "5 / 10 / 15... GOOD
// ANSWERS" line. The answer that ends the level gets MISSION COMPLETE instead.
function showAnswerCelebration() {
  clearAnswerCelebration();
  const host = $('tutorial-countdown')?.parentElement;
  if (!host) return;
  const fr = getLang() === 'fr';
  const messages = fr
    ? ['EXCELLENT PILOTE !', 'SUPER TIR !', 'MISSION PARFAITE !', 'TU DOMINES LE CIEL !']
    : ['EXCELLENT PILOT!', 'GREAT SHOT!', 'PERFECT MISSION!', 'YOU OWN THE SKY!'];
  const message = messages[(G.correctAnswers / 5) % messages.length | 0];
  const letters = [...message]
    .map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
  const streaks = Array.from({ length: 8 }, (_, i) => `<i style="--s:${i}"></i>`).join('');
  const banner = document.createElement('div');
  banner.className = 'level-start-banner streak-banner';
  banner.setAttribute('aria-hidden', 'true');
  banner.innerHTML = `
    <div class="lsb-streaks">${streaks}</div>
    <div class="lsb-stack">
      <div class="lsb-word lsb-word-long" style="--n:${message.length}">${letters}</div>
      <div class="lsb-sub">${G.correctAnswers} ${fr ? 'BONNES RÉPONSES !' : 'GOOD ANSWERS!'}</div>
    </div>`;
  host.appendChild(banner);
  SFX.streakBanner(message.length);
  _answerCelebrationTimer = setTimeout(() => {
    banner.remove();
    _answerCelebrationTimer = null;
  }, 2000);
}

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
let _touchId       = null;
let _canvasRect    = null;
let velX = 0, velY = 0;
const MOVE_SPEED   = 3.5;
const ACCEL        = 0.4;
const FRICTION     = 0.80;
const LERP         = 0.12;
const JS_RADIUS    = 72;     // max joystick drag radius (px on screen)

function _moveSpeed() {
  const badgeSpeed = G.activeBadge === 'first_takeoff' ? 1.05 : 1;
  const turboSpeed = aircraftTurboActive() ? SR71_TURBO_SPEED_MULT : 1;
  return (isTouchMobile() ? 4.4 : MOVE_SPEED) * (AIRCRAFT[G.activeAircraft]?.ability?.moveSpeed || 1) * badgeSpeed * turboSpeed;
}

function _turnRate() {
  return AIRCRAFT[G.activeAircraft]?.ability?.turnRate || 1;
}

function normaliseKey(k) {
  const key = String(k || '');
  return key.length === 1 ? key.toLowerCase() : key;
}

function _gameCheatHeld(keys) {
  const now = Date.now();
  return keys.every(k => _gameCT.has(k) && now - _gameCT.get(k) < 600);
}
function onKeyDown(e) {
  if (typedAnswerKey(e)) return;
  const k = normaliseKey(e.key);
  if (!k) return;
  if (k in keys) { keys[k] = true; pointerTarget = null; e.preventDefault(); }
  // Test shortcuts, local dev server only (never in the published game):
  // Y+U god mode · Q+W+E kill the boss · R+M+H+U / T win the level.
  if (!import.meta.env?.DEV) return;
  _gameCT.set(k, Date.now());
  if (_gameCheatHeld(['y', 'u']))             _toggleGodMode();
  if (_gameCheatHeld(['q', 'w', 'e']))        _killBoss();
  if (_gameCheatHeld(['r', 'm', 'h', 'u']))   _winLevel();
  if (k === 't' && !e.repeat && !_levelEnding
      && !e.target?.closest?.('input, textarea, select')) {
    endLevel(true);
  }
}
function onKeyUp(e) {
  const k = normaliseKey(e.key);
  if (!k) return;
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
  startBossDeath(boss);
  boss.active = false;
  G.enemies = G.enemies.filter(e => e.active);
  if (levelCfg.isBossLevel) setTimeout(() => endLevel(true), BOSS_DEATH_MS);
}

function canvasPointer(e) {
  const r = _canvasRect || (_canvasRect = canvas.getBoundingClientRect());
  let src = e;
  if (e.touches?.length) {
    if (e.type === 'touchstart') _touchId = e.touches[0].identifier;
    src = [...e.touches].find(t => t.identifier === _touchId) ?? e.touches[0];
    if (e.type === 'touchend' || e.type === 'touchcancel') {
      if (e.touches.length) {
        _touchId = e.touches[0].identifier;
        src = e.touches[0];
      }
    }
  }
  let x = src.clientX - r.left;
  let y = src.clientY - r.top;
  if (isTouchMobile()) ({ x, y } = _cssToCanvas(x, y));

  if ((e.type === 'touchstart' || !e.touches) && handleAirdropPointer(x, y)) {
    pointerTarget = null;
    _jsVelX = _jsVelY = 0;
    return;
  }

  if (e.touches) {
    if (e.type === 'touchstart') {
      _jsOrigin  = { x, y };
      _jsCurrent = { x, y };
      _jsVelX = _jsVelY = 0;
      pointerTarget = null;
    } else if (_jsOrigin && (e.type === 'touchmove' || e.touches.length)) {
      _jsCurrent = { x, y };
      const dx   = x - _jsOrigin.x;
      const dy   = y - _jsOrigin.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const ratio = Math.min(dist, JS_RADIUS) / JS_RADIUS;
        const spd = _moveSpeed();
        _jsVelX = (dx / dist) * ratio * spd;
        _jsVelY = (dy / dist) * ratio * spd;
      } else {
        _jsVelX = _jsVelY = 0;
      }
    }
  } else {
    // Desktop mouse — direct follow (unchanged)
    pointerTarget = { x, y };
  }
}

function clearPointer(e) {
  if (e?.touches?.length) {
    _touchId = e.touches[0].identifier;
    return;
  }
  pointerTarget = null;
  _jsOrigin = _jsCurrent = null;
  _touchId  = null;
  _jsVelX = _jsVelY = 0;
}

function updatePlayerMovement() {
  const step = _frameStep || 1;
  const margin  = 16;
  const minY    = canvas.height * 0.08;
  const maxY    = _playerLowerLimitY();

  // If the plane already sits below the limit (e.g. the question panel just
  // appeared), keep it there instead of snapping it forward; it just can't
  // fly any lower.
  const lowerY  = Math.min(canvas.height - margin, Math.max(maxY, G.player.y));

  const turnRate = _turnRate();
  if (_jsOrigin) {
    // Joystick touch: apply velocity directly, no lerp lag
    G.player.x += _jsVelX * step;
    G.player.y += _jsVelY * step;
    velX = velY = 0;
  } else if (pointerTarget) {
    velX = 0; velY = 0;
    G.player.x += (pointerTarget.x - G.player.x) * Math.min(1, LERP * turnRate * step);
    G.player.y += (pointerTarget.y - G.player.y) * Math.min(1, LERP * turnRate * step);
  } else {
    const spd = _moveSpeed();
    const accel = ACCEL * turnRate;
    if (keys.ArrowLeft  || keys.a) velX = Math.max(velX - accel * step, -spd);
    else if (velX < 0)             velX *= Math.pow(FRICTION, step);
    if (keys.ArrowRight || keys.d) velX = Math.min(velX + accel * step,  spd);
    else if (velX > 0)             velX *= Math.pow(FRICTION, step);
    if (keys.ArrowUp    || keys.w) velY = Math.max(velY - accel * step, -spd);
    else if (velY < 0)             velY *= Math.pow(FRICTION, step);
    if (keys.ArrowDown  || keys.s) velY = Math.min(velY + accel * step,  spd);
    else if (velY > 0)             velY *= Math.pow(FRICTION, step);
    if (Math.abs(velX) < 0.05) velX = 0;
    if (Math.abs(velY) < 0.05) velY = 0;
    G.player.x += velX * step;
    G.player.y += velY * step;
  }
  // Extreme weather gusts push the aircraft sideways; the player can fly
  // against the wind to hold position.
  if (!_cutsceneActive) G.player.x += windForce() * step;
  G.player.x = Math.max(margin, Math.min(canvas.width  - margin, G.player.x));
  if (_questionReturnAnim) {
    const elapsed = performance.now() - _questionReturnAnim.start;
    const progress = Math.min(1, Math.max(0, elapsed / _questionReturnAnim.duration));
    const eased = easeOutCubic(progress);
    G.player.y = _questionReturnAnim.fromY
      + (_questionReturnAnim.toY - _questionReturnAnim.fromY) * eased;
    if (progress >= 1) _questionReturnAnim = null;
  } else {
    G.player.y = Math.max(minY, Math.min(lowerY, G.player.y));
  }
}

function canvasAirdropClick(e) {
  const r = _canvasRect || (_canvasRect = canvas.getBoundingClientRect());
  let x = e.clientX - r.left;
  let y = e.clientY - r.top;
  ({ x, y } = _cssToCanvas(x, y));
  if (handleAirdropPointer(x, y)) {
    pointerTarget = null;
    _jsVelX = _jsVelY = 0;
  }
}

function attachInputListeners() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup',   onKeyUp);
  canvas.addEventListener('touchstart',  canvasPointer, { passive: true });
  canvas.addEventListener('touchmove',   canvasPointer, { passive: true });
  canvas.addEventListener('touchend',    clearPointer,  { passive: true });
  canvas.addEventListener('touchcancel', clearPointer,  { passive: true });
  canvas.addEventListener('click', canvasAirdropClick);
}

function detachInputListeners() {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup',   onKeyUp);
  canvas.removeEventListener('touchstart', canvasPointer);
  canvas.removeEventListener('touchmove',  canvasPointer);
  canvas.removeEventListener('touchend',    clearPointer);
  canvas.removeEventListener('touchcancel', clearPointer);
  canvas.removeEventListener('click', canvasAirdropClick);
}

// ── MOBILE GAME LOOP (phone + tablet only) ────────────────────────────────────
function _setCanvasSize(w, h) {
  _canvasRect = null;
  const dpr = gameCanvasDpr();
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  if (isTouchMobile()) {
    canvas.style.width          = w + 'px';
    canvas.style.height         = h + 'px';
    canvas.style.imageRendering = 'auto';
  } else {
    canvas.style.width = canvas.style.height = canvas.style.imageRendering = '';
  }
}

/** Question-box height in canvas pixel space (matches reduced internal resolution). */
function _canvasQboxH() {
  const qbox = document.getElementById('question-box');
  if (!qbox
    || qbox.classList.contains('question-inactive')
    || qbox.classList.contains('shooting-hidden')
    || qbox.style.visibility === 'hidden') return 0;
  const cssH = canvas?.clientHeight || 640;
  const bh   = canvas?.height || cssH;
  if (!isTouchMobile() || cssH <= 0) return _qboxH || 180;
  return Math.round((_qboxH || 180) * (bh / cssH));
}

/** Map pointer/touch CSS coords → internal canvas coords. */
function _cssToCanvas(cssX, cssY) {
  const r = _canvasRect || (_canvasRect = canvas.getBoundingClientRect());
  if (!r.width || !r.height) return { x: cssX, y: cssY };
  return {
    x: cssX * (canvas.width / r.width),
    y: cssY * (canvas.height / r.height),
  };
}

function _stopGameLoop() {
  cancelAnimationFrame(G.animFrame);
  G.animFrame = null;
  stopCountdownDraw();
  if (G.mobileLoop) { clearInterval(G.mobileLoop); G.mobileLoop = null; }
}

/** Lowest allowed aircraft centre. The aircraft's bottom edge stops at the
 * actual top edge of the visible equation panel. */
function _playerLowerLimitY() {
  const qbox = document.getElementById('question-box');
  // The wrong-answer correction screen covers the whole page; it must not
  // count as a flight boundary or the plane would snap to the top.
  const panelVisible = qbox
    && !qbox.classList.contains('correction-active')
    && !qbox.classList.contains('question-inactive')
    && !qbox.classList.contains('shooting-hidden')
    && qbox.style.visibility !== 'hidden';
  if (!panelVisible) return canvas.height - Math.max(44, getPlayerSize() * 0.5);

  // Canvas position only changes on resize (which nulls _canvasRect via
  // _setCanvasSize) — reuse it instead of forcing a second layout reflow
  // here on every frame of gameplay.
  const canvasRect = _canvasRect || (_canvasRect = canvas.getBoundingClientRect());
  const qboxRect = qbox.getBoundingClientRect();
  if (!canvasRect.height) return canvas.height - _canvasQboxH() - getPlayerSize() * 0.52;
  const panelTop = (qboxRect.top - canvasRect.top) * (canvas.height / canvasRect.height);
  return Math.max(canvas.height * 0.08, panelTop - getPlayerSize() * 0.52);
}

function returnPlayerAboveQuestionBox() {
  const qbox = document.getElementById('question-box');
  if (!qbox) return 0;
  // Prepare the panel for its reveal, kept transparent until then.
  qbox.classList.remove(
    'question-inactive',
    'shooting-hidden',
    'fading',
    'appearing',
    'resume-appearing',
  );
  qbox.style.visibility = 'hidden';
  // The plane is never pushed forward automatically: it stays where the
  // player left it, even if the panel overlaps it.
  return 0;
}

function _isActiveSid(sid = _activeSessionId) {
  return !!sid && _sessionId === sid && _activeSessionId === sid;
}

function _canRunSid(sid = _activeSessionId) {
  return _isActiveSid(sid) && !_gamePausedFromQuit;
}

function _queueFrame(sid = _activeSessionId) {
  if (!_canRunSid(sid)) return;
  // The game stays frozen while the wrong-answer correction is shown, even
  // if a resize or tab switch tries to restart the loop. nextQuestion()
  // restarts it once the player presses CONTINUE.
  if (_correctionWaiting) {
    cancelAnimationFrame(G.animFrame);
    G.animFrame = null;
    drawCorrectionSnapshot();
    return;
  }
  G.animFrame = requestAnimationFrame(ts => {
    if (!_canRunSid(sid)) {
      G.animFrame = null;
      return;
    }
    const queuedId = G.animFrame;
    try {
      frame(ts);
    } catch (err) {
      // One bad frame must never freeze the whole game: log it and keep the
      // loop running (frame() queues the next one only at its very end).
      console.error('[game] frame error', err);
      if (G.animFrame === queuedId && !_cutsceneActive) _queueFrame(sid);
    }
  });
}

function _startGameLoop(sid) {
  _stopGameLoop();
  if (!_canRunSid(sid)) return;
  _queueFrame(sid);
}

// ── RESIZE ─────────────────────────────────────────────────────────────────
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  _canvasRect = null;
  if (G.animFrame) { cancelAnimationFrame(G.animFrame); G.animFrame = null; }
  _setCanvasSize(w, h);
  setSpriteCanvasWidth(canvas.width);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  _qboxH = $('question-box').offsetHeight || 180;
  const bw = canvas.width;
  const bh = canvas.height;
  G.player.x = Math.max(16, Math.min(bw - 16,  G.player.x || bw / 2));
  // Keep the plane on screen, but never push it up above the question panel.
  const lowerLimit = _playerLowerLimitY();
  const y = G.player.y || lowerLimit;
  G.player.y = Math.max(bh * 0.08, Math.min(bh - 16, y));
  if (!_cutsceneActive) _queueFrame();
}

function placePlayer() {
  G.player.x = canvas.width / 2;
  G.player.y = canvas.height - _canvasQboxH() - Math.round(canvas.height * 0.22);
}

// ── LOADING SCREEN ──────────────────────────────────────────────────────────
function drawLoadingScreen() {
  const cw = canvas.width, ch = canvas.height;
  const sky = ctx.createLinearGradient(0, 0, 0, ch);
  sky.addColorStop(0, '#60bdf8');
  sky.addColorStop(0.55, '#1c8fea');
  sky.addColorStop(1, '#0755a8');
  ctx.fillStyle = sky;
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

function drawCountdownSafeFrame() {
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateBackground();
  drawBackground(ctx, canvas);
  updateClouds(1, canvas.width, canvas.height);
  drawClouds(ctx);
  if (_speedLines.length === 0) initSpeedLines(canvas.width, canvas.height);
  drawSpeedLines(ctx, canvas.width, canvas.height);
  const plane = countdownPlanePosition();
  drawAircraftSprite(ctx, G.activeAircraft, plane.x, plane.y, _shipFrame, 1, 0);
  // Weather is visible from the very start, during the countdown too.
  drawWeatherLayer(1, null);
}

// Draws the level's weather (tint + animated effects) and reacts to its
// events. `target` is the aircraft lightning may aim at (null during the
// countdown and cutscenes: bolts still shake the screen but cannot hit).
function drawWeatherLayer(step, target) {
  if (levelCfg.weather?.overlay) {
    ctx.fillStyle = levelCfg.weather.overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  for (const event of drawWeatherFx(ctx, canvas.width, canvas.height, step, target)) {
    if (event.type === 'bolt') onLightningBolt(event.points);
  }
  SFX.weatherWind(windIntensity());
  ctx.globalAlpha = 1;
}

function stopCountdownDraw() {
  if (_countdownRaf) cancelAnimationFrame(_countdownRaf);
  _countdownRaf = null;
}

function advanceShipAnimation(ts = performance.now()) {
  if (!_shipAnimLastTs) {
    _shipAnimLastTs = ts;
    return;
  }
  const deltaMs = Math.max(0, Math.min(80, ts - _shipAnimLastTs));
  _shipAnimLastTs = ts;
  _shipFrame = (_shipFrame + (deltaMs / 1000) * SHIP_ANIM_FPS) % SHIP_ANIM_FRAMES;
}

function startCountdownDraw(sid) {
  stopCountdownDraw();
  _shipAnimLastTs = 0;
  const step = (ts) => {
    if (!_isActiveSid(sid) || !_cutsceneActive) {
      _countdownRaf = null;
      return;
    }
    tick++;
    advanceShipAnimation(ts);
    drawCountdownSafeFrame();
    _countdownRaf = requestAnimationFrame(step);
  };
  _countdownRaf = requestAnimationFrame(step);
}

function playerFloatOffset() {
  return {
    x: Math.sin(tick * 0.035) * 1.2,
    y: Math.sin(tick * 0.045) * 4,
  };
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function startSmoothGameResume() {
  const now = performance.now();
  _resumeSlowStart = now;
  _resumeSlowDuration = isTouchMobile() ? 520 : 1800;
  // No plane offset on resume: the aircraft stays exactly where it was.
  _resumePlaneStart = 0;
  _resumePlaneDuration = 0;
  _frameStep = Math.min(_frameStep || 1, 0.35);
}

function resumeSpeedScale(now = performance.now()) {
  if (!_resumeSlowStart || !_resumeSlowDuration) return 1;
  const t = Math.min(1, Math.max(0, (now - _resumeSlowStart) / _resumeSlowDuration));
  if (t >= 1) {
    _resumeSlowStart = 0;
    _resumeSlowDuration = 0;
    return 1;
  }
  return 0.28 + 0.72 * easeInOutCubic(t);
}

function resumePlaneOffset(now = performance.now()) {
  if (!_resumePlaneStart || !_resumePlaneDuration) return { x: 0, y: 0 };
  const t = Math.min(1, Math.max(0, (now - _resumePlaneStart) / _resumePlaneDuration));
  if (t >= 1) {
    _resumePlaneStart = 0;
    _resumePlaneDuration = 0;
    return { x: 0, y: 0 };
  }
  const eased = easeOutCubic(t);
  return {
    x: Math.sin(t * Math.PI) * (isTouchMobile() ? 3 : 5),
    y: (1 - eased) * (isTouchMobile() ? 34 : 44),
  };
}

function isQuestionAwaitingAnswer() {
  const qbox = document.getElementById('question-box');
  return Boolean(
    G.question
    && !G.answerLocked
    && qbox
    && !qbox.classList.contains('question-inactive')
    && !qbox.classList.contains('shooting-hidden')
    && qbox.style.visibility !== 'hidden'
  );
}

function countdownPlanePosition(now = performance.now()) {
  const float = playerFloatOffset();
  if (_finishPlaneAnim) {
    const elapsed = Math.max(0, now - _finishPlaneAnim.start);
    if (elapsed < _finishPlaneAnim.retreatDuration) {
      const t = elapsed / _finishPlaneAnim.retreatDuration;
      return {
        x: _finishPlaneAnim.fromX + float.x,
        y: _finishPlaneAnim.fromY
          + (_finishPlaneAnim.retreatY - _finishPlaneAnim.fromY) * easeInOutCubic(t)
          + float.y,
      };
    }

    const boostElapsed = elapsed - _finishPlaneAnim.retreatDuration;
    const t = Math.min(1, boostElapsed / _finishPlaneAnim.boostDuration);
    const boost = t * t * t;
    return {
      x: _finishPlaneAnim.fromX + float.x,
      y: _finishPlaneAnim.retreatY
        + (_finishPlaneAnim.exitY - _finishPlaneAnim.retreatY) * boost
        + float.y,
    };
  }
  if (!_countdownPlaneAnim) {
    return { x: G.player.x + float.x, y: G.player.y + float.y };
  }
  const t = Math.min(1, Math.max(0, (now - _countdownPlaneAnim.start) / _countdownPlaneAnim.duration));
  const eased = easeOutCubic(t);
  return {
    x: _countdownPlaneAnim.fromX + (_countdownPlaneAnim.toX - _countdownPlaneAnim.fromX) * eased + float.x,
    y: _countdownPlaneAnim.fromY + (_countdownPlaneAnim.toY - _countdownPlaneAnim.fromY) * eased + float.y,
  };
}

// ── GAME LOOP ───────────────────────────────────────────────────────────────
function frame(ts = 0) {
  if (!_canRunSid()) {
    G.animFrame = null;
    return;
  }
  const prevFrameTs = _lastFrameTs || ts;
  const frameMs = prevFrameTs ? Math.max(8, Math.min(42, ts - prevFrameTs)) : 16.7;
  // Phones: a frame that took longer moves the game further (up to 2x, i.e.
  // full speed down to 30 fps), so a busy phone no longer slows the game down.
  const targetStep = isTouchMobile()
    ? Math.max(0.95, Math.min(2, frameMs / 16.7))
    : Math.max(0.85, Math.min(1.2, frameMs / 16.7));
  const questionFocusTarget = isQuestionAwaitingAnswer() ? 1 : 0;
  syncAbilityPause(Boolean(questionFocusTarget) || _correctionWaiting);
  const focusEaseMs = questionFocusTarget ? 420 : 520;
  const focusEase = 1 - Math.exp(-frameMs / focusEaseMs);
  _questionFocusBlend += (questionFocusTarget - _questionFocusBlend) * focusEase;
  if (Math.abs(_questionFocusBlend - questionFocusTarget) < 0.001) {
    _questionFocusBlend = questionFocusTarget;
  }
  // Mobile and tablet gameplay stays fast while the question is displayed.
  const focusSlowdown = isTouchMobile() ? 0.42 : 0.92;
  const questionSpeedScale = 1 - _questionFocusBlend * focusSlowdown;
  const resumeScale = resumeSpeedScale(ts || performance.now());
  _frameStep = (_frameStep * 0.65 + targetStep * 0.35) * resumeScale * questionSpeedScale;
  _lastFrameTs = ts;
  tuneAdaptivePerformance(ts);

  if (!_cutsceneActive && !_levelEnding && !_tutorialActive) {
    updateTimedPlayXp(frameMs);
  }

  tick += _frameStep;
  advanceShipAnimation(ts || performance.now());

  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const shaking = !_cutsceneActive && shakeFrames > 0;
  if (shaking) {
    ctx.save();
    const shakeAmp = performance.now() < _bigShakeUntil ? 22 : 7;
    ctx.translate((Math.random() - 0.5) * shakeAmp, (Math.random() - 0.5) * shakeAmp);
    shakeFrames--;
  }

  // ── Background ─────────────────────────────────────────────────────────
  updateBackground(_frameStep);
  drawBackground(ctx, canvas);

  // ── Weather overlay ────────────────────────────────────────────────────
  if (levelCfg.weather?.overlay) {
    ctx.fillStyle = levelCfg.weather.overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // The world gently dims only after the first dialogue line appears. The
  // pre-conversation aircraft entrance stays bright and fully visible.
  const dialogueDimTarget = _bossDialogueActive && !_bossDialogueEntrance && !_bossDialogueExit ? 1 : 0;
  const dialogueDimEase = 1 - Math.exp(-frameMs / 260);
  _bossDialogueDim += (dialogueDimTarget - _bossDialogueDim) * dialogueDimEase;
  if (_bossDialogueDim > 0.002) {
    ctx.fillStyle = `rgba(0,0,0,${(_bossDialogueDim * 0.58).toFixed(3)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Smoothly darken only the world background while a question is waiting.
  // Aircraft and projectiles are drawn afterward and remain easy to see.
  if (_questionFocusBlend > 0.001) {
    ctx.fillStyle = `rgba(0,0,0,${(_questionFocusBlend * 0.30).toFixed(3)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ── Speed lines ────────────────────────────────────────────────────────
  if (_speedLines.length === 0) initSpeedLines(canvas.width, canvas.height);
  drawSpeedLines(ctx, canvas.width, canvas.height);

  // Keep the cloud layer alive during cutscenes as well as active gameplay.
  // Boss entrance/dialogue frames return early below, so drawing clouds only
  // in the gameplay branch made them disappear for the whole boss animation.
  updateClouds(_frameStep, canvas.width, canvas.height);
  drawClouds(ctx);

  if (_cutsceneActive) {
    if (_bossDialogueActive) {
      const dialogueBoss = G.enemies.find(enemy => enemy.active && (enemy.a330Boss || enemy.b52Boss || enemy.kawasakiBoss || enemy.c5Boss || enemy.spaceShuttleBoss));
      const entranceT = _bossDialogueEntrance
        ? Math.max(0, Math.min(1, ((ts || performance.now()) - _bossDialogueEntrance.start) / _bossDialogueEntrance.duration))
        : 1;
      const entranceEase = 1 - Math.pow(1 - entranceT, 3);
      if (dialogueBoss) {
        const savedX = dialogueBoss.x;
        const savedY = dialogueBoss.y;
        const savedAlpha = dialogueBoss.spawnAlpha;
        dialogueBoss.x = canvas.width / 2;
        const bossTargetY = dialogueBoss.entryTargetY || canvas.height * 0.19;
        dialogueBoss.y = -getEnemyDrawSize(dialogueBoss) * 0.56
          + (bossTargetY + getEnemyDrawSize(dialogueBoss) * 0.56) * entranceEase;
        dialogueBoss.spawnAlpha = Math.min(1, entranceT * 1.8);
        drawEnemySprite(ctx, dialogueBoss, 0);
        dialogueBoss.x = savedX;
        dialogueBoss.y = savedY;
        dialogueBoss.spawnAlpha = savedAlpha;
      }
      drawAircraftSprite(
        ctx,
        G.activeAircraft,
        _bossPlayerAnchor?.x ?? G.player.x,
        _bossPlayerAnchor?.y ?? G.player.y,
        _shipFrame,
        1,
        0,
      );
    } else {
      const plane = countdownPlanePosition(ts || performance.now());
      drawAircraftSprite(ctx, G.activeAircraft, plane.x, plane.y, _shipFrame, 1, 0);
    }
    drawWeatherLayer(_frameStep, null);
    if (shaking) ctx.restore();
    _queueFrame();
    return;
  }

  // Clouds were drawn above so they remain below every aircraft and
  // projectile, including during boss cutscenes.
  updateAndDrawMapCoins(ctx, canvas.width, canvas.height, _frameStep,
    activeAircraftAbility().magnet ? C130_MAGNET_RADIUS : 0);

  // ── Enemy spawn ────────────────────────────────────────────────────────
  const bossFirstShotGraceActive = G.enemies.some(enemy =>
    enemy.active
    && enemy.type === 'boss'
    && enemy.firstShotAt
    && performance.now() < enemy.firstShotAt
  );
  // New-player practice break (after question 5): no new enemies.
  const spawnPaused = bossFirstShotGraceActive || guidedBreakActive();
  if (!spawnPaused) {
    spawnTimer -= _frameStep;
    // Keep planes coming one after another: an empty sky brings the next wave
    // right away, and a single plane left shortens the wait.
    if (adaptiveMaxEnemies() > 0) {
      const left = activeRegularEnemyCount();
      if (left === 0) spawnTimer = Math.min(spawnTimer, 10);
      else if (left === 1) spawnTimer = Math.min(spawnTimer, 50);
    }
  }
  if (!spawnPaused && spawnTimer <= 0) {
    // New-player practice: only lone F-15s (no formations, lasers or gunships).
    const types = _guidedRun ? ['basic'] : RANDOM_ENEMY_TYPES;
    const type  = types[Math.floor(Math.random() * types.length)];
    const activeCount = activeRegularEnemyCount();
    const normalCap = adaptiveMaxEnemies();
    const spawned = [];

    if (type === 'tank') {
      // Apaches now make individual, brief machine-gun ambushes.
      if (activeCount < normalCap) spawned.push(spawnEnemy(canvas.width, 'tank'));
    } else if (type === 'fast') {
      // F-5 waves: a lone F-5, kamikazes, or a crossing X, V or W formation.
      const shape = ['solo', 'kamikaze', 'x', 'v', 'w'][Math.floor(Math.random() * 5)];
      if (shape === 'kamikaze') {
        // 1 or 2 kamikaze F-5s (no guns, they charge the player), one after
        // another from different spots. A second one only from level 20.
        const most = G.currentLevel >= 20 ? 2 : 1;
        const count = Math.min(1 + Math.floor(Math.random() * most), Math.max(1, normalCap - activeCount));
        for (let i = 0; i < count; i++) {
          spawned.push(spawnEnemy(canvas.width, 'fast', { kamikaze: true, kamikazeDelay: i * 160 }));
        }
      } else if (shape === 'solo') {
        // A single F-5 flying straight down from a random position.
        if (activeCount < normalCap) spawned.push(spawnEnemy(canvas.width, 'fast'));
      } else if (shape === 'x') {
        // Crossing waves grow with the level: two pairs, then up to four.
        // Pairs always remain complete so their paths draw an X.
        const desiredPairs = Math.min(4, 2 + Math.floor(Math.max(0, G.currentLevel - 1) / 15));
        const availablePairs = Math.floor(Math.max(0, normalCap - activeCount) / 2);
        const pairCount = Math.min(desiredPairs, availablePairs);
        for (let lane = 0; lane < pairCount; lane++) {
          spawned.push(spawnEnemy(canvas.width, 'fast', { crossSide: -1, crossLane: lane }));
          spawned.push(spawnEnemy(canvas.width, 'fast', { crossSide: 1, crossLane: lane }));
        }
      } else {
        // V: 5, 7 or 9 planes (odd, so there is a lead plane at the tip).
        // W: 5 to 10 planes. A whole formation may exceed the normal cap a
        // little, but never pushes the screen past 10 regular enemies.
        const count = shape === 'v'
          ? [5, 7, 9][Math.floor(Math.random() * 3)]
          : 5 + Math.floor(Math.random() * 6);
        if (activeCount + count <= Math.max(normalCap, 10)) {
          spawned.push(...spawnF5Formation(shape, count));
        }
      }
    } else if (type === 'interceptor') {
      // F-14s fly solo or in a side-by-side line of 2, 3 or 4. The whole
      // line must fit under the 10 regular enemies limit.
      const count = [1, 2, 3, 4][Math.floor(Math.random() * 4)];
      const cap = count === 1 ? normalCap : Math.max(normalCap, 10);
      if (activeCount + count <= cap) {
        spawned.push(...spawnF14Line(count));
      }
    } else if (activeCount < normalCap) {
      // Independent enemies: F-15 straight runs and randomly turning Mirages.
      const e = spawnEnemy(canvas.width, type);
      // Some F-15s carry a homing missile (see HOMING F-15 below). Not in the
      // new-player practice, which only uses plain F-15s.
      if (type === 'basic' && !_guidedRun && Math.random() < HOMING_F15_CHANCE) e.homingShooter = true;
      spawned.push(e);
    }

    for (const e of spawned) {
      e.speed       *= levelCfg.enemySpeedMult * ENEMY_MOVEMENT_SPEED_SCALE * (_guidedRun ? GUIDED_ENEMY_SPEED : 1)
        * (isTouchMobile() ? TOUCH_ENEMY_SPEED_MULT * (e.type === 'fast' ? TOUCH_F5_EXTRA_SPEED : 1) : 1);
      // Same cadence on phone, tablet and computer.
      e.fireRate     = Math.max(30, Math.floor(e.fireRate * levelCfg.enemyFireRateMult));
      e.fireCooldown = 45 + Math.floor(Math.random() * 45);
      // Fixed cadence at 60 fps, independent of level: F-15 and F-5 every
      // 5 s, Eurofighter (the 'turner' sprite) every 3 s.
      const fixedFireRate = FIXED_ENEMY_FIRE_RATE[e.type];
      if (fixedFireRate) {
        e.fireRate = Math.round(fixedFireRate * (_guidedRun ? GUIDED_FIRE_SLOWER : 1));
        e.fireCooldown = Math.min(e.fireCooldown, fixedFireRate);
      }
      G.enemies.push(e);
    }
    // Retry sooner when a complete formation could not fit yet.
    spawnTimer = spawned.length ? adaptiveSpawnRate() : 45;
  }
  pruneEnemies(canvas.height + 80);

  // Level-based missile guidance strength and homing probability
  // ── Enemies ────────────────────────────────────────────────────────────
  updateEnemies(G.enemies.filter(e => !e.turncoat), canvas.width, canvas.height, _frameStep,
    activeAircraftAbility().jam ? enemySpeedMultFor : null,
    _stealthActive || G.lives <= 0 ? null : G.player);
  // Draw regular enemies first and bosses last. Keep G.enemies untouched so
  // collision, targeting, and spawn logic retain their original data order.
  const layeredEnemies = [
    ...G.enemies.filter(enemy => enemy.type !== 'boss'),
    ...G.enemies.filter(enemy => enemy.type === 'boss'),
  ];
  for (const e of layeredEnemies) {
    if (!e.active) continue;
    if (e.turncoat) { updateAndDrawTurncoat(e, frameMs); continue; }

    if (e.type === 'boss') {
      if (e.holdEntry) continue;   // not on screen yet (START / BOSS ALERT)
      if (e.a330Boss || e.b52Boss || e.kawasakiBoss || e.c5Boss || e.spaceShuttleBoss) {
        if (e.entryActive) {
          e.entryProgress = Math.min(1, e.entryProgress + _frameStep / 150);
          const p = e.entryProgress;
          const eased = p * p * (3 - 2 * p);
          e.spawnAlpha = Math.min(1, p * 2.2);
          e.x = canvas.width / 2;
          e.y = e.entryStartY + (e.entryTargetY - e.entryStartY) * eased;
          if (p >= 1) {
            e.entryActive = false;
            e.spawnAlpha = 1;
            e.y = e.entryTargetY;
            e._targetY = e.y;
          }
        }
        if (e.entryActive || !e.combatActive) {
          drawEnemySprite(ctx, e, 0);
          continue;
        }
        if (e.a330Boss) {
          // Ten-second A330 cycle: five seconds protected, five exposed.
          const wasDefenseActive = e.antiMissileActive;
          e.antiMissileCycle = (e.antiMissileCycle + _frameStep) % 600;
          e.antiMissileActive = e.antiMissileCycle < 300;
          if (wasDefenseActive && !e.antiMissileActive) e.a330SalvoCooldown = 0;

          if (!e.antiMissileActive) {
            e.a330SalvoCooldown -= _frameStep;
            if (e.a330SalvoCooldown <= 0 && performance.now() >= (e.firstShotAt || 0)) {
              const missileSpeed = (isTouchMobile() ? 3.8 : 2.8) * MISSILE_SPEED_SCALE;
              const aim = enemyAimTarget(e);
              for (const spread of [-52, 0, 52]) {
                const launchX = e.x + spread * 0.65;
                const targetX = aim.x + spread;
                const missile = createMissile(launchX, e.y + 22, targetX, aim.y, missileSpeed, e.id, '#ef4444');
                G.enemyMissiles.push(missile);
              }
              SFX.missile();
              e.a330SalvoCooldown = 300;
            }
          }
        } else {
          // Gunship cycle: five seconds firing, then ten seconds resting.
          e.b52LaserCycle = (e.b52LaserCycle + _frameStep) % (BOSS_LASER_FIRE_FRAMES + BOSS_LASER_REST_FRAMES);
          const firing = e.b52LaserCycle < BOSS_LASER_FIRE_FRAMES;
          const previousAim = e.b52TurretAim || 0;
          const aimSpeed = (23 / 90) * _frameStep;
          if (firing) {
            // Track the player's horizontal position. Values from -23 to +23
            // map directly onto the supplied center-to-left/right frames.
            const trackingRange = Math.max(1, canvas.width * 0.34);
            const rawTargetAim = ((G.player.x - e.x) / trackingRange) * 23;
            const targetAim = Math.max(-23, Math.min(23, rawTargetAim));
            const delta = targetAim - previousAim;
            e.b52TurretAim = previousAim + Math.sign(delta) * Math.min(Math.abs(delta), aimSpeed);
            const spriteBase = e.spaceShuttleBoss ? 'boss-space-shuttle' : e.kawasakiBoss ? 'boss-kawasaki-c2' : e.c5Boss ? 'boss-c5-galaxy' : 'boss-b52';
            const returningFromLeft = previousAim < 0 && e.b52TurretAim > previousAim;
            const returningFromRight = previousAim > 0 && e.b52TurretAim < previousAim;
            if (e.spaceShuttleBoss) {
              e.spriteKey = e.b52TurretAim < 0 ? 'boss-space-shuttle-left' : spriteBase;
              e.animFrame = Math.round(Math.abs(e.b52TurretAim));
            } else if (e.c5Boss) {
              e.spriteKey = spriteBase;
              e.animFrame = 0;
            } else if (returningFromLeft) {
              e.spriteKey = `${spriteBase}-left-return`;
              e.animFrame = Math.round(23 - Math.abs(e.b52TurretAim));
            } else if (returningFromRight) {
              e.spriteKey = `${spriteBase}-right-return`;
              e.animFrame = Math.round(23 - Math.abs(e.b52TurretAim));
            } else {
              e.spriteKey = e.b52TurretAim < 0 ? `${spriteBase}-left` : spriteBase;
              e.animFrame = Math.round(Math.abs(e.b52TurretAim));
            }
            e.b52LaserCooldown -= _frameStep;
            if (e.b52LaserCooldown <= 0 && performance.now() >= (e.firstShotAt || 0)) {
              const gunOffsets = e.kawasakiBoss ? [-34, 34] : e.spaceShuttleBoss ? [-7, 7] : [0];
              const aim = enemyAimTarget(e);
              for (const gunOffset of gunOffsets) {
                const laser = createMissile(e.x + gunOffset, e.y + 22, aim.x, aim.y, 7.6 * MISSILE_SPEED_SCALE, e.id, '#ff2020');
                laser.type = 'enemy-laser';
                G.enemyMissiles.push(laser);
              }
              SFX.missile('laser');
              e.b52LaserCooldown = 18;
            }
          } else {
            // Smoothly bring the gun back to the middle while the B-52 rests.
            e.b52TurretAim = previousAim - Math.sign(previousAim)
              * Math.min(Math.abs(previousAim), aimSpeed);
            if (e.spaceShuttleBoss) {
              e.spriteKey = e.b52TurretAim < 0 ? 'boss-space-shuttle-left' : 'boss-space-shuttle';
              e.animFrame = Math.round(Math.abs(e.b52TurretAim));
            } else if (e.c5Boss) {
              e.spriteKey = 'boss-c5-galaxy';
              e.animFrame = 0;
            } else if (previousAim < 0) {
              e.spriteKey = e.kawasakiBoss ? 'boss-kawasaki-c2-left-return' : 'boss-b52-left-return';
              e.animFrame = Math.round(23 - Math.abs(e.b52TurretAim));
            } else {
              e.spriteKey = e.kawasakiBoss ? 'boss-kawasaki-c2-right-return' : 'boss-b52-right-return';
              e.animFrame = Math.round(23 - Math.abs(e.b52TurretAim));
            }
            e.b52LaserCooldown = Math.min(e.b52LaserCooldown, 18);
          }
        }
      // Other milestone bosses retain their existing burst pattern.
      } else if (e.bossPhase === 'pause') {
        e.bossPauseTimer -= _frameStep;
        if (e.bossPauseTimer <= 0) {
          e.bossPhase    = 'burst';
          e.bossBurstFired = 0;
          e.bossBurstTimer = 0;
        }
      } else {
        e.bossBurstTimer -= _frameStep;
        if (e.bossBurstTimer <= 0
          && e.bossBurstFired < e.bossBurstMax
          && performance.now() >= (e.firstShotAt || 0)) {
          const ms = (e._missileSpd ?? 2.5) * (isTouchMobile() ? 1.45 : 1) * MISSILE_SPEED_SCALE;
          const mc = e._missileColor ?? '#ef4444';
          const muzzleY = e.y + getEnemyDrawSize(e) * 0.30;
          const aim = enemyAimTarget(e);
          const em = createMissile(e.x, muzzleY, aim.x, aim.y, ms, e.id, mc);
          G.enemyMissiles.push(em);
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
      e._moveTimer -= _frameStep;
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
      e.x += e._vx * _frameStep;
      e.y += e._vy * _frameStep;
      // Hard constraint: boss always stays in front of (above) the player
      const frontY = G.player.y - 110;
      if (e.y > frontY) {
        e.y = frontY;
        if (e._targetY > frontY) e._targetY = frontY * 0.8;
      }
      e.x = Math.max(44, Math.min(canvas.width - 44, e.x));

    } else {
      const fireTop = canvas.height * 0.08;
      const fireBot = Math.min(canvas.height * 0.78, G.player.y - 80);
      const inFireZone = e.y > fireTop && e.y < fireBot;
      if (e.type === 'interceptor') {
        // F-14 exclusive weapon: one straight red laser every 0.2 seconds
        // (12 simulation frames), in 3 s volleys separated by 3 s pauses
        // (180 frames each; the cycle only runs while in the fire zone).
        // Question slow motion also slows this cadence.
        e.laserCooldown -= _frameStep;
        if (inFireZone) e.f14CycleT = ((e.f14CycleT || 0) + _frameStep) % 360;
        const f14Firing = (e.f14CycleT || 0) < 180;
        if (e.laserCooldown <= 0 && inFireZone && f14Firing && !_stealthActive) {
          const laserSpeed = (isTouchMobile() ? 8.8 : 7.4) * MISSILE_SPEED_SCALE;
          const laser = createMissile(e.x, e.y + getEnemyDrawSize(e) * 0.28, e.x, canvas.height + 100, laserSpeed, e.id, '#ff2020');
          laser.type = 'enemy-laser';
          G.enemyMissiles.push(laser);
          e.laserCooldown += 12;
          SFX.missile('laser');
        } else if (e.laserCooldown <= 0) {
          e.laserCooldown = 1;
        }
      } else if (e.pathType === 'apache-ambush') {
        // Rapid short machine-gun bursts while the Apache is hovering.
        if (e.apachePhase === 'hover' && !_stealthActive) {
          e.apacheGunCooldown -= _frameStep;
          if (e.apacheGunCooldown <= 0) {
            if (e.apacheBurstRemaining <= 0) e.apacheBurstRemaining = 7;
            const muzzleX = e.x + (Math.random() - 0.5) * 10;
            const aim = enemyAimTarget(e);
            const targetX = aim.x + (Math.random() - 0.5) * 26;
            const bullet = createMissile(muzzleX, e.y + getEnemyDrawSize(e) * 0.24, targetX, aim.y, 8.5 * MISSILE_SPEED_SCALE, e.id, '#ffd34d');
            bullet.type = 'enemy-machine-gun';
            G.enemyMissiles.push(bullet);
            SFX.missile('gun');
            e.apacheBurstRemaining--;
            e.apacheGunCooldown = e.apacheBurstRemaining > 0 ? 5 : 72;
          }
        }
      } else if (e.kamikaze) {
        // Kamikaze F-5: no weapon, the plane itself is the threat.
      } else if (e.homingShooter) {
        // Homing F-15: locks on (red ring + beeps), then fires one missile
        // that follows the player - dodgeable, like the kamikaze F-5.
        e.fireCooldown -= _frameStep;
        if (e.homingLockT != null) {
          e.homingLockT += _frameStep;
          if (e.homingLockT >= HOMING_LOCK_FRAMES) {
            e.homingLockT = null;
            if (inFireZone && !_stealthActive) {
              const muzzleY = e.y + getEnemyDrawSize(e) * 0.30;
              const aim = enemyAimTarget(e);
              const speed = (isTouchMobile() ? 3.2 : 2.3) * MISSILE_SPEED_SCALE;
              const em = createMissile(e.x, muzzleY, aim.x, aim.y, speed, e.id, '#ff3b30');
              em.type = 'enemy-homing';
              em.age = 0;
              G.enemyMissiles.push(em);
              SFX.missile('missile');
            }
          }
        } else if (e.fireCooldown <= 0 && inFireZone && !_stealthActive) {
          e.fireCooldown = e.fireRate;
          e.homingLockT = 0;
          SFX.kamikazeLock?.();
        } else if (e.fireCooldown <= 0) {
          e.fireCooldown = 18;
        }
      } else {
        e.fireCooldown -= _frameStep;
      if (e.fireCooldown <= 0 && inFireZone && !_stealthActive) {
        e.fireCooldown = e.fireRate;
        const burstCount = 1;
        // F-5s fire faster blue laser dots instead of red missiles.
        const isBlueDot = e.type === 'fast';
        const enemyMissileSpeed = (isTouchMobile() ? 3.8 : 2.5) * MISSILE_SPEED_SCALE * (isBlueDot ? 1.6 : 1);
        const muzzleY = e.y + getEnemyDrawSize(e) * 0.30;
        const aim = enemyAimTarget(e);
        for (let i = 0; i < burstCount; i++) {
          const spread = (i - (burstCount - 1) / 2) * 28;
          const launchX = e.x + spread * 0.22;
          const targetX = aim.x + spread;
          const em = createMissile(launchX, muzzleY, targetX, aim.y, enemyMissileSpeed, e.id, isBlueDot ? '#38bdf8' : '#ef4444');
          if (isBlueDot) em.type = 'enemy-blue-dot';
          G.enemyMissiles.push(em);
        }
        SFX.missile(isBlueDot ? 'laser' : 'missile');
      } else if (e.fireCooldown <= 0) {
        e.fireCooldown = 18;
      }
      }
    }

    const ox = e.shakeTick > 0 ? (Math.random() - 0.5) * 5 : 0;
    const origX = e.x;
    e.x += ox;
    const bankAngle = (e.vx || 0) * 0.13;
    if (e.kamikaze && e.kamikazePhase !== 'enter') drawKamikazeMark(e);
    if (e.homingLockT != null) drawLockRing(e, e.homingLockT, HOMING_LOCK_FRAMES);
    drawEnemySprite(ctx, e, bankAngle);
    if (e.a330Boss && e.antiMissileActive) {
      const radius = e.antiMissileRadius || getEnemyDrawSize(e) * 0.78;
      const pulse = 0.5 + 0.5 * Math.sin((e.antiMissileCycle || 0) * 0.13);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(56,189,248,${0.48 + pulse * 0.34})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(e.x, e.y, radius * (0.94 + pulse * 0.06), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.restore();
    }
    e.x = origX;

    // Physical aircraft collision. Use an ellipse that follows the visible
    // sprite sizes, rather than the much smaller logical enemy size.
    if (_invincible <= 0 && !_stealthActive && e.active) {
      const enemyDrawSize = getEnemyDrawSize(e);
      const playerDrawSize = getPlayerSize();
      const dx = e.x - G.player.x;
      const dy = e.y - G.player.y;
      const hitWidth = enemyDrawSize * 0.34 + playerDrawSize * 0.30;
      const hitHeight = enemyDrawSize * 0.38 + playerDrawSize * 0.34;
      const aircraftTouching =
        (dx * dx) / (hitWidth * hitWidth) +
        (dy * dy) / (hitHeight * hitHeight) <= 1;
      if (aircraftTouching) onEnemyAircraftCollision(e);
    }

    if (e.label) {
      ctx.fillStyle    = 'rgba(255,255,255,0.8)';
      ctx.font         = isTouchMobile() ? 'bold 8px monospace' : 'bold 9px monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(e.label, e.x + ox, e.y - e.size - 6);
    }
  }

  // ── Player missiles — fixed path after launch ─────────────────────────────
  // ── Enemy missiles (with level-based guidance) ─────────────────────────
  updateAirdropXrayQuestionPause(ts || performance.now());
  updatePlayerAutoFire(ts || performance.now());
  updateMissiles(G.missiles, missile => {
    for (const enemy of G.enemies) {
      if (!enemy.active || enemy.turncoat) continue;
      const enemyDrawSize = getEnemyDrawSize(enemy);
      if (enemy.a330Boss && enemy.antiMissileActive) {
        const shieldRadius = enemy.antiMissileRadius || enemyDrawSize * 0.78;
        const shieldDx = missile.x - enemy.x;
        const shieldDy = missile.y - enemy.y;
        if ((missile.shieldBounceUntil || 0) <= tick &&
            shieldDx * shieldDx + shieldDy * shieldDy <= shieldRadius * shieldRadius) {
          const distance = Math.hypot(shieldDx, shieldDy) || 1;
          const normalX = shieldDx / distance;
          const normalY = shieldDy / distance;
          const velocityAlongNormal = missile.vx * normalX + missile.vy * normalY;
          missile.vx = (missile.vx - 2 * velocityAlongNormal * normalX) * 1.06;
          missile.vy = (missile.vy - 2 * velocityAlongNormal * normalY) * 1.06;
          // Place it just outside the energy field so it cannot become stuck
          // bouncing repeatedly on the same shield edge.
          missile.x = enemy.x + normalX * (shieldRadius + 5);
          missile.y = enemy.y + normalY * (shieldRadius + 5);
          missile.shieldBounceUntil = tick + 10;
          // A deflected homing missile would steer straight back into the
          // shield and bounce forever; it flies off in a straight line instead.
          missile.homing = false;
          spawnHitSpark(G.particles, missile.x, missile.y);
          return false;
        }
      }
      const hitHalfWidth = Math.max(28, enemyDrawSize * 0.48);
      const hitHalfHeight = Math.max(25, enemyDrawSize * 0.44);
      const dx = missile.x - enemy.x;
      const dy = missile.y - enemy.y;
      const insideAircraft =
        (dx * dx) / (hitHalfWidth * hitHalfWidth) +
        (dy * dy) / (hitHalfHeight * hitHalfHeight) <= 1;
      if (insideAircraft) {
        onMissileHit(enemy, missile);
        return true;
      }
    }
    return hitAirdrop(missile);
  }, _frameStep, (activeAircraftAbility().homing || homingUpgradeOwned() || coopBotAbility()?.homing)
    ? m => (m.allyHoming ? nearestEnemyTo(m.x, m.y) : nearestEnemyAheadOf(m))
    : m => (m.allyHoming ? nearestEnemyTo(m.x, m.y) : null));
  drawMissiles(ctx, G.missiles, false);

  for (let i = G.enemyMissiles.length - 1; i >= 0; i--) {
    const m  = G.enemyMissiles[i];
    const dx = m.x - G.player.x, dy = m.y - G.player.y;
    if (playerShieldActive(ts || performance.now())) {
      const shieldRadius = getPlayerSize() * 0.62;
      if ((m.playerShieldBounceUntil || 0) <= tick && dx * dx + dy * dy <= shieldRadius * shieldRadius) {
        const distance = Math.hypot(dx, dy) || 1;
        const normalX = dx / distance;
        const normalY = dy / distance;
        const velocityAlongNormal = m.vx * normalX + m.vy * normalY;
        m.vx = (m.vx - 2 * velocityAlongNormal * normalX) * 1.06;
        m.vy = (m.vy - 2 * velocityAlongNormal * normalY) * 1.06;
        m.x = G.player.x + normalX * (shieldRadius + 5);
        m.y = G.player.y + normalY * (shieldRadius + 5);
        m.playerShieldBounceUntil = tick + 10;
        spawnHitSpark(G.particles, m.x, m.y);
        continue;
      }
    }
    // F-16 ESQUIVE: enemy shots near the aircraft are pushed sideways so they
    // swerve around it, and cannot hit while the skill is active.
    const evading = aircraftSkillActive('evade', ts || performance.now())
      && dx * dx + dy * dy < F16_EVADE_RADIUS * F16_EVADE_RADIUS;
    if (evading) {
      const side = dx !== 0 ? Math.sign(dx) : (Math.random() < 0.5 ? -1 : 1);
      m.vx += side * 0.9 * _frameStep;
    }
    if (!_stealthActive && !evading && dx * dx + dy * dy < 22 * 22) {
      G.enemyMissiles.splice(i, 1);
      if (playerImmune()) {   // immune (question / 3 s after answering): the shot fizzles
        spawnHitSpark(G.particles, m.x, m.y);
        continue;
      }
      onEnemyMissileHit();
      break;
    }
    if (m.y > canvas.height + 40 || m.y < -80 || m.x < -60 || m.x > canvas.width + 60) {
      G.enemyMissiles.splice(i, 1); continue;
    }
    if (m.type === 'enemy-homing') steerHomingMissile(m);
    m.x += m.vx * _frameStep;
    m.y += m.vy * _frameStep;
    m.boltFrame = 0;

  }
  drawMissiles(ctx, G.enemyMissiles, true);

  // ── Machine gun (F/A-18) ───────────────────────────────────────────────
  // ── Particles ──────────────────────────────────────────────────────────
  updateParticles(G.particles);
  drawParticles(ctx, G.particles);
  drawBossDeaths(ts || performance.now());

  const nowForNuke = ts || performance.now();
  if (_nukeSweepUntil > nowForNuke) applyNuke();
  updateNukeButton(nowForNuke);

  // ── Player ─────────────────────────────────────────────────────────────
  if (_invincible > 0) _invincible--;
  // B-2 FURTIF ends with the button's real-time countdown, not a frame count
  // (frames run faster on 120 Hz screens and stop during questions).
  // It also switches off while the skill is paused and back on after.
  if (aircraftSkill()?.id === 'stealth') _stealthActive = aircraftSkillActive('stealth', ts || performance.now());
  const prevX = G.player.x;
  updatePlayerMovement();
  const _moveDelta = G.player.x - prevX;
  SFX.engineThrottle(Math.abs(_moveDelta) / 5);   // revs up while moving (keys or touch)
  const _targetTilt = _moveDelta > 0.5 ? 0.349 : _moveDelta < -0.5 ? -0.349 : 0;
  _bankTilt += (_targetTilt - _bankTilt) * Math.min(1, 0.1 * _turnRate());
  if (Math.abs(_bankTilt) < 0.001) _bankTilt = 0;
  const bankAngle = _bankTilt;
  // Aircraft with hand-drawn turn art (see hasTurnArt()) play a full roll
  // while turning left/right, instead of the generic flat-sprite rotation
  // every other aircraft still uses. Each direction: hold frames 0-9 while
  // turning, then frames 10-19 unwind back to level once the player lets go.
  const isTurningRightWithRollArt = hasTurnArt(G.activeAircraft, 'right') && _moveDelta > 0.5;
  const isTurningLeftWithRollArt  = hasTurnArt(G.activeAircraft, 'left')  && _moveDelta < -0.5;
  if (isTurningRightWithRollArt) {
    _turnRightFrame = Math.min(9, _turnRightFrame + _frameStep * 0.4);
  } else if (_turnRightFrame > 0) {
    _turnRightFrame += _frameStep * 0.4;
    if (_turnRightFrame >= 20) _turnRightFrame = 0;
  }
  if (isTurningLeftWithRollArt) {
    _turnLeftFrame = Math.min(9, _turnLeftFrame + _frameStep * 0.4);
  } else if (_turnLeftFrame > 0) {
    _turnLeftFrame += _frameStep * 0.4;
    if (_turnLeftFrame >= 20) _turnLeftFrame = 0;
  }
  // True while either turning (0-9) or unwinding (10-19) — normal flat-sprite
  // rendering only resumes once the relevant frame counter is back to 0.
  const showTurnRightRollArt = _turnRightFrame > 0;
  const showTurnLeftRollArt  = _turnLeftFrame > 0;
  const flashAlpha = _invincible > 0
    ? (Math.floor(_invincible / 6) % 2 === 0 ? 1.0 : 0.25)
    : _stealthActive
      ? 0.28 + 0.12 * Math.sin(tick * 0.18)  // slow ghost pulse
      : 1.0;

  const playerFloat = playerFloatOffset();
  const resumeOffset = resumePlaneOffset(ts || performance.now());
  const playerDrawX = G.player.x + playerFloat.x + resumeOffset.x;
  const playerDrawY = G.player.y + playerFloat.y + resumeOffset.y;
  updatePlayerShieldButton(ts || performance.now());
  updateAircraftTurboButton(ts || performance.now());
  updateAircraftRegen(ts || performance.now());
  const shootingPlan = activeShootingPlan();

  // Render the carrier, parachute crate, and its destruction effect behind
  // the player's aircraft.
  updateAirdrop(_frameStep, canvas.width, canvas.height,
    activeAircraftAbility().magnet ? C130_MAGNET_RADIUS : 0);
  // Airdrop crate held the (extremely rare) nuke: launch the nuclear strike.
  if (G.airdropNukePending) {
    G.airdropNukePending = false;
    launchNuke({ spareBosses: true });
  }
  // Airdrop crate held air support: a B-2 joins for 10 s.
  if (G.airdropSupportPending) {
    G.airdropSupportPending = false;
    startAirSupport(ts || performance.now());
  }
  updateGameCurrencyHUD();
  if (!isTutorialActive() && G.lives > _maxLives) {
    _maxLives = G.lives;
  }
  if (_lastHudLives !== G.lives) {
    _lastHudLives = G.lives;
    updateLivesHUD();
  }
  drawAirdrop(ctx, canvas.width, canvas.height);
  updateAndDrawAirSupport(ts || performance.now());
  updateAndDrawCoop(ts || performance.now());

  if (!_playerDestroyed && shootingPlan?.wingmen) {
    const wingSize = Math.max(46, Math.round(getPlayerSize() * (isTouchMobile() ? 0.78 : 0.68)));
    const wingOffset = wingmanSideOffset();
    const sideAlpha = flashAlpha * 0.94;
    const sideTilt = bankAngle * 0.45;
    drawAircraftSpriteSized(ctx, G.activeAircraft, playerDrawX - wingOffset, wingmanY(playerDrawY), wingSize, _shipFrame, sideAlpha, sideTilt);
    drawAircraftSpriteSized(ctx, G.activeAircraft, playerDrawX + wingOffset, wingmanY(playerDrawY), wingSize, _shipFrame, sideAlpha, sideTilt);
  }

  if (!_playerDestroyed) {
    if (showTurnRightRollArt) {
      const sz = getPlayerSize();
      drawFrame(ctx, `ship-${G.activeAircraft}-turn-right`, _turnRightFrame, playerDrawX, playerDrawY, sz, sz, { alpha: flashAlpha });
    } else if (showTurnLeftRollArt) {
      const sz = getPlayerSize();
      drawFrame(ctx, `ship-${G.activeAircraft}-turn-left`, _turnLeftFrame, playerDrawX, playerDrawY, sz, sz, { alpha: flashAlpha });
    } else {
      drawAircraftSprite(ctx, G.activeAircraft, playerDrawX, playerDrawY, _shipFrame, flashAlpha, bankAngle);
    }
    if (playerShieldActive(ts || performance.now())) {
      const radius = getPlayerSize() * 0.62;
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.13);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(56,189,248,${0.55 + pulse * 0.35})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(playerDrawX, playerDrawY, radius * (0.95 + pulse * 0.05), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.restore();
    }
    // 3 s immunity after an answer: a soft golden ring, fading at the end.
    const immuneLeft = _answerImmuneUntil - (ts || performance.now());
    if (immuneLeft > 0) {
      const fade = Math.min(1, immuneLeft / 800);
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * (0.45 + pulse * 0.3);
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(playerDrawX, playerDrawY, getPlayerSize() * (0.6 + pulse * 0.03), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (aircraftSkillActive('evade', ts || performance.now())) {
      // F-16 ESQUIVE: a spinning dashed green ring shows the dodge zone.
      ctx.save();
      ctx.strokeStyle = 'rgba(134,239,172,0.8)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 10;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -tick * 0.8;
      ctx.beginPath();
      ctx.arc(playerDrawX, playerDrawY, getPlayerSize() * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.globalAlpha = 1;

  // ── Weather (rain, storm, fog, snow…) over the whole playfield ──────────
  const weatherTarget = !_cutsceneActive && !_playerDestroyed ? G.player : null;
  for (const event of drawWeatherFx(ctx, canvas.width, canvas.height, _frameStep, weatherTarget)) {
    if (event.type === 'bolt') onLightningBolt(event.points);
  }
  SFX.weatherWind(windIntensity());
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

  // ── Nuke missile flight (before the blast) ─────────────────────────────
  if (_nukeMissileAnim > 0) {
    const p = 1 - _nukeMissileAnim / NUKE_MISSILE_FRAMES;          // 0 → 1
    SFX.nukeFlight(p);
    const ease = p * p * (3 - 2 * p);
    // Straight up from the aircraft, never sideways.
    const x = _nukeMissileFrom.x;
    const y = _nukeMissileFrom.y + (nukeBlastPoint().y - _nukeMissileFrom.y) * ease;
    // Grows as if it rises toward the screen, then shrinks back as if it
    // falls away again before hitting.
    const lift = Math.sin(p * Math.PI);
    const size = Math.min(canvas.width, canvas.height) * (0.12 + 0.3 * lift);
    // The 12-frame sheet is the missile spinning on itself; loop it quickly.
    const spinFrame = Math.floor(p * NUKE_MISSILE_FRAMES / 3) % 12;
    ctx.save();
    // Green radioactive glow: a cached halo, not shadowBlur (a blur this wide
    // on a sprite this big drops phones to a few frames per second).
    ctx.globalAlpha = 0.55 + 0.35 * lift;
    ctx.drawImage(nukeGlowSprite(), x - size * 0.75, y - size * 0.75, size * 1.5, size * 1.5);
    ctx.globalAlpha = 1;
    drawFrame(ctx, 'nuke-pivot', spinFrame, x, y, size, size);
    ctx.restore();
    _nukeMissileAnim--;
    if (_nukeMissileAnim <= 0) detonateNuke();
  }

  // ── Nuke animation overlay ─────────────────────────────────────────────
  if (_nukeAnim > 0) {
    if (_nukeAnim === 55 && !_nukeApplied) { _nukeApplied = true; applyNuke(); shakeGamePage(); }
    const t  = 1 - _nukeAnim / 90;          // 0 → 1 over the animation
    // The blast (and its shockwave) starts where the nuke missile landed.
    const { x: cx, y: cy } = nukeBlastPoint();

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
    if (t < 0.72) {
      const pass = Math.min(1, t / 0.72);
      const b2X = canvas.width / 2;
      const b2Y = canvas.height + 90 - pass * (canvas.height + 220);
      const b2Size = Math.min(canvas.width * 0.34, canvas.height * 0.24, 210);
      const tilt = Math.sin(pass * Math.PI) * 0.08;
      drawAircraftSprite(ctx, 'b2', b2X, b2Y, 0, 0.95, tilt);
      ctx.save();
      ctx.globalAlpha = 0.68 * (1 - Math.abs(pass - 0.45));
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath();
      ctx.ellipse(b2X - b2Size * 0.08, b2Y + b2Size * 0.34, b2Size * 0.05, b2Size * 0.18, 0, 0, Math.PI * 2);
      ctx.ellipse(b2X + b2Size * 0.08, b2Y + b2Size * 0.34, b2Size * 0.05, b2Size * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (t > 0.04 && t < 0.78) {
      const ta = t < 0.15 ? t / 0.15 : t > 0.62 ? (0.78 - t) / 0.16 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, ta);
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(canvas.height * 0.11)}px sans-serif`;
      ctx.fillStyle = t < 0.5 ? '#1a0000' : '#ff4400';
      ctx.fillText('NUKE', canvas.width / 2, canvas.height / 2);
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

  if (!_cutsceneActive) _queueFrame();
}

// ── COMBAT ──────────────────────────────────────────────────────────────────
function nearestEnemy() {
  let best = null, bestDist = Infinity;
  for (const e of G.enemies) {
    if (!e.active || e.turncoat) continue;
    const dx = e.x - G.player.x, dy = e.y - G.player.y;
    const d  = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

function activeShootingPlan() {
  return SHOOTING_PLANS.find(plan => plan.id === G.activeShootingPlan)
    || SHOOTING_PLANS.find(plan => plan.id === 'default')
    || SHOOTING_PLANS[0];
}

function activeAircraftAbility() {
  return AIRCRAFT[G.activeAircraft]?.ability || {};
}

function sourceForShot(shot) {
  const mobileScale = isTouchMobile() ? 0.72 : 1;
  const sideOffset = wingmanSideOffset();
  if (shot.source === 'leftWingman') {
    return { x: G.player.x - sideOffset, y: wingmanY(G.player.y) };
  }
  if (shot.source === 'rightWingman') {
    return { x: G.player.x + sideOffset, y: wingmanY(G.player.y) };
  }
  return {
    x: G.player.x + (shot.x || 0) * mobileScale,
    y: G.player.y - 42 + (shot.y || 0) * mobileScale,
  };
}

function wingmanSideOffset() {
  const size = getPlayerSize();
  return Math.max(size * 0.82, Math.min(canvas.width * (isTouchMobile() ? 0.23 : 0.18), size * 1.28));
}

function wingmanY(playerY) {
  return playerY + getPlayerSize() * 0.34;
}

function targetPointForShot(source, shot) {
  const angle = shot.angle || 0;
  const distance = Math.max(canvas.height * 1.4, 900);
  return {
    x: source.x + Math.sin(angle) * distance,
    y: source.y - Math.cos(angle) * distance,
  };
}

function firePlayerShootingPlan() {
  const plan = activeShootingPlan();
  const shots = Array.isArray(plan?.missiles) && plan.missiles.length
    ? plan.missiles
    : [{ x: 0, y: 0, angle: 0 }];
  if (!G.enemies.some(e => e.active)) return false;
  if (_coop?.mode === 'online' && !_coop.left) wsSend({ type: 'coop_shot', n: shots.length });

  const ability = activeAircraftAbility();
  const speed = (isTouchMobile() ? 9.8 : 8.4) * MISSILE_SPEED_SCALE * (ability.missileSpeed || 1);
  const burst = ability.burst ? burstActiveNow() : Boolean(ability.bonusShots);
  const aircraftShots = burst
    ? shots.flatMap(shot => [shot, { ...shot, x: (shot.x || 0) + 18, angle: (shot.angle || 0) + 0.025 }])
    : shots;
  // Hangar UPGRADE weapon (an aircraft's own special weapon still wins).
  const weapon = ability.weapon ? null : activeWeapon();
  // F-22 PRECISION or the hangar UPGRADE "homing missile".
  const homing = Boolean(ability.homing) || homingUpgradeOwned();
  for (const shot of aircraftShots) {
    const source = sourceForShot(shot);
    const target = targetPointForShot(source, shot);
    const damage = (shot.damage || 1) * (ability.damage || 1);
    if (ability.weapon === 'gau8') {
      // A-10 GAU-8: a burst of five heavy shells, each worth double damage.
      for (let b = 0; b < 5; b++) {
        const shell = createMissile(source.x, source.y + b * 20, target.x, target.y + b * 20, speed * 1.5, null, '#ffb347', damage * 2, homing);
        shell.fromPlayer = true;
        shell.type = 'player-gau8';
        G.missiles.push(shell);
      }
      continue;
    }
    if (weapon === 'machinegun') {
      // A short burst of three fast bullets, one behind the other.
      for (let b = 0; b < 3; b++) {
        const bullet = createMissile(source.x, source.y + b * 22, target.x, target.y + b * 22, speed * 1.35, null, '#fff6a8', damage, homing);
        bullet.fromPlayer = true;
        bullet.type = 'player-machine-gun';
        G.missiles.push(bullet);
      }
      continue;
    }
    const missile = createMissile(source.x, source.y, target.x, target.y, weapon === 'laser' ? speed * 1.8 : speed, null, ability.weapon === 'xray' ? '#ff2020' : '#00d4ff', damage, homing);
    missile.fromPlayer = true;
    missile.type = ability.weapon || (weapon === 'laser' ? 'player-laser' : G.activeMissileType || 'default');
    G.missiles.push(missile);
  }
  if (G.missiles.length) {
    SFX.shot(ability.weapon === 'gau8' || weapon === 'machinegun' ? 'gun'
      : ability.weapon === 'xray' || weapon === 'laser' ? 'laser' : 'missile');
  }
  return true;
}

// ── AIR SUPPORT (airdrop reward) ─────────────────────────────────────────────
// A B-2 glides in from behind the player to a spot just ahead of it, follows
// it for 10 s firing an orange laser at the nearest enemy every 0.5 s, then
// flies off forward and fades out.
const AIR_SUPPORT_MS = 10000;
const AIR_SUPPORT_ENTER_MS = 1100;
const AIR_SUPPORT_EXIT_MS = 1000;
const AIR_SUPPORT_SHOT_MS = 500;
let _airSupport = null;

function startAirSupport(now) {
  const size = getPlayerSize() * 1.35;
  _airSupport = {
    start: now,
    until: now + AIR_SUPPORT_ENTER_MS + (G.airdropSupportMs || AIR_SUPPORT_MS),
    nextShot: now + AIR_SUPPORT_ENTER_MS,
    x: G.player.x,
    y: canvas.height + size,
    size,
  };
  SFX.airdropPlane?.();
}

function updateAndDrawAirSupport(now) {
  const s = _airSupport;
  if (!s || !canvas || !G.player) return;
  const exitT = (now - s.until) / AIR_SUPPORT_EXIT_MS;
  if (exitT >= 1) { _airSupport = null; return; }

  // Formation spot: just ahead of the player, following it smoothly.
  const targetX = G.player.x;
  const targetY = Math.max(s.size * 0.6, G.player.y - getPlayerSize() * 1.9);
  const enterT = Math.min(1, (now - s.start) / AIR_SUPPORT_ENTER_MS);
  const enterEase = 1 - Math.pow(1 - enterT, 3);
  let alpha = Math.min(1, enterT * 1.6);
  if (enterT < 1) {
    s.x += (targetX - s.x) * Math.min(1, 0.12 * _frameStep);
    s.y = (canvas.height + s.size) + (targetY - (canvas.height + s.size)) * enterEase;
  } else if (exitT < 0) {
    s.x += (targetX - s.x) * Math.min(1, 0.06 * _frameStep);
    s.y += (targetY - s.y) * Math.min(1, 0.06 * _frameStep);
  } else {
    const k = exitT * exitT;
    s.y += (-s.size * 1.4 - s.y) * Math.min(1, k * 0.35 + 0.04);
    alpha = 1 - exitT;
  }

  // Lasers every 0.5 s at the nearest active enemy.
  if (enterT >= 1 && exitT < 0 && now >= s.nextShot && !_cutsceneActive) {
    s.nextShot = now + AIR_SUPPORT_SHOT_MS;
    let target = null, best = Infinity;
    for (const e of G.enemies) {
      if (!e.active || e.turncoat) continue;
      const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
      if (d < best) { best = d; target = e; }
    }
    if (target) {
      const speed = (isTouchMobile() ? 9.8 : 8.4) * MISSILE_SPEED_SCALE * 1.8;
      const noseY = s.y - s.size * 0.25;
      const laser = createMissile(s.x, noseY, target.x, target.y, speed, null, '#ff8a1f', 1, false);
      laser.fromPlayer = true;
      laser.type = 'player-laser';
      G.missiles.push(laser);
      SFX.shot('laser');
    }
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  const frame = Math.floor(now / 90) % 10;
  drawFrame(ctx, 'ship-b2', frame, s.x, s.y, s.size, s.size);
  // Short label while it arrives.
  if (now - s.start < 2200) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha, (2200 - (now - s.start)) / 500));
    ctx.textAlign = 'center';
    ctx.font = `bold ${isTouchMobile() ? 9 : 11}px 'Press Start 2P', monospace`;
    ctx.fillStyle = '#7fe8ff';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 6;
    ctx.fillText(getLang() === 'fr' ? 'SOUTIEN AÉRIEN' : 'AIR SUPPORT', s.x, s.y - s.size * 0.55);
  }
  ctx.restore();
}

// ── CO-OP TEAMMATE (MULTI screen, multiplayer.js) ───────────────────────────
// G.coopSession = { mode: 'bot' | 'online', partnerName, partnerAircraft }.
//  - bot: an allied plane flies in formation next to the player and fires at
//    the nearest enemy.
//  - online: the real teammate's plane follows the position they send (~15/s)
//    and each of their shots fires from their plane at our enemies, so both
//    players help each other in the same level.
const COOP_SEND_MS = 66;
// Bot teammate strength follows the level (1 -> 50): slower, less accurate
// and slower-moving at the start, sharper later — never stronger than the
// player's own help, never useless.
function coopBotSkill() {
  const f = Math.max(0, Math.min(1, ((levelCfg?.num || 1) - 1) / 49));
  return {
    shotMs: 1800 - 900 * f,          // 1.8 s -> 0.9 s between shots
    aimError: 60 - 45 * f,           // px of aim error at the target
    speed: 2.4 + 2.2 * f,            // px per frame
    thinkMs: 1500 - 600 * f,         // how often it picks a new plan
  };
}
// Teammate hearts: an enemy shot costs one heart; at 0 the teammate is down
// (faded, can't shoot or be hit). 3 correct answers from the player refill
// all its hearts (and bring it back).
const COOP_MAX_HP = 3;          // default hearts (real teammate, un-upgraded bot)
// Bot FIRE POWER upgrade (1-5): shots per volley and time between volleys.
const COOP_BOT_FIRE = [
  { shots: 1, rate: 1 }, { shots: 1, rate: 0.8 }, { shots: 2, rate: 0.8 },
  { shots: 2, rate: 0.65 }, { shots: 3, rate: 0.6 },
];
const COOP_HEAL_ANSWERS = 3;
const COOP_HIT_IMMUNE_MS = 1500;
let _coop = null;
let _coopHandlersReady = false;

function coopNotice(fr, en) {
  showTutorialNotice(getLang() === 'fr' ? fr : en, true, 2600);
}

function ensureCoopHandlers() {
  if (_coopHandlersReady) return;
  _coopHandlersReady = true;
  wsOn('coop_state', msg => {
    if (!_coop || _coop.mode !== 'online' || !canvas) return;
    _coop.tx = Math.max(0, Math.min(1, Number(msg.x) || 0)) * canvas.width;
    _coop.ty = Math.max(0, Math.min(1, Number(msg.y) || 0)) * canvas.height;
    if (msg.aircraft && AIRCRAFT[msg.aircraft] && msg.aircraft !== _coop.aircraft) {
      _coop.aircraft = msg.aircraft;
      preloadCoopSprites(msg.aircraft);
    }
    _coop.lastSeen = performance.now();
    if (!_coop.seen) { _coop.seen = true; _coop.x = _coop.tx; _coop.y = _coop.ty; }
  });
  wsOn('coop_shot', msg => {
    if (!_coop || _coop.mode !== 'online' || _coop.down) return;
    fireCoopShots(Math.max(1, Math.min(6, Number(msg.n) || 1)));
  });
  wsOn('coop_done', () => {
    if (!_coop) return;
    coopNotice(`${_coop.name} a terminé le niveau!`, `${_coop.name} finished the level!`);
  });
  wsOn('coop_partner_left', () => {
    if (!_coop || _coop.mode !== 'online') return;
    _coop.left = true;
    coopNotice(`${_coop.name} a quitté la partie.`, `${_coop.name} left the game.`);
  });
}

function startCoop() {
  const session = G.coopSession;
  if (!session || G.practiceMode || !canvas || !G.player) { _coop = null; return; }
  _coop = {
    mode: session.mode,
    name: String(session.partnerName || (session.mode === 'bot' ? 'BOT' : 'PILOT')).toUpperCase(),
    aircraft: AIRCRAFT[session.partnerAircraft] ? session.partnerAircraft : (session.mode === 'bot' ? 't6' : 'f18'),
    x: G.player.x - 90, y: G.player.y + getPlayerSize() * 1.5,
    nextThink: 0, targetEnemy: null,
    tx: G.player.x - 90, ty: G.player.y + 20,
    nextShot: 0, nextSend: 0, lastSeen: 0, seen: session.mode === 'bot', left: false,
    maxHp: session.mode === 'bot' ? Math.max(COOP_MAX_HP, Math.min(6, session.maxHp | 0)) : COOP_MAX_HP,
    fire: COOP_BOT_FIRE[Math.max(1, Math.min(5, session.fireLevel | 0 || 1)) - 1],
    hp: 0, down: false, healCount: 0, hitUntil: 0,
    turnRight: 0, turnLeft: 0,
  };
  _coop.hp = _coop.maxHp;
  // Bot: same ability as the plane in the hangar (see updateCoopBotAbility).
  _coop.ability = _coop.mode === 'bot' ? (AIRCRAFT[_coop.aircraft]?.ability || null) : null;
  _coop.nextRegen = performance.now() + PC21_REGEN_INTERVAL_MS;
  _coop.skillUntil = 0;
  _coop.skillReadyAt = performance.now() + COOP_BOT_SKILL_FIRST_MS;
  preloadCoopSprites(_coop.aircraft);
  if (_coop.mode === 'online') { ensureCoopHandlers(); G.coopLinkOpen = true; }
}

// -- BOT ABILITIES: the bot's plane works like the same plane in the hangar --
//  PC-21 REGEN: +1 heart every 18 s        C-130 MAGNET: catches nearby coins
//  A-10 GAU-8: extra heavy shell (x2 dmg)  F-16 EVASION: dodges shots 10 s / 30 s
//  F/A-18 BURST: one more shot per volley  F-22 PRECISION: shots never miss
//  F-35 GENIUS: +4 s to answer questions   B-2: stealth 10 s / 30 s + nuke
//  SR-71 TURBO: flies much faster
const COOP_BOT_SKILL_MS = 10000;
const COOP_BOT_SKILL_RECHARGE_MS = 30000;
const COOP_BOT_SKILL_FIRST_MS = 4000;
const COOP_BOT_MAGNET_RADIUS = 200;

function coopBotAbility() {
  return _coop && _coop.mode === 'bot' && !_coop.down ? _coop.ability : null;
}

// EVASION / STEALTH skill currently running?
function coopSkillActive(now = performance.now()) {
  const ab = coopBotAbility();
  return !!(ab && (ab.skill === 'evade' || ab.skill === 'stealth') && now < _coop.skillUntil);
}

function updateCoopBotAbility(now) {
  const ab = coopBotAbility();
  if (!ab || _cutsceneActive) return;
  if (ab.regen) {
    if (_coop.hp >= _coop.maxHp) _coop.nextRegen = now + PC21_REGEN_INTERVAL_MS;
    else if (now >= _coop.nextRegen) {
      _coop.hp++;
      _coop.nextRegen = now + PC21_REGEN_INTERVAL_MS;
      spawnHitSpark(G.particles, _coop.x, _coop.y);
    }
  }
  // The bot fires its skill on its own as soon as it is recharged.
  if ((ab.skill === 'evade' || ab.skill === 'stealth') && now >= _coop.skillReadyAt) {
    _coop.skillUntil = now + COOP_BOT_SKILL_MS;
    _coop.skillReadyAt = now + COOP_BOT_SKILL_MS + COOP_BOT_SKILL_RECHARGE_MS;
  }
}

// B-2 bot: nuclear bomb every Nth correct answer (skipped when the player's
// own B-2 already dropped one on that answer).
function coopMaybeNuke() {
  const every = coopBotAbility()?.nukeEveryCorrect;
  if (!every || !G.correctAnswers || G.correctAnswers % every !== 0) return;
  const own = AIRCRAFT[G.activeAircraft]?.ability?.nukeEveryCorrect;
  if (own && G.correctAnswers % own === 0) return;
  launchNuke({ spareBosses: true });
}

// C-130 bot: coins near the bot are pulled in and collected for the player.
function coopMagnetCoin(coin, step, size) {
  const ab = coopBotAbility();
  if (!ab?.magnet) return false;
  const dx = _coop.x - coin.x, dy = _coop.y - coin.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist > COOP_BOT_MAGNET_RADIUS) return false;
  const pull = Math.min(1, (0.1 * step) + (1 - dist / COOP_BOT_MAGNET_RADIUS) * 0.14 * step);
  coin.x += dx * pull;
  coin.y += dy * pull;
  return Math.hypot(_coop.x - coin.x, _coop.y - coin.y) <= size * 0.6;
}

// Who an enemy shoots at: the player, or the co-op teammate while it is still
// flying (more often when the teammate is the closer one in x).
function enemyAimTarget(e) {
  const mate = _coop && _coop.seen && !_coop.down && !(_coop.mode === 'online' && _coop.left)
    && !(coopBotAbility()?.skill === 'stealth' && coopSkillActive()) ? _coop : null;
  if (!mate) return G.player;
  const mateCloser = Math.abs(mate.x - e.x) < Math.abs(G.player.x - e.x);
  return Math.random() < (mateCloser ? 0.6 : 0.3) ? mate : G.player;
}

function preloadCoopSprites(aircraft) {
  preloadSprite(AIRCRAFT_SPRITE[aircraft] || 'ship-f18').catch(() => {});
  for (const dir of ['left', 'right']) {
    if (hasTurnArt(aircraft, dir)) preloadSprite(`ship-${aircraft}-turn-${dir}`).catch(() => {});
  }
}

// Enemy shots hitting the teammate's plane.
function coopCheckHits(now, size) {
  if (_coop.down || (_coop.mode === 'online' && _coop.left)) return;
  const r = size * 0.3;
  for (let i = G.enemyMissiles.length - 1; i >= 0; i--) {
    const m = G.enemyMissiles[i];
    const dx = m.x - _coop.x, dy = m.y - _coop.y;
    if (coopSkillActive(now)) {
      // F-16 EVASION pushes nearby shots aside; B-2 STEALTH lets them pass.
      if (coopBotAbility().skill === 'evade' && dx * dx + dy * dy < F16_EVADE_RADIUS * F16_EVADE_RADIUS) {
        m.vx += (dx !== 0 ? Math.sign(dx) : 1) * 0.9 * _frameStep;
      }
      continue;
    }
    if (dx * dx + dy * dy > r * r) continue;
    G.enemyMissiles.splice(i, 1);
    if (now < _coop.hitUntil) { spawnHitSpark(G.particles, m.x, m.y); continue; }
    _coop.hp--;
    _coop.hitUntil = now + COOP_HIT_IMMUNE_MS;
    spawnExplosion(G.particles, _coop.x, _coop.y, '#7dd3fc', 10);
    if (_coop.hp <= 0) {
      _coop.hp = 0;
      _coop.down = true;
      _coop.targetEnemy = null;
      spawnExplosion(G.particles, _coop.x, _coop.y, '#ef4444', 24);
      coopNotice(`${_coop.name} est touché! 3 bonnes réponses pour le réparer`,
        `${_coop.name} is down! 3 correct answers to repair it`);
    }
    break;
  }
}

// Called on each correct answer: after 3, the teammate gets all hearts back.
function coopOnCorrectAnswer() {
  if (!_coop || _coop.hp >= _coop.maxHp) return;
  _coop.healCount++;
  if (_coop.healCount < COOP_HEAL_ANSWERS) return;
  const wasDown = _coop.down;
  _coop.hp = _coop.maxHp;
  _coop.down = false;
  _coop.healCount = 0;
  _coop.hitUntil = performance.now() + COOP_HIT_IMMUNE_MS;
  trackMission('coop_heals', 1);
  spawnHitSpark(G.particles, _coop.x, _coop.y);
  coopNotice(wasDown ? `${_coop.name} est de retour!` : `${_coop.name} a toutes ses vies!`,
    wasDown ? `${_coop.name} is back!` : `${_coop.name} is fully repaired!`);
}

function drawCoopHearts(x, y, size) {
  const s = Math.max(5, size * 0.07);
  const gap = s * 2.6;
  for (let i = 0; i < _coop.maxHp; i++) {
    const hx = x + (i - (_coop.maxHp - 1) / 2) * gap;
    ctx.beginPath();
    ctx.moveTo(hx, y + s * 0.9);
    ctx.bezierCurveTo(hx - s * 1.3, y - s * 0.1, hx - s * 0.7, y - s * 1.1, hx, y - s * 0.35);
    ctx.bezierCurveTo(hx + s * 0.7, y - s * 1.1, hx + s * 1.3, y - s * 0.1, hx, y + s * 0.9);
    ctx.fillStyle = i < _coop.hp ? '#ef4444' : 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
  }
  // Repair progress while damaged: small dots under the hearts.
  if (_coop.hp < _coop.maxHp) {
    for (let i = 0; i < COOP_HEAL_ANSWERS; i++) {
      ctx.beginPath();
      ctx.arc(x + (i - 1) * s * 1.6, y + s * 2, s * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = i < _coop.healCount ? '#4ade80' : 'rgba(255,255,255,0.25)';
      ctx.fill();
    }
  }
}

// Same roll animation as the player's plane: frames 0-9 while turning,
// 10-19 to unwind back to level.
function updateCoopTurn(moveDelta) {
  const step = _frameStep * 0.4;
  if (hasTurnArt(_coop.aircraft, 'right') && moveDelta > 0.5 && !_coop.turnLeft) {
    _coop.turnRight = Math.min(9, _coop.turnRight + step);
  } else if (_coop.turnRight > 0) {
    _coop.turnRight += step;
    if (_coop.turnRight >= 20) _coop.turnRight = 0;
  }
  if (hasTurnArt(_coop.aircraft, 'left') && moveDelta < -0.5 && !_coop.turnRight) {
    _coop.turnLeft = Math.min(9, _coop.turnLeft + step);
  } else if (_coop.turnLeft > 0) {
    _coop.turnLeft += step;
    if (_coop.turnLeft >= 20) _coop.turnLeft = 0;
  }
}

// The link to a real teammate stays open after the level ends, so RETRY
// (game over / pause screen) replays with the same teammate. It is closed by
// leaveCoopLink() when the player goes back to the lobby or starts another game.
function stopCoop(levelWon = false) {
  if (!_coop) return;
  if (_coop.mode === 'online' && levelWon) wsSend({ type: 'coop_done' });
  _coop = null;
}

export function leaveCoopLink() {
  if (!G.coopLinkOpen) return;
  G.coopLinkOpen = false;
  wsSend({ type: 'coop_leave' });
  wsDisconnect();
}

function nearestEnemyTo(x, y) {
  let target = null, best = Infinity;
  for (const e of G.enemies) {
    if (!e.active || e.holdEntry || e.turncoat) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < best) { best = d; target = e; }
  }
  return target;
}

// Shots fired from the teammate's plane at the nearest enemy.
function fireCoopShots(count = 1, forcedTarget = null, aimError = 0) {
  if (!_coop || !canvas || _cutsceneActive) return;
  const target = forcedTarget || nearestEnemyTo(_coop.x, _coop.y);
  if (!target) return;
  const miss = aimError ? (Math.random() - 0.5) * 2 * aimError : 0;
  const speed = (isTouchMobile() ? 9.8 : 8.4) * MISSILE_SPEED_SCALE;
  const noseY = _coop.y - getPlayerSize() * 0.4;
  for (let i = 0; i < count; i++) {
    const spread = (i - (count - 1) / 2) * 14;
    const ab = coopBotAbility();
    const gau8 = ab?.weapon === 'gau8';
    const shot = createMissile(_coop.x + spread, noseY, target.x + spread + miss, target.y, speed, null,
      gau8 ? '#ffd34d' : '#7dd3fc', gau8 ? 2 : 1, !!ab?.homing);
    shot.fromPlayer = true;
    G.missiles.push(shot);
  }
  SFX.shot(coopBotAbility()?.weapon === 'gau8' ? 'gun' : 'missile');
}

// Bot teammate "brain": it flies on its own (never just follows the player).
// Every so often it picks an enemy to hunt and slides under it, keeps its
// distance from the player, sidesteps enemy shots coming at it, and fires
// with a level-based rate and accuracy (coopBotSkill).
function updateCoopBot(now, size) {
  if (_coop.down) {
    // Down: drifts gently, but still never hides under the question panel.
    const lowY = Math.max(canvas.height * 0.3, _playerLowerLimitY());
    if (_coop.y > lowY) _coop.y = Math.max(lowY, _coop.y - 6 * _frameStep);
    return;
  }
  const skill = coopBotSkill();
  // Same vertical zone as the player: never under the question panel.
  const maxY = Math.max(canvas.height * 0.3, _playerLowerLimitY());
  const minY = Math.min(canvas.height * 0.45, maxY - size);

  if (now >= _coop.nextThink || (_coop.targetEnemy && !_coop.targetEnemy.active)) {
    _coop.nextThink = now + skill.thinkMs * (0.8 + Math.random() * 0.4);
    // Hunt one of the 3 closest enemies (not always the same as the player).
    const enemies = G.enemies.filter(e => e.active && !e.holdEntry && !e.turncoat)
      .sort((a, b) => Math.abs(a.x - _coop.x) - Math.abs(b.x - _coop.x));
    _coop.targetEnemy = enemies.length ? enemies[Math.floor(Math.random() * Math.min(3, enemies.length))] : null;
    _coop.tx = _coop.targetEnemy
      ? _coop.targetEnemy.x + (Math.random() - 0.5) * skill.aimError
      : size + Math.random() * (canvas.width - size * 2);
    _coop.ty = minY + Math.random() * (maxY - minY);
  } else if (_coop.targetEnemy) {
    // Keep sliding under the hunted enemy as it moves.
    _coop.tx += (_coop.targetEnemy.x - _coop.tx) * 0.02 * _frameStep;
  }

  // Stay out of the player's way.
  const gap = size * 1.25;
  if (Math.abs(_coop.tx - G.player.x) < gap && Math.abs(_coop.ty - G.player.y) < gap) {
    _coop.tx = G.player.x + (_coop.tx >= G.player.x ? gap : -gap);
    if (_coop.tx < size * 0.6 || _coop.tx > canvas.width - size * 0.6) _coop.tx = G.player.x - (_coop.tx - G.player.x);
  }
  // Sidestep an enemy shot heading at it.
  for (const m of G.enemyMissiles) {
    const dx = m.x - _coop.x, dy = _coop.y - m.y;
    if (dy > 0 && dy < 160 && Math.abs(dx) < size * 0.5) {
      _coop.tx = _coop.x + (dx > 0 ? -1 : 1) * size;
      break;
    }
  }
  _coop.tx = Math.max(size * 0.6, Math.min(canvas.width - size * 0.6, _coop.tx));
  _coop.ty = Math.max(minY, Math.min(maxY, _coop.ty));

  // Move at a limited speed (level-based) instead of snapping.
  const dx = _coop.tx - _coop.x, dy = _coop.ty - _coop.y;
  const dist = Math.hypot(dx, dy);
  const stepLen = skill.speed * (_coop.ability?.turbo ? 1.8 : 1) * _frameStep;
  if (dist > stepLen) { _coop.x += dx / dist * stepLen; _coop.y += dy / dist * stepLen; }
  else { _coop.x = _coop.tx; _coop.y = _coop.ty; }
  // The question panel just appeared over it: climb out from under it fast.
  if (_coop.y > maxY) _coop.y = Math.max(maxY, _coop.y - stepLen * 3);

  // Fire at its target (or the closest enemy) with level-based accuracy.
  if (!_cutsceneActive && now >= _coop.nextShot) {
    const target = (_coop.targetEnemy?.active && _coop.targetEnemy) || nearestEnemyTo(_coop.x, _coop.y);
    if (target) {
      _coop.nextShot = now + skill.shotMs * _coop.fire.rate * (0.85 + Math.random() * 0.3);
      const ab = _coop.ability || {};
      const shots = _coop.fire.shots + (ab.burst ? 1 : 0) + (ab.weapon === 'gau8' ? 1 : 0);
      fireCoopShots(shots, target, ab.homing ? 0 : skill.aimError);
    }
  }
}

function updateAndDrawCoop(now) {
  if (!_coop || !canvas || !G.player) return;
  const size = getPlayerSize();
  const prevX = _coop.x;
  if (_coop.mode === 'bot') {
    updateCoopBot(now, size);
  } else if (!_coop.left && now >= _coop.nextSend) {
    _coop.nextSend = now + COOP_SEND_MS;
    wsSend({
      type: 'coop_state',
      x: +(G.player.x / canvas.width).toFixed(4),
      y: +(G.player.y / canvas.height).toFixed(4),
      aircraft: G.activeAircraft,
    });
  }
  if (!_coop.seen) return;
  if (_coop.mode !== 'bot') {
    const k = Math.min(1, 0.3 * _frameStep);
    _coop.x += (_coop.tx - _coop.x) * k;
    _coop.y += (_coop.ty - _coop.y) * k;
  }

  updateCoopTurn(_coop.x - prevX);
  updateCoopBotAbility(now);
  coopCheckHits(now, size);

  // Online: fade the teammate out if nothing arrived for a while; down
  // teammates are faded too, and blink right after a hit.
  const stale = _coop.mode === 'online' && (_coop.left || now - _coop.lastSeen > 3000);
  const blink = !_coop.down && now < _coop.hitUntil && Math.floor(now / 100) % 2 === 0;
  ctx.save();
  const skillOn = coopSkillActive(now);
  const ghost = skillOn && _coop.ability?.skill === 'stealth';
  ctx.globalAlpha = stale || _coop.down ? 0.3 : blink ? 0.35 : ghost ? 0.3 + 0.12 * Math.sin(now / 90) : 1;
  if (_coop.turnRight > 0) {
    drawFrame(ctx, `ship-${_coop.aircraft}-turn-right`, _coop.turnRight, _coop.x, _coop.y, size, size);
  } else if (_coop.turnLeft > 0) {
    drawFrame(ctx, `ship-${_coop.aircraft}-turn-left`, _coop.turnLeft, _coop.x, _coop.y, size, size);
  } else {
    drawAircraftSprite(ctx, _coop.aircraft, _coop.x, _coop.y, _shipFrame, 1, 0);
  }
  ctx.globalAlpha = 1;
  if (skillOn && _coop.ability?.skill === 'evade') {
    ctx.strokeStyle = `rgba(125,211,252,${0.45 + 0.3 * Math.sin(now / 120)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(_coop.x, _coop.y, size * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Hearts just above the plane, the name above them (under the plane they
  // would hide behind the answer panel).
  const heartsY = _coop.y - size * 0.58;
  drawCoopHearts(_coop.x, heartsY, size);
  ctx.textAlign = 'center';
  ctx.font = `bold ${isTouchMobile() ? 8 : 10}px 'Press Start 2P', monospace`;
  ctx.fillStyle = '#7dd3fc';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 5;
  ctx.fillText(_coop.name, _coop.x, heartsY - Math.max(5, size * 0.07) * 2.2);
  ctx.restore();
}

function fireAirdropXray() {
  if (!G.enemies.some(e => e.active)) return false;
  const sourceX = G.player.x;
  const sourceY = G.player.y - 42;
  const missile = createMissile(
    sourceX, sourceY, sourceX, sourceY - Math.max(canvas.height * 1.4, 900),
    (isTouchMobile() ? 11.2 : 9.6) * MISSILE_SPEED_SCALE,
    null, '#ff2020', 1,
  );
  missile.fromPlayer = true;
  missile.type = 'xray';
  G.missiles.push(missile);
  SFX.shot('laser');
  return true;
}

// Airdrop machine gun: a burst of 3 round bullets at the nearest enemy.
function fireAirdropMachineGun() {
  let target = null, best = Infinity;
  for (const e of G.enemies) {
    if (!e.active || e.turncoat) continue;
    const d = (e.x - G.player.x) ** 2 + (e.y - G.player.y) ** 2;
    if (d < best) { best = d; target = e; }
  }
  if (!target) return false;
  const speed = (isTouchMobile() ? 9.8 : 8.4) * MISSILE_SPEED_SCALE * 1.35;
  const sourceY = G.player.y - getPlayerSize() * 0.4;
  for (let b = -1; b <= 1; b++) {
    const bullet = createMissile(G.player.x + b * 12, sourceY + Math.abs(b) * 10, target.x + b * 12, target.y, speed, null, '#fff6a8', 1);
    bullet.fromPlayer = true;
    bullet.type = 'player-machine-gun';
    G.missiles.push(bullet);
  }
  SFX.shot('gun');
  return true;
}

function updateAirdropXrayQuestionPause(now = performance.now()) {
  const active = (G.airdropXrayUntil || 0) > now;
  const qbox = document.getElementById('question-box');

  if (active) {
    if (!G.airdropXrayQuestionPaused) {
      G.airdropXrayQuestionPaused = true;
      G.airdropXrayResumeQuestion = false;
    }

    // A delayed nextQuestion() may run after the laser has already started.
    // Re-cancel any equation and timer that appears during the whole bonus.
    const questionNeedsPause = !!G.question && !G.answerLocked;
    if (questionNeedsPause) G.airdropXrayResumeQuestion = true;
    if (G.timerInterval) {
      clearInterval(G.timerInterval);
      G.timerInterval = null;
    }
    if (qbox) {
      qbox.classList.add('shooting-hidden');
      qbox.style.visibility = 'hidden';
    }
  } else if (!active && G.airdropXrayQuestionPaused) {
    const shouldResume = G.airdropXrayResumeQuestion && !G.answerLocked;
    G.airdropXrayQuestionPaused = false;
    G.airdropXrayResumeQuestion = false;
    if (shouldResume && qbox) {
      qbox.classList.remove('shooting-hidden', 'fading', 'question-inactive');
      qbox.style.visibility = '';
      void qbox.offsetWidth;
      qbox.classList.add('resume-appearing');
      setTimeout(() => qbox.classList.remove('resume-appearing'), 420);
      startTimer(false);
    }
  }
}

function updatePlayerAutoFire(now = performance.now()) {
  const plan = activeShootingPlan();
  const xrayActive = (G.airdropXrayUntil || 0) > now;
  const machineGunActive = xrayActive && G.airdropWeapon === 'machinegun';
  const cadenceMs = machineGunActive ? 300 : xrayActive ? 500 : Math.max(0.35, shotDelaySeconds(Number(plan?.cadence || 5) * (activeAircraftAbility().fireRate || 1))) * 1000;
  const inShootingWindow = xrayActive || _shootingWindowUntil > now;

  if (G.airdropXrayShotReset) {
    G.airdropXrayShotReset = false;
    _nextPlayerShotAt = now;
  }

  // Weapons are a reward for a correct answer. Never carry a queued shot
  // into the question phase or into the next shooting window.
  if (!inShootingWindow) {
    _nextPlayerShotAt = 0;
    return;
  }
  if (_cutsceneActive || _transitioning || _correctionWaiting || !G.enemies.some(e => e.active)) {
    return;
  }
  if (!_nextPlayerShotAt) _nextPlayerShotAt = now + cadenceMs;
  if (now < _nextPlayerShotAt) return;
  const fired = machineGunActive ? fireAirdropMachineGun()
    : xrayActive ? fireAirdropXray()
    : firePlayerShootingPlan();
  _nextPlayerShotAt = now + (fired ? cadenceMs : 500);
}

function hasNukePlanEquipped() {
  return G.activeShootingPlan === 'blackbird_overload';
}

function updateNukeButton(now = performance.now()) {
  const btn = $('btn-nuke-strike');
  if (!btn) return;
  const enabled = hasNukePlanEquipped() && !isTutorialActive();
  btn.classList.toggle('hidden', !enabled);
  if (!enabled) return;

  const remaining = Math.max(0, _nukeReadyAt - now);
  if (remaining > 0) {
    btn.disabled = true;
    btn.textContent = `B-2 ${Math.ceil(remaining / 1000)}s`;
  } else if (_nukeSweepUntil > now) {
    btn.disabled = true;
    btn.textContent = 'NUKE';
  } else {
    btn.disabled = false;
    btn.textContent = getLang() === 'fr' ? 'B-2 PRET' : 'B-2 READY';
  }
}

function triggerNukeStrike() {
  const now = performance.now();
  if (!hasNukePlanEquipped() || isTutorialActive() || now < _nukeReadyAt) return;
  launchNuke();
  _nukeReadyAt = now + NUKE_COOLDOWN_MS;
  updateNukeButton(now);
}

// Plays the nuke flash and wipes the screen. spareBosses keeps bosses alive
// (the B-2 drops one every 5 correct answers, so it must not one-shot them);
// its sweep is also short so new enemies can keep arriving.
// Before the blast, the spinning nuke missile flies from the player's
// aircraft to the centre of the screen; the explosion starts on arrival.
const NUKE_MISSILE_FRAMES = 300;  // 5 s at 60 fps
let _nukeSparesBosses = false;
let _nukeMissileAnim = 0;
let _nukeMissileFrom = { x: 0, y: 0 };
let _nukePendingSweepMs = 0;
function launchNuke({ spareBosses = false } = {}) {
  if (_nukeMissileAnim > 0 || _nukeAnim > 0) return;   // one bomb at a time
  _nukeSparesBosses = spareBosses;
  _nukePendingSweepMs = spareBosses ? 1500 : NUKE_SWEEP_MS;
  _nukeMissileFrom = { x: G.player.x, y: G.player.y - getPlayerSize() * 0.4 };
  _nukeMissileAnim = NUKE_MISSILE_FRAMES;
  SFX.nukeLaunch();
}

// Shakes the whole game page (canvas, HUD and question panel) a little right
// after the nuke blast. Restarting the class replays the CSS animation.
// Music during play: the world's boss theme on boss levels, else the level theme.
function levelMusicKey() {
  return levelCfg?.isBossLevel ? `boss-${levelCfg.biome}` : 'game';
}

function shakeGamePage() {
  const page = document.getElementById('s-game');
  if (!page) return;
  page.classList.remove('nuke-shake');
  void page.offsetWidth;
  page.classList.add('nuke-shake');
  setTimeout(() => page.classList.remove('nuke-shake'), 700);
}

// ── BOSS DEATH ───────────────────────────────────────────────────────────────
// Every destroyed boss gets a big finale instead of a normal explosion:
//   0 – 1.1 s  the wreck shudders, flashes red and sinks while explosions
//              chain across its hull (the screen rumbles);
//   1.1 s      final blast: white flash, huge fireball, two shockwaves,
//              burning debris flying out, strong screen shake;
//   → 2.4 s    the smoke and debris fade out. Boss levels end after that.
// Kept in its own list: G.particles only keeps the last 24 effects.
const BOSS_BOOM_MS  = 1100;
const BOSS_DEATH_MS = 2400;
const BOSS_DEBRIS_COLORS = ['#fff3b0', '#ffd166', '#ff9f1c', '#ff5400', '#c1121f', '#3d3d3d'];
let _bossDeaths = [];
let _bigShakeUntil = 0;

function startBossDeath(boss) {
  const now = performance.now();
  const size = getEnemyDrawSize(boss) || boss.size || 160;
  const blasts = [];
  for (let i = 0; i < 11; i++) {
    const fire = i % 3 !== 0;
    blasts.push({
      at: i * 95 + Math.random() * 50,
      dx: (Math.random() - 0.5) * size * 0.85,
      dy: (Math.random() - 0.5) * size * 0.6,
      key: fire ? 'explosion-fire' : 'enemy-death',
      first: fire ? 4 : 0,
      frames: fire ? 12 : 7,
      size: size * (0.35 + Math.random() * 0.35),
    });
  }
  const debris = [];
  for (let i = 0; i < 34; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = (3 + Math.random() * 10) * (size / 160);
    debris.push({
      x: 0, y: 0,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 2,
      r: 2 + Math.random() * 6 * (size / 160),
      rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.4,
      color: BOSS_DEBRIS_COLORS[i % BOSS_DEBRIS_COLORS.length],
    });
  }
  _bossDeaths.push({
    boss: { ...boss, active: true, spawnAlpha: 1 },
    x: boss.x, y: boss.y, size, start: now, blasts, debris, boomed: false,
  });
  shakeFrames = Math.max(shakeFrames, 70);
  SFX.explode();
}

function drawBossDeaths(now) {
  if (!_bossDeaths.length) return;
  const step = _frameStep || 1;
  for (let i = _bossDeaths.length - 1; i >= 0; i--) {
    const d = _bossDeaths[i];
    const t = now - d.start;
    if (t > BOSS_DEATH_MS) { _bossDeaths.splice(i, 1); continue; }

    // 1) The wreck: shudders, blinks red/white and sinks, until the blast.
    if (t < BOSS_BOOM_MS) {
      const k = t / BOSS_BOOM_MS;
      d.boss.x = d.x + (Math.random() - 0.5) * 10 * (0.4 + k);
      d.boss.y = d.y + k * k * d.size * 0.12 + (Math.random() - 0.5) * 6;
      // Blinks between its normal colours and red-hot, faster near the end.
      const blinkMs = 110 - 70 * k;
      d.boss.spriteFilter = Math.floor(t / blinkMs) % 2
        ? 'sepia(1) saturate(7) hue-rotate(-35deg) brightness(1.15)'
        : `brightness(${1 - 0.35 * k})`;
      drawEnemySprite(ctx, d.boss, Math.sin(t / 90) * 0.06 * k);
    }

    // 2) Chain of explosions across the hull.
    for (const b of d.blasts) {
      const bt = t - b.at;
      if (bt < 0) continue;
      const frame = b.first + bt / 1000 * 60 * 0.4;
      if (frame >= b.frames) continue;
      drawFrame(ctx, b.key, frame, d.x + b.dx, d.y + b.dy, b.size, b.size);
    }

    // 3) Final blast.
    if (t >= BOSS_BOOM_MS) {
      if (!d.boomed) {
        d.boomed = true;
        _bigShakeUntil = now + 650;
        shakeFrames = Math.max(shakeFrames, 40);
        shakeGamePage();
        SFX.explode();
      }
      const bt = t - BOSS_BOOM_MS;
      const k = bt / (BOSS_DEATH_MS - BOSS_BOOM_MS);   // 0 → 1

      // White flash over the whole screen.
      const flash = Math.max(0, 1 - bt / 380);
      if (flash > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255,250,235,${0.9 * flash})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Hot core glow.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, 1 - k * 1.3);
      const coreR = d.size * (0.6 + k * 1.4);
      const core = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, coreR);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.25, '#ffe066');
      core.addColorStop(0.6, '#ff5400');
      core.addColorStop(1, 'rgba(120,0,0,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(d.x, d.y, coreR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Huge fireball sprite.
      const fbFrame = bt / 1000 * 60 * 0.3;
      if (fbFrame < 12) {
        const fb = d.size * 2.3;
        drawFrame(ctx, 'explosion-nuke', fbFrame, d.x, d.y, fb, fb);
      }

      // Two shockwave rings.
      const maxR = Math.hypot(canvas.width, canvas.height) * 0.75;
      for (const [delay, color, width] of [[0, '255,230,120', 16], [140, '255,90,0', 9]]) {
        const rt = (bt - delay) / 900;
        if (rt <= 0 || rt >= 1) continue;
        ctx.save();
        ctx.globalAlpha = 1 - rt;
        ctx.strokeStyle = `rgb(${color})`;
        ctx.lineWidth = width * (1 - rt * 0.6);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size * 0.3 + maxR * (1 - Math.pow(1 - rt, 3)), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Burning debris.
      ctx.save();
      for (const p of d.debris) {
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.vy += 0.18 * step;
        p.vx *= Math.pow(0.985, step);
        p.rot += p.spin * step;
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(d.x + p.x, d.y + p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
        ctx.restore();
      }
      ctx.restore();

      // Rising smoke: soft dark puffs that spread out and fade.
      if (bt > 250) {
        ctx.save();
        const sk = (bt - 250) / (BOSS_DEATH_MS - BOSS_BOOM_MS - 250);
        for (let s = 0; s < 7; s++) {
          const a = (s / 7) * Math.PI * 2 + 0.4;
          const r = d.size * (0.2 + sk * 0.6);
          const px = d.x + Math.cos(a) * r;
          const py = d.y + Math.sin(a) * r * 0.55 - sk * d.size * 0.35;
          const pr = d.size * (0.22 + sk * 0.3);
          const puff = ctx.createRadialGradient(px, py, 0, px, py, pr);
          puff.addColorStop(0, 'rgba(40,36,34,0.55)');
          puff.addColorStop(1, 'rgba(40,36,34,0)');
          ctx.globalAlpha = Math.max(0, 1 - sk) * Math.min(1, (bt - 250) / 200);
          ctx.fillStyle = puff;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }
}

// Storm lightning: every bolt shakes the screen; a bolt that touches the
// aircraft costs a heart, exactly like an enemy missile hit.
function distanceToPolyline(px, py, points) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    best = Math.min(best, Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)));
  }
  return best;
}

function onLightningBolt(points) {
  shakeGamePage();
  SFX.thunder();
  if (_cutsceneActive || _playerDestroyed || _invincible > 0 || _stealthActive) return;
  if (playerShieldActive()) return;
  if (distanceToPolyline(G.player.x, G.player.y, points) <= getPlayerSize() * 0.35) {
    onEnemyMissileHit();
  }
}

// Where the nuke lands: straight above the launch point, in the upper part
// of the screen.
let _nukeGlow = null;
function nukeGlowSprite() {
  if (_nukeGlow) return _nukeGlow;
  _nukeGlow = document.createElement('canvas');
  _nukeGlow.width = _nukeGlow.height = 128;
  const g = _nukeGlow.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, 'rgba(182,255,59,0.9)');
  grad.addColorStop(0.45, 'rgba(182,255,59,0.35)');
  grad.addColorStop(1, 'rgba(182,255,59,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return _nukeGlow;
}

function nukeBlastPoint() {
  return { x: _nukeMissileFrom.x, y: canvas.height * 0.32 };
}

function detonateNuke() {
  _nukeAnim = 90;
  _nukeApplied = false;
  _nukeSweepUntil = performance.now() + _nukePendingSweepMs;
  _nukedBosses = new Set();
  G.enemyMissiles = [];
  SFX.nukeBlast();
}

function applyNuke() {
  const toRemove = [];
  for (const e of G.enemies) {
    if (!e.active) continue;
    if (e.type === 'boss' && _nukeSparesBosses) continue;
    if (e.type === 'boss' && _nukedBosses.has(e)) continue;
    if (e.type === 'boss') {
      _nukedBosses.add(e);
      startBossDeath(e);
      if (levelCfg.isBossLevel) setTimeout(() => endLevel(true), BOSS_DEATH_MS);
    }
    else spawnExplosion(G.particles, e.x, e.y, e.color, 22);
    SFX.explode();
    toRemove.push(e);
  }
  toRemove.forEach(e => { e.active = false; });
  G.enemies = G.enemies.filter(e => e.active);
}

const MISSILE_HIT_RECOVERY_MS = 3000;
const MISSILE_HIT_FEEDBACK_MS = 450;

function airdropShieldActive() {
  return performance.now() < (G.airdropShieldUntil || 0);
}

// The player cannot be hurt (enemy shots fizzle, enemy planes pass through):
//  - while a question is waiting for an answer, so a hit can never skip or
//    change the current question;
//  - for 3 s after answering it (right, wrong or time out);
//  - while the wrong-answer correction is shown, then 3 s more from the tap
//    on CONTINUE (the 3 s start when the game starts moving again).
const ANSWER_IMMUNE_MS = 3000;
let _answerImmuneUntil = 0;

function answeringQuestion() {
  return !!G.question && !G.answerLocked;
}

function playerImmune(now = performance.now()) {
  // Nothing can hurt the player while the wrong-answer correction is shown.
  return _correctionWaiting || answeringQuestion() || now < _answerImmuneUntil;
}

function onEnemyMissileHit() {
  if (G.lives <= 0 || _invincible > 0) return;
  if (playerImmune()) return;
  if (airdropShieldActive()) return;
  G.missileHitsReceived = (G.missileHitsReceived || 0) + 1;
  if (!G.practiceMode && G.currentLevel <= 30) {
    G.sr71MissileHits = (G.sr71MissileHits || 0) + 1;
    save('sr71MissileHits', G.sr71MissileHits);
  }
  spawnExplosion(G.particles, G.player.x, G.player.y, '#ef4444', 14);
  SFX.explode();
  shakeFrames = 14;

  // Remove the current equation immediately. The next one is created and
  // revealed only after the missile-hit recovery period has finished.
  const questionBox = document.getElementById('question-box');
  if (questionBox) {
    questionBox.classList.remove('fading', 'appearing', 'resume-appearing');
    questionBox.classList.add('question-inactive');
    questionBox.style.visibility = 'hidden';
  }

  if (!G.answerLocked && G.question) {
    G.answerLocked = true;
    G.questionsAnswered++;
    recordTutorialAnswer(G.question.op, false);
    showTutorialFeedback(false);
    G.streak = 0;
    updateStreakHUD();
    clearInterval(G.timerInterval);
    G.timerInterval = null;
    document.querySelectorAll('.answer-btn').forEach(b => {
      b.classList.add('wrong');
      b.disabled = true;
    });
    const sid = _sessionId;
    _revealTimer = setTimeout(() => {
      if (_sessionId === sid) {
        loseLife({ resumeDelayMs: MISSILE_HIT_RECOVERY_MS - MISSILE_HIT_FEEDBACK_MS, fromEnemyHit: true });
      }
    }, MISSILE_HIT_FEEDBACK_MS);
    return;
  }
  loseLife({ resumeDelayMs: MISSILE_HIT_RECOVERY_MS, fromEnemyHit: true });
}

function onEnemyAircraftCollision(enemy) {
  if (!enemy?.active || G.lives <= 0 || _invincible > 0) return;
  if (playerImmune()) return;   // immune (question / 3 s after answering)
  // Airdrop protective bubble: the attacker is destroyed, the player is safe.
  if (airdropShieldActive()) {
    if (enemy.type !== 'boss') {
      enemy.active = false;
      spawnExplosion(G.particles, enemy.x, enemy.y, enemy.color || '#38bdf8', 20);
      SFX.explode();
    }
    return;
  }

  // A regular aircraft is destroyed by the impact. Bosses remain active but
  // the player's invincibility window prevents repeated collision damage.
  if (enemy.type !== 'boss') enemy.active = false;
  spawnMissileExplosion(G.particles, enemy.x, enemy.y, 'default', 34);
  spawnExplosion(G.particles, enemy.x, enemy.y, enemy.color || '#ef4444', 20);
  spawnMissileExplosion(G.particles, G.player.x, G.player.y, 'default', 26);
  spawnExplosion(G.particles, G.player.x, G.player.y, '#ef4444', 18);
  SFX.explode();
  shakeFrames = 16;
  pruneEnemies(canvas.height + 80);

  // Stop the current equation cleanly. A collision costs a life, but it does
  // not count as a wrong mathematical answer.
  if (!G.answerLocked) {
    G.answerLocked = true;
    clearInterval(G.timerInterval);
    G.timerInterval = null;
    document.querySelectorAll('.answer-btn').forEach(button => {
      button.disabled = true;
      button.style.pointerEvents = 'none';
    });
  }

  loseLife({ fromEnemyHit: true });
}

function onMissileHit(enemy, missile) {
  SFX.explode();
  const badgeDamage = G.activeBadge === 'flawless' ? 1.15 : (G.activeBadge === 'boss_hunter' && enemy.type === 'boss' ? 1.25 : 1);
  const destroyed = hitEnemy(enemy, (missile?.damage ?? 1) * badgeDamage);
  if (enemy.type === 'boss') updateBossHealthBar(enemy);
  if (destroyed) {
    if (enemy.type === 'boss') startBossDeath(enemy);
    else spawnMissileExplosion(G.particles, enemy.x, enemy.y, missile?.type || 'default', 18);
    enemy.active = false;
    // Every aircraft destroyed by the player leaves a collectible coin at
    // its last position. The coin is awarded only if the player picks it up.
    spawnMapCoin(canvas.width, enemy.y, enemy.x, 1);
    shakeFrames  = 6;
    pruneEnemies(canvas.height + 80);
    // Boss killed → win the boss level immediately
    if (enemy.type === 'boss' && levelCfg.isBossLevel) {
      setTimeout(() => endLevel(true), BOSS_DEATH_MS);
    }
  } else {
    spawnHitSpark(G.particles, enemy.x, enemy.y);
  }
}

// ── QUESTION CYCLE ───────────────────────────────────────────────────────────
function nextQuestion() {
  if (_transitioning) return;
  stopShootingWindow();
  const questionTarget = isTutorialActive() ? tutorialQuestionTarget()
    : _guidedRun ? GUIDED_QUESTIONS : levelCfg.questionCount;
  if (!levelCfg.isBossLevel && G.questionsAnswered >= questionTarget) {
    if (isTutorialActive() && _tutorialRound === 1) {
      showRoundOneSummary(() => {
        _tutorialRound = 2;
        G.questionsAnswered = 0;
        G.correctAnswers = 0;
        saveTutorialProgress();
        updateTutorialHUD();
        showTutorialCountdown(nextQuestion);
      });
      return;
    }
    if (isTutorialActive()) { showTutorialAnalysis(); return; }
    if (_guidedRun) { endLevel(true); return; }
    endLevel(true);
    return;
  }
  if (guidedBreakDue()) {
    startGuidedBreak();
    return;
  }
  // (The switch was announced by the 3 LIVES banner during the break.)
  if (_guidedRun && G.questionsAnswered === GUIDED_FREE_QUESTIONS) {
    _guidedLives = GUIDED_LIVES;
    updateLivesHUD();
  }
  _transitioning = true;
  G.answerLocked = false;
  const _nqSid = _sessionId; // capture session at start of transition

  // Remove any pending skip listener
  if (_skipHandler) {
    document.removeEventListener('pointerdown', _skipHandler, true);
    _skipHandler = null;
  }
  _correctionWaiting = false;
  clearTimeout(_revealTimer);
  _revealTimer = null;

  const resumeFromCorrection = _smoothResumeAfterCorrection;
  _smoothResumeAfterCorrection = false;

  // Undim and resume game loop
  const overlay = $('game-pause-overlay');
  if (resumeFromCorrection) overlay.classList.remove('correction-dimmed');
  else overlay.classList.remove('dimmed', 'correction-dimmed');
  if (!G.animFrame && !_cutsceneActive) _queueFrame(_nqSid);

  const reveal = $('correct-answer-reveal');
  const qbox   = $('question-box');
  const qboxWasHidden = qbox.style.visibility === 'hidden'
    || qbox.classList.contains('shooting-hidden')
    || qbox.classList.contains('question-inactive');
  qbox.classList.remove('correction-active');

  if (!qboxWasHidden) {
    qbox.style.visibility = '';
    qbox.classList.add('fading');
  } else {
    qbox.classList.add('fading');
  }

  setTimeout(() => {
    // If the level ended while we were transitioning, abort
    if (_sessionId !== _nqSid) { _transitioning = false; return; }

    // Hide reveal banner
    reveal.classList.add('hidden');
    reveal.classList.remove('hiding');

    // Swap in new question — apply grade filter
    const rawOps  = G.practiceMode ? G.practiceOps : levelCfg.ops;
    const practiceMath = PRACTICE_MATH_RANGE[G.practiceDifficulty] || PRACTICE_MATH_RANGE.normal;
    const rawCap  = G.practiceMode ? practiceMath.cap : levelCfg.mathCap;
    const rawMCap = G.practiceMode ? practiceMath.mCap : levelCfg.mathMultCap;
    const { ops, cap, mCap } = applyGradeToQuestion(rawOps, rawCap, rawMCap, G.playerGrade);
    const mathCfg = tutorialMathConfig(ops, cap, mCap);
    // Onboarding "which numbers" choice: numbers up to that max in + and -,
    // x / ÷ tables up to min(max, 12). Practice keeps its own difficulty.
    // Practice: the number typed in its setup ("de 1 à N") does the same.
    const numberMax = G.practiceMode ? G.practiceNumberMax : G.numberRangeMax;
    if (numberMax > 0) {
      mathCfg.cap = numberMax;
      mathCfg.mCap = Math.max(2, Math.min(12, numberMax));
    }
    // Extra topics: practice with only exponent/algebra selected asks only
    // those; otherwise they replace part of the usual questions.
    const extraOps = selectedExtraTopicOps();
    const practiceBasics = G.practiceMode
      ? (G.practiceOps || []).filter(op => ['+', '-', '*', '/'].includes(op)).length : 1;
    const extraShare = !extraOps.length ? 0
      : !practiceBasics ? 1
      : G.practiceMode ? extraOps.length / (extraOps.length + practiceBasics)
      : EXTRA_TOPIC_SHARE;
    G.question = Math.random() < extraShare
      ? newQuestion(extraOps, G.practiceMode ? (G.practiceNumberMax || rawCap) : extraTopicCap(rawCap), rawMCap)
      : newQuestion(mathCfg.ops, mathCfg.cap, mathCfg.mCap);
    $('question-text').textContent = G.question.text;
    G.question.typed = typedQuestionAllowed() && Math.random() < TYPED_QUESTION_SHARE;
    const btns = $('answer-buttons');
    btns.innerHTML = '';
    btns.classList.toggle('typed-answer', G.question.typed);
    if (G.question.typed) {
      renderTypedAnswer(btns);
    } else {
      G.question.choices.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = c;
        btn.addEventListener('click', () => handleAnswer(c, btn));
        btns.appendChild(btn);
      });
    }

    // If the aircraft used the panel's space, fly it clear before revealing
    // the equation. This prevents any part of the plane entering the panel.
    const returnDuration = returnPlayerAboveQuestionBox();
    const revealQuestionPanel = () => {
      if (_sessionId !== _nqSid) return;
      qbox.classList.remove('question-inactive');
      qbox.style.visibility = '';
      qbox.classList.remove('fading', 'shooting-hidden', 'resume-appearing', 'appearing');
      void qbox.offsetWidth;
      qbox.classList.add(resumeFromCorrection ? 'resume-appearing' : 'appearing');
      if (resumeFromCorrection) {
        startSmoothGameResume();
        requestAnimationFrame(() => overlay.classList.remove('dimmed', 'correction-dimmed'));
      }
      const appearClass = resumeFromCorrection ? 'resume-appearing' : 'appearing';
      const appearMs = resumeFromCorrection ? 920 : 730;
      setTimeout(() => { qbox.classList.remove(appearClass); _transitioning = false; }, appearMs);
      updateTutorialHUD();
      startTimer();
    };
    if (returnDuration) setTimeout(revealQuestionPanel, returnDuration + 40);
    else revealQuestionPanel();
  }, qboxWasHidden ? 0 : 620);
}

function startTimer(resetTime = true) {
  if (G.timerInterval) clearInterval(G.timerInterval);
  G.timerInterval = null;
  const timerWrap = $('timer-bar-wrap');
  if (_levelEnding) {
    timerWrap.classList.add('timer-finished');
    return;
  }
  timerWrap.classList.remove('timer-finished');
  timerWrap.style.visibility = '';

  // Practice unlimited mode — freeze timer bar, no countdown
  if (G.practiceMode && G.practiceTimeLimit === null && !_guidedRun) {
    if (resetTime) {
      G.timeLeft  = 9999;
      _timerTotal = 9999;
    }
    $('timer-bar').style.width      = '100%';
    $('timer-bar').style.background = 'var(--dim, #334155)';
    return;
  }
  // Training round 1 and new-player practice questions 1-5: no timer.
  if ((isTutorialActive() && _tutorialRound === 1) || (_guidedRun && !guidedLivesPhase())) {
    if (resetTime) {
      G.timeLeft  = 9999;
      _timerTotal = 9999;
    }
    $('timer-bar-wrap').classList.add('tutorial-no-timer');
    $('timer-bar').style.width      = '100%';
    $('timer-bar').style.background = 'var(--dim, #334155)';
    return;
  }
  $('timer-bar-wrap').classList.remove('tutorial-no-timer');

  const baseTime   = _guidedRun ? GUIDED_TIME_S
    : G.practiceMode
    ? (G.practiceTimeLimit || GUIDED_TIME_S)
    : levelCfg.timeLimit + (levelCfg.weather?.timeMod || 0);
  const adjustedBaseTime = isTutorialActive()
    ? Math.max(9, baseTime + 4)
    : G.practiceMode ? baseTime : baseTime + getOnboardingTimerBonus()
      + (G.activeBadge === 'lightning_reflex' ? 5 : 0)
      + (AIRCRAFT[G.activeAircraft]?.ability?.extraAnswerTime || 0)
      + (coopBotAbility()?.extraAnswerTime || 0);
  const typedBonus = G.question?.typed ? TYPED_QUESTION_EXTRA_S : 0;
  if (resetTime) {
    G.timeLeft  = Math.max(3, adjustedBaseTime + typedBonus);
    _timerTotal = G.timeLeft;
  }
  const currentPct = resetTime ? 100 : Math.max(0, G.timeLeft / _timerTotal) * 100;
  $('timer-bar').style.width      = currentPct + '%';
  $('timer-bar').style.background = currentPct < 25 ? 'var(--red)' : currentPct < 55 ? 'var(--yellow)' : 'var(--accent)';
  _runTimer();
}

function _runTimer() {
  if (G.timerInterval) clearInterval(G.timerInterval);
  const bar      = $('timer-bar');
  const timerSid = _sessionId;
  const timerStep  = isTouchMobile() ? 0.25 : 0.1;
  const timerDelay = isTouchMobile() ? 250 : 100;
  G.timerInterval = setInterval(() => {
    if (!_isActiveSid(timerSid) || _gamePausedFromQuit) {
      clearInterval(G.timerInterval);
      G.timerInterval = null;
      return;
    }
    if (G.answerLocked) return;
    G.timeLeft -= timerStep;
    const pct = Math.max(0, G.timeLeft / _timerTotal) * 100;
    bar.style.width = pct + '%';
    if (pct < 25)      bar.style.background = 'var(--red)';
    else if (pct < 55) bar.style.background = 'var(--yellow)';
    if (pct < 25 && Math.floor(G.timeLeft * 10) % 5 === 0) SFX.timerWarn();
    if (G.timeLeft <= 0) { clearInterval(G.timerInterval); handleTimeout(); }
  }, timerDelay);
}

// ── TYPED ANSWERS ────────────────────────────────────────────────────────────
// Some questions are answered by writing the number instead of picking one of
// four buttons: a display plus a compact keypad (1-9, 0, erase, OK) under the
// question, and the computer keyboard (digits, Backspace, Enter) works too.
// They get a few more seconds. Not in the beginner practice or the training.
const TYPED_QUESTION_SHARE = 0.3;
const TYPED_QUESTION_EXTRA_S = 4;
let _typedValue = '';

function typedQuestionAllowed() {
  return !_guidedRun && !isTutorialActive();
}

function renderTypedAnswer(btns) {
  _typedValue = '';
  const fr = getLang() === 'fr';
  const display = document.createElement('div');
  display.className = 'typed-display';
  display.setAttribute('aria-live', 'polite');
  btns.appendChild(display);
  const keypad = document.createElement('div');
  keypad.className = 'typed-keypad';
  ['1', '2', '3', '4', '5', 'del', '6', '7', '8', '9', '0', 'ok'].forEach(key => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `answer-btn typed-key${key === 'ok' ? ' typed-ok' : key === 'del' ? ' typed-del' : ''}`;
    btn.dataset.key = key;
    btn.textContent = key === 'ok' ? 'OK' : key === 'del' ? '⌫' : key;
    if (key === 'del') btn.setAttribute('aria-label', fr ? 'Effacer' : 'Erase');
    btn.addEventListener('click', () => typedPress(key));
    keypad.appendChild(btn);
  });
  btns.appendChild(keypad);
  updateTypedDisplay();
}

function updateTypedDisplay() {
  const display = document.querySelector('#answer-buttons .typed-display');
  if (display) {
    display.textContent = _typedValue || (getLang() === 'fr' ? 'ÉCRIS TA RÉPONSE' : 'TYPE YOUR ANSWER');
    display.classList.toggle('is-empty', !_typedValue);
  }
  const ok = document.querySelector('#answer-buttons .typed-ok');
  if (ok && !G.answerLocked) ok.disabled = !_typedValue;
}

function typedPress(key) {
  if (G.answerLocked || !G.question?.typed) return;
  if (key === 'ok') {
    if (!_typedValue) return;
    handleAnswer(Number(_typedValue), document.querySelector('#answer-buttons .typed-ok'));
    return;
  }
  if (key === 'del') _typedValue = _typedValue.slice(0, -1);
  else if (_typedValue.length < String(G.question.answer).length + 2) _typedValue = (_typedValue + key).replace(/^0+(?=\d)/, '');
  SFX.click?.();
  updateTypedDisplay();
}

// Computer keyboard on a typed question. Returns true when the key was used.
function typedAnswerKey(e) {
  if (!G.question?.typed || G.answerLocked || e.target?.closest?.('input, textarea, select')) return false;
  const key = /^[0-9]$/.test(e.key) ? e.key
    : e.key === 'Backspace' ? 'del'
    : e.key === 'Enter' ? 'ok'
    : null;
  if (!key) return false;
  e.preventDefault();
  typedPress(key);
  return true;
}

// ── ANSWER HANDLING ──────────────────────────────────────────────────────────
function handleAnswer(choice, btn) {
  if (G.answerLocked) return;
  G.answerLocked = true;
  _answerImmuneUntil = performance.now() + ANSWER_IMMUNE_MS;
  clearInterval(G.timerInterval);
  G.timerInterval = null;
  $('timer-bar-wrap').classList.add('timer-finished');
  document.querySelectorAll('.answer-btn').forEach(b => {
    b.disabled = true;
    b.style.pointerEvents = 'none';
  });

  const correct = choice === G.question.answer;
  G.sessionResponseTimeTotal = (G.sessionResponseTimeTotal || 0) + Math.max(0, _timerTotal - G.timeLeft);
  G.sessionResponseCount = (G.sessionResponseCount || 0) + 1;
  btn.classList.add(correct ? 'correct' : 'wrong');
  document.querySelector('#answer-buttons .typed-display')?.classList.add(correct ? 'correct' : 'wrong');

  if (correct) {
    SFX.correct();
    const now = performance.now();
    // A correct answer must not be punished by a missile that was already
    // touching the player while their attention was on the equation.
    const safetyRadiusSq = CORRECT_ANSWER_SAFETY_RADIUS * CORRECT_ANSWER_SAFETY_RADIUS;
    G.enemyMissiles = G.enemyMissiles.filter(missile => {
      const dx = missile.x - G.player.x;
      const dy = missile.y - G.player.y;
      return dx * dx + dy * dy > safetyRadiusSq;
    });
    _invincible = Math.max(_invincible, CORRECT_ANSWER_INVINCIBLE_FRAMES);
    const cadenceMs = Math.max(0.35, shotDelaySeconds(Number(activeShootingPlan()?.cadence || 5) * (activeAircraftAbility().fireRate || 1))) * 1000;
    _shootingWindowUntil = now + GOOD_ANSWER_SHOOTING_WINDOW_MS;
    firePlayerShootingPlan();
    _nextPlayerShotAt = now + cadenceMs;
    G.correctAnswers++;
    coopOnCorrectAnswer();
    // Coins are earned only by answering correctly. A missed, timed-out, or
    // incorrect question never releases a collectible coin.
    releaseCorrectAnswerCoins();
    const endsLevel = !isTutorialActive() && !levelCfg.isBossLevel
      && G.questionsAnswered + 1 >= levelCfg.questionCount;
    const startsGuidedBreak = _guidedRun && G.questionsAnswered + 1 === GUIDED_FREE_QUESTIONS && !_guidedBreakDone;
    if (G.correctAnswers > 0 && G.correctAnswers % 5 === 0 && !endsLevel && !startsGuidedBreak) showAnswerCelebration();
    maybeLaunchB2Nuke();
    maybeTurnEnemies();
    coopMaybeNuke();
    G.questionsAnswered++;
    recordTutorialAnswer(G.question.op, true);
    showTutorialFeedback(true);
    G.sessionXP += calcSpeedXP(G.timeLeft, _timerTotal) + (G.likesMath ? 1 : 0);
    G.streak++;
    G.bestAnswerStreak = Math.max(G.bestAnswerStreak || 0, G.streak);
    save('bestAnswerStreak', G.bestAnswerStreak);
    updateStreakHUD();
    if (G.streak === 3 || G.streak === 5) SFX.streak();
    trackMission('correct_answers', 1);
    trackMission('max_streak', G.streak);
    if (_coop) trackMission('coop_correct', 1);
    if (G.practiceMode) {
      trackMission('practice_correct', 1);
      trackMission('practice_streak', G.streak);
    }

  } else {
    SFX.wrong();
    G.questionsAnswered++;
    recordTutorialAnswer(G.question.op, false);
    showTutorialFeedback(false);
    G.streak = 0;
    updateStreakHUD();
    // Wrong answer breaks the SR-71 run — reset all cube progress
    revealCorrectAnswer(choice);
    if (!G.practiceMode && G.currentLevel <= 30) {
      G.sr71WrongAnswers = (G.sr71WrongAnswers || 0) + 1;
      G.sr71CleanLevels  = [];
      save('sr71WrongAnswers', G.sr71WrongAnswers);
      save('sr71CleanLevels',  []);
    }
  }

  const sid = _sessionId;
  if (correct) {
    const qbox = document.getElementById('question-box');
    if (qbox) {
      qbox.classList.add('fading', 'shooting-hidden');
      setTimeout(() => {
        if (_sessionId === sid) qbox.style.visibility = 'hidden';
      }, 620);
    }
    // Beginner practice, question 5: the break starts at once.
    if (guidedBreakDue()) startGuidedBreak();
    else _revealTimer = setTimeout(() => advanceAfterCorrectAnswer(sid), GOOD_ANSWER_SHOOTING_WINDOW_MS);
  }

  if (!correct) {
    waitForCorrectionContinue(() => loseLife(), sid);
  }
}

function listCountingSteps(start, count, direction = 1) {
  const values = [];
  for (let i = 1; i <= Math.min(count, 12); i++) values.push(start + i * direction);
  const suffix = count > 12 ? ', ...' : '';
  return values.join(', ') + suffix;
}

function buildExplanation(q, picked = null) {
  return buildMentalMathExplanationV2(q, picked);
}

function isCloseMathSlip(q, picked) {
  if (picked == null || !Number.isFinite(Number(picked))) return false;
  const diff = Math.abs(Number(picked) - Number(q.answer));
  if (diff === 0) return false;
  const scale = Math.max(3, Math.round(Math.abs(Number(q.answer)) * 0.08));
  return diff <= scale || diff <= 2;
}

function buildCorrectionIntro(q, picked = null) {
  const isFr = getLang() === 'fr';
  if (isCloseMathSlip(q, picked)) {
    return isFr
      ? 'Presque ! Petit glissement de calcul.'
      : 'Almost! Just a small calculation slip.';
  }
  return isFr
    ? 'Pas grave ! Regardons la strategie.'
    : "No worries! Let's use a strategy.";
}

function buildMentalMathExplanationV2(q, picked = null) {
  const { a, b, op, answer } = q;
  const isFr = getLang() === 'fr';
  const sym = op === '*' ? 'x' : op === '/' ? '/' : op;
  const eq = `${a} ${sym} ${b} = ${answer}`;

  if (op === '+') {
    const rounded = Math.ceil(b / 10) * 10;
    if (b >= 8 && rounded !== b && rounded - b <= 5) {
      return isFr
        ? `Arrondis ${b} a ${rounded}. ${a} + ${rounded} = ${a + rounded}. Puis retire ${rounded - b}: ${answer}.`
        : `Round ${b} to ${rounded}. ${a} + ${rounded} = ${a + rounded}. Then take away ${rounded - b}: ${answer}.`;
    }
    const tens = Math.floor(b / 10) * 10;
    const ones = b - tens;
    if (tens > 0 && ones > 0) {
      return isFr
        ? `Coupe ${b} en ${tens} et ${ones}. ${a} + ${tens} = ${a + tens}. Puis + ${ones} = ${answer}.`
        : `Split ${b} into ${tens} and ${ones}. ${a} + ${tens} = ${a + tens}. Then + ${ones} = ${answer}.`;
    }
    const steps = listCountingSteps(a, b, 1);
    return isFr
      ? `Avance de ${b} pas apres ${a}: ${steps}. Donc ${eq}.`
      : `Count ${b} steps after ${a}: ${steps}. So ${eq}.`;
  }

  if (op === '-') {
    const rounded = Math.ceil(b / 10) * 10;
    if (b >= 8 && rounded !== b && rounded - b <= 5) {
      return isFr
        ? `Arrondis ${b} a ${rounded}. ${a} - ${rounded} = ${a - rounded}. Puis rajoute ${rounded - b}: ${answer}.`
        : `Round ${b} to ${rounded}. ${a} - ${rounded} = ${a - rounded}. Then add back ${rounded - b}: ${answer}.`;
    }
    const tens = Math.floor(b / 10) * 10;
    const ones = b - tens;
    if (tens > 0 && ones > 0) {
      return isFr
        ? `Enleve d'abord ${tens}: ${a} - ${tens} = ${a - tens}. Puis enleve ${ones}: ${answer}.`
        : `Take away ${tens} first: ${a} - ${tens} = ${a - tens}. Then take away ${ones}: ${answer}.`;
    }
    const steps = listCountingSteps(a, b, -1);
    return isFr
      ? `Recule de ${b} pas depuis ${a}: ${steps}. Donc ${eq}.`
      : `Count back ${b} steps from ${a}: ${steps}. So ${eq}.`;
  }

  if (op === '*') {
    if (b === 5 || a === 5) {
      const other = a === 5 ? b : a;
      return isFr
        ? `Pour x5, fais x10 puis coupe en deux. ${other} x 10 = ${other * 10}. La moitie = ${answer}.`
        : `For x5, do x10 then cut it in half. ${other} x 10 = ${other * 10}. Half is ${answer}.`;
    }
    if (b === 9 || a === 9) {
      const other = a === 9 ? b : a;
      return isFr
        ? `Pour x9, fais x10 puis enleve une fois le nombre. ${other} x 10 = ${other * 10}. ${other * 10} - ${other} = ${answer}.`
        : `For x9, do x10 then take away the number once. ${other} x 10 = ${other * 10}. ${other * 10} - ${other} = ${answer}.`;
    }
    if ((b === 11 && a >= 10 && a < 100) || (a === 11 && b >= 10 && b < 100)) {
      const other = a === 11 ? b : a;
      const digits = String(other).split('').map(Number);
      const middle = digits[0] + digits[1];
      return isFr
        ? `Pour x11, additionne les deux chiffres de ${other}: ${digits[0]} + ${digits[1]} = ${middle}. Mets le total au milieu: ${answer}.`
        : `For x11, add the two digits of ${other}: ${digits[0]} + ${digits[1]} = ${middle}. Put it in the middle: ${answer}.`;
    }
    if (a % 2 === 0 && b * 2 <= 100) {
      return isFr
        ? `Simplifie: coupe ${a} en deux et double ${b}. ${a} x ${b} devient ${a / 2} x ${b * 2}. Resultat: ${answer}.`
        : `Make it simpler: halve ${a} and double ${b}. ${a} x ${b} becomes ${a / 2} x ${b * 2}. Result: ${answer}.`;
    }
    if (a <= 6 && b <= 12) {
      const groups = Array.from({ length: a }, () => b).join(' + ');
      return isFr
        ? `${a} groupes de ${b}: ${groups} = ${answer}.`
        : `${a} groups of ${b}: ${groups} = ${answer}.`;
    }
    return isFr
      ? `Pense en groupes: ${a} groupes de ${b}. Compte par bonds jusqu'a ${answer}.`
      : `Think in groups: ${a} groups of ${b}. Count by jumps up to ${answer}.`;
  }

  if (op === '/') {
    if (b === 5) {
      return isFr
        ? `Pour diviser par 5, double puis divise par 10. ${a} x 2 = ${a * 2}. Puis /10 = ${answer}.`
        : `To divide by 5, double then divide by 10. ${a} x 2 = ${a * 2}. Then /10 = ${answer}.`;
    }
    if (b === 4) {
      return isFr
        ? `Pour diviser par 4, coupe en deux deux fois. ${a} / 2 = ${a / 2}. Puis /2 = ${answer}.`
        : `To divide by 4, halve it twice. ${a} / 2 = ${a / 2}. Then /2 = ${answer}.`;
    }
    return isFr
      ? `Demande: combien de groupes de ${b} font ${a}? ${answer} groupes, car ${answer} x ${b} = ${a}.`
      : `Ask: how many groups of ${b} make ${a}? ${answer} groups, because ${answer} x ${b} = ${a}.`;
  }

  return eq;
}

function ensureCorrectionRevealMarkup() {
  const banner = $('correct-answer-reveal');
  if (!banner) return null;
  if (!$('car-step1') || !$('car-step2') || !$('car-step3') || !$('car-step4') || !$('car-step5') || !$('btn-correction-continue')) {
    banner.innerHTML = `
      <div id="car-step1" class="car-step car-step-wrong"></div>
      <div id="car-step2" class="car-step car-step-how"></div>
      <div id="car-step3" class="car-step car-step-how"></div>
      <div id="car-step4" class="car-step car-step-check"></div>
      <div id="car-step5" class="car-step car-step-answer"></div>
      <button id="btn-correction-continue" class="correction-continue-btn" type="button"></button>
    `;
  }
  return banner;
}

function buildClearCorrectionSteps(q, picked = null) {
  const { a, b, op, answer } = q;
  const isFr = getLang() === 'fr';
  const symbol = op === '*' ? '×' : op === '/' ? '÷' : op;
  const explanation = buildExplanation(q, picked)
    .replace(/^.*?(?:Your answer was|Ta reponse etait).*?\.\s*/i, '')
    .trim();
  const sentences = explanation.split(/\.\s+/).map(s => s.replace(/\.$/, '').trim()).filter(Boolean);
  const method1 = sentences[0] || `${a} ${symbol} ${b}`;
  const method2 = sentences.slice(1).join('. ') || (isFr ? 'Verifie chaque valeur de position.' : 'Check each place value.');

  let setup = `${a} ${symbol} ${b}`;
  // Keep the complete calculation on one line for fast, unambiguous reading.
  setup = `${a} ${symbol} ${b} = ?`;

  let check;
  if (op === '+') check = `${answer} - ${b} = ${a}`;
  else if (op === '-') check = `${answer} + ${b} = ${a}`;
  else if (op === '*') check = `${answer} ÷ ${b} = ${a}`;
  else if (op === '/') check = `${answer} × ${b} = ${a}`;
  else check = `${a} ${symbol} ${b} = ${answer}`;

  return [
    buildCorrectionIntro(q, picked),
    `${isFr ? 'ETAPE 1 — PLACE LES NOMBRES' : 'STEP 1 — SET UP THE NUMBERS'}\n${setup}`,
    `${isFr ? 'ETAPE 2 — CALCULE' : 'STEP 2 — CALCULATE'}\n${method1}${method2 ? `. ${method2}` : ''}`,
    `${isFr ? 'ETAPE 3 — VERIFIE' : 'STEP 3 — CHECK'}\n${check}`,
    `${isFr ? 'BONNE REPONSE' : 'CORRECT ANSWER'} : ${answer}`,
  ];
}

function revealCorrectAnswer(picked = null) {
  stopShootingWindow();
  const qbox = document.getElementById('question-box');
  if (qbox) {
    qbox.classList.remove('fading', 'appearing', 'shooting-hidden');
    qbox.classList.add('correction-active');
    qbox.style.visibility = '';
  }
  const correct = String(G.question.answer).trim();
  // Typed question: the display shows the right number (not a keypad digit).
  if (G.question.typed) {
    const display = document.querySelector('#answer-buttons .typed-display');
    if (display) {
      display.textContent = correct;
      display.classList.remove('is-empty', 'wrong');
      display.classList.add('correct');
    }
  }
  document.querySelectorAll(G.question.typed ? '.typed-ok' : '.answer-btn').forEach(b => {
    b.disabled = false;
    if (!G.question.typed && b.textContent.trim() === correct) {
      b.classList.remove('wrong');
      b.classList.add('correct');
    }
    b.disabled = true;
  });

  const banner = ensureCorrectionRevealMarkup();
  if (!banner) return;
  banner.classList.remove('hidden', 'hiding');
  banner.style.display = 'flex';
  banner.style.visibility = 'visible';
  banner.style.opacity = '1';
  const continueBtn = $('btn-correction-continue');
  if (continueBtn) {
    continueBtn.textContent = getLang() === 'fr' ? 'CONTINUER' : 'CONTINUE';
    continueBtn.disabled = false;
    continueBtn.style.display = 'block';
    continueBtn.onclick = null;
  }

  const s1 = $('car-step1'), s2 = $('car-step2'), s3 = $('car-step3');
  const s4 = $('car-step4'), s5 = $('car-step5');
  s1.className = 'car-step car-step-wrong';
  s2.className = 'car-step car-step-how';
  s3.className = 'car-step car-step-how';
  s4.className = 'car-step car-step-check';
  s5.className = 'car-step car-step-answer';

  const correctionSteps = buildClearCorrectionSteps(G.question, picked);
  [s1, s2, s3, s4, s5].forEach((s, index) => {
    s.textContent = correctionSteps[index];
    s.classList.remove('visible');
    setTimeout(() => s.classList.add('visible'), 80 + index * 180);
  });

  // Dim and freeze the game while the player reads the correction.
  const overlay = $('game-pause-overlay');
  overlay.classList.add('dimmed', 'correction-dimmed');
  cancelAnimationFrame(G.animFrame);
  G.animFrame = null;
  takeCorrectionSnapshot();
}

const CORRECTION_FADE_MS = 260;

function waitForCorrectionContinue(onContinue, sid) {
  const btn = $('btn-correction-continue');
  if (!btn) return;
  _correctionWaiting = true;
  btn.disabled = false;
  btn.style.display = 'block';
  btn.onclick = e => {
    e.stopPropagation();
    if (!_correctionWaiting || _sessionId !== sid) return;
    _correctionWaiting = false;
    // Immune for the fade below, then the full 3 s once the game resumes.
    _answerImmuneUntil = performance.now() + CORRECTION_FADE_MS + ANSWER_IMMUNE_MS;
    _correctionSnapshot = null;
    _smoothResumeAfterCorrection = true;
    btn.disabled = true;
    btn.onclick = null;
    $('correct-answer-reveal')?.classList.add('hiding');
    const qbox = document.getElementById('question-box');
    if (qbox) {
      qbox.classList.add('fading', 'shooting-hidden');
      qbox.style.visibility = 'hidden';
    }
    const qText = document.getElementById('question-text');
    const answerBtns = document.getElementById('answer-buttons');
    if (qText) qText.textContent = '';
    if (answerBtns) answerBtns.innerHTML = '';
    clearTimeout(_revealTimer);
    _revealTimer = setTimeout(() => {
      if (_sessionId !== sid) return;
      $('game-pause-overlay')?.classList.remove('correction-dimmed');
      const qbox = document.getElementById('question-box');
      qbox?.classList.remove('correction-active', 'fading');
      const reveal = $('correct-answer-reveal');
      if (reveal) {
        reveal.classList.add('hidden');
        reveal.classList.remove('hiding');
        reveal.style.display = '';
        reveal.style.visibility = '';
        reveal.style.opacity = '';
      }
      _revealTimer = null;
      onContinue();
    }, CORRECTION_FADE_MS);
  };
}

function handleTimeout() {
  if (G.answerLocked) return;
  G.answerLocked = true;
  _answerImmuneUntil = performance.now() + ANSWER_IMMUNE_MS;
  G.questionsAnswered++;
  recordTutorialAnswer(G.question?.op || '+', false, true);
  showTutorialFeedback(false, true);
  G.streak = 0;
  updateStreakHUD();
  SFX.wrong();
  document.querySelectorAll('.answer-btn').forEach(b => {
    if (!G.question?.typed) b.classList.add('wrong');
    b.disabled = true;
  });
  document.querySelector('#answer-buttons .typed-display')?.classList.add('wrong');
  const sid = _sessionId;
  revealCorrectAnswer(null);
  waitForCorrectionContinue(() => loseLife(), sid);
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

function loseLife({ resumeDelayMs = 900, fromEnemyHit = false } = {}) {
  // A wrong answer is charged once CONTINUE is pressed: the equation is over,
  // so a shield paused by it counts again.
  if (!fromEnemyHit) syncAbilityPause(false);
  if (_guidedRun) {
    // questionsAnswered already counts this question: > 5 = questions 6-10.
    if (G.questionsAnswered > GUIDED_FREE_QUESTIONS) {
      _guidedLives = Math.max(0, _guidedLives - 1);
      updateLivesHUD();
      if (_guidedLives <= 0) {
        shakeFrames = 14;
        restartGuidedRun();
        return;
      }
    }
    shakeFrames = 6;
    G.streak = 0;
    updateStreakHUD();
    // Question 5 wrong: the break starts as soon as CONTINUE is pressed.
    if (guidedBreakDue()) { startGuidedBreak(); return; }
    const sid = _sessionId;
    setTimeout(() => { if (_sessionId === sid) nextQuestion(); }, 650);
    return;
  }
  if (isTutorialActive()) {
    shakeFrames = 6;
    G.streak = 0;
    updateStreakHUD();
    updateTutorialHUD();
    const sid = _sessionId;
    setTimeout(() => { if (_sessionId === sid) nextQuestion(); }, 650);
    return;
  }
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
  if (playerShieldActive()) {
    _invincible = 180;
    updateLivesHUD();
    const sid = _sessionId;
    setTimeout(() => {
      if (_sessionId !== sid) return;
      if (levelCfg.isBossLevel || G.questionsAnswered < levelCfg.questionCount) nextQuestion();
      else endLevel(true);
    }, Math.min(resumeDelayMs, 900));
    return;
  }
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
    _playerDestroyed = true;
    G.answerLocked = true;
    G.enemyMissiles = [];
    stopShootingWindow();
    spawnMissileExplosion(G.particles, G.player.x, G.player.y, 'default', 24);
    SFX.explode?.();
    shakeFrames = 10;
    const gameOverSid = _sessionId;
    setTimeout(() => {
      if (_sessionId === gameOverSid) endLevel(false);
    }, 520);
    return;
  }
  // Keep the aircraft protected throughout longer recovery sequences, such as
  // the three-second regeneration period after an enemy missile hit.
  _invincible = Math.max(120, Math.ceil(resumeDelayMs / (1000 / 60)));
  spawnTimer  = adaptiveSpawnRate();
  setTimeout(() => {
    if (_sessionId !== sid) return;
    if (levelCfg.isBossLevel || G.questionsAnswered < levelCfg.questionCount) nextQuestion();
    else endLevel(true);
  }, resumeDelayMs);
}

// ── HUD ──────────────────────────────────────────────────────────────────────
function updateLivesHUD() {
  if (isTutorialActive()) {
    const copy = tutorialCopy();
    $('hud-lives').innerHTML = `<span class="tutorial-safe-life">${copy.training}</span>`;
    return;
  }
  // New-player practice: "∞ VIES" for questions 1-5, then 3 hearts.
  if (_guidedRun) {
    $('hud-lives').innerHTML = guidedLivesPhase()
      ? Array.from({ length: GUIDED_LIVES }, (_, i) =>
        `<img src="/assets/fx/Iteam/heart-full.png" style="width:28px;height:28px;image-rendering:pixelated;opacity:${i < _guidedLives ? '1' : '0.3'}">`).join('')
      : `<span class="tutorial-safe-life">∞ ${tutorialCopy().infinite}</span>`;
    return;
  }
  $('hud-lives').innerHTML = Array.from({ length: _maxLives }, (_, i) =>
    `<img src="/assets/fx/Iteam/heart-full.png" style="width:28px;height:28px;image-rendering:pixelated;opacity:${i < G.lives ? '1' : '0.3'}">`
  ).join('');
}

function updateStreakHUD() {
  $('hud-streak').textContent = '';
}

// ── LEVEL END ────────────────────────────────────────────────────────────────
function finishLevel(won) {
  if (won && _coop?.mode === 'online' && !_coop.left) wsSend({ type: 'coop_done' });
  // Beginner practice won (last question or T key): main.js shows the Google
  // sign-in invitation to guests.
  G.beginnerPracticeDone = !!(won && _guidedRun);
  // Won with a real teammate (even if they left before the end): this game's
  // EXP also counts for the MULTIJOUEUR TOP 20 (state.js addLifetimeXp).
  G.coopWinXp = !!(won && !G.practiceMode && G.coopSession?.mode === 'online');
  // Coins and EXP earned in gameplay are temporary until victory. Losing or
  // leaving the level discards the session counters without changing the
  // player's saved account balance.
  if (won) {
    const earnedCoins = Math.max(0, G.airdropSessionCoins || 0);
    const earnedXp = Math.max(0, G.airdropSessionXP || 0);
    G.coins = clampCoins((G.coins || 0) + earnedCoins);
    G.xp = (G.xp || 0) + earnedXp;
    G.totalXpEarned = (G.totalXpEarned || 0) + earnedXp;
    addLifetimeXp(earnedXp);
    save('coins', G.coins);
    save('xp', G.xp);
    save('totalXpEarned', G.totalXpEarned);
  }
  _cutsceneActive = false;
  _bossDialogueActive = false;
  _bossDialogueEntrance = null;
  _bossDialogueSpeakerIsPlayer = false;
  _bossDialogueDim = 0;
  _bossDialogueSpeechStartedAt = 0;
  _bossPlayerAnchor = null;
  _finishPlaneAnim = null;
  _levelEnding = false;
  _playerDestroyed = false;
  _sessionId++;
  _activeSessionId = 0;
  _gamePausedFromQuit = false;
  G.pausedGameResume = null;
  stopShootingWindow();
  clearInterval(G.timerInterval);
  _stopGameLoop();
  G.timerInterval = null;
  G.answerLocked  = true;
  if (ctx) { ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; }
  recordGuestGamePlayed();
  if (won) {
    trackMission('levels_won', 1);
    if (G.coopSession) trackMission('coop_wins', 1);
    if (G.coopSession?.mode === 'online') trackMission('coop_real_wins', 1);
    if (G.practiceMode) trackMission('practice_wins', 1);
  }
  if (_onComplete) _onComplete(won);
}

function updateGameCurrencyHUD() {
  const coins = document.getElementById('hud-coins-count');
  const xp = document.getElementById('hud-xp-count');
  if (coins) coins.textContent = (G.airdropSessionCoins || 0).toLocaleString();
  if (xp) xp.textContent = (G.airdropSessionXP || 0).toLocaleString();
}

function updateTimedPlayXp(frameMs) {
  _timedXpElapsedMs += frameMs;
  while (_timedXpElapsedMs >= 30000) {
    _timedXpElapsedMs -= 30000;
    const roll = Math.random();
    const reward = roll < 0.55 ? { rarity: 'COMMON', amount: 5 }
      : roll < 0.82 ? { rarity: 'UNCOMMON', amount: 10 }
        : roll < 0.94 ? { rarity: 'RARE', amount: 20 }
          : roll < 0.99 ? { rarity: 'EPIC', amount: 35 }
            : { rarity: 'LEGENDARY', amount: 50 };
    addSessionXp(reward.amount);
    G.lastTimedXpRarity = reward.rarity;
  }
}

function endLevel(won) {
  if (!won || _levelEnding || !canvas || !G.player) {
    if (!_levelEnding) finishLevel(won);
    return;
  }

  _levelEnding = true;
  _cutsceneActive = true;
  G.answerLocked = true;
  clearInterval(G.timerInterval);
  G.timerInterval = null;
  $('timer-bar-wrap').classList.add('timer-finished');
  stopShootingWindow();
  clearInterval(G.timerInterval);
  G.timerInterval = null;
  G.enemyMissiles = [];
  clearQuestionUI();

  const qbox = document.getElementById('question-box');
  const hud = document.getElementById('game-hud');
  const timer = document.getElementById('timer-bar-wrap');
  if (qbox) qbox.style.visibility = 'hidden';
  if (hud) hud.style.visibility = 'hidden';
  if (timer) timer.style.visibility = 'hidden';
  timer?.classList.add('timer-finished');

  // MISSION COMPLETE banner first (the plane keeps hovering), then the plane
  // pulls back and boosts off the top of the screen.
  showMissionCompleteBanner();
  const retreatDuration = 620;
  const boostDuration = 780;
  _finishPlaneAnim = {
    start: performance.now() + MISSION_COMPLETE_BANNER_MS,
    fromX: G.player.x,
    fromY: G.player.y,
    retreatY: Math.min(canvas.height + 20, G.player.y + Math.max(48, canvas.height * 0.12)),
    exitY: -Math.max(180, canvas.height * 0.32),
    retreatDuration,
    boostDuration,
  };

  const sid = _activeSessionId;
  if (!G.animFrame) _queueFrame(sid);
  setTimeout(() => {
    if (_isActiveSid(sid) && _levelEnding) SFX.missionBoost?.();
  }, MISSION_COMPLETE_BANNER_MS + retreatDuration - 120);
  setTimeout(() => {
    if (_isActiveSid(sid) && _levelEnding) finishLevel(true);
  }, MISSION_COMPLETE_BANNER_MS + retreatDuration + boostDuration + 80);
}

// End of a won level: a MISSION COMPLETE banner in the style of the START one
// (letters drop in, light sweep, speed streaks, zoom-out) with the number of
// good answers under it, and its own fanfare.
const MISSION_COMPLETE_BANNER_MS = 1900;
function showMissionCompleteBanner() {
  const host = $('tutorial-countdown')?.parentElement;
  if (!host) return;
  clearAnswerCelebration();
  const fr = getLang() === 'fr';
  const word = fr ? 'MISSION ACCOMPLIE' : 'MISSION COMPLETE';
  const letters = [...word]
    .map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
  const streaks = Array.from({ length: 8 }, (_, i) => `<i style="--s:${i}"></i>`).join('');
  const total = levelCfg?.isBossLevel ? 0 : (levelCfg?.questionCount || 0);
  const count = total ? `${G.correctAnswers}/${total}` : `${G.correctAnswers}`;
  const banner = document.createElement('div');
  banner.className = 'level-start-banner streak-banner mission-complete-banner';
  banner.setAttribute('aria-hidden', 'true');
  banner.innerHTML = `
    <div class="lsb-streaks">${streaks}</div>
    <div class="lsb-stack">
      <div class="lsb-word lsb-word-long" style="--n:${word.length}">${letters}</div>
      <div class="lsb-sub">${count} ${fr ? 'BONNES RÉPONSES !' : 'GOOD ANSWERS!'}</div>
    </div>`;
  host.appendChild(banner);
  SFX.missionComplete?.(word.length);
  setTimeout(() => banner.remove(), MISSION_COMPLETE_BANNER_MS + 200);
}

// ── PUBLIC API ───────────────────────────────────────────────────────────────
// Speed lines — initialised per session, used in frame()
let _speedLines   = [];
const _skinImgCache = {};
let _lastFrameTs = 0;
let   _qboxH         = 180;  // cached question-box height — updated in resize()
let _perfTier = 2;
let _perfAvgMs = 16.7;
let _perfLastTs = 0;
let _perfSamples = 0;
let _frameStep = 1;
let _questionFocusBlend = 0;
let _drawBackgroundEveryOtherFrame = false;

function resetAdaptivePerformance() {
  _perfTier = isTouchMobile() ? 1 : 2;
  _perfAvgMs = 16.7;
  _perfLastTs = 0;
  _perfSamples = 0;
  _frameStep = 1;
  _questionFocusBlend = 0;
  _drawBackgroundEveryOtherFrame = false;
}

// Enemy numbers are the same on phone, tablet and computer: more planes, which
// arrive more often and more of them at once. Training / beginner practice
// keep their own calm pace. A slow phone is helped by cheaper drawing
// (tuneAdaptivePerformance), never by removing enemies or shots.
const SPAWN_INTERVAL_MULT = 0.7;   // 30% shorter wait between spawns
const MAX_ENEMIES_MULT = 1.5;      // +50% enemies on screen

function extraEnemies() {
  return !isTutorialActive() && !_guidedRun;
}

function adaptiveSpawnRate() {
  return Math.round(baseSpawnRate * ENEMY_SPAWN_INTERVAL_SCALE
    * (extraEnemies() ? SPAWN_INTERVAL_MULT : 1));
}

function adaptiveMaxEnemies() {
  return extraEnemies() ? Math.ceil(baseMaxEnemies * MAX_ENEMIES_MULT) : baseMaxEnemies;
}

function tuneAdaptivePerformance(ts = 0) {
  if (!ts) return;
  if (!_perfLastTs) {
    _perfLastTs = ts;
    return;
  }
  const dt = Math.min(80, Math.max(8, ts - _perfLastTs));
  _perfLastTs = ts;
  _perfAvgMs = (_perfAvgMs * 0.92) + (dt * 0.08);
  if (++_perfSamples < 45) return;
  _perfSamples = 0;

  const lagMs = isTouchMobile() ? 19.5 : 31;
  const smoothMs = isTouchMobile() ? 16.9 : 19;
  if (_perfAvgMs > lagMs && _perfTier > 0) _perfTier--;
  else if (_perfAvgMs < smoothMs && _perfTier < 2) _perfTier++;
  _drawBackgroundEveryOtherFrame = isTouchMobile() && _perfTier === 0;
}

function initSpeedLines(cw, ch) {
  const count = 28;
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
  if (!_speedLines.length) return;
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
  if (!hasGuestTrialLeft(levelNum)) {
    if (window._showToast) window._showToast(t('signInAlert'));
    window._nav?.toMenu?.();
    return () => {};
  }
  _sessionId++;
  const airdropSelected = rollAirdropForLevel({ practice: G.practiceMode, tutorial: !!G.tutorialMode && !G.practiceMode });
  _activeSessionId = _sessionId;
  _gamePausedFromQuit = false;
  G.pausedGameResume = null;
  G.question = null;
  _transitioning = false;
  _correctionWaiting = false;
  _correctionSnapshot = null;
  clearTimeout(_revealTimer);
  _revealTimer = null;
  stopShootingWindow();
  clearSmoothResumeState();
  _cutsceneActive = false;
  _bossDialogueActive = false;
  _bossDialogueSpeechStartedAt = 0;
  _bossDialogueExit = null;
  _bossDialogueEntrance = null;
  _bossDialogueSpeakerIsPlayer = false;
  _bossDialogueDim = 0;
  _bossPlayerAnchor = null;
  _finishPlaneAnim = null;
  _levelEnding = false;
  clearQuestionUI();
  const qbox = document.getElementById('question-box');
  if (qbox) qbox.style.visibility = '';
  $('game-hud').style.visibility      = '';
  $('timer-bar-wrap').style.visibility = '';
  $('timer-bar-wrap').classList.remove('timer-finished');
  document.getElementById('boss-health-wrap')?.classList.add('hidden');
  _invincible    = 0;
  _answerImmuneUntil = 0;
  _playerShieldUntil = 0;
  _playerShieldReadyAt = 0;
  _shieldPausedAt = 0;
  _lastShieldHudSecond = -1;
  _turboUntil = 0;
  _turboReadyAt = 0;
  _skillPausedAt = 0;
  _lastTurboHudSecond = -1;
  _nextRegenAt = performance.now() + PC21_REGEN_INTERVAL_MS;
  _bankTilt      = 0;
  _stealthActive = false;
  _stealthAnswers = 0;
  _nukeAnim    = 0;
  _nukeMissileAnim = 0;
  _nukeApplied = false;
  _nukeSweepUntil = 0;
  _nukeReadyAt = 0;
  _nukedBosses = new Set();
  updateNukeButton();
  clearAnswerCelebration();
  _godMode     = false;
  // Practice never runs the placement tutorial (it stays pending for levels).
  // Training rounds only for a placement asked on purpose (equation settings
  // "see my level"); an old tutorialMode flag (e.g. from a cloud save) alone
  // no longer turns real levels into training.
  _tutorialActive = !!G.tutorialMode && !G.practiceMode && G.onboardingStartMode === 'placement';
  _nukeReadyAt = hasNukePlanEquipped() && !_tutorialActive ? performance.now() + NUKE_COOLDOWN_MS : 0;
  updateNukeButton();
  const savedTutorial = _tutorialActive ? getStoredTutorialProgress() : null;
  _tutorialRound = savedTutorial?.round || 1;
  // New-player practice run (main.js startPracticeFromOnboarding): 10
  // questions, 1-5 free (no timer, infinite lives), 6-10 timed with 3 lives.
  _guidedRun = !!G.practiceMode && !!G.onboardingPracticeRun;
  G.coopWinXp = false;   // a new game: nothing won with a teammate yet
  G.onboardingPracticeRun = false;
  _guidedLives = GUIDED_LIVES;
  _guidedBreakDone = false;
  _guidedBreakUntil = 0;
  _tutorialStats = _tutorialActive ? (savedTutorial?.stats || emptyTutorialStats()) : null;
  document.getElementById('tutorial-analysis')?.classList.add('hidden');
  document.getElementById('tutorial-countdown')?.classList.add('hidden');
  document.getElementById('tutorial-feedback')?.classList.add('hidden');
  document.getElementById('boss-dialogue')?.classList.add('hidden');
  document.getElementById('boss-dialogue')?.classList.remove('player-speaking');
  document.getElementById('tutorial-captain-guide')?.classList.add('hidden');
  document.getElementById('tutorial-round-summary')?.classList.add('hidden');
  document.getElementById('tutorial-hud')?.classList.add('hidden');   // training banner removed
  _gameCT.clear();
  const godBadge = document.getElementById('hud-godmode');
  if (godBadge) godBadge.classList.add('hidden');
  shakeFrames = 0;
  _bossDeaths = [];
  _bigShakeUntil = 0;
  tick        = 0;
  _shipFrame  = 0;
  _shipAnimLastTs = 0;
  _turnRightFrame = 0;
  _turnLeftFrame = 0;
  _speedLines = [];
  trackMission('games_played', 1);
  if (G.coopSession) trackMission('coop_games', 1);
  if (G.practiceMode) trackMission('practice_games', 1);
  const snap = G.continueState;
  G.continueState = null;
  resetLevel();
  _timedXpElapsedMs = 0;
  G.airdropSessionCoins = 0;
  G.airdropSessionXP = 0;
  updateGameCurrencyHUD();   // show 0 now, not last game's total during the countdown
  G.airdropXrayUntil = 0;
  G.airdropNukePending = false;
  G.airdropSupportPending = false;
  G.airdropShieldUntil = 0;
  G.airdropWeapon = null;
  _airSupport = null;
  _coop = null;
  G.airdropXrayShotReset = false;
  G.airdropXrayQuestionPaused = false;
  G.airdropXrayResumeQuestion = false;
  G.currentLevel = levelNum;
  if (savedTutorial) {
    G.currentLevel = savedTutorial.currentLevel || levelNum;
    G.questionsAnswered = Math.max(0, savedTutorial.questionsAnswered || 0);
    G.correctAnswers = Math.max(0, savedTutorial.correctAnswers || 0);
  }
  // Reset SR-71 run tracker when starting level 1 (non-practice)
  if (levelNum === 1 && !G.practiceMode) {
    G.sr71WrongAnswers = 0;
    G.sr71MissileHits  = 0;
    G.sr71CleanLevels  = [];
    save('sr71WrongAnswers', 0);
    save('sr71MissileHits',  0);
    save('sr71CleanLevels',  []);
  }
  levelCfg       = applyOnboardingLevelLength(applyAgeModifiers(getLevel(levelNum), G.playerAge));
  // Practice: the weather picked in the practice drawer replaces the level's.
  if (G.practiceMode && WEATHER_TYPES[G.practiceWeather]) {
    levelCfg = { ...levelCfg, weather: WEATHER_TYPES[G.practiceWeather] };
  }
  // New-player practice: plain normal weather (no rain / storm / fog / snow).
  if (_guidedRun) levelCfg = { ...levelCfg, weather: WEATHER_TYPES.CLOUDY };
  _maxLives = G.lives;
  _lastHudLives = null;
  if (snap) {
    G.lives             = snap.lives;
    G.correctAnswers    = snap.correctAnswers;
    G.questionsAnswered = snap.questionsAnswered;
    G.streak            = snap.streak;
  }
  _onComplete    = onComplete;
  G.currentWeather = levelCfg.weather || null;

  canvas = $('game-canvas');
  // Background always fully repaints the canvas every frame (drawBackground
  // tiles it edge-to-edge) — alpha:false skips the compositor's alpha-blend
  // pass against the page behind it, which matters on weaker mobile GPUs.
  ctx    = canvas.getContext('2d', { alpha: false });
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha = 1;

  const ro = new ResizeObserver(() => {
    if (_resizeTimer) return;
    _resizeTimer = setTimeout(() => { _resizeTimer = null; resize(); }, 200);
  });
  ro.observe(canvas);

  const copy = tutorialCopy();
  $('hud-level').textContent = isTutorialActive() ? copy.hudLevel
    : G.practiceMode ? t('practice_label')
    : levelCfg.isBossLevel ? `${t('bossLevel')}${levelNum}` : `${t('level')} ${levelNum}`;
  if (isTutorialActive()) {
    G.lives = 99;
    _maxLives = 1;
    $('hud-lives').innerHTML = `<span class="tutorial-safe-life">${copy.training}</span>`;
  } else if (G.practiceMode && !G.practiceHearts) {
    $('hud-lives').innerHTML = '<span style="opacity:0.3">∞</span>';
  } else {
    updateLivesHUD();
    _maxLives = G.lives;
    updateLivesHUD();
  }
  updateStreakHUD();

  resetAdaptivePerformance();
  // Training and new-player practice: few, slowly arriving enemies.
  baseSpawnRate = (isTutorialActive() || _guidedRun) ? 170 : levelCfg.spawnRate;
  baseMaxEnemies = (isTutorialActive() || _guidedRun) ? 2 : levelCfg.maxEnemies;
  spawnRate = baseSpawnRate;
  maxEnemies = baseMaxEnemies;
  spawnTimer = isTouchMobile() ? 22 : 60;

  attachInputListeners();
  const shieldButton = document.getElementById('btn-player-shield');
  if (shieldButton) {
    _playerShieldButtonHandler = event => { event.preventDefault(); activatePlayerShield(); };
    shieldButton.addEventListener('pointerdown', _playerShieldButtonHandler);
    updatePlayerShieldButton(performance.now(), true);
  }
  const turboButton = document.getElementById('btn-aircraft-turbo');
  if (turboButton) {
    _turboButtonHandler = event => { event.preventDefault(); activateAircraftTurbo(); };
    turboButton.addEventListener('pointerdown', _turboButtonHandler);
    updateAircraftTurboButton(performance.now(), true);
  }

  const quitBtn = $('btn-quit-game');
  const nukeBtn = $('btn-nuke-strike');
  if (nukeBtn) nukeBtn.onclick = triggerNukeStrike;
  quitBtn.onclick = () => {
    _gamePausedFromQuit = true;
    stopShootingWindow();
    clearInterval(G.timerInterval);
    G.timerInterval = null;
    if (_resizeTimer) {
      clearTimeout(_resizeTimer);
      _resizeTimer = null;
    }
    if (_skipHandler) {
      document.removeEventListener('pointerdown', _skipHandler, true);
      _skipHandler = null;
    }
    _stopGameLoop();
    _countdownPlaneAnim = null;
    pointerTarget = null;
    _jsOrigin = _jsCurrent = null;
    _touchId  = null;
    _jsVelX = _jsVelY = 0;
    velX = 0; velY = 0;
    Object.keys(keys).forEach(k => keys[k] = false);
    G.pausedGameResume = () => {
      if (!_isActiveSid(sid)) return;
      _gamePausedFromQuit = false;
      showScreen('s-game');
      SFX.stopSFX();
      SFX.playMusic(_bossDialogueActive ? 'dialogue' : levelMusicKey());
      SFX.weatherStart(levelCfg.weather?.id);
      SFX.engineStart(G.activeAircraft);
      _lastFrameTs = 0;
      if (!G.answerLocked) startTimer(false);
      _startGameLoop(sid);
    };
    window._gameResume = G.pausedGameResume;
    SFX.stopSFX();
    SFX.stopMusic();
    SFX.weatherStop();
    SFX.engineStop();
    SFX.airdropPlaneStop();
    $('gameover-title').textContent = getLang() === 'fr' ? 'PARTIE ARRETEE' : 'GAME STOPPED';
    $('gameover-score').textContent = getLang() === 'fr'
      ? 'Choisis continuer, recommencer ou retourner au lobby.'
      : 'Choose continue, restart, or go back to the lobby.';
    const continueBtn = $('btn-continue-game');
    if (continueBtn) {
      continueBtn.classList.remove('hidden');
      continueBtn.textContent = getLang() === 'fr' ? 'CONTINUER' : 'CONTINUE';
      continueBtn.onclick = () => G.pausedGameResume?.();
    }
    $('btn-retry').textContent = getLang() === 'fr' ? 'RECOMMENCER' : 'RETRY';
    $('btn-go-map').textContent = getLang() === 'fr' ? 'LOBBY' : 'LOBBY';
    showScreen('s-gameover');
  };



  const sid = _sessionId;

  function tryStart() {
    if (!_isActiveSid(sid)) return;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) { requestAnimationFrame(tryStart); return; }
    _setCanvasSize(cw, ch);
    setSpriteCanvasWidth(canvas.width);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Animate loading screen while sprites download
    let _loadRaf = requestAnimationFrame(function loadTick() {
      if (!_isActiveSid(sid)) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawLoadingScreen();
      _loadRaf = requestAnimationFrame(loadTick);
    });

    preloadBiome(levelCfg.biome, {
      aircraftId: G.activeAircraft,
      levelNum: levelCfg.num,
      enemyTypes: [
        ...RANDOM_ENEMY_TYPES,
        ...(levelCfg.isBossLevel ? ['boss'] : []),
      ],
    }).then(() => {
      cancelAnimationFrame(_loadRaf);
      if (!_isActiveSid(sid)) return;
      initBackground(levelCfg.biome, levelCfg.num);
      initClouds(levelCfg.biome, canvas.width, canvas.height, levelCfg.weather?.id);
      initWeatherFx(levelCfg.weather, canvas.width, canvas.height);
      SFX.weatherStart(levelCfg.weather?.id);
      initAirdrop(airdropSelected, canvas.width, canvas.height);
      if (airdropSelected) preloadSprite('ship-b2').catch(() => {});
      _qboxH = $('question-box').offsetHeight || 180;
      placePlayer();
      startCoop();   // MULTI teammate (bot or real player), if any
      // The canvas has its final dimensions here. Creating map coins earlier
      // can place them outside the visible playfield on a fresh game launch.
      resetMapCoins();

      // Boss level: spawn one static boss centred near top, infinite questions
      if (levelCfg.isBossLevel) {
        maxEnemies = 0; // prevent re-spawning via timer
        const boss = spawnEnemy(canvas.width, 'boss');
        // Hidden until START and the BOSS ALERT have played; it then makes
        // its entrance with the intro dialogue (startA330BossIntro).
        boss.holdEntry = true;
        const milestone = levelNum / 10;
        boss.hp       = 4 + milestone * 4;   // 8, 12, 16, 20, 24 for lv10-50
        boss.currentHp = boss.hp;
        boss.maxHp     = boss.hp;
        boss.x         = canvas.width / 2;
        boss.y         = canvas.height * 0.18;
        boss.speed        = 0;
        if (levelNum === 10) {
          boss.a330Boss = true;
          boss.spriteKey = 'boss-a330';
          boss.spriteFilter = '';
          boss.size = 66;
          boss.antiMissileCycle = 0;
          boss.antiMissileActive = true;
          boss.antiMissileRadius = Math.min(canvas.width * 0.30, 150);
          boss.a330SalvoCooldown = 300;
          boss.combatActive = false;
          boss.entryActive = true;
          boss.entryProgress = 0;
          boss.spawnAlpha = 0;
          boss.entryTargetY = canvas.height * 0.19;
          boss.entryStartY = -Math.max(180, getEnemyDrawSize(boss) * 0.7);
          boss.y = boss.entryStartY;
        } else if (levelNum === 20) {
          boss.b52Boss = true;
          boss.spriteKey = 'boss-b52';
          boss.spriteFilter = '';
          boss.size = 70;
          boss.antiMissileActive = false;
          boss.b52LaserCycle = 0;
          boss.b52LaserCooldown = 18;
          boss.b52TurretFrame = 0;
          boss.b52ReturnFrame = 0;
          boss.b52TurretDirection = 'right';
          boss.b52TurretAim = 0;
          boss.animFrame = 0;
          boss.animFrames = 24;
          boss.animRate = 0;
          boss.interpolateFrames = false;
          boss.combatActive = false;
          boss.entryActive = true;
          boss.entryProgress = 0;
          boss.spawnAlpha = 0;
          boss.entryTargetY = canvas.height * 0.19;
          boss.entryStartY = -Math.max(180, getEnemyDrawSize(boss) * 0.7);
          boss.y = boss.entryStartY;
        } else if (levelNum === 30) {
          boss.kawasakiBoss = true;
          boss.spriteKey = 'boss-kawasaki-c2';
          boss.spriteFilter = '';
          boss.size = 70;
          boss.antiMissileActive = false;
          boss.b52LaserCycle = 0;
          boss.b52LaserCooldown = 18;
          boss.b52TurretAim = 0;
          boss.animFrame = 0;
          boss.animFrames = 24;
          boss.animRate = 0;
          boss.interpolateFrames = false;
          boss.combatActive = false;
          boss.entryActive = true;
          boss.entryProgress = 0;
          boss.spawnAlpha = 0;
          boss.entryTargetY = canvas.height * 0.19;
          boss.entryStartY = -Math.max(180, getEnemyDrawSize(boss) * 0.7);
          boss.y = boss.entryStartY;
        } else if (levelNum === 40) {
          boss.c5Boss = true;
          boss.spriteKey = 'boss-c5-galaxy';
          boss.spriteFilter = '';
          boss.size = 74;
          boss.antiMissileActive = false;
          boss.b52LaserCycle = 0;
          boss.b52LaserCooldown = 18;
          boss.b52TurretAim = 0;
          boss.animFrame = 0;
          boss.animFrames = 1;
          boss.animRate = 0;
          boss.interpolateFrames = false;
          boss.combatActive = false;
          boss.entryActive = true;
          boss.entryProgress = 0;
          boss.spawnAlpha = 0;
          boss.entryTargetY = canvas.height * 0.19;
          boss.entryStartY = -Math.max(180, getEnemyDrawSize(boss) * 0.7);
          boss.y = boss.entryStartY;
        } else if (levelNum === 50) {
          boss.spaceShuttleBoss = true;
          boss.spriteKey = 'boss-space-shuttle';
          boss.spriteFilter = '';
          boss.size = 78;
          boss.antiMissileActive = false;
          boss.b52LaserCycle = 0;
          boss.b52LaserCooldown = 18;
          boss.b52TurretAim = 0;
          boss.animFrame = 0;
          boss.animFrames = 10;
          boss.animRate = 0;
          boss.interpolateFrames = false;
          boss.combatActive = false;
          boss.entryActive = true;
          boss.entryProgress = 0;
          boss.spawnAlpha = 0;
          boss.entryTargetY = canvas.height * 0.19;
          boss.entryStartY = -Math.max(180, getEnemyDrawSize(boss) * 0.7);
          boss.y = boss.entryStartY;
        }
        boss.bossPhase      = 'pause';
        boss.bossPauseTimer = 150;
        boss.bossBurstMax   = 2 + milestone;
        boss.bossBurstFired = 0;
        boss.bossBurstTimer = 0;

        // Per-milestone theme: attack cadence only — sprites keep their
        // normal livery (spriteFilter stays '' as set above) rather than
        // being recolored per milestone.
        const BOSS_THEMES = [
          null,
          { color: '#94a3b8', pauseF: 320, burstI: 32, missileSpd: 2.5, missileColor: '#94a3b8' }, // lv10
          { color: '#d97706', pauseF: 310, burstI: 31, missileSpd: 2.6, missileColor: '#f59e0b' }, // lv20
          { color: '#e2e8f0', pauseF: 295, burstI: 30, missileSpd: 2.7, missileColor: '#e2e8f0' }, // lv30
          { color: '#a855f7', pauseF: 280, burstI: 30, missileSpd: 2.8, missileColor: '#c084fc' }, // lv40
          { color: '#fbbf24', pauseF: 260, burstI: 28, missileSpd: 3.0, missileColor: '#fbbf24' }, // lv50
        ];
        const theme = BOSS_THEMES[milestone] ?? BOSS_THEMES[1];
        boss.color         = theme.color;
        boss._pauseFrames  = theme.pauseF;
        boss._burstInterval = theme.burstI;
        boss._missileSpd   = theme.missileSpd;
        boss._missileColor = theme.missileColor;

        // Per-milestone movement profile
        // Higher milestones = faster, wider range, more player tracking
        const BOSS_MOVES = [
          null,
          { speed: 0.0005, interval: 420, xRange: 0.60, yMinF: 0.08, yMaxF: 0.25, trackX: 0.00 }, // lv10
          { speed: 0.0007, interval: 390, xRange: 0.68, yMinF: 0.07, yMaxF: 0.28, trackX: 0.12 }, // lv20
          { speed: 0.0009, interval: 360, xRange: 0.75, yMinF: 0.06, yMaxF: 0.30, trackX: 0.22 }, // lv30
          { speed: 0.0011, interval: 330, xRange: 0.82, yMinF: 0.05, yMaxF: 0.32, trackX: 0.33 }, // lv40
          { speed: 0.0013, interval: 300, xRange: 0.86, yMinF: 0.05, yMaxF: 0.34, trackX: 0.42 }, // lv50
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
        updateBossHealthBar(boss);
        // Companions spawn via normal timer — set maxEnemies to companion count
        baseMaxEnemies = levelCfg.bossCompanionMax;
        maxEnemies = baseMaxEnemies;
      }

      _startGameLoop(sid);
      updateTutorialHUD();
      const startLevelFlow = () => {
        _cutsceneActive = true;
        drawCountdownSafeFrame();
        _lastFrameTs = 0;
        showStartCountdown(() => {
          if ([10, 20, 30, 40, 50].includes(levelNum)) startA330BossIntro(nextQuestion);
          else nextQuestion();
        });
      };
      if (shouldForceIntroBriefingBeforeFirstRound() || shouldShowIntroBriefing(levelNum)) {
        _cutsceneActive = true;
        _stopGameLoop();
        drawCountdownSafeFrame();
        showIntroBriefing(() => {
          if (typeof window._showDailyRewardAfterIntro === 'function') {
            window._showDailyRewardAfterIntro(startLevelFlow);
          } else {
            startLevelFlow();
          }
        });
      } else startLevelFlow();
    });
  }
  requestAnimationFrame(tryStart);

  // Pause loop when tab is hidden, resume when visible again
  const _onVisibility = () => {
    if (document.hidden) {
      _stopGameLoop();
    } else if (!_cutsceneActive && _canRunSid(sid)) {
      _lastFrameTs = 0;
      if (!G.animFrame) _startGameLoop(sid);
    }
  };
  document.addEventListener('visibilitychange', _onVisibility);

  return () => {
    _sessionId++;
    SFX.weatherStop();
    SFX.engineStop();
    SFX.airdropPlaneStop();
    stopCoop();
    // Kept for RETRY: the teammate comes back (full hearts) in the new run.
    G.lastCoopSession = G.coopSession || null;
    G.coopSession = null;
    _countdownPlaneAnim = null;
    if (_activeSessionId === sid) _activeSessionId = 0;
    _gamePausedFromQuit = false;
    G.pausedGameResume = null;
    clearInterval(G.timerInterval);
    clearTimeout(_revealTimer);
    _revealTimer = null;
    stopShootingWindow();
    _transitioning = false;
    _correctionWaiting = false;
    clearSmoothResumeState();
    G.question = null;
    if (_resizeTimer) {
      clearTimeout(_resizeTimer);
      _resizeTimer = null;
    }
    if (_skipHandler) {
      document.removeEventListener('pointerdown', _skipHandler, true);
      _skipHandler = null;
    }
    _stopGameLoop();
    document.removeEventListener('visibilitychange', _onVisibility);
    G.timerInterval = null;
    G.animFrame     = null;
    detachInputListeners();
    const shieldButton = document.getElementById('btn-player-shield');
    if (shieldButton && _playerShieldButtonHandler) shieldButton.removeEventListener('pointerdown', _playerShieldButtonHandler);
    shieldButton?.classList.add('hidden');
    _playerShieldButtonHandler = null;
    const turboButton = document.getElementById('btn-aircraft-turbo');
    if (turboButton && _turboButtonHandler) turboButton.removeEventListener('pointerdown', _turboButtonHandler);
    turboButton?.classList.add('hidden');
    _turboButtonHandler = null;
    pointerTarget = null;
    _jsOrigin = _jsCurrent = null;
    _touchId  = null;
    _jsVelX = _jsVelY = 0;
    velX = 0; velY = 0;
    Object.keys(keys).forEach(k => keys[k] = false);
    if (ctx) { ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; }
    clearQuestionUI();
    ro.disconnect();
  };
}

