// ── WEATHER EFFECTS ──────────────────────────────────────────────────────────
// Animated weather drawn over the playfield for each level's weather
// (see data/weather.js): rain, storm (heavy rain + lightning), fog, snow,
// sunny glare, windy, the biome weathers blizzard (arctic), sandstorm and
// heat wave (desert), typhoon (Pacific) and one weather per planet in
// space (Io, Jupiter, Ganymede, Neptune, Saturn). Cloudy levels
// use the dense cloud layer in clouds.js instead. Particle counts are reduced
// on touch devices to keep phones smooth.

import { isTouchMobile } from '../utils/device.js';
import { getLang } from '../i18n.js';

let fx = null;

function rand(a, b) { return a + Math.random() * (b - a); }

function makeDrops(count, w, h, speedMin, speedMax, lenMin, lenMax) {
  return Array.from({ length: count }, () => ({
    x: rand(0, w), y: rand(-h, h),
    speed: rand(speedMin, speedMax), len: rand(lenMin, lenMax),
    alpha: rand(0.5, 0.85),
  }));
}

export function initWeatherFx(weather, w, h) {
  const id = weather?.id || 'CLEAR';
  const scale = isTouchMobile() ? 0.5 : 1;
  fx = { id, w, h, t: 0, flash: 0, bolt: null, nextBolt: rand(180, 420) };
  fx.gust = null;
  fx.nextGust = rand(240, 420);
  fx.streaks = Array.from({ length: Math.round(26 * scale) }, () => ({
    x: rand(0, w), y: rand(0, h), len: rand(60, 140), speed: rand(14, 22), alpha: rand(0.25, 0.6),
  }));

  if (id === 'RAIN') {
    fx.drops = makeDrops(Math.round(140 * scale), w, h, 13, 19, 26, 42);
  } else if (id === 'STORM') {
    fx.drops = makeDrops(Math.round(220 * scale), w, h, 18, 26, 30, 48);
  } else if (id === 'TYPHOON') {
    fx.drops = makeDrops(Math.round(320 * scale), w, h, 20, 30, 34, 56);

  } else if (id === 'SNOW') {
    fx.flakes = Array.from({ length: Math.round(120 * scale) }, () => ({
      x: rand(0, w), y: rand(-h, h), r: rand(1.4, 3.6),
      speed: rand(0.8, 2.2), sway: rand(0, Math.PI * 2), alpha: rand(0.55, 0.95),
    }));
  } else if (id === 'BLIZZARD') {
    fx.flakes = Array.from({ length: Math.round(260 * scale) }, () => ({
      x: rand(0, w), y: rand(0, h), r: rand(1.4, 3.4),
      vx: rand(3.5, 7), vy: rand(2, 4.2), alpha: rand(0.6, 1),
    }));
  } else if (id === 'SANDSTORM') {
    fx.grains = Array.from({ length: Math.round(240 * scale) }, () => ({
      x: rand(-w * 0.3, w), y: rand(0, h), len: rand(6, 16),
      vx: rand(6, 11), vy: rand(0.4, 1.6), alpha: rand(0.35, 0.8),
      color: Math.random() < 0.5 ? '#e8b86b' : '#c98a3c',
    }));
    fx.banks = Array.from({ length: 5 }, (_, i) => ({
      x: rand(0, w), y: (h / 5) * i + rand(0, h / 5),
      r: rand(Math.max(w, h) * 0.25, Math.max(w, h) * 0.4),
      speed: rand(1.2, 2.4),
    }));
  } else if (id === 'HEATWAVE') {
    fx.waves = Array.from({ length: 7 }, (_, i) => ({
      y: (h / 7) * i + rand(0, h / 7), phase: rand(0, Math.PI * 2),
      speed: rand(0.4, 0.8), amp: rand(4, 9),
    }));
  } else if (id === 'VOLCANIC') {
    fx.embers = Array.from({ length: Math.round(90 * scale) }, () => ({
      x: rand(0, w), y: rand(0, h), r: rand(1.2, 3), vy: rand(-1.6, -0.4),
      vx: rand(-0.3, 0.3), life: rand(0, 1), hue: Math.random() < 0.5 ? '#fbbf24' : '#f97316',
    }));
    fx.plumes = [];
    fx.nextPlume = rand(20, 60);
  } else if (id === 'JOVIAN') {
    fx.bands = Array.from({ length: 8 }, (_, i) => ({
      y: (h / 8) * i, hgt: h / 8 + rand(-8, 8), speed: rand(0.4, 1.2) * (i % 2 ? -1 : 1),
      color: ['rgba(214,160,110,0.16)', 'rgba(170,110,70,0.14)', 'rgba(235,205,160,0.12)'][i % 3],
      offset: rand(0, w),
    }));
  } else if (id === 'AURORA') {
    fx.crystals = Array.from({ length: Math.round(70 * scale) }, () => ({
      x: rand(0, w), y: rand(-h, h), size: rand(1.5, 3.5), speed: rand(0.3, 0.9),
      twinkle: rand(0, Math.PI * 2),
    }));
  } else if (id === 'RING_SHOWER') {
    fx.fragments = Array.from({ length: Math.round(80 * scale) }, () => ({
      x: rand(0, w * 1.3), y: rand(-h, h), size: rand(1.5, 4.5), vx: rand(-3.2, -1.6),
      vy: rand(3.5, 6.5), ice: Math.random() < 0.6,
    }));
  } else if (id === 'FOG') {
    fx.banks = Array.from({ length: 6 }, (_, i) => ({
      x: rand(0, w), y: (h / 6) * i + rand(0, h / 6),
      r: rand(Math.max(w, h) * 0.28, Math.max(w, h) * 0.45),
      speed: rand(0.15, 0.4) * (Math.random() < 0.5 ? -1 : 1),
    }));
  }
}

// Performance: up to 320 drops a frame. They are drawn in 3 strokes (one per
// transparency level) instead of one stroke each, and without shadowBlur,
// which is one of the slowest canvas operations on phones.
const RAIN_ALPHA_LEVELS = 3;
function drawRain(ctx, step, windX, color, width = 2.6) {
  const { w, h } = fx;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  const paths = Array.from({ length: RAIN_ALPHA_LEVELS }, () => new Path2D());
  const alphaSum = new Array(RAIN_ALPHA_LEVELS).fill(0);
  const alphaCount = new Array(RAIN_ALPHA_LEVELS).fill(0);
  for (const d of fx.drops) {
    d.y += d.speed * step;
    d.x += windX * d.speed * 0.12 * step;
    if (d.y - d.len > h) { d.y = rand(-80, -10); d.x = rand(-40, w + 40); }
    if (d.x > w + 40) d.x -= w + 80;
    if (d.x < -40) d.x += w + 80;
    const level = d.alphaLevel ??= Math.min(RAIN_ALPHA_LEVELS - 1, Math.floor(d.alpha * RAIN_ALPHA_LEVELS / 0.9));
    paths[level].moveTo(d.x, d.y);
    paths[level].lineTo(d.x - windX * d.len * 0.25, d.y - d.len);
    alphaSum[level] += d.alpha;
    alphaCount[level]++;
  }
  for (let i = 0; i < RAIN_ALPHA_LEVELS; i++) {
    if (!alphaCount[i]) continue;
    ctx.globalAlpha = alphaSum[i] / alphaCount[i];
    ctx.stroke(paths[i]);
  }
  ctx.restore();
}

// Chance that a lightning bolt aims at the player's aircraft (after a short
// on-screen warning so it can be dodged).
const TARGETED_BOLT_CHANCE = 0.4;
const BOLT_WARNING_FRAMES = 45;   // ≈0.75 s

function makeBolt(w, h, target = null) {
  const points = [];
  const bottom = target ? target.y : rand(h * 0.35, h * 0.65);
  let x = target ? target.x + rand(-w * 0.15, w * 0.15) : rand(w * 0.15, w * 0.85);
  let y = 0;
  while (y < bottom) {
    points.push([x, y]);
    y += rand(18, 42);
    // Jitter, pulled toward the target so the bolt lands exactly on it.
    x += rand(-28, 28);
    if (target) x += (target.x - x) * Math.min(1, y / bottom) * 0.5;
  }
  points.push([target ? target.x : x, bottom]);
  return { points, life: 8 };
}

function strikeBolt(bolt, events) {
  fx.bolt = bolt;
  fx.flash = 1;
  events.push({ type: 'bolt', points: bolt.points });
}

function drawStorm(ctx, step, player, events, darkness = 0.22) {
  const { w, h } = fx;
  // Darker, heavier sky.
  ctx.fillStyle = `rgba(12,14,40,${darkness})`;
  ctx.fillRect(0, 0, w, h);
  drawRain(ctx, step, 1.4 + windForce() * 2.5, '#5b8cff', 2.8);
  updateLightning(ctx, step, player, events);
}

// Lightning every few seconds. Some bolts first mark the player's position
// with a blinking warning, then strike that exact spot.
function updateLightning(ctx, step, player, events) {
  const { w, h } = fx;
  fx.nextBolt -= step;
  if (fx.nextBolt <= 0 && !fx.warn) {
    if (player && Math.random() < TARGETED_BOLT_CHANCE) {
      fx.warn = { x: player.x, y: player.y, life: BOLT_WARNING_FRAMES };
    } else {
      strikeBolt(makeBolt(w, h), events);
    }
    fx.nextBolt = rand(240, 540);
  }
  if (fx.warn) {
    const blink = Math.floor(fx.warn.life / 5) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.95 : 0.45;
    ctx.strokeStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(fx.warn.x, fx.warn.y, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Lightning bolt symbol (drawn: no emoji).
    ctx.beginPath();
    ctx.moveTo(fx.warn.x + 3, fx.warn.y - 14);
    ctx.lineTo(fx.warn.x - 8, fx.warn.y + 2);
    ctx.lineTo(fx.warn.x - 1, fx.warn.y + 2);
    ctx.lineTo(fx.warn.x - 3, fx.warn.y + 14);
    ctx.lineTo(fx.warn.x + 8, fx.warn.y - 2);
    ctx.lineTo(fx.warn.x + 1, fx.warn.y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    fx.warn.life -= step;
    if (fx.warn.life <= 0) {
      strikeBolt(makeBolt(w, h, fx.warn), events);
      fx.warn = null;
    }
  }
  if (fx.bolt) {
    ctx.save();
    ctx.strokeStyle = '#f5f7ff';
    ctx.shadowColor = '#a5b4fc';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.globalAlpha = Math.min(1, fx.bolt.life / 4);
    ctx.beginPath();
    fx.bolt.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
    fx.bolt.life -= step;
    if (fx.bolt.life <= 0) fx.bolt = null;
  }
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(235,240,255,${(fx.flash * 0.45).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
    fx.flash = Math.max(0, fx.flash - 0.08 * step);
  }
}

function drawSnow(ctx, step) {
  const { w, h } = fx;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (const f of fx.flakes) {
    f.y += f.speed * step;
    f.sway += 0.03 * step;
    f.x += Math.sin(f.sway) * 0.6 * step;
    if (f.y - f.r > h) { f.y = rand(-40, -5); f.x = rand(0, w); }
    ctx.globalAlpha = f.alpha;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFog(ctx, step) {
  const { w, h } = fx;
  // Even haze over everything, then thicker drifting fog banks.
  ctx.fillStyle = 'rgba(214,222,230,0.16)';
  ctx.fillRect(0, 0, w, h);
  for (const b of fx.banks) {
    b.x += b.speed * step;
    if (b.x - b.r > w) b.x = -b.r;
    if (b.x + b.r < 0) b.x = w + b.r;
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, 'rgba(226,232,240,0.30)');
    g.addColorStop(1, 'rgba(226,232,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
}

function drawBlizzard(ctx, step) {
  const { w, h, t } = fx;
  // Gusting white-out: the haze thickens and thins with the wind.
  const gust = 0.12 + 0.08 * (0.5 + 0.5 * Math.sin(t * 0.02));
  ctx.fillStyle = `rgba(236,243,252,${gust.toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  for (const f of fx.flakes) {
    f.x += f.vx * step;
    f.y += f.vy * step;
    if (f.x - f.r > w || f.y - f.r > h) {
      // Re-enter from the top or from the left edge, where the wind comes
      // from, so the whole screen stays covered.
      if (Math.random() < 0.5) { f.x = rand(-w * 0.2, w); f.y = rand(-40, -5); }
      else { f.x = rand(-40, -5); f.y = rand(0, h); }
    }
    const angle = Math.atan2(f.vy, f.vx);
    ctx.globalAlpha = f.alpha;
    // A thin grey-blue shadow keeps white flakes visible over the white map.
    // Stretched along the wind so the snow looks like it is flying sideways.
    ctx.fillStyle = 'rgba(100,116,139,0.55)';
    ctx.beginPath();
    ctx.ellipse(f.x + 1, f.y + 1, f.r * 2.2, f.r, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.r * 2.2, f.r, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSandstorm(ctx, step) {
  const { w, h } = fx;
  ctx.fillStyle = 'rgba(196,132,58,0.18)';
  ctx.fillRect(0, 0, w, h);
  // Drifting clouds of dust.
  for (const b of fx.banks) {
    b.x += b.speed * step;
    if (b.x - b.r > w) b.x = -b.r;
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, 'rgba(214,150,80,0.30)');
    g.addColorStop(1, 'rgba(214,150,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  // Sand grains streaking sideways.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.6;
  for (const g of fx.grains) {
    g.x += g.vx * step;
    g.y += g.vy * step;
    if (g.x - g.len > w || g.y > h) { g.x = rand(-w * 0.3, -5); g.y = rand(0, h); }
    ctx.globalAlpha = g.alpha;
    ctx.strokeStyle = g.color;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x - g.len, g.y - g.len * (g.vy / g.vx));
    ctx.stroke();
  }
  ctx.restore();
}

function drawHeatwave(ctx, step) {
  const { w, h, t } = fx;
  // Hot orange sun glare, stronger than a clear day.
  const r = Math.max(w, h) * (0.7 + Math.sin(t * 0.025) * 0.04);
  const sun = ctx.createRadialGradient(w * 0.85, -h * 0.02, 0, w * 0.85, -h * 0.02, r);
  sun.addColorStop(0, 'rgba(255,214,120,0.42)');
  sun.addColorStop(0.35, 'rgba(255,150,60,0.16)');
  sun.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  // Shimmering heat waves slowly rising.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,236,200,0.16)';
  ctx.lineWidth = 3;
  for (const wv of fx.waves) {
    wv.y -= wv.speed * step;
    wv.phase += 0.05 * step;
    if (wv.y < -20) wv.y = h + 20;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 12) {
      const y = wv.y + Math.sin(x * 0.03 + wv.phase) * wv.amp;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawClear(ctx) {
  const { w, h, t } = fx;
  // Warm sun glow in the top-right corner, gently pulsing.
  const r = Math.max(w, h) * (0.55 + Math.sin(t * 0.02) * 0.03);
  const g = ctx.createRadialGradient(w * 0.92, -h * 0.02, 0, w * 0.92, -h * 0.02, r);
  g.addColorStop(0, 'rgba(255,236,160,0.28)');
  g.addColorStop(0.4, 'rgba(255,214,120,0.10)');
  g.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawTyphoon(ctx, step, player, events) {
  const { w, h, t } = fx;
  // Huge cloud spiral slowly turning around an eye above the screen.
  const cx = w * 0.5, cy = -h * 0.25;
  const rot = t * 0.004;
  ctx.save();
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 4; arm++) {
    for (let k = 0; k < 5; k++) {
      const r = Math.max(w, h) * (0.35 + k * 0.2);
      const start = rot + arm * (Math.PI / 2) + k * 0.35;
      ctx.strokeStyle = `rgba(210,225,240,${(0.17 - k * 0.02).toFixed(3)})`;
      ctx.lineWidth = 46 - k * 5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, start + 1.1);
      ctx.stroke();
    }
  }
  ctx.restore();
  // Torrential storm rain, darker than a normal storm, with lightning.
  drawStorm(ctx, step, player, events, 0.3);
}

// ── Space: planet weathers ───────────────────────────────────────────────────
function drawVolcanic(ctx, step) {
  const { w, h } = fx;
  // Io: sulfur-yellow haze, embers drifting up, volcanic plumes erupting from
  // the bottom of the screen.
  ctx.fillStyle = 'rgba(234,179,8,0.10)';
  ctx.fillRect(0, 0, w, h);
  fx.nextPlume -= step;
  if (fx.nextPlume <= 0) {
    fx.plumes.push({ x: rand(w * 0.1, w * 0.9), age: 0, life: 110, height: rand(h * 0.35, h * 0.6) });
    fx.nextPlume = rand(90, 220);
  }
  for (let i = fx.plumes.length - 1; i >= 0; i--) {
    const p = fx.plumes[i];
    p.age += step;
    const t = p.age / p.life;
    if (t >= 1) { fx.plumes.splice(i, 1); continue; }
    const top = h - p.height * Math.min(1, t * 2.2);
    const spread = 30 + t * 80;
    const g = ctx.createLinearGradient(0, h, 0, top);
    g.addColorStop(0, `rgba(249,115,22,${(0.8 * (1 - t)).toFixed(3)})`);
    g.addColorStop(1, 'rgba(250,204,21,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(p.x - 14, h);
    ctx.quadraticCurveTo(p.x - spread, (h + top) / 2, p.x, top);
    ctx.quadraticCurveTo(p.x + spread, (h + top) / 2, p.x + 14, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.save();
  for (const e of fx.embers) {
    e.x += e.vx * step;
    e.y += e.vy * step;
    e.life += 0.0035 * step;
    if (e.y < -10 || e.life > 1) { e.x = rand(0, w); e.y = h + rand(0, 20); e.life = 0; }
    // Halo + core (no shadowBlur: far too slow for dozens of embers).
    ctx.fillStyle = e.hue;
    ctx.globalAlpha = 0.25 * (1 - e.life);
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9 * (1 - e.life);
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawJovian(ctx, step, player, events) {
  const { w } = fx;
  // Jupiter: cloud bands sliding in opposite directions and lightning deep in
  // the storm.
  for (const b of fx.bands) {
    b.offset = (b.offset + b.speed * step) % w;
    ctx.fillStyle = b.color;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.ellipse(b.offset + k * w, b.y + b.hgt / 2, w * 0.7, b.hgt / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  updateLightning(ctx, step, player, events);
}

function drawAurora(ctx, step) {
  const { w, h, t } = fx;
  // Ganymede: waving green and purple aurora curtains, sparkling ice crystals.
  const curtains = [['rgba(74,222,128,', 0], ['rgba(168,85,247,', 2.1], ['rgba(45,212,191,', 4.2]];
  for (const [rgb, phase] of curtains) {
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    g.addColorStop(0, rgb + '0)');
    g.addColorStop(0.35, rgb + '0.22)');
    g.addColorStop(1, rgb + '0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; ; x = Math.min(w, x + 16)) {
      ctx.lineTo(x, h * 0.3 + Math.sin(x * 0.012 + t * 0.02 + phase) * h * 0.08);
      if (x >= w) break;
    }
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.save();
  ctx.fillStyle = '#e0f7ff';
  for (const c of fx.crystals) {
    c.y += c.speed * step;
    c.twinkle += 0.1 * step;
    if (c.y > h + 5) { c.y = rand(-20, -5); c.x = rand(0, w); }
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(c.twinkle));
    ctx.fillRect(c.x - c.size / 2, c.y - c.size / 2, c.size, c.size);
  }
  ctx.restore();
}

function drawSupersonic(ctx) {
  const { w, h } = fx;
  // Neptune: deep blue methane haze; the supersonic wind itself is the
  // gust system below (strongest push, streaks always visible).
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(30,64,175,0.18)');
  g.addColorStop(1, 'rgba(59,130,246,0.08)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawRingShower(ctx, step) {
  const { w, h } = fx;
  // Saturn: a faint ring arc across the sky, and ice / rock fragments from
  // the rings streaking down.
  ctx.save();
  ctx.strokeStyle = 'rgba(253,230,138,0.14)';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, -h * 0.05, w * 0.9, h * 0.16, -0.18, 0, Math.PI);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(253,230,138,0.08)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, -h * 0.05, w * 1.02, h * 0.2, -0.18, 0, Math.PI);
  ctx.stroke();
  ctx.lineCap = 'round';
  for (const f of fx.fragments) {
    f.x += f.vx * step;
    f.y += f.vy * step;
    if (f.y > h + 10 || f.x < -20) { f.x = rand(w * 0.2, w * 1.3); f.y = rand(-60, -5); }
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = f.ice ? 'rgba(224,242,254,0.35)' : 'rgba(180,150,110,0.35)';
    ctx.lineWidth = f.size * 0.6;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(f.x - f.vx * 4, f.y - f.vy * 4);
    ctx.stroke();
    ctx.fillStyle = f.ice ? '#e0f2fe' : '#a8916d';
    ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
  }
  ctx.restore();
}

// ── Wind gusts (extreme weather only) ────────────────────────────────────────
// Every 5-10 s a gust blows left or right for ~2.5 s. Its strength eases in
// and out; windForce() tells the game how hard to push the player's aircraft.
// push: px per frame at the peak of a gust · every: frames between gusts ·
// bothWays: gusts can blow left or right (otherwise always to the right, the
// way the sand / blizzard snow flies) · ambient: streaks visible even
// between gusts · tailHead: share of gusts blowing from behind (pushes the
// plane forward = up the screen) or head-on (pushes it back = down), storms.
const GUST_CONFIG = {
  STORM:     { push: 1.6, every: [300, 600], bothWays: true, tailHead: 0.6 },
  BLIZZARD:  { push: 1.6, every: [300, 600], bothWays: false, tailHead: 0.4 },
  SANDSTORM: { push: 1.6, every: [300, 600], bothWays: false, tailHead: 0.4 },
  WINDY:     { push: 1.4, every: [150, 330], bothWays: true, ambient: 0.3 },
  TYPHOON:   { push: 2.3, every: [180, 360], bothWays: true, tailHead: 0.5 },
  JOVIAN:    { push: 1.3, every: [240, 480], bothWays: true, tailHead: 0.5 },
  SUPERSONIC:{ push: 2.5, every: [150, 300], bothWays: false, ambient: 0.45 },
};
// Screens are shorter than wide: front / back gusts push a bit less.
const TAIL_HEAD_PUSH = 0.75;
const GUST_FRAMES = 150;          // ≈2.5 s

function gustStrength() {
  if (!fx?.gust) return 0;
  return Math.sin(Math.PI * (fx.gust.age / GUST_FRAMES));   // 0 → 1 → 0
}

/** How hard the wind blows right now, 0 → 1 (gust peak), for the wind sound. */
export function windIntensity() {
  if (!fx) return 0;
  const cfg = GUST_CONFIG[fx.id];
  return cfg ? Math.max(gustStrength(), cfg.ambient || 0) : 0;
}

/** Horizontal push (px per frame, signed) from the current wind gust. */
export function windForce() {
  if (!fx) return 0;
  const cfg = GUST_CONFIG[fx.id];
  return fx.gust && cfg && fx.gust.axis !== 'y' ? fx.gust.dir * cfg.push * gustStrength() : 0;
}

/** Vertical push (px per frame): < 0 tail wind (forward), > 0 head wind (back). */
export function windForceY() {
  if (!fx) return 0;
  const cfg = GUST_CONFIG[fx.id];
  return fx.gust && cfg && fx.gust.axis === 'y' ? fx.gust.dir * cfg.push * TAIL_HEAD_PUSH * gustStrength() : 0;
}

function updateGusts(ctx, step) {
  const cfg = GUST_CONFIG[fx.id];
  if (!cfg) return;
  const { w, h } = fx;
  if (!fx.gust) {
    fx.nextGust -= step;
    if (fx.nextGust <= 0) {
      const axis = Math.random() < (cfg.tailHead || 0) ? 'y' : 'x';
      const dir = axis === 'y' || cfg.bothWays ? (Math.random() < 0.5 ? -1 : 1) : 1;
      fx.gust = { dir, axis, age: 0 };
      fx.lastGustDir = fx.gust.dir;
      fx.lastGustAxis = axis;
    }
  } else {
    fx.gust.age += step;
    if (fx.gust.age >= GUST_FRAMES) {
      fx.gust = null;
      fx.nextGust = rand(cfg.every[0], cfg.every[1]);
    }
  }
  // Wind streaks racing across the screen in the gust direction (windy
  // weather keeps a few faint ones even between gusts).
  const k = Math.max(gustStrength(), cfg.ambient || 0);
  if (k <= 0) return;
  const dir = fx.gust?.dir ?? fx.lastGustDir ?? 1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = fx.id === 'SANDSTORM' ? '#fde6c0' : '#ffffff';
  ctx.lineWidth = 2;
  if ((fx.gust?.axis ?? fx.lastGustAxis) === 'y') {
    // Front / back gust: streaks race up (tail wind) or down (head wind).
    for (const st of fx.streaks) {
      st.y += dir * st.speed * (0.4 + k) * step;
      if (dir > 0 && st.y - st.len > h) { st.y = rand(-h * 0.3, 0); st.x = rand(0, w); }
      if (dir < 0 && st.y + st.len < 0) { st.y = rand(h, h * 1.3); st.x = rand(0, w); }
      ctx.globalAlpha = st.alpha * k;
      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(st.x, st.y - dir * st.len);
      ctx.stroke();
    }
    // Name the gust while it blows hard.
    if (fx.gust && k > 0.25) {
      const fr = getLang() === 'fr';
      const text = dir < 0 ? (fr ? '▲ VENT ARRIÈRE ▲' : '▲ TAIL WIND ▲') : (fr ? '▼ VENT DE FACE ▼' : '▼ HEAD WIND ▼');
      ctx.globalAlpha = Math.min(1, (k - 0.25) * 2.5);
      ctx.font = `${Math.max(10, Math.round(w * 0.018))}px 'Press Start 2P', monospace`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(text, w / 2, h * 0.2);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillText(text, w / 2, h * 0.2);
    }
    ctx.restore();
    return;
  }
  for (const st of fx.streaks) {
    st.x += dir * st.speed * (0.4 + k) * step;
    if (dir > 0 && st.x - st.len > w) { st.x = rand(-w * 0.3, 0); st.y = rand(0, h); }
    if (dir < 0 && st.x + st.len < 0) { st.x = rand(w, w * 1.3); st.y = rand(0, h); }
    ctx.globalAlpha = st.alpha * k;
    ctx.beginPath();
    ctx.moveTo(st.x, st.y);
    ctx.lineTo(st.x - dir * st.len, st.y);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Call every frame, after the aircraft and projectiles are drawn.
 * `player` ({x, y}) lets storm lightning aim at the aircraft.
 * Returns this frame's events so the game can react: { type: 'bolt', points }
 * when lightning strikes.
 */
export function drawWeatherFx(ctx, w, h, step = 1, player = null) {
  const events = [];
  if (!fx) return events;
  if (fx.w !== w || fx.h !== h) { fx.w = w; fx.h = h; }
  fx.t += step;
  if (fx.id === 'RAIN') drawRain(ctx, step, 0.6, '#2f8bff');
  else if (fx.id === 'STORM') drawStorm(ctx, step, player, events);
  else if (fx.id === 'SNOW') drawSnow(ctx, step);
  else if (fx.id === 'FOG') drawFog(ctx, step);
  else if (fx.id === 'CLEAR') drawClear(ctx);
  else if (fx.id === 'BLIZZARD') drawBlizzard(ctx, step);
  else if (fx.id === 'SANDSTORM') drawSandstorm(ctx, step);
  else if (fx.id === 'HEATWAVE') drawHeatwave(ctx, step);
  else if (fx.id === 'TYPHOON') drawTyphoon(ctx, step, player, events);
  else if (fx.id === 'VOLCANIC') drawVolcanic(ctx, step);
  else if (fx.id === 'JOVIAN') drawJovian(ctx, step, player, events);
  else if (fx.id === 'AURORA') drawAurora(ctx, step);
  else if (fx.id === 'SUPERSONIC') drawSupersonic(ctx);
  else if (fx.id === 'RING_SHOWER') drawRingShower(ctx, step);
  updateGusts(ctx, step);
  return events;
}
