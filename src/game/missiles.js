// ── SPRITE-BASED MISSILES ─────────────────────────────────────────────────────
// Uses the pixel-art rocket sprite (single frame, white background → multiply blend).
// Rocket image points upper-left (~135° in canvas), so offset rotation by -π*0.75
// to align nose upward for player missiles, downward for enemy missiles.

import { drawFrame, getImage } from './sprites.js';

// Rocket image points NW (~225° canvas CW). Offset to point straight up (-90°):
const ROCKET_ANGLE   = (3 * Math.PI) / 4;  // image native angle from +X axis
const BOLT_ROT_UP    = -Math.PI / 2 - ROCKET_ANGLE + Math.PI * 2; // nose up
const BOLT_ROT_DOWN  = BOLT_ROT_UP + Math.PI;                      // nose down

const BOLT_W          = 38;    // draw width
const BOLT_H          = 38;    // draw height (square — rocket is diagonal)
const BOLT_FRAME_RATE = 0;

// ── FACTORY ───────────────────────────────────────────────────────────────────

export function createMissile(x, y, tx, ty, speed, enemyId, color = '#00d4ff', damage = 1) {
  const dx = tx - x, dy = ty - y;
  const d  = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x, y,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    tx, ty, enemyId, color, damage,
    boltFrame: 0,
  };
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export function updateMissiles(missiles, onHit) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.x += m.vx;
    m.y += m.vy;
    m.boltFrame = (m.boltFrame + BOLT_FRAME_RATE) % 4;
    const dx = m.x - m.tx, dy = m.y - m.ty;
    if (dx * dx + dy * dy < 18 * 18) { onHit(m); missiles.splice(i, 1); continue; }
    if (m.y < -80 || m.x < -100 || m.x > 4000) missiles.splice(i, 1);
  }
}

// ── DRAW ──────────────────────────────────────────────────────────────────────

export function drawMissiles(ctx, missiles, isEnemy = false) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const m of missiles) {
    // Rotate sprite to match actual travel direction
    const travelAngle = Math.atan2(m.vy, m.vx);
    const rot = travelAngle - ROCKET_ANGLE + Math.PI;
    drawFrame(ctx, 'bolt', 0, m.x, m.y, BOLT_W, BOLT_H, { rotate: rot });
  }
  ctx.restore();
}
