// Fuel of the player's plane during a game (values in data/fuel.js): the
// tank burns while the plane flies (game.js calls burnFuel only when the
// plane really flies: never while a question or the correction is on screen,
// in pause or during cutscenes), an enemy missile costs a share of the tank,
// and some destroyed enemies drop a fuel can that refills part of it.
// The can is drawn from assets/fx/Fuel/bidon.png (32 x 32) at an integer
// scale, without smoothing; only its body can be picked up, not the spout.
// The gauge on screen is screens/fuel-gauge.js; the empty tank (engine stop,
// crash, a heart lost) is handled by game.js.
import {
  planeFuel, HIT_COST, CAN_REFILL, CAN_DROP_CHANCE, SAFETY_BELOW, SAFETY_KILLS,
  RESPAWN_FUEL, LOW_ALERT, CRITICAL_ALERT, GENTLE,
} from '../data/fuel.js';

const CAN_SRC = '/assets/fx/Fuel/bidon.png';
const CAN_PX = 32;
// Body of the can in the 32 x 32 picture (the spout is above, on the right).
const BODY = { x0: 8, y0: 10, x1: 24, y1: 26 };
const CAN_LIFE_MS = 6000;
const CAN_BLINK_MS = 1500;
const CAN_FALL = 0.75;          // px per 60 fps frame (slow float down)
const CAN_BOB_MS = 320;         // up / down by one picture pixel
const MAX_CANS = 3;             // on screen at once

let _img = null;
function canImage() {
  if (!_img) { _img = new Image(); _img.src = CAN_SRC; }
  return _img;
}

const S = {
  on: false, gentle: false,
  tank: 60, burn: 1, fuel: 60,
  killsSinceCan: 0,
  lowAlerted: false, criticalAlerted: false,
  cans: [],
};

// New game / new life. on = false: no fuel in this mode (practice, tutorial).
export function resetFuel(planeId, { on = true, gentle = false, share = 1 } = {}) {
  const p = planeFuel(planeId);
  S.on = on;
  S.gentle = gentle;
  S.tank = p.tank;
  S.burn = p.burn;
  S.fuel = p.tank * share;
  S.killsSinceCan = 0;
  S.lowAlerted = S.criticalAlerted = false;
  S.cans = [];
  canImage();
}

export const fuelOn = () => S.on;
export const fuelShare = () => (S.on ? Math.max(0, Math.min(1, S.fuel / S.tank)) : 1);
export const fuelEmpty = () => S.on && S.fuel <= 0;

// Alerts crossed by the last change: 'low' (under 25 %) / 'critical' (10 %).
function checkAlerts() {
  const share = fuelShare();
  const out = [];
  if (share >= LOW_ALERT) { S.lowAlerted = false; S.criticalAlerted = false; }
  else if (share >= CRITICAL_ALERT) S.criticalAlerted = false;
  if (share < LOW_ALERT && share > 0 && !S.lowAlerted) { S.lowAlerted = true; out.push('low'); }
  if (share < CRITICAL_ALERT && share > 0 && !S.criticalAlerted) { S.criticalAlerted = true; out.push('critical'); }
  return out;
}

// Flying for `ms`: returns the alerts crossed (see checkAlerts).
export function burnFuel(ms) {
  if (!S.on || S.fuel <= 0) return [];
  S.fuel = Math.max(0, S.fuel - S.burn * (S.gentle ? GENTLE.burn : 1) * ms / 1000);
  return checkAlerts();
}

// Hit by an enemy missile.
export function hitFuel() {
  if (!S.on || S.fuel <= 0) return [];
  S.fuel = Math.max(0, S.fuel - S.tank * HIT_COST * (S.gentle ? GENTLE.hit : 1));
  return checkAlerts();
}

// Back with part of the tank (after an empty tank, revived in co-op).
export function refuelTo(share = RESPAWN_FUEL) {
  if (!S.on) return;
  S.fuel = Math.max(S.fuel, S.tank * share);
  checkAlerts();
}

// Test version only (game.js): almost empty, to see the alerts and the crash.
export function drainForTest(share = 0.03) {
  if (!S.on) return;
  S.fuel = S.tank * share;
  S.lowAlerted = S.criticalAlerted = false;
}

// An enemy plane was destroyed at (x, y): maybe it drops a can.
// boss: a boss always drops one.
export function enemyDestroyed(x, y, { boss = false } = {}) {
  if (!S.on) return false;
  const chance = S.gentle ? GENTLE.drop : CAN_DROP_CHANCE;
  const safety = fuelShare() < SAFETY_BELOW && S.killsSinceCan >= SAFETY_KILLS;
  if (!boss && !safety && Math.random() >= chance) { S.killsSinceCan++; return false; }
  if (S.cans.length >= MAX_CANS) S.cans.shift();
  S.cans.push({ x, y, age: 0 });
  S.killsSinceCan = 0;
  return true;
}

// Picture scale: an integer, about half the player's plane.
export function canScale(playerSize) {
  return Math.max(1, Math.round((playerSize * 0.5) / CAN_PX));
}

// Moves the cans, picks up the one the plane touches, draws them. They age
// and fall only while the plane flies (frozen during a question), and none
// is picked up while `noPickup` (the plane crashing).
// Returns { gained, x, y } for a can picked up this frame, else null.
export function updateAndDrawCans(ctx, { now, ms, step, height, player, playerRadius, playerSize, frozen = false, noPickup = false }) {
  if (!S.on || !S.cans.length) return null;
  const k = canScale(playerSize);
  const size = CAN_PX * k;
  const img = canImage();
  let picked = null;
  for (let i = S.cans.length - 1; i >= 0; i--) {
    const c = S.cans[i];
    if (!frozen) { c.age += ms; c.y += CAN_FALL * step; }
    const age = c.age;
    if (age >= CAN_LIFE_MS || c.y - size > height) { S.cans.splice(i, 1); continue; }
    // Floats: up and down by one picture pixel.
    const bob = Math.floor(now / CAN_BOB_MS) % 2 ? -k : 0;
    const left = Math.round(c.x - size / 2);
    const top = Math.round(c.y - size / 2 + bob);
    // Blinks just before it vanishes.
    const blinking = CAN_LIFE_MS - age < CAN_BLINK_MS;
    if (!blinking || Math.floor(now / 110) % 2 === 0) {
      if (img.complete && img.naturalWidth) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, left, top, size, size);
        ctx.restore();
      }
    }
    if (noPickup || picked) continue;
    // Pick-up: the plane's circle against the can's body only.
    const bx0 = left + BODY.x0 * k, bx1 = left + BODY.x1 * k;
    const by0 = top + BODY.y0 * k, by1 = top + BODY.y1 * k;
    const nx = Math.max(bx0, Math.min(player.x, bx1));
    const ny = Math.max(by0, Math.min(player.y, by1));
    if ((player.x - nx) ** 2 + (player.y - ny) ** 2 <= playerRadius * playerRadius) {
      S.cans.splice(i, 1);
      const before = S.fuel;
      S.fuel = Math.min(S.tank, S.fuel + S.tank * CAN_REFILL);
      checkAlerts();
      picked = { gained: (S.fuel - before) / S.tank, x: (bx0 + bx1) / 2, y: (by0 + by1) / 2 };
    }
  }
  return picked;
}

export function clearCans() { S.cans = []; }
