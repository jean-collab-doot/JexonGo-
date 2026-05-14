// ── SPRITE-ONLY AIRCRAFT RENDERING ───────────────────────────────────────────
// All canvas polygon shapes removed. Sprites from the Legacy Collection are
// the definitive visuals for every aircraft and enemy in the game.

import { drawFrame, AIRCRAFT_SPRITE } from './sprites.js';

// Engine exhaust nozzle positions as fractions of the sprite size from center.
// x: left(-) / right(+), y: forward(-) / rear(+). Multiply by sz to get pixels.
const ENGINE_OFFSETS = {
  f16:  [{ x:  0,     y:  0.38 }],
  f35:  [{ x:  0,     y:  0.38 }],
  f18:  [{ x: -0.12,  y:  0.35 }, { x:  0.12,  y:  0.35 }],
  f22:  [{ x: -0.13,  y:  0.35 }, { x:  0.13,  y:  0.35 }],
  sr71: [{ x: -0.18,  y:  0.28 }, { x:  0.18,  y:  0.28 }],
  a10:  [{ x: -0.08,  y:  0.22 }, { x:  0.08,  y:  0.22 }],
  b2:   [{ x: -0.22,  y:  0.1  }, { x: -0.07,  y:  0.1  }, { x:  0.07, y: 0.1 }, { x:  0.22, y: 0.1 }],
};

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
  if (enemy.spriteFilter) {
    ctx.save();
    ctx.filter = enemy.spriteFilter;
    drawFrame(ctx, enemy.spriteKey, enemy.animFrame, enemy.x, enemy.y, size, size,
      { rotate: Math.PI + bankAngle });
    ctx.restore();
  } else {
    drawFrame(ctx, enemy.spriteKey, enemy.animFrame, enemy.x, enemy.y, size, size,
      { rotate: Math.PI + bankAngle });
  }

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

// ── ENGINE FIRE ───────────────────────────────────────────────────────────────

export function drawEngineFire(ctx, aircraftId, cx, cy, tick, bankAngle = 0) {
  const offsets = ENGINE_OFFSETS[aircraftId];
  if (!offsets) return;
  const sz    = getPlayerSize();
  const fw    = sz * 0.28;
  const fh    = sz * 0.16;
  const frame = Math.floor(tick / 3) % 3;

  ctx.save();
  ctx.translate(cx, cy);
  if (bankAngle) ctx.rotate(bankAngle);

  for (const off of offsets) {
    ctx.save();
    ctx.translate(off.x * sz, off.y * sz);
    ctx.rotate(-Math.PI / 2);  // sprite points right → rotate to point down
    drawFrame(ctx, 'fire-ball', frame, 0, 0, fw, fh);
    ctx.restore();
  }

  ctx.restore();
}
