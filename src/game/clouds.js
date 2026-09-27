import { getImage } from './sprites.js';
import { isTouchMobile } from '../utils/device.js';

const CLOUD_KEYS = Array.from({ length: 12 }, (_, i) => `cloud-${i + 1}`);
const clouds = [];
let enabled = false;
let spawnDelay = 0;
// Cloudy and typhoon weather fill the sky with many more (and slightly
// bigger) clouds.
let dense = false;

function random(min, max) {
  return min + Math.random() * (max - min);
}

function makeCloud(cw, ch, initial = false) {
  const depth = Math.random();
  const size = random(dense ? 0.2 : 0.16, dense ? 0.36 : 0.28) * cw * (0.72 + depth * 0.55);
  const cloud = {
    key: CLOUD_KEYS[Math.floor(Math.random() * CLOUD_KEYS.length)],
    x: random(-size * 0.18, cw - size * 0.82),
    y: initial ? random(-size, ch + size) : -size * random(0.7, 1.5),
    size,
    speed: random(0.34, 0.62) + depth * 0.52,
    drift: random(-0.075, 0.075),
    phase: random(0, Math.PI * 2),
    sway: random(0.002, 0.006),
    alpha: random(0.55, 0.82) + depth * 0.12,
    flip: Math.random() < 0.5 ? -1 : 1,
  };
  clouds.push(cloud);
}

function cloudLimits() {
  if (!dense) return { count: 16, max: 19 };
  return isTouchMobile() ? { count: 30, max: 36 } : { count: 42, max: 50 };
}

export function initClouds(biome, cw, ch, weatherId = null) {
  clouds.length = 0;
  enabled = biome !== 'space';
  dense = weatherId === 'CLOUDY' || weatherId === 'TYPHOON';
  if (!enabled || !cw || !ch) return;

  const { count } = cloudLimits();
  for (let i = 0; i < count; i++) makeCloud(cw, ch, true);
  spawnDelay = random(55, 120);
}

export function updateClouds(step, cw, ch) {
  if (!enabled) return;

  for (let i = clouds.length - 1; i >= 0; i--) {
    const cloud = clouds[i];
    cloud.phase += cloud.sway * step;
    cloud.x += (cloud.drift + Math.sin(cloud.phase) * 0.025) * step;
    cloud.y += cloud.speed * step;
    if (cloud.y > ch + cloud.size || cloud.x < -cloud.size * 1.5 || cloud.x > cw + cloud.size * 0.5) {
      clouds.splice(i, 1);
    }
  }

  spawnDelay -= step;
  const maxClouds = cloudLimits().max;
  if (spawnDelay <= 0 && clouds.length < maxClouds) {
    makeCloud(cw, ch);
    spawnDelay = dense ? random(18, 45) : random(65, 145);
  }
}

export function drawClouds(ctx) {
  if (!enabled) return;

  ctx.save();
  for (const cloud of clouds) {
    const img = getImage(cloud.key);
    if (!img) continue;
    const edgeFade = Math.min(
      1,
      Math.max(0, (cloud.y + cloud.size) / (cloud.size * 0.55)),
      Math.max(0, (ctx.canvas.height + cloud.size - cloud.y) / (cloud.size * 0.55)),
    );
    ctx.save();
    ctx.globalAlpha = cloud.alpha * edgeFade;
    ctx.translate(cloud.x + cloud.size / 2, cloud.y + cloud.size / 2);
    ctx.scale(cloud.flip, 1);
    ctx.drawImage(img, -cloud.size / 2, -cloud.size / 2, cloud.size, cloud.size);
    ctx.restore();
  }
  ctx.restore();
}
