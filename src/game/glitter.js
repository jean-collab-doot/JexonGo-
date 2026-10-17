// Gentle mode: players in the first four years of primary school (Quebec
// 1re-4e année, France CP-CM1, US grades 1-4) see glitter instead of
// explosions, to keep the game free of violence for the youngest. Every
// explosion goes through drawGlitterBurst: particles.js (enemies, missiles,
// sparks, the player's plane), game.js (boss death, nuke) and the explosion
// sound (audio/sound.js plays a sparkle instead).
import { G } from '../state.js';

const GENTLE_MAX_SCHOOL_YEAR = 4;

// School year 1-12 from the onboarding class (qc-prim3, fr-ce2, us-3...).
function schoolYear(level = G.schoolLevel || '') {
  const qc = level.match(/^qc-(prim|sec)(\d)/);
  if (qc) return qc[1] === 'sec' ? 6 + Number(qc[2]) : Number(qc[2]);
  const us = level.match(/^us-(\d+)/);
  if (us) return Number(us[1]);
  const fr = { 'fr-cp': 1, 'fr-ce1': 2, 'fr-ce2': 3, 'fr-cm1': 4, 'fr-cm2': 5, 'fr-6e': 6, 'fr-5e': 7, 'fr-4e': 8, 'fr-3e': 9, 'fr-2nde': 10, 'fr-1re': 11, 'fr-term': 12 };
  return fr[level] || 0;
}

export function gentleFx() {
  const year = schoolYear();
  return year >= 1 && year <= GENTLE_MAX_SCHOOL_YEAR;
}

const GLITTER_COLORS = ['#ff7ac6', '#ffd23f', '#7ee8fa', '#b28dff', '#8fff9c', '#ffffff', '#ffb36b'];
const SPECKS = 26;

// Seeded once per burst (kept on `owner`), so a burst does not flicker.
function specksOf(owner) {
  if (owner._glitter) return owner._glitter;
  const specks = [];
  for (let i = 0; i < SPECKS; i++) {
    const a = (i / SPECKS) * Math.PI * 2 + Math.random() * 0.5;
    specks.push({
      a,
      reach: 0.35 + Math.random() * 0.65,
      r: 0.045 + Math.random() * 0.055,
      color: GLITTER_COLORS[i % GLITTER_COLORS.length],
      star: i % 3 === 0,
      twinkle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 6,
    });
  }
  owner._glitter = specks;
  return specks;
}

// A four-pointed sparkle (star) or a small diamond, centred on 0,0.
function sparkleShape(ctx, r, star) {
  ctx.beginPath();
  if (star) {
    const inner = r * 0.32;
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? inner : r;
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
  } else {
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.6, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.6, 0);
  }
  ctx.closePath();
  ctx.fill();
}

// Glitter burst at (x, y) about `size` px wide; progress 0 → 1 over its life.
// `owner` is any object that lives as long as the burst (particle, boss...).
export function drawGlitterBurst(ctx, x, y, size, progress, owner) {
  const p = Math.max(0, Math.min(1, progress));
  const specks = specksOf(owner);
  const spread = 1 - Math.pow(1 - p, 3);          // fast out, then slows
  const alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
  ctx.save();
  // Soft pastel glow in the middle at the start.
  if (p < 0.45) {
    ctx.globalAlpha = (1 - p / 0.45) * 0.35;
    ctx.fillStyle = '#fff4fb';
    ctx.beginPath();
    ctx.arc(x, y, size * (0.15 + p * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of specks) {
    const d = size * 0.6 * s.reach * spread;
    const sx = x + Math.cos(s.a) * d;
    const sy = y + Math.sin(s.a) * d + p * p * size * 0.18;   // drifts down a little
    const tw = 0.6 + 0.4 * Math.sin(s.twinkle + p * 18);
    ctx.globalAlpha = Math.max(0, alpha * tw);
    ctx.fillStyle = s.color;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(s.spin * p);
    sparkleShape(ctx, Math.max(2, size * s.r * (s.star ? 1.5 : 1)), s.star);
    ctx.restore();
  }
  ctx.restore();
}
