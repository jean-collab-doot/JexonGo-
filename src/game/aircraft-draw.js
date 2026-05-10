// ── SPRITE-ONLY AIRCRAFT RENDERING ───────────────────────────────────────────
// All canvas polygon shapes removed. Sprites from the Legacy Collection are
// the definitive visuals for every aircraft and enemy in the game.

import { drawFrame, AIRCRAFT_SPRITE } from './sprites.js';

// Smaller on phone so the plane doesn't dominate the narrow screen
function getPlayerSize() {
  return window.innerWidth <= 520 ? 110 : 180;
}

function getEnemyScale() {
  return window.innerWidth <= 520 ? 3.2 : 4.8;
}
export { getPlayerSize };

// ── PLAYER AIRCRAFT ───────────────────────────────────────────────────────────

/**
 * Draw the player ship sprite centred at (cx, cy).
 * Uses 'screen' blend so the built-in dark vignette becomes transparent.
 */
export function drawAircraftSprite(ctx, aircraftId, cx, cy, frame, alpha = 1, bankAngle = 0, skinFilter = '') {
  const key = AIRCRAFT_SPRITE[aircraftId] ?? 'ship-t6';
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (alpha !== 1)  ctx.globalAlpha = alpha;
  if (skinFilter)   ctx.filter = skinFilter;
  const sz = getPlayerSize();
  drawFrame(ctx, key, frame, cx, cy, sz, sz, { rotate: bankAngle });
  ctx.restore();
}

/**
 * Draw a static first-frame ship sprite for the hangar preview.
 * Uses 'screen' blend so the dark vignette disappears over the card background.
 */
export function drawAircraftPreview(ctx, aircraftId, cx, cy, size) {
  const key = AIRCRAFT_SPRITE[aircraftId] ?? 'ship-t6';
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'screen';
  drawFrame(ctx, key, 0, cx, cy, size, size);
  ctx.restore();
}

// ── ENEMIES ───────────────────────────────────────────────────────────────────

/**
 * Draw an enemy sprite centred at (enemy.x, enemy.y).
 * Uses the enemy's own spriteKey and animFrame set by enemies.js.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} enemy  full enemy object from G.enemies
 */
export function drawEnemySprite(ctx, enemy, bankAngle = 0) {
  const size = enemy.size * getEnemyScale();
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (enemy.spriteFilter) ctx.filter = enemy.spriteFilter;
  drawFrame(ctx, enemy.spriteKey, enemy.animFrame, enemy.x, enemy.y, size, size,
    { rotate: Math.PI + bankAngle });
  ctx.restore();

  // HP bar for tank / boss enemies
  if (enemy.maxHp > 1) {
    const bw = enemy.size * 1.6;
    const bh = 4;
    const bx = enemy.x - bw / 2;
    const by = enemy.y + enemy.size + 2;
    ctx.fillStyle = '#1e293b'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = enemy.color;
    ctx.fillRect(bx, by, bw * (enemy.currentHp / enemy.maxHp), bh);
  }
}
