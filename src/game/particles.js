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

export function spawnMissileExplosion(particles, x, y, missileType = 'default', count = 14) {
  const mobile = isTouchMobile();
  const profiles = {
    fire: { spriteKey: 'explosion-fire', glow: '#ff6a00', ring: '#ffcf33', size: 4.0, frames: 12 },
    ice: { spriteKey: 'explosion-ice', glow: '#67e8f9', ring: '#dffbff', size: 5.4, frames: 12 },
    nuke: { spriteKey: 'explosion-nuke', glow: '#ff9d00', ring: '#ffe45c', size: 8.2, frames: 12 },
    ray:  { spriteKey: 'explosion-ray', glow: '#8b5cf6', ring: '#22d3ee', size: 6.0, frames: 12 },
    default: { spriteKey: 'enemy-death', glow: '#f97316', ring: '#fde047', size: 3.5, frames: 7 },
  };
  const profile = profiles[missileType] || profiles.default;
  particles.push({
    spriteKey: profile.spriteKey,
    missileType,
    dedicatedMissileFx: profile.spriteKey !== 'enemy-death',
    glow: profile.glow,
    ring: profile.ring,
    x, y,
    frame: 0,
    frameRate: mobile ? 0.48 : 0.32,
    totalFrames: profile.frames,
    size: mobile ? Math.max(32, count * profile.size * 0.72) : Math.max(50, count * profile.size),
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
    drawMissileExplosionOverlay(ctx, p);
  }
}

function drawMissileExplosionOverlay(ctx, p) {
  if (!p.missileType || p.dedicatedMissileFx) return;
  const progress = Math.max(0, Math.min(1, p.frame / Math.max(1, p.totalFrames)));
  const alpha = Math.max(0, 1 - progress);
  const radius = p.size * (0.24 + progress * 0.78);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha * 0.72;
  ctx.strokeStyle = p.ring || '#fde047';
  ctx.lineWidth = Math.max(2, p.size * (p.missileType === 'nuke' ? 0.075 : 0.045));
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = p.glow || '#f97316';
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius * 0.56, 0, Math.PI * 2);
  ctx.fill();

  if (p.missileType === 'ice') {
    ctx.globalAlpha = alpha * 0.75;
    ctx.strokeStyle = '#dffbff';
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + progress * 0.4;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * radius * 0.25, p.y + Math.sin(a) * radius * 0.25);
      ctx.lineTo(p.x + Math.cos(a) * radius * 0.95, p.y + Math.sin(a) * radius * 0.95);
      ctx.stroke();
    }
  } else if (p.missileType === 'ray') {
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = Math.max(2, p.size * 0.035);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + progress * 0.8;
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(a) * radius * 0.85, p.y - Math.sin(a) * radius * 0.85);
      ctx.lineTo(p.x + Math.cos(a) * radius * 0.85, p.y + Math.sin(a) * radius * 0.85);
      ctx.stroke();
    }
  }
  ctx.restore();
}
