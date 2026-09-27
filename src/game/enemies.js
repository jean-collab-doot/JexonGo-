import { ENEMY_DEFS } from '../data/enemies.js';
import { ENEMY_SPRITE } from './sprites.js';

let _eid = 0;

const ENEMY_ANIM_FRAMES = 12;
// The supplied exhaust cycles read cleanly at 8 FPS. At 12 FPS their large
// flame changes looked like dropped/glitching frames, especially on phones.
const ENEMY_ANIM_FPS = 8;
const ENEMY_ANIM_RATE = ENEMY_ANIM_FPS / 60;

const MOVE_PROFILE = {
  basic: { amp: 1.4,  freqMin: 0.012, freqMax: 0.018 },
  fast:  { amp: 3.0,  freqMin: 0.035, freqMax: 0.055 },
  tank:  { amp: 0.55, freqMin: 0.006, freqMax: 0.010 },
  turner: { amp: 2.4, freqMin: 0.008, freqMax: 0.020 },
  interceptor: { amp: 0, freqMin: 0, freqMax: 0 },
  boss:  { amp: 2.2,  freqMin: 0.014, freqMax: 0.022 },
};

function randFloat(a, b) { return a + Math.random() * (b - a); }

export function spawnEnemy(canvasW, type, options = {}) {
  const def    = ENEMY_DEFS[type] || ENEMY_DEFS.basic;
  const mp     = MOVE_PROFILE[type] || MOVE_PROFILE.basic;
  // Wider margin on narrow (phone) screens so enemies stay away from corners
  const margin = canvasW < 500 ? Math.round(canvasW * 0.28) : 85;
  // Reduce lateral amplitude on mobile so fast enemies don't dart to corners
  const sinAmp = canvasW < 500 ? Math.min(mp.amp, 1.2) : mp.amp;
  const enemy = {
    ...def,
    id:           'e' + (++_eid),
    type,
    x:            margin + Math.random() * Math.max(1, canvasW - margin * 2),
    y:            -def.size - 10,
    currentHp:    def.hp,
    maxHp:        def.hp,
    active:       true,
    shakeTick:    0,
    fireCooldown: def.fireRate + Math.floor(Math.random() * 60),
    spriteKey:    ENEMY_SPRITE[type] ?? 'enemy-basic-new',
    // Sideways-moving enemies roll into their turns using a dedicated bank sheet.
    bankSpriteKey: type === 'fast' ? 'enemy-fast-bank'
                 : type === 'turner' ? 'enemy-turner-bank'
                 : null,
    animFrame:    0,
    animRate:     type === 'tank' ? ENEMY_ANIM_RATE * 2 : ENEMY_ANIM_RATE,
    animFrames:   type === 'tank' ? 24 : ENEMY_ANIM_FRAMES,
    vx:       0,
    sinPhase: Math.random() * Math.PI * 2,
    sinFreq:  randFloat(mp.freqMin, mp.freqMax),
    sinAmp,
  };

  // F-5s enter from opposite top corners and cross to the opposite bottom
  // corner. A matching pair therefore draws a clear X across the playfield.
  if (type === 'fast' && options.crossSide) {
    const edge = Math.max(def.size * 1.5, canvasW < 500 ? 32 : 52);
    const lane = Math.max(0, options.crossLane || 0);
    enemy.pathType = 'cross';
    enemy.crossStartY = -def.size - 12 - lane * (canvasW < 500 ? 52 : 68);
    enemy.y = enemy.crossStartY;
    // Only half of the screen width is crossed sideways, which halves the
    // horizontal speed; the pair still meets at the centre to draw an X.
    const crossSpan = (canvasW - edge * 2) * 0.5;
    enemy.crossStartX = options.crossSide < 0 ? canvasW / 2 - crossSpan / 2 : canvasW / 2 + crossSpan / 2;
    enemy.crossEndX = options.crossSide < 0 ? canvasW / 2 + crossSpan / 2 : canvasW / 2 - crossSpan / 2;
    enemy.x = enemy.crossStartX;
    enemy.headingAngle = 0;
  }

  // Apache ambush: enter, hover long enough for a short machine-gun attack,
  // then retreat through the top of the screen.
  if (type === 'tank') {
    enemy.pathType = 'apache-ambush';
    enemy.apachePhase = 'enter';
    enemy.apacheTimer = 0;
    enemy.apacheStartY = enemy.y;
    enemy.apacheTargetYRatio = randFloat(0.14, 0.25);
    enemy.apacheGunCooldown = 35;
    enemy.apacheBurstRemaining = 0;
  }

  if (type === 'turner') {
    enemy.pathType = 'random-turn';
    enemy.turning = false;
    enemy.turnStartX = enemy.x;
    enemy.turnTargetX = enemy.x;
    enemy.turnProgress = 0;
    enemy.turnDuration = 120;
    enemy.turnTimer = randFloat(70, 260);
    enemy.headingAngle = 0;
  }

  if (type === 'interceptor') {
    enemy.pathType = 'interceptor';
    enemy.entryAnimationStarted = false;
    enemy.entryAnimationComplete = false;
    enemy.entryAnimationProgress = 0;
    enemy.entryAnimationRate = 6 / 60;
    enemy.interpolateFrames = true;
    enemy.normalSpriteKey = 'enemy-f14-normal';
    enemy.laserCooldown = 12;
    enemy.animFrame = 0;
  }

  return enemy;
}

function smoothStep(t) {
  const n = Math.max(0, Math.min(1, t));
  return n * n * (3 - 2 * n);
}

// speedMultFn(enemy) -> multiplier applied to this enemy's movement this frame
// (e.g. F-117 jamming slows down whichever enemies are near the player).
// Defaults to 1 for every enemy, i.e. the previous unconditional behavior.
export function updateEnemies(enemies, canvasW = 400, canvasH = 800, baseStep = 1, speedMultFn = null) {
  for (const e of enemies) {
    if (!e.active) continue;
    const step = speedMultFn ? baseStep * speedMultFn(e) : baseStep;

    // Boss is fully static — no movement
    if (e.type === 'boss') {
      if (e.shakeTick > 0) e.shakeTick -= step;
      e.animFrame = (e.animFrame + e.animRate * step) % e.animFrames;
      continue;
    }

    if (e.pathType === 'cross') {
      const previousX = e.x;
      e.y += e.speed * step;
      const endY = canvasH + e.size + 20;
      const progress = Math.max(0, Math.min(1, (e.y - e.crossStartY) / (endY - e.crossStartY)));
      // Quintic easing produces a real turn: enter straight, bank smoothly
      // into the diagonal, then straighten before leaving the screen.
      const curvedProgress = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
      e.x = e.crossStartX + (e.crossEndX - e.crossStartX) * curvedProgress;
      e.vx = step ? (e.x - previousX) / step : 0;
      // Bank enemies show the turn with the dedicated bank sheet, not a yaw
      // rotation. Keep headingAngle flat and ease a smoothed bank signal so the
      // pose ramps in and out instead of snapping between levels at turn's end.
      e.headingAngle = 0;
      e.bankVis = (e.bankVis || 0) + (e.vx - (e.bankVis || 0)) * Math.min(1, 0.18 * step);
    } else if (e.pathType === 'apache-ambush') {
      e.apacheTimer += step;
      const targetY = canvasH * e.apacheTargetYRatio;
      if (e.apachePhase === 'enter') {
        const progress = Math.min(1, e.apacheTimer / 52);
        e.y = e.apacheStartY + (targetY - e.apacheStartY) * smoothStep(progress);
        if (progress >= 1) {
          e.apachePhase = 'hover';
          e.apacheTimer = 0;
          e.y = targetY;
        }
      } else if (e.apachePhase === 'hover') {
        e.y = targetY + Math.sin(e.apacheTimer * 0.055) * 3;
        e.x += Math.sin(e.apacheTimer * 0.025) * 0.10 * step;
        if (e.apacheTimer >= 245) {
          e.apachePhase = 'exit';
          e.apacheTimer = 0;
          e.apacheStartY = e.y;
        }
      } else {
        const progress = Math.min(1, e.apacheTimer / 62);
        e.y = e.apacheStartY + (-e.size - 30 - e.apacheStartY) * smoothStep(progress);
        if (progress >= 1) e.active = false;
      }
      e.vx = 0;
    } else if (e.pathType === 'random-turn') {
      const previousX = e.x;
      const edge = e.size * 1.6;
      if (!e.turning) {
        e.turnTimer -= step;
        if (e.turnTimer <= 0) {
          // Select one deliberate destination and glide there in a single
          // smooth arc. There are no repeated steering corrections or shake.
          const direction = e.x < canvasW * 0.28 ? 1 : e.x > canvasW * 0.72 ? -1 : (Math.random() < 0.5 ? -1 : 1);
          const distance = randFloat(canvasW * 0.14, canvasW * 0.30) * direction;
          e.turnStartX = e.x;
          e.turnTargetX = Math.max(edge, Math.min(canvasW - edge, e.x + distance));
          e.turnProgress = 0;
          e.turnDuration = randFloat(100, 190);
          e.turning = Math.abs(e.turnTargetX - e.turnStartX) > 2;
          if (!e.turning) e.turnTimer = randFloat(80, 240);
        }
      } else {
        e.turnProgress = Math.min(1, e.turnProgress + step / e.turnDuration);
        const blend = smoothStep(e.turnProgress);
        e.x = e.turnStartX + (e.turnTargetX - e.turnStartX) * blend;
        if (e.turnProgress >= 1) {
          e.turning = false;
          e.turnTimer = randFloat(80, 260);
        }
      }
      e.vx = step ? (e.x - previousX) / step : 0;
      e.headingAngle = 0;
      e.bankVis = (e.bankVis || 0) + (e.vx - (e.bankVis || 0)) * Math.min(1, 0.18 * step);
      e.y += e.speed * step;
    } else if (e.pathType === 'interceptor') {
      e.vx = 0;
      e.y += e.speed * step;
      if (!e.entryAnimationStarted && e.y >= 0) e.entryAnimationStarted = true;
      if (!e.entryAnimationComplete) {
        if (e.entryAnimationStarted) e.entryAnimationProgress += e.entryAnimationRate * step;
        e.animFrame = Math.min(11, e.entryAnimationProgress);
        if (e.entryAnimationProgress >= ENEMY_ANIM_FRAMES) {
          e.entryAnimationComplete = true;
          e.spriteKey = e.normalSpriteKey;
          e.animFrame = 0;
          e.interpolateFrames = false;
        }
      } else {
        e.animFrame = (e.animFrame + e.animRate * step) % ENEMY_ANIM_FRAMES;
      }
    } else {
      // F-15: choose a random horizontal entry point, then fly perfectly
      // straight down without the old side-to-side sine movement.
      e.vx = 0;
      e.y += e.speed * step;
    }

    if (e.shakeTick > 0) e.shakeTick -= step;
    if (e.pathType !== 'interceptor') {
      e.animFrame = (e.animFrame + e.animRate * step) % e.animFrames;
    }
  }
}

// Returns true if enemy is destroyed
export function hitEnemy(enemy, damage = 1) {
  enemy.currentHp -= damage;
  enemy.shakeTick = 7;
  return enemy.currentHp <= 0;
}
