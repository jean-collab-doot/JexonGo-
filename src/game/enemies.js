import { ENEMY_DEFS } from '../data/enemies.js';

let _eid = 0;

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
    fireCooldown: def.fireRate + Math.floor(Math.random() * 60), // stagger first shot
  };
}

export function updateEnemies(enemies) {
  for (const e of enemies) {
    if (!e.active) continue;
    e.y += e.speed;
    if (e.shakeTick > 0) e.shakeTick--;
  }
}

// Returns true if enemy is destroyed
export function hitEnemy(enemy) {
  enemy.currentHp--;
  enemy.shakeTick = 7;
  return enemy.currentHp <= 0;
}
