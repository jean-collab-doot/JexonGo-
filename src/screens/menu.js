import { $ } from '../utils/dom.js';
import { G } from '../state.js';

// ── ASSET LOADING ─────────────────────────────────────────────────────────────
let _shipImg = null;

function loadMenuAssets() {
  if (_shipImg) return; // already loaded
  _shipImg = new Image();
  _shipImg.src = '/public/assets/menu/menu-ship.png';
}

// ── SHIP STATE ────────────────────────────────────────────────────────────────
// Two ships flying at different heights / speeds for depth
const SHIPS = [
  { x: -120, y: 0.58, speed: 1.4, scale: 2.8, frame: 0, rate: 0.10 },
  { x: -300, y: 0.72, speed: 0.9, scale: 1.8, frame: 2, rate: 0.07 },
];
const SHIP_FRAMES = 4;

// ── CANVAS DRAW ───────────────────────────────────────────────────────────────
let _raf = null;

function drawFrame() {
  const canvas = document.getElementById('menu-canvas');
  if (!canvas) return;

  // Stop loop when menu is hidden
  if (document.getElementById('s-menu')?.classList.contains('hidden')) {
    _raf = null;
    return;
  }

  // Keep canvas pixels matching CSS size
  const dW = canvas.clientWidth  || 360;
  const dH = canvas.clientHeight || 640;
  if (canvas.width !== dW || canvas.height !== dH) {
    canvas.width  = dW;
    canvas.height = dH;
  }

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Canvas is transparent — background image is handled by CSS on #s-menu
  ctx.clearRect(0, 0, dW, dH);

  // ── Ships ───────────────────────────────────────────────────────────────────
  if (_shipImg && _shipImg.complete && _shipImg.naturalWidth) {
    const fw = _shipImg.naturalWidth / SHIP_FRAMES;
    const fh = _shipImg.naturalHeight;

    for (const s of SHIPS) {
      s.x     += s.speed;
      s.frame  = (s.frame + s.rate) % SHIP_FRAMES;
      if (s.x > dW + 160) s.x = -120;

      const f     = Math.floor(s.frame);
      const drawW = fw * s.scale;
      const drawH = fh * s.scale;
      const cy    = dH * s.y;

      ctx.drawImage(_shipImg, f * fw, 0, fw, fh,
        s.x - drawW / 2, cy - drawH / 2, drawW, drawH);
    }
  }

  _raf = requestAnimationFrame(drawFrame);
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

export function initMenu(nav) {
  loadMenuAssets();
  $('btn-play').onclick     = () => nav.toMap();
  $('btn-hangar').onclick   = () => nav.toHangar();
  $('btn-practice').onclick = () => nav.toGame(1, true);
}

export function renderMenu() {
  $('menu-xp').textContent     = G.xp.toLocaleString();
  $('menu-levels').textContent = Object.keys(G.levelStars).length;
  const totalStars             = Object.values(G.levelStars).reduce((s, v) => s + v, 0);
  $('menu-stars').textContent  = totalStars;

  // Reset ship positions for fresh entry
  SHIPS[0].x = -120;
  SHIPS[1].x = -340;

  // Start canvas loop if not running
  if (!_raf) drawFrame();
}
