import { ENEMY_DEFS } from '../data/enemies.js';
import { ENEMY_SPRITE } from './sprites.js';

let _eid = 0;

const ANIM_RATE = {
  basic: 0.08,
  fast:  0.12,
  tank:  0.06,
  boss:  0.05,
};

// Sine-wave movement profile per type
// freq: radians per frame — lower = wider, lazier sweeps
// amp:  max horizontal pixels per frame
const MOVE_PROFILE = {
  basic: { amp: 1.4,  freqMin: 0.012, freqMax: 0.018 },
  fast:  { amp: 3.0,  freqMin: 0.035, freqMax: 0.055 },
  tank:  { amp: 0.55, freqMin: 0.006, freqMax: 0.010 },
  boss:  { amp: 2.2,  freqMin: 0.014, freqMax: 0.022 },
};

function randFloat(a, b) { return a + Math.random() * (b - a); }

export function spawnEnemy(canvasW, type) {
  const def = ENEMY_DEFS[type] || ENEMY_DEFS.basic;
  const mp  = MOVE_PROFILE[type] || MOVE_PROFILE.basic;
  const margin = 60;
  return {
    ...def,
    id:          'e' + (++_eid),
    x:           margin + Math.random() * (canvasW - margin * 2),
    y:           -def.size - 10,
    currentHp:   def.hp,
    maxHp:       def.hp,
    active:      true,
    shakeTick:   0,
    fireCooldown: def.fireRate + Math.floor(Math.random() * 60),
    spriteKey:   ENEMY_SPRITE[type] ?? 'enemy-basic',
    animFrame:   Math.random() * 4,
    animRate:    ANIM_RATE[type] ?? 0.08,
    // sine-wave horizontal movement
    vx:       0,
    sinPhase: Math.random() * Math.PI * 2,   // random start so each enemy is offset
    sinFreq:  randFloat(mp.freqMin, mp.freqMax),
    sinAmp:   mp.amp,
  };
}

export function updateEnemies(enemies, canvasW = 400) {
  const margin = 50;
  for (const e of enemies) {
    if (!e.active) continue;

    // Continuous sine wave — perfectly smooth, no snapping
    e.sinPhase += e.sinFreq;
    e.vx = Math.sin(e.sinPhase) * e.sinAmp;

    // Reflect wave at edges so the plane doesn't leave the screen
    if (e.x + e.vx < margin || e.x + e.vx > canvasW - margin) {
      e.sinPhase = Math.PI - e.sinPhase; // mirror phase
      e.vx = Math.sin(e.sinPhase) * e.sinAmp;
    }
    e.x += e.vx;

    e.y += e.speed;
    if (e.shakeTick > 0) e.shakeTick--;
    e.animFrame = (e.animFrame + e.animRate) % 4;
  }
}

// Returns true if enemy is destroyed
export function hitEnemy(enemy) {
  enemy.currentHp--;
  enemy.shakeTick = 7;
  return enemy.currentHp <= 0;
}
