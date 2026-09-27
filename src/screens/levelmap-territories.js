// Backdrop for the level map: a canvas (radar grid, "+" marks and optional
// territory artwork, painted with a fisheye lens by levelmap-fisheye.js) plus
// the dotted route between level nodes. Everything is laid out in percentages
// of the map panel, so node positions are percentages.

// Positions of levels 1..10 (percent of the panel), laid out as a winding route.
export const NODE_POSITIONS = [
  [54, 88.5], [44, 73.5], [52, 57.5], [25.5, 53.5], [31.5, 35],
  [19, 20.5], [50.5, 18], [75.5, 27], [72, 48.5], [80, 65],
];

// Real-world spots on the Pacific artwork, in pixels of the 1103x1426 image:
// 1 south of New Zealand, 2 north of New Zealand, 3 Sydney, 4 Brisbane,
// 5 Port Moresby (Papua New Guinea), 6 Manila (Philippines), 7 Shanghai
// (China coast), 8 Tokyo (Japan), 9 Hawaii (Big Island), 10 Santiago (Chile).
const PACIFIC_PX = [
  [415, 1018], [453, 883], [327, 910], [352, 862], [303, 703],
  [172, 526], [168, 436], [288, 380], [642, 510], [1025, 835],
];
const PACIFIC_NODES = PACIFIC_PX.map(([x, y]) => [x / 1103 * 100, y / 1426 * 100]);

// Real-world spots on the Sahara artwork, in pixels of the 1774x887 image:
// 11 Western Sahara, 12 Casablanca, 13 Marrakesh, 14 Algiers, 15 Tamanrasset,
// 16 Tripoli, 17 Cairo, 18 Hurghada, 19 Alexandria, 20 Egyptian desert.
const SAHARA_PX = [
  [140, 470], [400, 155], [480, 240], [665, 90], [700, 580],
  [935, 185], [1550, 390], [1650, 520], [1495, 220], [1420, 480],
];
const DESERT_NODES = SAHARA_PX.map(([x, y]) => [x / 1774 * 100, y / 887 * 100]);

// Real-world spots on the USA artwork, in pixels of the 1536x1024 image:
// 21 New York, 22 Washington D.C., 23 North Carolina, 24 South Carolina,
// 25 Miami, 26 Dallas, 27 San Diego, 28 Los Angeles, 29 San Francisco,
// 30 Seattle.
const USA_PX = [
  [1370, 415], [1320, 480], [1345, 545], [1300, 615], [1300, 940],
  [550, 730], [170, 600], [110, 545], [85, 410], [140, 95],
];
const USA_NODES = USA_PX.map(([x, y]) => [x / 1536 * 100, y / 1024 * 100]);

// Two levels per planet, in pixels of the 1536x1024 image: 41-42 on the small
// cratered moon, 43-44 on the gas giant, 45-46 on the mid cratered moon,
// 47-48 on the swirled planet, 49-50 (boss) on the ringed planet.
const SPACE_PX = [
  [250, 756], [341, 795], [213, 203], [388, 278], [764, 199],
  [886, 251], [1234, 212], [1367, 269], [914, 693], [1000, 880],
];
const SPACE_NODES = SPACE_PX.map(([x, y]) => [x / 1536 * 100, y / 1024 * 100]);

export const nodePositions = biome => {
  if (biome === 'ocean') return PACIFIC_NODES;
  if (biome === 'desert') return DESERT_NODES;
  if (biome === 'city') return USA_NODES;
  if (biome === 'space') return SPACE_NODES;
  return NODE_POSITIONS;
};

// Per-biome territory artwork (PNG drawn over the grid) and its width/height
// ratio, so the layout is known before the image has loaded.
const TERRITORY_ART = {
  ocean: {
    src: '/assets/Maps/Territory/Pacific.png',
    ratio: 1103 / 1426,
    // Nodes are packed tighter on this map, so size them from the board.
    nodeSize: (bw, bh) => Math.max(60, Math.min(bw * 0.22, bh * 0.13)),
    // Nodes are pinned to real-world spots on the art, so on a portrait panel
    // (phones) they must stay glued to the art's own rectangle instead of the
    // "spread across the whole panel" fallback other biomes use.
    pinned: true,
  },
  desert: {
    src: '/assets/Maps/Territory/Sahara.png',
    ratio: 1774 / 887,
    nodeSize: (bw, bh) => Math.max(35, Math.min(bw * 0.068, bh * 0.15)),
    pinned: true,
  },
  city: {
    src: '/assets/Maps/Territory/USA.png',
    ratio: 1536 / 1024,
    nodeSize: (bw, bh) => Math.max(27, Math.min(bw * 0.051, bh * 0.078)) * 1.18,
    pinned: true,
  },
  // Pinned so the phone layout matches desktop exactly: the image is always
  // fitted whole and the nodes sit on it, instead of the "spread across the
  // whole panel" fallback used by biomes with no real-world node placement.
  arctic: { src: '/assets/Maps/Territory/Arctic.png', ratio: 1536 / 1024, pinned: true },
  space: {
    src: '/assets/Maps/Territory/Space.png',
    ratio: 1536 / 1024,
    // Same base formula as the USA map, scaled up on both phone and desktop
    // so the planets' two nodes each read clearly.
    nodeSize: (bw, bh) => Math.max(20, Math.min(bw * 0.038, bh * 0.058)) * 1.7,
    pinned: true,
  },
};

// Major grid lines (percent of the board) and the "+" marks at their crossings.
export const MAJOR_X = [22, 51, 80];
export const MAJOR_Y = [12, 36.5, 59, 81.5];

export const territoryArt = biome => TERRITORY_ART[biome] || null;

// Where the artwork is drawn and where the level nodes live, in panel pixels.
// The artwork is never stretched or cropped: it is always fitted whole and
// centred. The nodes use that same rectangle so they stay on the map, except on
// a portrait panel (phones) with a wide artwork, where that rectangle would be
// too short to hold ten nodes - they then spread over the whole panel instead.
export function layoutBoard(W, H, ratio, pinned) {
  if (!ratio) ratio = 0.9;
  const ih = Math.min(H, W / ratio);
  const iw = ih * ratio;
  const art = { x: (W - iw) / 2, y: (H - ih) / 2, w: iw, h: ih };
  const tooShort = !pinned && W < H && ratio > 1 && ih < H * 0.7;
  return { art, board: tooShort ? { x: 0, y: 0, w: W, h: H } : art };
}

export function buildMapBackdrop(routePaths) {
  return `<canvas class="tmap-canvas" aria-hidden="true"></canvas>
  <div class="tmap-board">
    <svg class="tmap-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g class="tmap-route">${routePaths}</g>
    </svg>
  </div>
  <div class="tmap-glass" aria-hidden="true"></div>`;
}

// Straight route segment between two consecutive level nodes.
export function routeSegment(positions, fromIdx, toIdx, reached) {
  const [x1, y1] = positions[fromIdx];
  const [x2, y2] = positions[toIdx];
  return `<path class="${reached ? 'reached' : 'ahead'}" d="M${x1} ${y1} L${x2} ${y2}"/>`;
}
