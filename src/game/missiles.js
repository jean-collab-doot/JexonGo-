// ── SPRITE-BASED MISSILES ─────────────────────────────────────────────────────
// Uses the Warped Bolt spritesheet (4 frames) for all missiles.
// Player missiles travel upward  → bolt rotated +π/2 (tip points up).
// Enemy  missiles travel downward → bolt rotated −π/2 (tip points down).

import { drawFrame } from './sprites.js';

const BOLT_ROT_UP   =  Math.PI / 2;
const BOLT_ROT_DOWN = -Math.PI / 2;

const BOLT_W          = 20;    // draw width  (px along travel axis after rotation)
const BOLT_H          = 10;    // draw height (px)
const BOLT_FRAME_RATE = 0.25;  // frames advanced per game-tick (4 frames)

// ── FACTORY ───────────────────────────────────────────────────────────────────

export function createMissile(x, y, tx, ty, speed, enemyId, color = '#00d4ff') {
  const dx = tx - x, dy = ty - y;
  const d  = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x, y,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    tx, ty, enemyId, color,
    trail:     [],
    boltFrame: 0,
  };
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export function updateMissiles(missiles, onHit) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.trail.push({ x: m.x, y: m.y });
    if (m.trail.length > 8) m.trail.shift();
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
  ctx.imageSmoothingEnabled = false;
  const rot = isEnemy ? BOLT_ROT_DOWN : BOLT_ROT_UP;
  for (const m of missiles) {
    drawFrame(ctx, 'bolt', m.boltFrame, m.x, m.y, BOLT_W, BOLT_H, { rotate: rot });
  }
  ctx.imageSmoothingEnabled = true;
}
