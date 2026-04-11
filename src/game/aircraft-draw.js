// All draw functions: centered at (cx,cy), scale≈14 for player, ≈10 for hangar preview
// ctx is already in world space; functions use save/restore

function stealth(ctx, s, col) {
  ctx.fillStyle = col;
  // Fuselage
  ctx.beginPath(); ctx.moveTo(0,-s*2.2); ctx.lineTo(s*0.28,s*0.1); ctx.lineTo(0,s*0.9); ctx.lineTo(-s*0.28,s*0.1); ctx.closePath(); ctx.fill();
  // Left wing
  ctx.beginPath(); ctx.moveTo(0,-s*0.4); ctx.lineTo(-s*2.0,s*0.7); ctx.lineTo(-s*0.35,s*0.5); ctx.closePath(); ctx.fill();
  // Right wing
  ctx.beginPath(); ctx.moveTo(0,-s*0.4); ctx.lineTo(s*2.0,s*0.7); ctx.lineTo(s*0.35,s*0.5); ctx.closePath(); ctx.fill();
}

function fighter(ctx, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0,-s*2.4); ctx.lineTo(s*0.32,s*0.6); ctx.lineTo(0,s*1.1); ctx.lineTo(-s*0.32,s*0.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(s*0.18,-s*0.2); ctx.lineTo(s*1.9,s*0.9); ctx.lineTo(s*1.1,s*1.0); ctx.lineTo(s*0.28,s*0.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s*0.18,-s*0.2); ctx.lineTo(-s*1.9,s*0.9); ctx.lineTo(-s*1.1,s*1.0); ctx.lineTo(-s*0.28,s*0.6); ctx.closePath(); ctx.fill();
  // Tail fins
  ctx.beginPath(); ctx.moveTo(s*0.1,s*0.5); ctx.lineTo(s*0.55,s*0.2); ctx.lineTo(s*0.48,s*1.1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s*0.1,s*0.5); ctx.lineTo(-s*0.55,s*0.2); ctx.lineTo(-s*0.48,s*1.1); ctx.closePath(); ctx.fill();
}

function trainer(ctx, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0,-s*0.2,s*0.3,s*1.8,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(s*0.28,-s*0.1); ctx.lineTo(s*1.7,s*0.15); ctx.lineTo(s*1.7,s*0.42); ctx.lineTo(s*0.28,s*0.35); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s*0.28,-s*0.1); ctx.lineTo(-s*1.7,s*0.15); ctx.lineTo(-s*1.7,s*0.42); ctx.lineTo(-s*0.28,s*0.35); ctx.closePath(); ctx.fill();
}

function transport(ctx, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0,-s*0.2,s*0.48,s*2.1,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(s*0.4,-s*0.9); ctx.lineTo(s*2.3,-s*0.4); ctx.lineTo(s*2.3,-s*0.05); ctx.lineTo(s*0.4,-s*0.2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s*0.4,-s*0.9); ctx.lineTo(-s*2.3,-s*0.4); ctx.lineTo(-s*2.3,-s*0.05); ctx.lineTo(-s*0.4,-s*0.2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s*0.55,s*1.2); ctx.lineTo(s*0.55,s*1.2); ctx.lineTo(s*0.45,s*1.55); ctx.lineTo(-s*0.45,s*1.55); ctx.closePath(); ctx.fill();
}

function attack(ctx, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0,-s*1.8); ctx.lineTo(s*0.42,-s*0.4); ctx.lineTo(s*0.42,s*1.0); ctx.lineTo(-s*0.42,s*1.0); ctx.lineTo(-s*0.42,-s*0.4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(s*0.4,-s*0.2); ctx.lineTo(s*2.2,s*0.1); ctx.lineTo(s*2.2,s*0.45); ctx.lineTo(s*0.4,s*0.45); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s*0.4,-s*0.2); ctx.lineTo(-s*2.2,s*0.1); ctx.lineTo(-s*2.2,s*0.45); ctx.lineTo(-s*0.4,s*0.45); ctx.closePath(); ctx.fill();
}

function bomber(ctx, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0,-s*1.1); ctx.lineTo(s*3.0,s*0.9); ctx.lineTo(s*1.4,s*1.1);
  ctx.lineTo(0,s*0.6); ctx.lineTo(-s*1.4,s*1.1); ctx.lineTo(-s*3.0,s*0.9);
  ctx.closePath(); ctx.fill();
}

function recon(ctx, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0,-s*3.1); ctx.lineTo(s*0.2,s*0.6); ctx.lineTo(0,s*1.3); ctx.lineTo(-s*0.2,s*0.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(s*0.12,-s*0.4); ctx.lineTo(s*1.7,s*0.6); ctx.lineTo(s*0.8,s*0.65); ctx.lineTo(s*0.18,s*0.25); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s*0.12,-s*0.4); ctx.lineTo(-s*1.7,s*0.6); ctx.lineTo(-s*0.8,s*0.65); ctx.lineTo(-s*0.18,s*0.25); ctx.closePath(); ctx.fill();
}

const DRAW_FN = { stealth, fighter, trainer, transport, attack, bomber, recon };

export function drawAircraft(ctx, type, cx, cy, scale, color) {
  ctx.save();
  ctx.translate(cx, cy);
  (DRAW_FN[type] || fighter)(ctx, scale, color);
  ctx.restore();
}

// Enemy faces downward: flip Y
export function drawEnemy(ctx, x, y, size, color, hp, maxHp) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, -1);
  ctx.fillStyle = color;
  // Simple angular enemy body
  ctx.beginPath();
  ctx.moveTo(0,-size*0.85); ctx.lineTo(size*0.45,size*0.55); ctx.lineTo(0,size*0.2); ctx.lineTo(-size*0.45,size*0.55);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(size*0.12,-size*0.1); ctx.lineTo(size*1.1,size*0.45); ctx.lineTo(size*0.5,size*0.55); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-size*0.12,-size*0.1); ctx.lineTo(-size*1.1,size*0.45); ctx.lineTo(-size*0.5,size*0.55); ctx.closePath(); ctx.fill();
  ctx.restore();

  // HP bar for multi-hp enemies
  if (maxHp > 1) {
    const bw = size * 1.6, bh = 4;
    const bx = x - bw / 2, by = y + size + 2;
    ctx.fillStyle = '#1e293b';  ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = color;      ctx.fillRect(bx, by, bw * (hp / maxHp), bh);
  }
}
