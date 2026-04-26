import { ENEMY_DEFS } from '../data/enemies.js';
import { ENEMY_SPRITE } from './sprites.js';

let _eid = 0;

const ANIM_RATE = {
  basic: 0.08,
  fast:  0.12,
  tank:  0.06,
  boss:  0.05,
};

const MOVE_PROFILE = {
  basic: { amp: 1.4,  freqMin: 0.012, freqMax: 0.018 },
  fast:  { amp: 3.0,  freqMin: 0.035, freqMax: 0.055 },
  tank:  { amp: 0.55, freqMin: 0.006, freqMax: 0.010 },
  boss:  { amp: 2.2,  freqMin: 0.014, freqMax: 0.022 },
};

function randFloat(a, b) { return a + Math.random() * (b - a); }

export function spawnEnemy(canvasW, type) {
  const def    = ENEMY_DEFS[type] || ENEMY_DEFS.basic;
  const mp     = MOVE_PROFILE[type] || MOVE_PROFILE.basic;
  // Wider margin on narrow (phone) screens so enemies stay away from corners
  const margin = canvasW < 500 ? Math.round(canvasW * 0.22) : 60;
  // Reduce lateral amplitude on mobile so fast enemies don't dart to corners
  const sinAmp = canvasW < 500 ? Math.min(mp.amp, 1.5) : mp.amp;
  return {
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
    spriteKey:    ENEMY_SPRITE[type] ?? 'enemy-basic',
    animFrame:    Math.random() * 4,
    animRate:     ANIM_RATE[type] ?? 0.08,
    vx:       0,
    sinPhase: Math.random() * Math.PI * 2,
    sinFreq:  randFloat(mp.freqMin, mp.freqMax),
    sinAmp,
  };
}

export function updateEnemies(enemies, canvasW = 400) {
  const margin = canvasW < 500 ? Math.round(canvasW * 0.22) : 50;
  for (const e of enemies) {
    if (!e.active) continue;

    // Boss is fully static — no movement
    if (e.type === 'boss') {
      if (e.shakeTick > 0) e.shakeTick--;
      e.animFrame = (e.animFrame + e.animRate) % 4;
      continue;
    }

    e.sinPhase += e.sinFreq;
    e.vx = Math.sin(e.sinPhase) * e.sinAmp;

    const nextX = e.x + e.vx;
    if (nextX < margin || nextX > canvasW - margin) {
      // Reverse oscillation direction AND current velocity so the enemy
      // immediately moves away from the wall instead of staying clamped
      e.sinFreq = -e.sinFreq;
      e.vx      = -e.vx;
    }
    e.x += e.vx;
    e.x = Math.max(margin, Math.min(canvasW - margin, e.x));

    e.y += e.speed;
    if (e.shakeTick > 0) e.shakeTick--;
    e.animFrame = (e.animFrame + e.animRate) % 4;
  }
}

// Returns true if enemy is destroyed
export function hitEnemy(enemy, damage = 1) {
  enemy.currentHp -= damage;
  enemy.shakeTick = 7;
  return enemy.currentHp <= 0;
}
