// ── SPRITE-ONLY AIRCRAFT RENDERING ───────────────────────────────────────────
import { drawFrame, AIRCRAFT_SPRITE } from './sprites.js';
import { isPhone, isTablet, isTouchMobile } from '../utils/device.js';

const ENGINE_OFFSETS = {
  f16:  [{ x:  0,     y:  0.38 }],
  f35:  [{ x:  0,     y:  0.38 }],
  f18:  [{ x: -0.12,  y:  0.35 }, { x:  0.12,  y:  0.35 }],
  f22:  [{ x: -0.13,  y:  0.35 }, { x:  0.13,  y:  0.35 }],
  sr71: [{ x: -0.18,  y:  0.28 }, { x:  0.18,  y:  0.28 }],
  a10:  [{ x: -0.08,  y:  0.22 }, { x:  0.08,  y:  0.22 }],
  b2:   [{ x: -0.22,  y:  0.1  }, { x: -0.07,  y:  0.1  }, { x:  0.07, y: 0.1 }, { x:  0.22, y: 0.1 }],
};

let _spriteCanvasW = 0;
let _cachedPlayerSize = 0, _cachedPlayerSizeW = -1;
let _cachedEnemyScale = 0, _cachedEnemyScaleW = -1;

export function setSpriteCanvasWidth(w) {
  _spriteCanvasW = w || 0;
  _cachedPlayerSizeW = -1;
  _cachedEnemyScaleW = -1;
}

function _layoutWidth() {
  return _spriteCanvasW || window.innerWidth;
}

function _clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getPlayerSize() {
  const w = _layoutWidth();
  if (_cachedPlayerSizeW !== w) {
    _cachedPlayerSizeW = w;
    if (isTouchMobile()) {
      const max = isPhone() ? 66 : 82;
      _cachedPlayerSize = Math.round(_clamp(w * 0.16, 46, max));
    } else {
      const narrow = w <= 520;
      _cachedPlayerSize = narrow ? 85 : 150;
    }
  }
  return _cachedPlayerSize;
}

function getEnemyScale() {
  const w = _layoutWidth();
  if (_cachedEnemyScaleW !== w) {
    _cachedEnemyScaleW = w;
    if (isTouchMobile()) {
      _cachedEnemyScale = isPhone() ? 1.8 : isTablet() ? 2.25 : 2.5;
    } else {
      const narrow = w <= 520;
      _cachedEnemyScale = narrow ? 3.2 : 4.8;
    }
  }
  return _cachedEnemyScale;
}
export { getPlayerSize };

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

export function drawAircraftPreview(ctx, aircraftId, cx, cy, size) {
  const key = AIRCRAFT_SPRITE[aircraftId] ?? 'ship-t6';
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'screen';
  drawFrame(ctx, key, 0, cx, cy, size, size);
  ctx.restore();
}

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
    ctx.rotate(-Math.PI / 2);
    drawFrame(ctx, 'fire-ball', frame, 0, 0, fw, fh);
    ctx.restore();
  }

  ctx.restore();
}
