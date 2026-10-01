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

let _spriteCanvasH = 0;

export function setSpriteCanvasWidth(w, h = 0) {
  _spriteCanvasW = w || 0;
  _spriteCanvasH = h || 0;
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
      const min = isPhone() ? 48 : 72;
      const max = isPhone() ? 62 : 96;
      _cachedPlayerSize = Math.round(_clamp(w * 0.18, min, max));
    } else {
      const narrow = w <= 520;
      _cachedPlayerSize = narrow ? 64 : 112;
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
    const size = isTouchMobile()
      ? _clamp(w * 0.40, 115, 170)
      : _clamp(w * 0.34, 180, 300);
    // Never bigger than the playfield allows: on a short / landscape screen
    // the width-based size alone pushed the boss half off the top.
    const h = _spriteCanvasH || window.innerHeight;
    return Math.round(Math.min(size, h * 0.34, w * 0.9));
  }
  return isTouchMobile() ? getTouchEnemySize() : enemy.size * getEnemyScale();
}

export { getPlayerSize };

export function drawAircraftSprite(ctx, aircraftId, cx, cy, frame, alpha = 1, bankAngle = 0, skinFilter = '') {
  const key = AIRCRAFT_SPRITE[aircraftId] ?? 'ship-t6';
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (alpha !== 1)  ctx.globalAlpha = alpha;
  if (skinFilter) ctx.filter = skinFilter;
  const sz = getPlayerSize();
  drawFrame(ctx, key, frame, cx, cy, sz, sz, { rotate: bankAngle });
  ctx.restore();
}

export function drawAircraftSpriteSized(ctx, aircraftId, cx, cy, size, frame, alpha = 1, bankAngle = 0, skinFilter = '') {
  const key = AIRCRAFT_SPRITE[aircraftId] ?? 'ship-t6';
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (skinFilter) ctx.filter = skinFilter;
  drawFrame(ctx, key, frame, cx, cy, size, size, { rotate: bankAngle });
  ctx.restore();
}

// Width / height of one frame of the STS engine sheet (176 x 250).
const STS_FRAME_RATIO = 176 / 250;

export function drawEnemySprite(ctx, enemy, bankAngle = 0) {
  const size = getEnemyDrawSize(enemy);
  const rotation = Number.isFinite(enemy.headingAngle) ? enemy.headingAngle : bankAngle;
  const spawnAlpha = Math.max(0, Math.min(1, enemy.spawnAlpha ?? 1));
  if (spawnAlpha < 1) {
    ctx.save();
    ctx.globalAlpha *= spawnAlpha;
  }
  // Banking enemies (fast / turner): when moving sideways hard enough, swap the
  // level-flight sheet for a dedicated bank pose. Sheet row 0 = bank right,
  // row 1 = bank left; the enemy is drawn 180°-flipped so a screen-right turn
  // needs the source's LEFT-bank pose (row 1) and vice-versa.
  // Drive the bank pose off a smoothed signal (bankVis) rather than the raw
  // per-frame vx: without it the plane snapped from a deep bank straight to
  // level — and briefly to a yaw the opposite way — the instant a turn ended.
  const bankSignal = enemy.bankSpriteKey ? (enemy.bankVis ?? enemy.vx ?? 0) : 0;
  const bankLevel = enemy.bankSpriteKey
    ? Math.min(4, Math.round(Math.abs(bankSignal) * 3.2))
    : 0;
  if (bankLevel > 0) {
    const row = bankSignal > 0 ? 5 : 0;
    const drawWidth = size;
    const drawEnemyFrame = () => drawFrame(
      ctx, enemy.bankSpriteKey, row + bankLevel, enemy.x, enemy.y, drawWidth, size, { rotate: Math.PI });
    if (enemy.spriteFilter) {
      ctx.save();
      ctx.filter = enemy.spriteFilter;
      drawEnemyFrame();
      ctx.restore();
    } else {
      drawEnemyFrame();
    }
    if (spawnAlpha < 1) ctx.restore();
    return;
  }

  const drawEnemyFrame = () => {
    if (enemy.interpolateFrames) {
      const current = Math.floor(enemy.animFrame || 0);
      const next = Math.min(11, current + 1);
      const blend = Math.max(0, Math.min(1, (enemy.animFrame || 0) - current));
      const drawWidth = enemy.spaceShuttleBoss ? size * STS_FRAME_RATIO : size;
      drawFrame(ctx, enemy.spriteKey, current, enemy.x, enemy.y, drawWidth, size,
        { rotate: Math.PI + rotation, alpha: 1 - blend });
      if (blend > 0.001 && next !== current) {
        drawFrame(ctx, enemy.spriteKey, next, enemy.x, enemy.y, drawWidth, size,
          { rotate: Math.PI + rotation, alpha: blend });
      }
    } else {
      const drawWidth = enemy.spaceShuttleBoss ? size * STS_FRAME_RATIO : size;
      // STS: its engine flames loop continuously (10 frames, ~11 fps).
      const frame = enemy.spaceShuttleBoss
        ? Math.floor(performance.now() / 90) % 10
        : enemy.animFrame;
      drawFrame(ctx, enemy.spriteKey, frame, enemy.x, enemy.y, drawWidth, size,
        { rotate: Math.PI + rotation });
    }
  };
  if (enemy.spriteFilter) {
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
