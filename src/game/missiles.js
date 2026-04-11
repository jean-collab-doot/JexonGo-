export function createMissile(x, y, tx, ty, speed, enemyId, color = '#00d4ff') {
  const dx = tx - x, dy = ty - y;
  const d  = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x, y,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    tx, ty, enemyId, color,
    trail: [],
  };
}

export function updateMissiles(missiles, onHit) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.trail.push({ x: m.x, y: m.y });
    if (m.trail.length > 8) m.trail.shift();
    m.x += m.vx;
    m.y += m.vy;
    const dx = m.x - m.tx, dy = m.y - m.ty;
    if (dx * dx + dy * dy < 18 * 18) { onHit(m); missiles.splice(i, 1); continue; }
    if (m.y < -80 || m.x < -100 || m.x > 4000) missiles.splice(i, 1);
  }
}

export function drawMissiles(ctx, missiles) {
  for (const m of missiles) {
    for (let i = 0; i < m.trail.length; i++) {
      const t = m.trail[i];
      const a = (i / m.trail.length) * 0.55;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2.5 * (i / m.trail.length), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,212,255,${a})`;
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(m.x, m.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = m.color; ctx.fill();
    ctx.beginPath(); ctx.arc(m.x, m.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,212,255,0.25)'; ctx.fill();
  }
}
