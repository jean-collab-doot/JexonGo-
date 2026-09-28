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

export function createMissile(x, y, tx, ty, speed, enemyId, color = '#00d4ff', damage = 1, homing = false) {
  const dx = tx - x, dy = ty - y;
  const d  = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x, y,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    tx, ty, enemyId, color, damage, homing,
    boltFrame: 0,
  };
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

// findTarget(missile) -> {x,y} | null — when given, a homing missile (see
// createMissile's `homing` flag, F-22's PRECISION ability) steers toward that
// point each frame instead of flying its original straight line, so it always
// reaches an enemy that is still on screen instead of possibly missing it.
const HOMING_TURN_RATE = 0.12;

export function updateMissiles(missiles, onHit, step = 1, findTarget = null) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    if (m.homing && findTarget) {
      const target = findTarget(m);
      if (target) {
        const dx = target.x - m.x, dy = target.y - m.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || 1;
        const desiredVx = (dx / d) * speed, desiredVy = (dy / d) * speed;
        const turn = Math.min(1, HOMING_TURN_RATE * step);
        m.vx += (desiredVx - m.vx) * turn;
        m.vy += (desiredVy - m.vy) * turn;
      }
    }
    m.x += m.vx * step;
    m.y += m.vy * step;
    m.boltFrame = (m.boltFrame + BOLT_FRAME_RATE * step) % BOLT_FRAMES;
    if (onHit(m)) { missiles.splice(i, 1); continue; }
    if (m.y < -80 || m.x < -100 || m.x > 4000) missiles.splice(i, 1);
  }
}

// ── DRAW ──────────────────────────────────────────────────────────────────────

// Performance: a soft glow is drawn once per colour into a small canvas and
// reused, instead of ctx.shadowBlur on every bullet every frame (shadowBlur
// is one of the slowest canvas operations, especially on phones).
const _glows = new Map();
function glowSprite(color) {
  let c = _glows.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.75;
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    _glows.set(color, c);
  }
  return c;
}
// Glow of `radius` px around (x, y); w/h stretch it for long shapes.
function drawGlow(ctx, color, x, y, w, h = w) {
  ctx.drawImage(glowSprite(color), x - w, y - h, w * 2, h * 2);
}

export function drawMissiles(ctx, missiles, isEnemy = false) {
  const scale = isTouchMobile() ? 0.78 : 1;
  const w = BOLT_W * scale;
  const h = BOLT_H * scale;
  for (const m of missiles) {
    if (m.type === 'player-laser') {
      // Player laser (hangar UPGRADE weapon): a long, glowing orange beam.
      const angle = Math.atan2(m.vy, m.vx);
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(angle);
      drawGlow(ctx, '#ff8a1f', 0, 0, 34 * scale, 14 * scale);
      ctx.fillStyle = '#ff8a1f';
      ctx.fillRect(-22 * scale, -3 * scale, 44 * scale, 6 * scale);
      ctx.fillStyle = '#fff1d6';
      ctx.fillRect(-20 * scale, -1.2 * scale, 40 * scale, 2.4 * scale);
      ctx.restore();
      continue;
    }
    if (m.type === 'player-gau8') {
      // A-10 GAU-8 shell: a bigger round orange shell with a hot core.
      ctx.save();
      drawGlow(ctx, '#ff7a00', m.x, m.y, 16 * scale);
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 6 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff4d6';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 2.6 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    if (m.type === 'player-machine-gun') {
      // Player machine-gun bullet: a small round, glowing yellow ball.
      ctx.save();
      drawGlow(ctx, '#ffb000', m.x, m.y, 12 * scale);
      ctx.fillStyle = '#fff6a8';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 4 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    if (m.type === 'enemy-machine-gun') {
      const angle = Math.atan2(m.vy, m.vx);
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(angle);
      drawGlow(ctx, '#ffb000', 0, 0, 16 * scale, 8 * scale);
      ctx.fillStyle = '#fff6a8';
      ctx.fillRect(-8 * scale, -1.5 * scale, 16 * scale, 3 * scale);
      ctx.restore();
      continue;
    }
    if (m.type === 'enemy-blue-dot') {
      // F-5 laser: a round, glowing blue dot with a bright white core.
      const r = 5 * scale;
      ctx.save();
      drawGlow(ctx, '#38bdf8', m.x, m.y, r * 3.2);
      ctx.fillStyle = '#1d9bf0';
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0f7ff';
      ctx.beginPath();
      ctx.arc(m.x, m.y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    if (m.type === 'enemy-homing') {
      // Homing F-15 missile: the game's real missile sprite, turned along its
      // path, with a short smoke trail behind it.
      const angle = Math.atan2(m.vy, m.vx);
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(210,210,210,0.3)';
      ctx.beginPath();
      ctx.ellipse(-h * 0.75, 0, h * 0.35, w * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawFrame(ctx, 'bolt', m.boltFrame || 0, m.x, m.y, w, h, { rotate: angle + Math.PI / 2 });
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
