import { G, addSessionCoins, addSessionXp } from '../state.js';
import { drawFrame } from './sprites.js';
import { SFX } from '../audio/sound.js';
import { airdropChanceMult, airdropItemDurationMs } from '../data/upgrades.js';

export const AIRDROP_STATE = Object.freeze({
  IDLE: 'IDLE', DROP: 'CHEST_DROP', DESCEND: 'CHEST_DESCEND',
  LANDED: 'CHEST_LANDED', OPEN: 'CHEST_OPEN', PICKUP: 'CHEST_PICKUP', REWARD: 'CHEST_REWARD_UI', DONE: 'DONE',
});

let drop = null;

const PLANE_ANIM_END = 120;
// A drop in 35 % of normal levels, 12-20 s after the start. The local dev
// server (`npm run dev`) drops one every level after 6-10 s, for testing.
const DEV_TEST = !!import.meta.env?.DEV;
const AIRDROP_LEVEL_CHANCE = DEV_TEST ? 1 : 0.35;
const AIRDROP_DELAY_MIN_FRAMES = (DEV_TEST ? 6 : 12) * 60;
const AIRDROP_DELAY_MAX_FRAMES = (DEV_TEST ? 10 : 20) * 60;
// Match the visible aircraft bounds of frame 12 (transparent padding differs
// between the spritesheet cell and the standalone carrier image).
const EXIT_PLANE_WIDTH_SCALE = 0.714;
const EXIT_PLANE_HEIGHT_SCALE = 0.714;
const EXIT_PLANE_Y_OFFSET = -0.158;
const RELEASE_CRATE_Y_OFFSET = 0.388;
const DROP_WIDTH_SCALE = 0.280;
const DROP_HEIGHT_SCALE = 0.316;
const EXPLOSION_WIDTH_SCALE = 0.263;
const EXPLOSION_HEIGHT_SCALE = 0.289;

function updateParachuteMotion(step, cw) {
  drop.fallTimer += step;
  drop.y += (0.34 + Math.sin(drop.fallTimer * 0.035) * 0.035) * step;
  // Drift is an offset around baseX so external pulls (C-130 magnet) that
  // move baseX persist instead of being overwritten every frame.
  drop.x = drop.baseX
    + Math.sin(drop.fallTimer * 0.018) * Math.min(34, cw * 0.045)
    + Math.sin(drop.fallTimer * 0.006) * Math.min(12, cw * 0.016);
}

function getCarrierPose(cw, ch, timer) {
  const size = Math.min(460, cw * 1.08);
  const startY = ch + size * 0.55;
  // Finish the spritesheet animation around the position shown at release,
  // then move the frozen final frame all the way through the top edge.
  const holdY = ch * 0.02;
  const speed = (startY - holdY) / PLANE_ANIM_END;
  const y = timer <= PLANE_ANIM_END
    ? startY + (holdY - startY) * (timer / PLANE_ANIM_END)
    : holdY - speed * (timer - PLANE_ANIM_END);
  return { size, y };
}

export function rollAirdropForLevel({ practice = false, tutorial = false } = {}) {
  // One drop per normal level, never during practice or the tutorial.
  return !practice && !tutorial && Math.random() < AIRDROP_LEVEL_CHANCE;
}

// Extremely rare crate content: a nuclear strike (game.js launchNuke).
const AIRDROP_NUKE_CHANCE = 0.01;

function rollReward() {
  // Local test only: http://localhost:5173/?airdrop=nuke (or =support) always
  // drops that reward.
  if (import.meta.env?.DEV) {
    const test = new URLSearchParams(location.search).get('airdrop');
    if (test === 'nuke') return { type: 'nuke' };
    if (['support', 'machinegun', 'shield', 'xray'].includes(test)) return timedReward(test);
  }
  if (Math.random() < AIRDROP_NUKE_CHANCE) return { type: 'nuke' };
  // Base weights (%); the hangar UPGRADE "AIRDROP — CHANCE" multiplies the
  // special items' weights for the active aircraft.
  const table = [
    ['coins', 24], ['xp', 24], ['life', 16],
    ['xray', 14 * airdropChanceMult('xray')],
    ['machinegun', 7 * airdropChanceMult('machinegun')],   // machine-gun bursts
    ['shield', 7 * airdropChanceMult('shield')],           // protective bubble
    ['support', 8 * airdropChanceMult('support')],         // B-2 air support
  ];
  const total = table.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  let type = 'coins';
  for (const [id, w] of table) {
    if (roll < w) { type = id; break; }
    roll -= w;
  }
  if (type === 'coins') return { type: 'coins', amount: 25 + Math.floor(Math.random() * 4) * 25 };
  if (type === 'xp') return { type: 'xp', amount: 100 + Math.floor(Math.random() * 4) * 50 };
  if (type === 'life') return { type: 'life', amount: 1 };
  return timedReward(type);
}

// Timed items last 10 s, longer with the hangar UPGRADE "AIRDROP — DURÉE".
function timedReward(type) {
  return { type, duration: airdropItemDurationMs() };
}

function applyReward(reward) {
  if (reward.type === 'coins') {
    addSessionCoins(reward.amount);
  } else if (reward.type === 'xp') {
    addSessionXp(reward.amount);
  } else if (reward.type === 'life') {
    G.lives = (G.lives || 0) + 1;
  } else if (reward.type === 'xray') {
    G.airdropWeapon = 'xray';
    G.airdropXrayUntil = performance.now() + reward.duration;
    G.airdropXrayShotReset = true;
  } else if (reward.type === 'machinegun') {
    // Same 10 s timed-weapon flow as the X-ray (question waits meanwhile).
    G.airdropWeapon = 'machinegun';
    G.airdropXrayUntil = performance.now() + reward.duration;
    G.airdropXrayShotReset = true;
  } else if (reward.type === 'shield') {
    G.airdropShieldUntil = performance.now() + reward.duration;
  } else if (reward.type === 'nuke') {
    // game.js picks this up on the next frame and launches the strike.
    G.airdropNukePending = true;
  } else if (reward.type === 'support') {
    G.airdropSupportPending = true;
    G.airdropSupportMs = reward.duration;
  }
}

export function initAirdrop(enabled, cw, ch) {
  const arrivalDelay = AIRDROP_DELAY_MIN_FRAMES
    + Math.random() * (AIRDROP_DELAY_MAX_FRAMES - AIRDROP_DELAY_MIN_FRAMES);
  drop = {
    state: enabled ? AIRDROP_STATE.IDLE : AIRDROP_STATE.DONE,
    timer: 0,
    delay: arrivalDelay,
    x: cw * 0.5,
    baseX: cw * 0.5,
    y: ch * 0.24,
    groundY: ch * 0.62,
    reward: null,
    rewardApplied: false,
    fallTimer: 0,
    planeTimer: 0,
    planeActive: false,
    planeSoundStarted: false,
    planeX: cw * 0.5,
  };
}

// magnetRadius: when set (C-130's MAGNET ability), the revealed reward pulls
// itself toward the player once it is within this many pixels, instead of
// requiring the player to fly right up to it.
export function updateAirdrop(step, cw, ch, magnetRadius = 0) {
  if (!drop) return;
  // The carrier keeps flying independently of the crate/reward sequence, so
  // even its tail must fully clear the top edge before it can be removed.
  if (drop.planeActive) {
    // The A400M always uses the map's centre flight corridor. It never tracks
    // the player's aircraft, and remains centred if the canvas is resized.
    drop.planeX = cw * 0.5;
    drop.planeTimer += step;
    const { size: planeSize, y: planeY } = getCarrierPose(cw, ch, drop.planeTimer);
    // Do not remove the held final frame until the bottom of its full sprite
    // (including the aircraft tail) has crossed above the canvas.
    const visiblePlaneY = drop.planeTimer >= PLANE_ANIM_END
      ? planeY + planeSize * EXIT_PLANE_Y_OFFSET
      : planeY;
    const visibleHalfHeight = drop.planeTimer >= PLANE_ANIM_END
      ? planeSize * EXIT_PLANE_HEIGHT_SCALE / 2
      : planeSize / 2;
    if (drop.planeTimer >= PLANE_ANIM_END && visiblePlaneY + visibleHalfHeight < 0) drop.planeActive = false;
  }
  if (drop.state === AIRDROP_STATE.DONE || drop.state === AIRDROP_STATE.REWARD) return;
  drop.groundY = ch * 0.62;
  if (drop.state === AIRDROP_STATE.IDLE) {
    drop.delay -= step;
    // The recording has a gradual engine lead-in, so start it well before
    // the carrier reaches the visible playfield.
    if (!drop.planeSoundStarted && drop.delay <= 240) {
      drop.planeSoundStarted = true;
      SFX.airdropPlane?.();
    }
    if (drop.delay <= 0) {
      drop.state = AIRDROP_STATE.DROP;
      drop.timer = 0;
      drop.planeTimer = 0;
      drop.planeActive = true;
      drop.planeX = cw * 0.5;
    }
    return;
  }
  drop.timer += step;
  if (drop.state === AIRDROP_STATE.DROP && drop.timer >= PLANE_ANIM_END) {
    drop.state = AIRDROP_STATE.DESCEND;
    SFX.airdropRelease();
    drop.timer = 0;
    // Continue from the exact parachute position in the final carrier frame.
    const planeSize = Math.min(460, cw * 1.08);
    drop.x = drop.planeX;
    drop.baseX = drop.planeX;
    drop.y = ch * 0.02 + planeSize * RELEASE_CRATE_Y_OFFSET;
  } else if (drop.state === AIRDROP_STATE.DESCEND) {
    // A deployed parachute falls slowly and drifts smoothly with the air.
    updateParachuteMotion(step, cw);
    // Keep falling until the whole crate has left the bottom of the screen;
    // if the player never breaks it, the drop is simply lost.
    const crateHalfHeight = Math.min(460, cw * 1.08) * DROP_HEIGHT_SCALE / 2;
    if (drop.y - crateHalfHeight > ch) {
      drop.state = AIRDROP_STATE.DONE;
      drop.timer = 0;
      return;
    }
    // Flying into the falling crate also breaks it open.
    const player = G.player;
    if (player) {
      const dx = player.x - drop.x;
      const dy = player.y - drop.y;
      if ((dx * dx) / (58 * 58) + (dy * dy) / (66 * 66) <= 1) {
        drop.state = AIRDROP_STATE.OPEN;
        drop.timer = 0;
        SFX.airdropBreak();
      }
    }
  } else if (drop.state === AIRDROP_STATE.LANDED) {
    // Flying into the landed crate also breaks it open.
    const player = G.player;
    if (player) {
      const dx = player.x - drop.x;
      const dy = player.y - drop.y;
      if ((dx * dx) / (58 * 58) + (dy * dy) / (66 * 66) <= 1) {
        drop.state = AIRDROP_STATE.OPEN;
        drop.timer = 0;
        SFX.airdropBreak();
      }
    }
  } else if (drop.state === AIRDROP_STATE.OPEN) {
    // Preserve the parachute's falling speed and drift throughout destruction.
    updateParachuteMotion(step, cw);
    if (drop.timer >= 48) drop.reward ||= rollReward();
    if (drop.timer >= 72) { drop.state = AIRDROP_STATE.PICKUP; drop.timer = 0; }
  } else if (drop.state === AIRDROP_STATE.PICKUP) {
    // The revealed item inherits the crate's exact descent speed and drift.
    updateParachuteMotion(step, cw);
    // Keep it inside the playable map until the player actually collects it.
    drop.y = Math.min(drop.y, ch * 0.72);
    const player = G.player;
    if (player) {
      let dx = player.x - drop.x;
      let dy = player.y - drop.y;
      if (magnetRadius > 0) {
        const dist = Math.hypot(dx, dy) || 1;
        if (dist <= magnetRadius) {
          const pull = Math.min(1, (0.08 * step) + (1 - dist / magnetRadius) * 0.12 * step);
          drop.baseX += dx * pull;
          drop.x += dx * pull;
          drop.y += dy * pull;
          dx = player.x - drop.x;
          dy = player.y - drop.y;
        }
      }
      if (dx * dx + dy * dy <= 46 * 46) {
        if (!drop.rewardApplied) {
          drop.reward ||= rollReward();
          applyReward(drop.reward);
          SFX.airdropPickup();
          drop.rewardApplied = true;
        }
        drop.state = AIRDROP_STATE.DONE;
        drop.timer = 0;
      }
    }
  }
}

export function handleAirdropPointer(x, y) {
  if (!drop) return false;
  if (drop.state === AIRDROP_STATE.REWARD) {
    drop.state = AIRDROP_STATE.DONE; return true;
  }
  return false;
}

export function hitAirdrop(missile) {
  if (!drop || ![AIRDROP_STATE.DESCEND, AIRDROP_STATE.LANDED].includes(drop.state)) return false;
  const dx = missile.x - drop.x;
  const dy = missile.y - drop.y;
  if ((dx * dx) / (58 * 58) + (dy * dy) / (66 * 66) > 1) return false;
  drop.state = AIRDROP_STATE.OPEN;
  drop.timer = 0;
  SFX.airdropBreak();
  return true;
}

// Pickups drawn in code (no sprite art): three round machine-gun bullets, or
// a pulsing blue protective bubble.
function drawTimedPickup(ctx, type, x, y, scale, timer) {
  const pulse = 1 + Math.sin(timer * 0.1) * 0.06;
  ctx.save();
  if (type === 'machinegun') {
    const r = 7 * scale * pulse;
    ctx.fillStyle = '#fff6a8';
    ctx.shadowColor = '#ffb000';
    ctx.shadowBlur = 12;
    for (const [dx, dy] of [[0, -14], [-12, 8], [12, 8]]) {
      ctx.beginPath();
      ctx.arc(x + dx * scale, y + dy * scale, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const r = 30 * scale * pulse;
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(125,211,252,.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(56,189,248,.28)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawAirdrop(ctx, cw, ch) {
  if (!drop || drop.state === AIRDROP_STATE.IDLE || (drop.state === AIRDROP_STATE.DONE && !drop.planeActive)) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (drop.planeActive) {
    const { size: planeSize, y } = getCarrierPose(cw, ch, drop.planeTimer);
    if (drop.planeTimer < PLANE_ANIM_END) {
      const frame = Math.floor(drop.planeTimer / 10);
      drawFrame(ctx, 'airdrop-plane', frame, drop.planeX, y, planeSize, planeSize);
    } else {
      // Continue with the clean standalone carrier after the release sheet ends.
      const exitY = y + planeSize * EXIT_PLANE_Y_OFFSET;
      drawFrame(
        ctx, 'airdrop-plane-exit', 0, drop.planeX, exitY,
        planeSize * EXIT_PLANE_WIDTH_SCALE,
        planeSize * EXIT_PLANE_HEIGHT_SCALE,
      );
    }
  }
  if (drop.state === AIRDROP_STATE.DESCEND || drop.state === AIRDROP_STATE.LANDED) {
    const planeSize = Math.min(460, cw * 1.08);
    // The carrier sheet already completes deployment; hold the fully opened
    // parachute and preserve its measured dimensions during the descent.
    drawFrame(
      ctx, 'airdrop-parachute-final', 0, drop.x, drop.y,
      planeSize * DROP_WIDTH_SCALE,
      planeSize * DROP_HEIGHT_SCALE,
    );
    if (drop.state === AIRDROP_STATE.LANDED) {
      ctx.textAlign = 'center'; ctx.font = "bold 10px 'Press Start 2P', monospace";
      ctx.fillStyle = '#fff700'; ctx.shadowColor = '#000'; ctx.shadowBlur = 5;
      ctx.fillText('SHOOT TO OPEN', drop.x, drop.y + 82);
    }
  } else if (drop.state === AIRDROP_STATE.OPEN) {
    const frame = Math.min(11, Math.floor(drop.timer / 6));
    const planeSize = Math.min(460, cw * 1.08);
    drawFrame(
      ctx, 'airdrop-open', frame, drop.x, drop.y,
      planeSize * EXPLOSION_WIDTH_SCALE,
      planeSize * EXPLOSION_HEIGHT_SCALE,
    );
  } else if (drop.state === AIRDROP_STATE.PICKUP) {
    const rewardKey = {
      coins: 'airdrop-coin', xp: 'airdrop-exp', life: 'airdrop-heart', xray: 'airdrop-xray',
      nuke: 'nuke-pivot', support: 'ship-b2',
    }[drop.reward?.type] || 'airdrop-coin';
    const isExp = drop.reward?.type === 'xp';
    const isHeart = drop.reward?.type === 'life';
    const isCoin = drop.reward?.type === 'coins';
    const frame = (isExp || isHeart || isCoin) ? 0 : Math.floor(drop.timer / 6) % 12;
    const scale = Math.min(460, cw * 1.08) / 460;
    const pickupSize = {
      coins: [52, 52],
      xp: [73, 73],
      life: [72, 72],
      xray: [53, 27],
      nuke: [86, 86],
      support: [96, 96],
    }[drop.reward?.type] || [65, 65];
    const smoothPulse = (isExp || isHeart || isCoin) ? 1 + Math.sin(drop.timer * 0.08) * 0.045 : 1;
    if (drop.reward?.type === 'machinegun' || drop.reward?.type === 'shield') {
      drawTimedPickup(ctx, drop.reward.type, drop.x, drop.y, scale, drop.timer);
    } else {
      drawFrame(
        ctx, rewardKey, frame, drop.x, drop.y,
        pickupSize[0] * scale * smoothPulse,
        pickupSize[1] * scale * smoothPulse,
      );
    }
  }
  ctx.restore();
}

