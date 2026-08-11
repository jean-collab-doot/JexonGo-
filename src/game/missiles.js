// ── SPRITE-BASED MISSILES ─────────────────────────────────────────────────────
// Uses the upright rocket sprite sheet and rotates it to match the missile travel.

import { drawFrame } from './sprites.js';
import { isTouchMobile } from '../utils/device.js';
import { G } from '../state.js';

const BOLT_FRAMES     = 12;
const BOLT_W          = 24;
const BOLT_H          = 56;
const BOLT_FRAME_RATE = 0.38;
const PLAYER_MISSILE_SPRITES = {
  fire: 'missile-fire',
  ice: 'missile-ice',
  nuke: 'missile-nuke',
  ray: 'missile-ray',
  xray: 'airdrop-xray',
};

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

export function updateMissiles(missiles, onHit, step = 1) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.x += m.vx * step;
    m.y += m.vy * step;
    m.boltFrame = (m.boltFrame + BOLT_FRAME_RATE * step) % BOLT_FRAMES;
    if (onHit(m)) { missiles.splice(i, 1); continue; }
    if (m.y < -80 || m.x < -100 || m.x > 4000) missiles.splice(i, 1);
  }
}

// ── DRAW ──────────────────────────────────────────────────────────────────────

export function drawMissiles(ctx, missiles, isEnemy = false) {
  const scale = isTouchMobile() ? 0.78 : 1;
  const w = BOLT_W * scale;
  const h = BOLT_H * scale;
  for (const m of missiles) {
    if (m.type === 'enemy-machine-gun') {
      const angle = Math.atan2(m.vy, m.vx);
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(angle);
      ctx.fillStyle = '#fff6a8';
      ctx.shadowColor = '#ffb000';
      ctx.shadowBlur = 7;
      ctx.fillRect(-8 * scale, -1.5 * scale, 16 * scale, 3 * scale);
      ctx.restore();
      continue;
    }
    const isLaser = m.type === 'xray' || m.type === 'enemy-laser';
    const spriteKey = m.type === 'enemy-laser'
      ? 'airdrop-xray'
      : isEnemy
        ? 'bolt'
        : (PLAYER_MISSILE_SPRITES[m.type] || PLAYER_MISSILE_SPRITES[G.activeMissileType] || 'bolt');
    const travelAngle = Math.atan2(m.vy, m.vx);
    const rot = isLaser ? travelAngle : travelAngle + Math.PI / 2;
    drawFrame(ctx, spriteKey, m.boltFrame || 0, m.x, m.y, isLaser ? 62 * scale : w, isLaser ? 26 * scale : h, { rotate: rot });
  }
}
