// Paints the level-map backdrop (grid, "+" marks, territory artwork) onto a
// canvas through a fisheye / ultra-wide-angle lens: the centre bulges and lines
// bow outward toward the edges, while the picture still fills the whole panel.
import { MAJOR_X, MAJOR_Y, layoutBoard } from './levelmap-territories.js';

const STRENGTH = 0.16;
const MAX_PIXELS = 1.6e6;
const images = new Map();

function loadImage(src, onLoad) {
  const cached = images.get(src);
  if (cached) {
    if (cached.complete && cached.naturalWidth) onLoad(cached);
    else cached.addEventListener('load', () => onLoad(cached), { once: true });
    return;
  }
  const img = new Image();
  images.set(src, img);
  img.addEventListener('load', () => onLoad(img), { once: true });
  img.src = src;
}

function drawFlat(ctx, w, h, image, art) {
  const grid = (step, alpha) => {
    ctx.strokeStyle = `rgba(150,200,60,${alpha})`;
    ctx.beginPath();
    for (let x = 0; x <= w; x += step) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); }
    for (let y = 0; y <= h; y += step) { ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); }
    ctx.stroke();
  };
  ctx.lineWidth = 1;
  grid(6, .07);
  grid(24, .09);

  const { art: rect, board } = layoutBoard(w, h, art?.ratio, art?.pinned);
  if (image) ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);

  ctx.strokeStyle = 'rgba(150,200,60,.34)';
  ctx.beginPath();
  MAJOR_X.forEach(p => { const x = Math.round(board.x + board.w * p / 100) + .5; ctx.moveTo(x, 0); ctx.lineTo(x, h); });
  MAJOR_Y.forEach(p => { const y = Math.round(board.y + board.h * p / 100) + .5; ctx.moveTo(0, y); ctx.lineTo(w, y); });
  ctx.stroke();

  ctx.strokeStyle = 'rgba(190,230,100,.65)';
  ctx.beginPath();
  MAJOR_X.forEach(px => MAJOR_Y.forEach(py => {
    const x = Math.round(board.x + board.w * px / 100) + .5;
    const y = Math.round(board.y + board.h * py / 100) + .5;
    ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y);
    ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7);
  }));
  ctx.stroke();
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
      const w00 = (1 - fx) * (1 - fy) * src[i00 + 3];
      const w10 = fx * (1 - fy) * src[i10 + 3];
      const w01 = (1 - fx) * fy * src[i01 + 3];
      const w11 = fx * fy * src[i11 + 3];
      const a = w00 + w10 + w01 + w11;
      const o = (y * W + x) * 4;
      if (a > 0) {
        dst[o] = (src[i00] * w00 + src[i10] * w10 + src[i01] * w01 + src[i11] * w11) / a;
        dst[o + 1] = (src[i00 + 1] * w00 + src[i10 + 1] * w10 + src[i01 + 1] * w01 + src[i11 + 1] * w11) / a;
        dst[o + 2] = (src[i00 + 2] * w00 + src[i10 + 2] * w10 + src[i01 + 2] * w01 + src[i11 + 2] * w11) / a;
        dst[o + 3] = a;
      }
    }
  }
  outCtx.putImageData(out, 0, 0);
}

// The lens pass is per-pixel work, so each finished backdrop is cached (keyed
// by artwork + pixel size) and painted with a plain drawImage afterwards. That
// keeps switching worlds smooth: warmFisheye() fills the cache in the
// background so nothing heavy runs while the slide animation is playing.
const rendered = new Map();
let renderedSize = '';

function backdropSize(stage) {
  const cssW = stage.clientWidth;
  const cssH = stage.clientHeight;
  if (cssW < 2 || cssH < 2) return null;
  let scale = Math.min(window.devicePixelRatio || 1, 2);
  while (cssW * scale * cssH * scale > MAX_PIXELS) scale *= .85;
  const W = Math.max(2, Math.round(cssW * scale));
  const H = Math.max(2, Math.round(cssH * scale));
  const size = `${cssW}x${cssH}@${W}x${H}`;
  if (size !== renderedSize) { rendered.clear(); renderedSize = size; }
  return { cssW, cssH, W, H };
}

function buildBackdrop(image, art, { cssW, cssH, W, H }) {
  const flat = document.createElement('canvas');
  flat.width = W;
  flat.height = H;
  const flatCtx = flat.getContext('2d', { willReadFrequently: true });
  flatCtx.scale(W / cssW, H / cssH);
  drawFlat(flatCtx, cssW, cssH, image, art);

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  applyLens(flatCtx, out.getContext('2d'), W, H);
  return out;
}

// Where a point of the flat artwork ends up after the lens, so level nodes sit
// exactly on their place on the distorted map. Inverts source = out * f(|out|).
function lensPoint(W, H, px, py) {
  const nx = (px / W) * 2 - 1;
  const ny = (py / H) * 2 - 1;
  let ox = nx;
  let oy = ny;
  for (let i = 0; i < 12; i++) {
    const f = (1 + STRENGTH * (ox * ox + oy * oy) * .5) / (1 + STRENGTH);
    ox = nx / f;
    oy = ny / f;
  }
  return [((ox + 1) / 2) * W, ((oy + 1) / 2) * H];
}

// Node positions (percent of the board) corrected for the lens.
export function lensPositions(stage, art, positions) {
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  if (W < 2 || H < 2) return null;
  const { board } = layoutBoard(W, H, art?.ratio, art?.pinned);
  return positions.map(([x, y]) => {
    const [lx, ly] = lensPoint(W, H, board.x + (board.w * x) / 100, board.y + (board.h * y) / 100);
    return [((lx - board.x) / board.w) * 100, ((ly - board.y) / board.h) * 100];
  });
}

export function paintFisheye(stage, art) {
  const canvas = stage.querySelector('.tmap-canvas');
  const dims = canvas && backdropSize(stage);
  if (!dims) return;

  // The level nodes live in the same rectangle the artwork is fitted to.
  const { board } = layoutBoard(dims.cssW, dims.cssH, art?.ratio, art?.pinned);
  const boardEl = canvas.nextElementSibling;
  if (boardEl?.classList.contains('tmap-board')) {
    boardEl.style.left = `${board.x}px`;
    boardEl.style.top = `${board.y}px`;
    boardEl.style.width = `${board.w}px`;
    boardEl.style.height = `${board.h}px`;
    if (art?.nodeSize) boardEl.style.setProperty('--tn', `${art.nodeSize(board.w, board.h)}px`);
    else boardEl.style.removeProperty('--tn');
  }

  const paint = image => {
    if (!canvas.isConnected) return;
    const key = art?.src || '';
    let out = rendered.get(key);
    if (!out) {
      out = buildBackdrop(image, art, dims);
      rendered.set(key, out);
    }
    canvas.width = dims.W;
    canvas.height = dims.H;
    canvas.getContext('2d').drawImage(out, 0, 0);
  };

  if (art) loadImage(art.src, paint);
  else paint(null);
}

// Loads the artwork and builds every backdrop ahead of time, one per task so
// the main thread is never blocked for more than a single lens pass.
export function warmFisheye(stage, arts) {
  const queue = arts.filter(Boolean);
  const next = () => {
    const art = queue.shift();
    if (!art) return;
    const dims = backdropSize(stage);
    if (!dims || rendered.has(art.src)) { setTimeout(next, 0); return; }
    loadImage(art.src, image => {
      setTimeout(() => {
        const current = backdropSize(stage);
        if (current && !rendered.has(art.src)) rendered.set(art.src, buildBackdrop(image, art, current));
        setTimeout(next, 0);
      }, 0);
    });
  };
  setTimeout(next, 0);
}
