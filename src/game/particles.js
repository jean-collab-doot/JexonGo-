import { drawFrame } from './sprites.js';
import { isTouchMobile, maxParticlesTouch } from '../utils/device.js';

export function spawnExplosion(particles, x, y, color, count = 14) {
  const mobile = isTouchMobile();
  particles.push({
    spriteKey:   'enemy-death',
    x, y,
    frame:       0,
    frameRate:   mobile ? 0.6 : 0.35,
    totalFrames: 7,
    size:        mobile ? Math.max(28, count * 2.2) : Math.max(44, count * 3.5),
  });
}

export function spawnHitSpark(particles, x, y) {
  if (isTouchMobile()) return;
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
  const max = isTouchMobile() ? maxParticlesTouch() : 24;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.frame += p.frameRate;
    if (p.frame >= p.totalFrames) particles.splice(i, 1);
  }
  if (particles.length > max) particles.splice(0, particles.length - max);
}

export function drawParticles(ctx, particles) {
  const max = isTouchMobile() ? maxParticlesTouch() : 24;
  const limit = Math.min(particles.length, max);
  for (let i = 0; i < limit; i++) {
    const p = particles[i];
    drawFrame(ctx, p.spriteKey, p.frame, p.x, p.y, p.size, p.size);
  }
}
