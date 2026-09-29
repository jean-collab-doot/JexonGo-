export function coinIcon(extraClass = '') {
  const cls = ['jg-coin-icon', extraClass].filter(Boolean).join(' ');
  return `<img class="${cls}" src="/assets/fx/Caisse/JexonGo_Coin_frame_01.png" alt="" aria-hidden="true">`;
}

export function expIcon(extraClass = '') {
  const cls = ['jg-exp-icon', extraClass].filter(Boolean).join(' ');
  return `<img class="${cls}" src="/assets/fx/Caisse/JexonGo_EXP_frame_01.png" alt="EXP">`;
}

// ── UI ICONS ─────────────────────────────────────────────────────────────────
// The game's small icons (no emoji: they look different on every phone).
// One style: 24x24, 2px rounded stroke in the text colour (currentColor);
// `fill: true` icons are solid shapes. Sized 1em (follows the font size), so
// `uiIcon('rain')` drops in wherever an emoji used to be.
const UI_ICONS = {
  // weather
  sun:       '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  cloud:     '<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 9.4 4.3 4.3 0 0 0 7 18z"/>',
  rain:      '<path d="M7 14h10a3.5 3.5 0 0 0 .5-6.97A5.5 5.5 0 0 0 6.7 6.1 3.95 3.95 0 0 0 7 14z"/><path d="M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3"/>',
  storm:     '<path d="M7 14h10a3.5 3.5 0 0 0 .5-6.97A5.5 5.5 0 0 0 6.7 6.1 3.95 3.95 0 0 0 7 14z"/><path d="M12.5 15l-2 3.5h3l-2 3.5"/>',
  fog:       '<path d="M4 8h16M3 12h18M5 16h14M8 20h8"/>',
  snow:      '<path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10M9.5 3.5L12 5.5l2.5-2M9.5 20.5l2.5-2 2.5 2"/>',
  blizzard:  '<path d="M7 13h10a3.5 3.5 0 0 0 .5-6.97A5.5 5.5 0 0 0 6.7 5.1 3.95 3.95 0 0 0 7 13z"/><path d="M7 17v.01M11 19v.01M15 17v.01M9 21v.01M13 21.5v.01M17 20v.01"/>',
  sandstorm: '<path d="M3 5h18M5 9h13M7 13h9M9 17h6M10.5 21h3"/>',
  wind:      '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7"/>',
  typhoon:   '<path d="M12 12a2 2 0 1 1 2-2 4 4 0 0 1-4 4 6 6 0 0 1-6-6 8 8 0 0 1 8-8M12 12a2 2 0 1 0-2 2 4 4 0 0 0 4-4 6 6 0 0 1 6 6 8 8 0 0 1-8 8"/>',
  volcano:   '<path d="M2 21l6.5-10h7L22 21zM10 11l-1.5-4M14 11l1.5-4M12 8V3"/>',
  aurora:    '<path d="M3 17c3-6 6-6 9 0s6 6 9 0M3 11c3-6 6-6 9 0s6 6 9 0"/>',
  planet:    '<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10.5" ry="3.5" transform="rotate(-22 12 12)"/>',
  heat:      '<path d="M12 2.5c.8 3.6 5.5 5.2 5.5 10.5a5.5 5.5 0 0 1-11 0c0-3 2-4.5 2-6.5 1.8 1 3 3 3 5 1.2-2.4 1.3-5.6.5-9z"/>',
  // game / interface
  bolt:      '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  clock:     '<circle cx="12" cy="13.5" r="8"/><path d="M12 9.5v4l2.6 2.6M9.5 2h5M12 2v3.5"/>',
  lock:      '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  pin:       '<path d="M12 21.5s-7-6.3-7-11.5a7 7 0 0 1 14 0c0 5.2-7 11.5-7 11.5z"/><circle cx="12" cy="10" r="2.5"/>',
  warning:   '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
  eye:       '<path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:    '<path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/>',
  save:      '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  coin:      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
  phone:     '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  gift:      '<rect x="3" y="8.5" width="18" height="4.5"/><path d="M5 13v8h14v-8M12 8.5V21M12 8.5c-1.5-4-6-4.5-6-1.5 0 1.6 3 1.5 6 1.5 3 0 6 .1 6-1.5 0-3-4.5-2.5-6 1.5"/>',
  plane:     '<path d="M12 2.5c.9 0 1.5 1.2 1.5 2.5v4.2l7.5 4.6v2l-7.5-2.3v4l2 1.6V21l-3.5-1-3.5 1v-1.9l2-1.6v-4l-7.5 2.3v-2l7.5-4.6V5c0-1.3.6-2.5 1.5-2.5z"/>',
  swords:    '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 17.5L21 6V3h-3L6.5 14.5M11 19l-6-6M8 16l-4 4M5 21l-2-2"/>',
  gear:      '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  keyboard:  '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  touch:     '<path d="M9 11V5a1.5 1.5 0 0 1 3 0v6M12 10.5a1.5 1.5 0 0 1 3 0V12M15 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.6 15a1.5 1.5 0 0 1 2.5-1.7L9 16"/>',
  move:      '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  x:         '<path d="M6 6l12 12M18 6L6 18"/>',
  check:     '<path d="M4 12.5l5 5L20 6.5"/>',
  plus:      '<path d="M12 5v14M5 12h14"/>',
  music:     '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  rotate:    '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
  magnet:    '<path d="M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3zM6 7h4M14 7h4"/>',
  target:    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  burst:     '<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19"/>',
  stealth:   '<path d="M3 9c3-3 6-3 9 0s6 3 9 0M3 15c3-3 6-3 9 0s6 3 9 0"/>',
  hexagon:   '<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"/>',
  crown:     '<path d="M3 18h18M4 15.5L3 7l5 4 4-6 4 6 5-4-1 8.5z"/>',
  chevron:   '<path d="M5 16l7-7 7 7"/>',
  help:      '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.9-.9 1.7M12 17v.01"/>',
  crate:     '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  upgrade:   '<path d="M12 20V5M6 11l6-6 6 6M5 21h14"/>',
  // solid shapes
  star:      { fill: true, d: '<path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z"/>' },
  heart:     { fill: true, d: '<path d="M12 21s-8.5-5.4-8.5-11.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.6C20.5 15.6 12 21 12 21z"/>' },
  sparkle:   { fill: true, d: '<path d="M12 1.5l2.2 8.3 8.3 2.2-8.3 2.2-2.2 8.3-2.2-8.3L1.5 12l8.3-2.2z"/>' },
  diamond:   { fill: true, d: '<path d="M12 2l8.5 10L12 22 3.5 12z"/>' },
  radiation: { fill: true, d: '<circle cx="12" cy="12" r="2"/><path d="M12 12L8.3 5.6a7.4 7.4 0 0 1 7.4 0zM12 12l7.4 0a7.4 7.4 0 0 1-3.7 6.4zM12 12l-3.7 6.4A7.4 7.4 0 0 1 4.6 12z"/>' },
};

export function uiIcon(name, extraClass = '') {
  const def = UI_ICONS[name];
  if (!def) return '';
  const solid = typeof def === 'object';
  const cls = ['ui-icon', `ui-icon-${name}`, extraClass].filter(Boolean).join(' ');
  const paint = solid
    ? 'fill="currentColor" stroke="none"'
    : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg class="${cls}" viewBox="0 0 24 24" width="1em" height="1em" ${paint} aria-hidden="true" focusable="false">${solid ? def.d : def}</svg>`;
}
