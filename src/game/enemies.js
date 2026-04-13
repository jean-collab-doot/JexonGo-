import { ENEMY_DEFS } from '../data/enemies.js';
import { ENEMY_SPRITE } from './sprites.js';

let _eid = 0;

// Animation speed (frames advanced per game-tick) per enemy type.
// Lower = slower animation.
const ANIM_RATE = {
  basic: 0.08,
  fast:  0.12,
  tank:  0.06,
  boss:  0.05,
};

export function spawnEnemy(canvasW, type) {
  const def    = ENEMY_DEFS[type] || ENEMY_DEFS.basic;
  const margin = 60;
  return {
    ...def,
    id:        'e' + (++_eid),
    x:         margin + Math.random() * (canvasW - margin * 2),
    y:         -def.size - 10,
    currentHp: def.hp,
    maxHp:     def.hp,
    active:      true,
    shakeTick:   0,
    fireCooldown: def.fireRate + Math.floor(Math.random() * 60),
    // ── sprite animation state ────────────────────────────────────────────
    spriteKey:  ENEMY_SPRITE[type] ?? 'enemy-basic',
    animFrame:  Math.random() * 4,   // stagger so enemies don't all pulse in sync
    animRate:   ANIM_RATE[type] ?? 0.08,
  };
}

export function updateEnemies(enemies) {
  for (const e of enemies) {
    if (!e.active) continue;
    e.y += e.speed;
    if (e.shakeTick > 0) e.shakeTick--;
    // Advance sprite animation
    e.animFrame = (e.animFrame + e.animRate) % 4; // all enemy sheets ≤ 5 frames; use 4 for safe loop
  }
}

// Returns true if enemy is destroyed
export function hitEnemy(enemy) {
  enemy.currentHp--;
  enemy.shakeTick = 7;
  return enemy.currentHp <= 0;
}
