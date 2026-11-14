// Paints the ⓘ plane-info "radar screen" (green background, or the lobby's
// hangar floor for AMÉLIORER and the ⓘ window, + plane portrait)
// through the same barrel-lens warp as the level map's territory backdrop
// (see levelmap-fisheye.js), so the whole screen bulges like an old CRT tube
// instead of showing a flat picture. Kept separate from that module because
// it targets a plain portrait image, not the map's board/route layout.
const STRENGTH = 0.22;
const MAX_PIXELS = 900_000;
const images = new Map();

// onLoad gets the picture, or null if it could not be loaded.
function loadImage(src, onLoad) {
  const cached = images.get(src);
  if (cached) {
    if (cached.complete) onLoad(cached.naturalWidth ? cached : null);
    else {
      cached.addEventListener('load', () => onLoad(cached), { once: true });
      cached.addEventListener('error', () => onLoad(null), { once: true });
    }
    return;
  }
  const img = new Image();
  images.set(src, img);
  img.addEventListener('load', () => onLoad(img), { once: true });
  img.addEventListener('error', () => onLoad(null), { once: true });
  img.src = src;
}

// The parking spot of the lobby's hangar picture (hangar-door frame 19,
// 1536 x 1024): centre of the yellow box the plane stands in, and how much
// of the floor the screen shows.
const FLOOR_CX = 768, FLOOR_CY = 575, FLOOR_VIEW_H = 880;

function drawFloor(ctx, w, h, floor) {
  const iw = floor.naturalWidth, ih = floor.naturalHeight;
  const sx = iw / 1536, sy = ih / 1024;
  let srcH = FLOOR_VIEW_H * sy;
  let srcW = srcH * (w / h);
  if (srcW > iw) { srcW = iw; srcH = srcW / (w / h); }
  if (srcH > ih) { srcH = ih; srcW = srcH * (w / h); }
  const x = Math.max(0, Math.min(iw - srcW, FLOOR_CX * sx - srcW / 2));
  const y = Math.max(0, Math.min(ih - srcH, FLOOR_CY * sy - srcH / 2));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(floor, x, y, srcW, srcH, 0, 0, w, h);
  ctx.fillStyle = 'rgba(8, 12, 16, .16)';   // a bit darker so the plane stands out
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawFlat(ctx, w, h, image, locked, floor = null) {
  if (floor) drawFloor(ctx, w, h, floor);
  else {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.72);
    grad.addColorStop(0,   '#8fbf4a');
    grad.addColorStop(0.6, '#56802a');
    grad.addColorStop(1,   '#2f4a14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  if (!image) return;
  // A little bigger on the hangar floor, to fill its parking spot.
  const maxW = w * (floor ? 0.72 : 0.62), maxH = h * (floor ? 0.9 : 0.82);
  const ratio = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight);
  const dw = image.naturalWidth * ratio, dh = image.naturalHeight * ratio;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // 'secret' (F-117 not owned yet): an all-black silhouette with "???".
  if (locked === 'secret') {
    ctx.filter = 'brightness(0)';
  } else if (locked) {
    ctx.filter = 'grayscale(1) brightness(.72)';
    ctx.globalAlpha = 0.7;
  }
  if (floor) {
    // Parked on the floor: a soft shadow under the plane.
    const k = ctx.getTransform().a || 1;
    ctx.shadowColor = 'rgba(0, 0, 0, .5)';
    ctx.shadowBlur = 6 * k;
    ctx.shadowOffsetX = 4 * k;
    ctx.shadowOffsetY = 7 * k;
  }
  ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
  ctx.restore();
  if (locked === 'secret') {
    ctx.save();
    ctx.font = `${Math.round(Math.min(w, h) * 0.2)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 8;
    ctx.fillText('???', w / 2, h / 2);
    ctx.restore();
  }
}

// Barrel distortion: output -> source lookup, scaled so the corners stay put
// (no black corners) and the centre is magnified by (1 + STRENGTH).
function applyLens(srcCtx, outCtx, W, H) {
  const src = srcCtx.getImageData(0, 0, W, H).data;
  const out = outCtx.createImageData(W, H);
  const dst = out.data;
  const norm = 1 / (1 + STRENGTH);
  for (let y = 0; y < H; y++) {
    const ny = ((y + .5) / H) * 2 - 1;
    for (let x = 0; x < W; x++) {
      const nx = ((x + .5) / W) * 2 - 1;
      const f = (1 + STRENGTH * (nx * nx + ny * ny) * .5) * norm;
      const sx = ((nx * f + 1) / 2) * W - .5;
      const sy = ((ny * f + 1) / 2) * H - .5;
      const x0 = Math.max(0, Math.min(W - 2, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(H - 2, Math.floor(sy)));
      const fx = Math.max(0, Math.min(1, sx - x0));
      const fy = Math.max(0, Math.min(1, sy - y0));
      const i00 = (y0 * W + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + W * 4;
      const i11 = i01 + 4;
      const o = (y * W + x) * 4;
      dst[o]     = src[i00]     * (1 - fx) * (1 - fy) + src[i10]     * fx * (1 - fy) + src[i01]     * (1 - fx) * fy + src[i11]     * fx * fy;
      dst[o + 1] = src[i00 + 1] * (1 - fx) * (1 - fy) + src[i10 + 1] * fx * (1 - fy) + src[i01 + 1] * (1 - fx) * fy + src[i11 + 1] * fx * fy;
      dst[o + 2] = src[i00 + 2] * (1 - fx) * (1 - fy) + src[i10 + 2] * fx * (1 - fy) + src[i01 + 2] * (1 - fx) * fy + src[i11 + 2] * fx * fy;
      dst[o + 3] = 255;
    }
  }
  outCtx.putImageData(out, 0, 0);
}

// Paints `canvas` (sized to fill its box via CSS) with the warped screen.
// imageSrc may be null (locked/secret plane → background only).
// backdropSrc: a picture to use instead of the green background.
export function paintPlaneInfoFisheye(canvas, imageSrc, locked = false, { backdropSrc = null } = {}) {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW < 2 || cssH < 2) return;

  let scale = Math.min(window.devicePixelRatio || 1, 2);
  while (cssW * scale * cssH * scale > MAX_PIXELS) scale *= .85;
  const W = Math.max(2, Math.round(cssW * scale));
  const H = Math.max(2, Math.round(cssH * scale));

  const paint = (image, floor = null) => {
    if (!canvas.isConnected) return;
    const flat = document.createElement('canvas');
    flat.width = W;
    flat.height = H;
    const flatCtx = flat.getContext('2d', { willReadFrequently: true });
    flatCtx.scale(W / cssW, H / cssH);
    drawFlat(flatCtx, cssW, cssH, image, locked, floor);

    canvas.width = W;
    canvas.height = H;
    applyLens(flatCtx, canvas.getContext('2d'), W, H);
  };

  // Waits for both pictures, then paints once.
  const withPlane = floor => {
    if (imageSrc) loadImage(imageSrc, image => paint(image, floor));
    else paint(null, floor);
  };
  if (backdropSrc) loadImage(backdropSrc, withPlane);
  else withPlane(null);
}
