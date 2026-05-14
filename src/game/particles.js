// ── SPRITE-BASED PARTICLES ────────────────────────────────────────────────────
// All particle effects use spritesheet animations from the Legacy Collection.
// No canvas dot/circle primitives remain.

import { drawFrame } from './sprites.js';

// ── SPAWN ─────────────────────────────────────────────────────────────────────

/**
 * Spawn an explosion at (x, y).
 * Uses the enemy-death sheet (7 frames). `count` is repurposed as a size hint.
 */
export function spawnExplosion(particles, x, y, color, count = 14) {
  particles.push({
    spriteKey:   'enemy-death',
    x, y,
    frame:       0,
    frameRate:   0.35,   // 7 frames over ~20 ticks
    totalFrames: 7,
    size:        Math.max(44, count * 3.5),
  });
}

/**
 * Spawn a small hit spark at (x, y).
 * Uses explosion-a (8 frames).
 */
export function spawnHitSpark(particles, x, y) {
  particles.push({
    spriteKey:   'spark',
    x, y,
    frame:       0,
    frameRate:   0.55,   // 8 frames over ~14 ticks
    totalFrames: 8,
    size:        32,
  });
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export function updateParticles(particles) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.frame += p.frameRate;
    if (p.frame >= p.totalFrames) particles.splice(i, 1);
  }
  if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
}

// ── DRAW ──────────────────────────────────────────────────────────────────────

const MAX_PARTICLES = 24;

export function drawParticles(ctx, particles) {
  const limit = Math.min(particles.length, MAX_PARTICLES);
  for (let i = 0; i < limit; i++) {
    const p = particles[i];
    drawFrame(ctx, p.spriteKey, p.frame, p.x, p.y, p.size, p.size);
  }
}
