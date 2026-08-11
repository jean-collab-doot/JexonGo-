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
  b2:   [{ x: -0.08,  y:  0.36 }, { x:  0.08,  y:  0.36 }],
};

let _spriteCanvasW = 0;
let _cachedPlayerSize = 0, _cachedPlayerSizeW = -1;
let _cachedEnemyScale = 0, _cachedEnemyScaleW = -1;
let _cachedEnemySize = 0, _cachedEnemySizeW = -1;

export function setSpriteCanvasWidth(w) {
  _spriteCanvasW = w || 0;
  _cachedPlayerSizeW = -1;
  _cachedEnemyScaleW = -1;
  _cachedEnemySizeW = -1;
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
      const min = isPhone() ? 62 : 96;
      const max = isPhone() ? 82 : 128;
      _cachedPlayerSize = Math.round(_clamp(w * 0.24, min, max));
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
      _cachedEnemyScale = isPhone() ? 2.35 : isTablet() ? 2.85 : 3.2;
    } else {
      const narrow = w <= 520;
      _cachedEnemyScale = narrow ? 3.2 : 4.8;
    }
  }
  return _cachedEnemyScale;
}

function getTouchEnemySize() {
  const w = _layoutWidth();
  if (_cachedEnemySizeW !== w) {
    _cachedEnemySizeW = w;
    const min = isPhone() ? 58 : 90;
    const max = isPhone() ? 76 : 120;
    _cachedEnemySize = Math.round(_clamp(w * 0.22, min, max));
  }
  return _cachedEnemySize;
}

export function getEnemyDrawSize(enemy) {
  if (enemy?.a330Boss || enemy?.b52Boss || enemy?.kawasakiBoss || enemy?.c5Boss || enemy?.spaceShuttleBoss) {
    const w = _layoutWidth();
    return Math.round(isTouchMobile()
      ? _clamp(w * 0.56, 160, 235)
      : _clamp(w * 0.48, 250, 430));
  }
  return isTouchMobile() ? getTouchEnemySize() : enemy.size * getEnemyScale();
}

export { getPlayerSize };

export function drawAircraftSprite(ctx, aircraftId, cx, cy, frame, alpha = 1, bankAngle = 0, skinFilter = '') {
  const key = AIRCRAFT_SPRITE[aircraftId] ?? 'ship-t6';
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (alpha !== 1)  ctx.globalAlpha = alpha;
  if (skinFilter && !isPhone()) ctx.filter = skinFilter;
  const sz = getPlayerSize();
  drawFrame(ctx, key, frame, cx, cy, sz, sz, { rotate: bankAngle });
  ctx.restore();
}

export function drawAircraftSpriteSized(ctx, aircraftId, cx, cy, size, frame, alpha = 1, bankAngle = 0, skinFilter = '') {
  const key = AIRCRAFT_SPRITE[aircraftId] ?? 'ship-t6';
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (skinFilter && !isPhone()) ctx.filter = skinFilter;
  drawFrame(ctx, key, frame, cx, cy, size, size, { rotate: bankAngle });
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
  const size = getEnemyDrawSize(enemy);
  const rotation = Number.isFinite(enemy.headingAngle) ? enemy.headingAngle : bankAngle;
  const spawnAlpha = Math.max(0, Math.min(1, enemy.spawnAlpha ?? 1));
  if (spawnAlpha < 1) {
    ctx.save();
    ctx.globalAlpha *= spawnAlpha;
  }
  const drawEnemyFrame = () => {
    if (enemy.interpolateFrames) {
      const current = Math.floor(enemy.animFrame || 0);
      const next = Math.min(11, current + 1);
      const blend = Math.max(0, Math.min(1, (enemy.animFrame || 0) - current));
      const drawWidth = enemy.spaceShuttleBoss ? size * (1254 / 1500) : size;
      drawFrame(ctx, enemy.spriteKey, current, enemy.x, enemy.y, drawWidth, size,
        { rotate: Math.PI + rotation, alpha: 1 - blend });
      if (blend > 0.001 && next !== current) {
        drawFrame(ctx, enemy.spriteKey, next, enemy.x, enemy.y, drawWidth, size,
          { rotate: Math.PI + rotation, alpha: blend });
      }
    } else {
      const drawWidth = enemy.spaceShuttleBoss ? size * (1254 / 1500) : size;
      drawFrame(ctx, enemy.spriteKey, enemy.animFrame, enemy.x, enemy.y, drawWidth, size,
        { rotate: Math.PI + rotation });
    }
  };
  if (enemy.spriteFilter && !isPhone()) {
    ctx.save();
    ctx.filter = enemy.spriteFilter;
    drawEnemyFrame();
    ctx.restore();
  } else {
    drawEnemyFrame();
  }

  // The C-5 source is a single pristine aircraft render. Its rear gun is
  // animated separately so the body never shifts or changes between frames.
  if (enemy.c5Boss) {
    const turretX = enemy.x;
    const turretY = enemy.y - size * 0.165;
    const aim = (enemy.b52TurretAim || 0) / 23;
    const angle = aim * 0.82;
    const barrelLength = size * 0.042;
    const barrelGap = size * 0.009;
    ctx.save();
    ctx.translate(turretX, turretY);
    ctx.rotate(-angle);
    ctx.fillStyle = '#17283a';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.026, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d7e8f3';
    ctx.lineWidth = Math.max(1.5, size * 0.006);
    ctx.lineCap = 'round';
    for (const offset of [-barrelGap, barrelGap]) {
      ctx.beginPath();
      ctx.moveTo(offset, size * 0.004);
      ctx.lineTo(offset, barrelLength);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (spawnAlpha < 1) ctx.restore();

}

export function drawEngineFire(ctx, aircraftId, cx, cy, tick, bankAngle = 0) {
  const offsets = ENGINE_OFFSETS[aircraftId];
  if (!offsets) return;
  const sz    = getPlayerSize();
  const fw    = aircraftId === 'b2' ? sz * 0.2 : sz * 0.28;
  const fh    = aircraftId === 'b2' ? sz * 0.22 : sz * 0.16;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const frame = Math.floor((now / 1000) * 30) % 3;

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
