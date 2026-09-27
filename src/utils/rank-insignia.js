// ── PILOT RANK INSIGNIA ──────────────────────────────────────────────────────
// Builds a small vector badge that visually grows with rank, like real
// military insignia: company-grade ranks (CADET → CAPTAIN) get stacked
// chevrons, field/general ranks (MAJOR → AIR ACE) get stars — so a kid can
// tell at a glance whether a badge means "just started" or "top rank",
// instead of reading an arbitrary abstract glyph (◇ vs ⚡ vs ✦, etc).

function starPoints(cx, cy, outerR) {
  const innerR = outerR * 0.42;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/**
 * @param {number} rank  0 (lowest, CADET) .. 7 (highest, AIR ACE)
 * @param {string} color stroke/fill color, usually the grade's color
 * @returns {string} inline SVG markup
 */
export function rankInsigniaSVG(rank, color = '#e2e8f0') {
  const r = Math.max(0, Math.min(7, rank | 0));
  let shapes = '';

  if (r <= 3) {
    // 1-4 stacked chevrons — junior/company-grade ranks.
    const n = r + 1;
    const gap = 5.5;
    const startY = 16 - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const cy = startY + i * gap;
      shapes += `<polyline points="8,${(cy + 3.5).toFixed(1)} 16,${(cy - 3.5).toFixed(1)} 24,${(cy + 3.5).toFixed(1)}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="square" stroke-linejoin="miter"/>`;
    }
  } else {
    // 1-4 stars in a row — field/general officer ranks.
    const n = r - 3;
    const gap = 6.5;
    const startX = 16 - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const cx = startX + i * gap;
      shapes += `<polygon points="${starPoints(cx, 16, 4.5)}" fill="${color}"/>`;
    }
  }

  return `<svg viewBox="0 0 32 32" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${shapes}</svg>`;
}
