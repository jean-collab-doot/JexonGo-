// The two escort planes of the "wingmen" shot types (shop.js SHOOTING_PLANS:
// Tir en V, Blackbird). When the countdown ends they fly in, one from each
// side of the screen, and settle smoothly beside the player's plane. Then
// they do not stay glued to their spot: each one roams on its own a little
// ahead and to the side (like small independent turrets; game.js aims their
// shots at the nearest enemy). They can never be hit and never lose a life.
// Planes with hand-drawn turn sheets (sprites.js hasTurnArt) play their
// roll frames when the escorts move sideways, like the player's plane.
import { drawFrame, hasTurnArt, shipSpriteKey } from './sprites.js';
import { drawAircraftSpriteSized } from './aircraft-draw.js';

const ENTRY_MS = 1700;
const ROAM_MIN_MS = 1300;
const ROAM_MAX_MS = 3200;
const TURN_SPEED = 0.4;      // turn sheet frames per 60 fps frame (same as the player)

let _wing = [];              // [{ side, x, y, ... }] once they came in
let _entryStart = 0;         // 0 = not in yet (hidden)

function makeWing(side) {
  return {
    side, x: 0, y: 0, prevX: 0,
    offX: 0, offY: 0, tgtX: 0, tgtY: 0, nextRoam: 0,
    turnR: 0, turnL: 0, tilt: 0,
  };
}

// New game, or the escorts must wait for the next countdown.
export function resetWingmen() {
  _wing = [];
  _entryStart = 0;
}

// The countdown is over: both escorts fly in from the screen edges.
export function startWingmenEntry(now = performance.now()) {
  _wing = [makeWing(-1), makeWing(1)];
  _entryStart = now;
}

export function wingmenIn() { return _wing.length > 0; }

const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

// slot(side) = { x, y } of that escort's place beside the player.
// size = escort draw size, frameStep = 60 fps frames since the last update.
export function updateWingmen({ now, frameStep, slot, size, width }) {
  if (!_wing.length) return;
  const t = Math.min(1, (now - _entryStart) / ENTRY_MS);
  for (const w of _wing) {
    const home = slot(w.side);
    w.prevX = w.x;
    if (t < 1) {
      // Flying in: from beyond its side of the screen, a bit behind, to its spot.
      const k = easeOutCubic(t);
      const fromX = w.side < 0 ? -size : width + size;
      const fromY = home.y + size * 0.9;
      w.x = fromX + (home.x - fromX) * k;
      w.y = fromY + (home.y - fromY) * k;
      if (t === 0) w.prevX = w.x;
    } else {
      // Roaming: a new spot every few seconds, a little ahead / to the side.
      if (now >= w.nextRoam) {
        // Outward up to 0.9 plane, inward only 0.3 (never onto the player);
        // forward up to 2.2 planes, back a little.
        w.tgtX = w.side * (Math.random() * 1.2 - 0.3) * size;
        w.tgtY = -Math.random() * size * 2.2 + size * 0.2;
        w.nextRoam = now + ROAM_MIN_MS + Math.random() * (ROAM_MAX_MS - ROAM_MIN_MS);
      }
      const ease = Math.min(1, 0.04 * frameStep);
      w.offX += (w.tgtX - w.offX) * ease;
      w.offY += (w.tgtY - w.offY) * ease;
      w.x = Math.max(size * 0.5, Math.min(width - size * 0.5, home.x + w.offX));
      w.y = home.y + w.offY;
    }
    // Turning: roll frames 0-9 while moving sideways, 10-19 back to level.
    const dx = (w.x - w.prevX) / Math.max(0.5, frameStep);
    const right = dx > 0.45, left = dx < -0.45;
    if (right && w.turnL === 0) w.turnR = Math.min(9, w.turnR + frameStep * TURN_SPEED);
    else if (w.turnR > 0) { w.turnR += frameStep * TURN_SPEED; if (w.turnR >= 20) w.turnR = 0; }
    if (left && w.turnR === 0) w.turnL = Math.min(9, w.turnL + frameStep * TURN_SPEED);
    else if (w.turnL > 0) { w.turnL += frameStep * TURN_SPEED; if (w.turnL >= 20) w.turnL = 0; }
    // Planes without turn sheets lean instead.
    const tiltTarget = right ? 0.3 : left ? -0.3 : 0;
    w.tilt += (tiltTarget - w.tilt) * Math.min(1, 0.1 * frameStep);
  }
}

// Where an escort is (shots start there), or null before they came in.
export function wingmanPos(side) {
  const w = _wing.find(item => item.side === side);
  return w ? { x: w.x, y: w.y } : null;
}

export function drawWingmen(ctx, { aircraftId, size, frame, alpha = 1 }) {
  for (const w of _wing) {
    if (w.turnR > 0 && hasTurnArt(aircraftId, 'right')) {
      drawFrame(ctx, shipSpriteKey(aircraftId, 'right'), Math.floor(w.turnR), w.x, w.y, size, size, { alpha });
    } else if (w.turnL > 0 && hasTurnArt(aircraftId, 'left')) {
      drawFrame(ctx, shipSpriteKey(aircraftId, 'left'), Math.floor(w.turnL), w.x, w.y, size, size, { alpha });
    } else {
      drawAircraftSpriteSized(ctx, aircraftId, w.x, w.y, size, frame, alpha, w.tilt);
    }
  }
}
