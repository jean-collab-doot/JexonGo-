// ── SPRITE-BASED PARTICLES ────────────────────────────────────────────────────
import { drawFrame } from './sprites.js';
import { isTouchMobile, MAX_PARTICLES_TOUCH } from '../utils/device.js';

const MAX_PARTICLES = isTouchMobile ? MAX_PARTICLES_TOUCH : 24;

export function spawnExplosion(particles, x, y, color, count = 14) {
  particles.push({
    spriteKey:   'enemy-death',
    x, y,
    frame:       0,
    frameRate:   0.35,
    totalFrames: 7,
    size:        Math.max(44, count * 3.5),
  });
}

export function spawnHitSpark(particles, x, y) {
  particles.push({
    spriteKey:   'spark',
    x, y,
    frame:       0,
    frameRate:   0.55,
    totalFrames: 8,
    size:        32,
  });
}

export function updateParticles(particles) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.frame += p.frameRate;
    if (p.frame >= p.totalFrames) particles.splice(i, 1);
  }
  if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
}

export function drawParticles(ctx, particles) {
  const limit = Math.min(particles.length, MAX_PARTICLES);
  for (let i = 0; i < limit; i++) {
    const p = particles[i];
    drawFrame(ctx, p.spriteKey, p.frame, p.x, p.y, p.size, p.size);
  }
}
