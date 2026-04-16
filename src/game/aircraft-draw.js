// ── SPRITE-ONLY AIRCRAFT RENDERING ───────────────────────────────────────────
// All canvas polygon shapes removed. Sprites from the Legacy Collection are
// the definitive visuals for every aircraft and enemy in the game.

import { drawFrame, AIRCRAFT_SPRITE } from './sprites.js';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const PLAYER_SIZE  = 130;  // px — player ship draw size
const ENEMY_SCALE  = 3.2;  // multiplier on enemy.size for draw dimensions

// ── PLAYER AIRCRAFT ───────────────────────────────────────────────────────────

/**
 * Draw the player ship sprite centred at (cx, cy).
 * Uses 'screen' blend so the built-in dark vignette becomes transparent.
 */
export function drawAircraftSprite(ctx, aircraftId, cx, cy, frame, alpha = 1, bankAngle = 0) {
  const key = AIRCRAFT_SPRITE[aircraftId] ?? 'ship-t6';
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  drawFrame(ctx, key, frame, cx, cy, PLAYER_SIZE, PLAYER_SIZE, { rotate: bankAngle });
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
export function drawEnemySprite(ctx, enemy) {
  const size = enemy.size * ENEMY_SCALE;

  // Rotate 180° so the plane faces downward (enemies fly top→bottom).
  // 'screen' blend removes the built-in dark vignette background.
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  drawFrame(ctx, enemy.spriteKey, enemy.animFrame, enemy.x, enemy.y, size, size,
    { rotate: Math.PI });
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
