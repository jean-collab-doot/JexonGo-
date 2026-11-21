// Tanker plane (A330 MRTT) that refuels the player in flight. This module is
// the plane itself: when it comes, how it flies in, holds in formation in
// the upper middle of the screen and leaves, its two hoses with a basket at
// the end (left and right), the targets shown on the baskets, the fuel
// running down a hose. game.js runs the rules around it (attach, lock the
// player on the basket, no enemy fire, refill, shield, co-op).
// Picture: assets/planes/Fuel plane/mrtt.png (120 x 138, nose up, made from
// the player's art), drawn at an integer scale without smoothing.
import { accent } from '../utils/accent.js';

const SRC = '/assets/planes/Fuel%20plane/mrtt.png';
const PIC_W = 120, PIC_H = 138;
// Baskets and hose tops in the picture (pixels).
const BASKETS = [{ x: 20.5, y: 133 }, { x: 96.5, y: 132 }];
const HOSE_TOPS = [{ x: 20.5, y: 77 }, { x: 97, y: 76 }];
const BASKET_PX = 9;               // width of a basket in the picture

export const TANKER_ENTER_MS = 2000;
export const TANKER_WAIT_MS = 10000;   // time to connect
export const TANKER_LEAVE_MS = 1500;
// 35 % of the levels (like the airdrop plane), 30-45 s of flight after the
// start (the airdrop plane comes at 12-20 s).
export const TANKER_LEVEL_CHANCE = 0.35;
export const TANKER_DELAY_MIN_MS = 30000;
export const TANKER_DELAY_MAX_MS = 45000;
const RAINBOW = ['#ff5fa2', '#ffb13b', '#ffe14d', '#5ee87a', '#4cc9ff', '#9b7bff'];

let _img = null;
function picture() {
  if (!_img) { _img = new Image(); _img.src = SRC; }
  return _img;
}

const T = {
  phase: 'idle',        // idle | scheduled | enter | wait | refuel | leave
  due: 0,               // scheduled: flight ms left before it comes
  t: 0,                 // ms in the current phase
  waitLeft: 0,
  x: 0, y: 0, k: 1, w: PIC_W, h: PIC_H, holdY: 0, leaveFromY: 0,
};

export function resetTanker() {
  T.phase = 'idle'; T.due = 0; T.t = 0; T.waitLeft = 0;
  picture();
}

// Rolls whether this level gets a tanker; schedules it when it does.
export function rollTanker() {
  resetTanker();
  if (Math.random() >= TANKER_LEVEL_CHANCE) return false;
  scheduleTanker(TANKER_DELAY_MIN_MS + Math.random() * (TANKER_DELAY_MAX_MS - TANKER_DELAY_MIN_MS));
  return true;
}

export function scheduleTanker(delayMs) {
  T.phase = 'scheduled';
  T.due = delayMs;
}

// Comes right now (test key, or the co-op host's tanker on the guest's screen).
export function callTankerNow() {
  T.phase = 'enter';
  T.t = 0;
  T.y = Infinity;   // placed below the screen on the next update
}

export const tankerPhase = () => T.phase;
export const tankerOnScreen = () => ['enter', 'wait', 'refuel', 'leave'].includes(T.phase);
export const tankerWaiting = () => T.phase === 'wait';
export const tankerWaitLeft = () => T.waitLeft;

function sizeFor(width, height, playerSize) {
  // About 3 times the player's plane, an integer scale, never taller than
  // 45 % of the screen (landscape phones).
  let k = Math.max(1, Math.round((playerSize * 3.1) / PIC_W));
  k = Math.max(1, Math.min(k, Math.floor((height * 0.45) / PIC_H)));
  T.k = k; T.w = PIC_W * k; T.h = PIC_H * k;
  T.holdY = Math.max(T.h * 0.5 + height * 0.06, height * 0.27);
}

const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;

// Moves the tanker. flying: the plane is really flying (the delay before it
// comes only counts then). Returns an event: 'arrive' (starts entering),
// 'ready' (in place, the 10 s to connect start), 'missed' (nobody connected:
// it leaves), 'gone' (left the screen), or ''.
export function updateTanker(ms, { flying, width, height, playerSize, now, paused = false }) {
  let ev = '';
  if (T.phase === 'scheduled') {
    if (flying) T.due -= ms;
    if (T.due <= 0) { callTankerNow(); ev = 'arrive'; } else return '';
  }
  if (T.phase === 'idle') return '';
  sizeFor(width, height, playerSize);
  T.t += ms;
  // Formation: centred, a slow sway, the same speed as the player's plane.
  const sway = Math.sin(now / 1800) * width * 0.015;
  const bob = Math.sin(now / 1300) * 3;
  T.x = width / 2 + sway;
  if (T.phase === 'enter') {
    const p = Math.min(1, T.t / TANKER_ENTER_MS);
    const fromY = height + T.h * 0.6;
    T.y = fromY + (T.holdY - fromY) * easeOut(p);
    if (p >= 1) { T.phase = 'wait'; T.t = 0; T.waitLeft = TANKER_WAIT_MS; ev = ev || 'ready'; }
  } else if (T.phase === 'wait') {
    T.y = T.holdY + bob;
    if (!paused) T.waitLeft -= ms;   // paused: a question to answer first
    if (T.waitLeft <= 0) { leaveTanker(); ev = 'missed'; }
  } else if (T.phase === 'refuel') {
    T.y = T.holdY + bob * 0.4;
  } else if (T.phase === 'leave') {
    const p = Math.min(1, T.t / TANKER_LEAVE_MS);
    T.y = T.leaveFromY + (-T.h * 0.7 - T.leaveFromY) * easeIn(p);
    if (p >= 1) { T.phase = 'idle'; ev = 'gone'; }
  }
  return ev;
}

export function startRefuel() { T.phase = 'refuel'; T.t = 0; }
// Accelerates and leaves the screen (refuel done, or nobody connected).
export function leaveTanker() { T.leaveFromY = T.y; T.phase = 'leave'; T.t = 0; }

// Where basket i is on screen, and the radius of its connect zone (wide
// enough on a phone).
export function basketAt(i, playerSize) {
  const b = BASKETS[i];
  const left = T.x - T.w / 2, top = T.y - T.h / 2;
  return {
    x: left + b.x * T.k, y: top + b.y * T.k,
    r: Math.max(BASKET_PX * T.k * 1.7, playerSize * 0.6, 30),
  };
}

// Where the player's plane is held while connected to basket i: its nose
// (a little above its centre) in the basket.
export function holdPointFor(i, playerSize) {
  const b = basketAt(i, playerSize);
  return { x: b.x, y: b.y + playerSize * 0.4 };
}

// The basket (among `allowed`) whose zone the nose is in, else -1.
export function basketTouched(nose, playerSize, allowed = [0, 1]) {
  if (T.phase !== 'wait') return -1;
  for (const i of allowed) {
    const b = basketAt(i, playerSize);
    if ((nose.x - b.x) ** 2 + (nose.y - b.y) ** 2 <= b.r * b.r) return i;
  }
  return -1;
}

// Draws the tanker. targets: baskets to show as targets (blinking ring and
// pulse), flowing: baskets with fuel running down the hose, arrowFrom: the
// player's nose (an arrow points to the nearest target when it is far),
// gentle: rainbow colours and glitter for the youngest players.
export function drawTanker(ctx, { now, playerSize, targets = [], flowing = [], arrowFrom = null, gentle = false }) {
  if (!tankerOnScreen()) return;
  const img = picture();
  const left = Math.round(T.x - T.w / 2), top = Math.round(T.y - T.h / 2);
  if (img.complete && img.naturalWidth) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, left, top, T.w, T.h);
    ctx.restore();
  }
  // Fuel running down the hose(s).
  for (const i of flowing) {
    const a = HOSE_TOPS[i], b = BASKETS[i];
    const x0 = left + a.x * T.k, y0 = top + a.y * T.k, x1 = left + b.x * T.k, y1 = top + (b.y - 4) * T.k;
    ctx.save();
    for (let d = 0; d < 6; d++) {
      const p = ((now / 600) + d / 6) % 1;
      ctx.fillStyle = gentle ? RAINBOW[d % RAINBOW.length] : (d % 2 ? '#ffd84d' : '#ffb13b');
      const s = Math.max(2, T.k * 2);
      ctx.fillRect(Math.round(x0 + (x1 - x0) * p - s / 2), Math.round(y0 + (y1 - y0) * p - s / 2), s, s);
    }
    ctx.restore();
  }
  if (!targets.length) return;
  // Targets: a ring that pulses and blinks around each basket to reach.
  const blink = Math.floor(now / 260) % 2 === 0;
  for (const i of targets) {
    const b = basketAt(i, playerSize);
    const pulse = 1 + Math.sin(now / 180) * 0.12;
    ctx.save();
    ctx.lineWidth = Math.max(3, T.k * 1.5);
    // Accent cyan (utils/accent.js); rainbow for the youngest players.
    ctx.strokeStyle = gentle ? RAINBOW[Math.floor(now / 140) % RAINBOW.length] : (blink ? accent().main : accent().hover);
    ctx.globalAlpha = blink ? 1 : 0.55;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([6, 6]);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (gentle) {
      ctx.save();
      for (let g = 0; g < 6; g++) {
        const a = now / 400 + g * (Math.PI / 3);
        ctx.fillStyle = RAINBOW[g];
        ctx.fillRect(Math.round(b.x + Math.cos(a) * b.r * 1.15) - 2, Math.round(b.y + Math.sin(a) * b.r * 1.15) - 2, 4, 4);
      }
      ctx.restore();
    }
  }
  // Arrow from the player's nose to the nearest target, while it is far.
  if (arrowFrom) {
    let best = null, bestD = Infinity;
    for (const i of targets) {
      const b = basketAt(i, playerSize);
      const d = Math.hypot(b.x - arrowFrom.x, b.y - arrowFrom.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    if (best && bestD > best.r * 1.6) {
      const ang = Math.atan2(best.y - arrowFrom.y, best.x - arrowFrom.x);
      const ax = arrowFrom.x + Math.cos(ang) * playerSize * 0.8;
      const ay = arrowFrom.y + Math.sin(ang) * playerSize * 0.8;
      const s = Math.max(12, playerSize * 0.28);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = gentle ? RAINBOW[Math.floor(now / 140) % RAINBOW.length] : accent().main;
      ctx.strokeStyle = gentle ? '#3a1d00' : accent().edge;
      ctx.lineWidth = 2;
      ctx.globalAlpha = blink ? 1 : 0.7;
      ctx.beginPath();
      ctx.moveTo(s, 0); ctx.lineTo(-s * 0.6, -s * 0.7); ctx.lineTo(-s * 0.2, 0); ctx.lineTo(-s * 0.6, s * 0.7);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}
