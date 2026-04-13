// ── SPRITE-ONLY AIRCRAFT RENDERING ───────────────────────────────────────────
// All canvas polygon shapes removed. Sprites from the Legacy Collection are
// the definitive visuals for every aircraft and enemy in the game.

import { drawFrame, AIRCRAFT_SPRITE } from './sprites.js';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const PLAYER_SIZE  = 64;   // px — player ship draw size (width = height)
const ENEMY_SCALE  = 2.1;  // multiplier on enemy.size for draw dimensions

// ── PLAYER AIRCRAFT ───────────────────────────────────────────────────────────

/**
 * Draw the player ship sprite centred at (cx, cy).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} aircraftId   key from AIRCRAFT data (e.g. 't6', 'f22')
 * @param {number} cx           centre X
 * @param {number} cy           centre Y
 * @param {number} frame        animation frame (float; floored internally)
 * @param {number} [alpha=1]    opacity — used for invincibility flash
 * @param {number} [bankAngle=0] rotation in radians for banking left/right
 */
export function drawAircraftSprite(ctx, aircraftId, cx, cy, frame, alpha = 1, bankAngle = 0) {
  ctx.imageSmoothingEnabled = false;
  const key = AIRCRAFT_SPRITE[aircraftId] ?? 'ship-y1';
  drawFrame(ctx, key, frame, cx, cy, PLAYER_SIZE, PLAYER_SIZE, { rotate: bankAngle, alpha });
  ctx.imageSmoothingEnabled = true;
}

/**
 * Draw a static first-frame ship sprite for the hangar preview.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} aircraftId
 * @param {number} cx  centre X on the preview canvas
 * @param {number} cy  centre Y on the preview canvas
 * @param {number} size  width and height to draw
 */
export function drawAircraftPreview(ctx, aircraftId, cx, cy, size) {
  ctx.imageSmoothingEnabled = false;
  const key = AIRCRAFT_SPRITE[aircraftId] ?? 'ship-y1';
  drawFrame(ctx, key, 0, cx, cy, size, size);
  ctx.imageSmoothingEnabled = true;
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
  ctx.imageSmoothingEnabled = false;

  const size = enemy.size * ENEMY_SCALE;
  drawFrame(ctx, enemy.spriteKey, enemy.animFrame, enemy.x, enemy.y, size, size);

  // HP bar (drawn over the sprite for tank / boss enemies with multiple HP)
  if (enemy.maxHp > 1) {
    const bw = enemy.size * 1.6;
    const bh = 4;
    const bx = enemy.x - bw / 2;
    const by = enemy.y + enemy.size + 2;
    ctx.fillStyle = '#1e293b'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = enemy.color;
    ctx.fillRect(bx, by, bw * (enemy.currentHp / enemy.maxHp), bh);
  }

  ctx.imageSmoothingEnabled = true;
}
