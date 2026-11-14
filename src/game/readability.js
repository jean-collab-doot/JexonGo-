// Readability of the targets over the scenery (game.js, wingmen.js):
//  * the world (ocean, islands, clouds) is drawn a little darker and less
//    colourful during play, so the planes and shots stand out;
//  * every plane casts a shadow of its own shape below it, so it reads as
//    flying above the scenery; enemy planes also get a thin dark outline;
//  * enemy shots get a dark halo too (missiles.js).
// No ctx.filter (missing on older Safari). The shadows are hard canvas
// shadows (no blur, cheap); only the enemy outline uses a small blur, and
// there are only a few enemies on screen. The shot halo is drawn once into a
// small canvas and reused, like the glows of missiles.js.

// How much the world fades: share of grey mixed in, and the dark veil.
export const WORLD_DESATURATE = 0.28;
export const WORLD_DARKEN = 'rgba(6, 14, 30, 0.16)';

// Desaturates then darkens everything drawn so far (call it after the
// background and the clouds, before the planes and shots).
export function drawWorldDim(ctx, width, height) {
  ctx.save();
  ctx.globalCompositeOperation = 'saturation';
  ctx.globalAlpha = WORLD_DESATURATE;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = WORLD_DARKEN;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

const _soft = new Map();
// A soft round blob: `core` share of the radius fully `color`, then fading.
function softSprite(color, core) {
  const key = `${color}|${core}`;
  let c = _soft.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(core, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    _soft.set(key, c);
  }
  return c;
}

// Shadow of a plane, in its own shape: draw() paints the plane, and the
// canvas casts a hard, see-through copy of it below and to the right (light
// from the top left), as if it flew above the scenery. No blur: crisp like
// the pixel art, and cheap.
export function withPlaneShadow(ctx, size, draw) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 10, 28, 0.42)';
  ctx.shadowOffsetX = Math.round(size * 0.09);
  ctx.shadowOffsetY = Math.round(size * 0.15);
  ctx.shadowBlur = 0;
  draw();
  ctx.restore();
}

// Enemy plane: its shadow, then a thin dark outline around its shape (the
// plane drawn a second time with a small dark glow) so it stands out from
// the scenery. Only a few enemies are on screen, so the small blur is fine.
export function withEnemyOutline(ctx, size, draw) {
  withPlaneShadow(ctx, size, draw);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = Math.max(2, Math.round(size * 0.05));
  draw();
  ctx.restore();
}

const SHOT_HALO_COLOR = 'rgba(20, 0, 0, 0.6)';
// Dark halo behind an enemy shot (missiles.js).
export function drawShotHalo(ctx, x, y, radius) {
  ctx.drawImage(softSprite(SHOT_HALO_COLOR, 0.35), x - radius, y - radius, radius * 2, radius * 2);
}
