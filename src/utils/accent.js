// The accent colour (cyan) for canvas drawings: the shield around the plane,
// the tanker's basket targets and arrow, the teammate's name and ring.
// Read once from the CSS variables of src/screens/accent.css, the one place
// the colours are defined.
let _c = null;

export function accent() {
  if (_c) return _c;
  let s = null;
  try { s = getComputedStyle(document.documentElement); } catch { /* no DOM */ }
  const v = (name, fallback) => (s?.getPropertyValue(name).trim() || fallback);
  _c = {
    main: v('--jx-accent', '#1EC8FF'),
    hover: v('--jx-accent-hover', '#6FDDFF'),
    press: v('--jx-accent-press', '#0A9FD1'),
    edge: v('--jx-accent-edge', '#0B5E80'),
    ink: v('--jx-accent-ink', '#10182F'),
  };
  return _c;
}

// The accent at some opacity: rgba() string.
export function accentRgba(alpha = 1, key = 'main') {
  const hex = accent()[key].replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
