export function spawnExplosion(particles, x, y, color, count = 14) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.6;
    const spd   = 1.8 + Math.random() * 3.2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1, decay: 0.028 + Math.random() * 0.025,
      size: 3 + Math.random() * 4, color,
    });
  }
}

export function spawnHitSpark(particles, x, y) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    particles.push({
      x, y,
      vx: Math.cos(a) * (1 + Math.random() * 2.5),
      vy: Math.sin(a) * (1 + Math.random() * 2.5),
      life: 1, decay: 0.09, size: 2 + Math.random() * 2.5, color: '#ff6b35',
    });
  }
}

export function updateParticles(particles) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.06;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
