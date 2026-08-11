import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { getLevel, TOTAL_LEVELS, BIOME_META } from '../data/levels.js';
import { levelState } from '../systems/progression.js';
import { SFX } from '../audio/sound.js';
import { coinIcon, expIcon } from '../utils/icons.js';

const ZIG_SIDES = ['left', 'right'];
const REGULAR_OPEN_SHEET = '/assets/levels/Unlock/Apercu_Niveaux_Cadenas_Ouverts_Transparent.png';
const REGULAR_LOCKED_SHEET = '/assets/levels/Lock/Apercu_Niveaux_Cadenas_Fermes_Transparent.png';
const BOSS_OPEN_SHEET = '/assets/levels/Unlock/Apercu_Boss_Rouges_Cadenas_Ouvert_Transparent.png';
const STATIC_MAP_AIRCRAFT = new Set(['t6', 'pc21']);
const MAP_BIOME_BACKGROUNDS = {
  ocean: '/assets/Maps/JexonGo_Map_Ocean/JexonGo_ocean_High_Altitude_1024x8192.webp',
  desert: '/assets/Maps/JexonGo_Map_Desert/JexonGo_desert_High_Altitude_1024x8192.webp',
  city: '/assets/Maps/JexonGo_Map_Ville/JexonGo_city_High_Altitude_1024x8192.webp',
  arctic: '/assets/Maps/JexonGo_Map_Arctique/JexonGo_arctic_High_Altitude_1024x8192.webp',
  space: '/assets/Maps/JexonGo_Map_Espace/JexonGo_space_High_Altitude_1024x8192.webp',
};

function createPlayerPositionMarker() {
  const aircraftId = G.activeAircraft || 't6';
  const marker = document.createElement('div');
  marker.className = `map-player-plane${STATIC_MAP_AIRCRAFT.has(aircraftId) ? '' : ' map-player-plane-sheet'}`;
  marker.style.setProperty(
    '--map-player-plane',
    `url('/assets/ships/player/${aircraftId}${STATIC_MAP_AIRCRAFT.has(aircraftId) ? '' : '-animation'}.png')`,
  );
  marker.setAttribute('role', 'img');
  marker.setAttribute('aria-label', `Your current aircraft: ${aircraftId.toUpperCase()}`);
  return marker;
}

function createLevelArtwork(level, isBoss, isLocked) {
  const artwork = document.createElement('div');
  artwork.className = `map-node-art map-node-art-${isBoss ? 'boss' : 'regular'}`;
  artwork.setAttribute('role', 'img');
  artwork.setAttribute('aria-label', `${isBoss ? 'Boss ' : ''}Level ${level}${isLocked ? ', locked' : ''}`);

  if (isBoss) {
    if (isLocked) {
      artwork.style.backgroundImage = `url('/assets/levels/Lock/JexonGO_Pack_Boss_Rouges_Cadenas_Ferme/Niveau_Boss_Rouge_${level}_Cadenas_Ferme.png')`;
      artwork.classList.add('map-node-art-single');
    } else {
      artwork.style.backgroundImage = `url('${BOSS_OPEN_SHEET}')`;
      artwork.style.setProperty('--sprite-column', String((level / 10) - 1));
    }
  } else {
    artwork.style.backgroundImage = `url('${isLocked ? REGULAR_LOCKED_SHEET : REGULAR_OPEN_SHEET}')`;
    artwork.style.setProperty('--sprite-column', String((level - 1) % 10));
    artwork.style.setProperty('--sprite-row', String(Math.floor((level - 1) / 10)));
  }

  return artwork;
}

export function initLevelMap(nav) {
  $('btn-map-back').onclick = () => nav.toMenu();
}

export function renderLevelMap() {
  $('map-xp-display').innerHTML = `${coinIcon()} ${(G.coins || 0).toLocaleString()} &nbsp; ${expIcon()} ${(G.xp || 0).toLocaleString()}`;
  const container = $('levelmap-nodes');
  container.innerHTML = '';

  const nodes = [];
  for (let n = 1; n <= TOTAL_LEVELS; n++) {
    nodes.push({ num: n, state: levelState(n, G.levelStars), stars: G.levelStars[n] || 0 });
  }
  nodes.reverse();
  const playerLevel = nodes.find(node => node.state === 'available')?.num
    ?? nodes.find(node => node.state === 'completed')?.num
    ?? 1;

  let lastBiome = null;
  let biomeZone = null;

  nodes.forEach((node, idx) => {
    const biome = getLevel(node.num).biome;
    const visualState = node.state;

    if (biome !== lastBiome) {
      biomeZone = document.createElement('section');
      biomeZone.className = `map-biome-zone map-biome-zone-${biome}`;
      biomeZone.style.setProperty('--map-biome-background', `url('${MAP_BIOME_BACKGROUNDS[biome]}')`);
      container.appendChild(biomeZone);
      lastBiome = biome;
    }

    const sideName = ZIG_SIDES[idx % ZIG_SIDES.length];
    const isBoss = node.num % 10 === 0;
    if (idx > 0) {
      const connector = document.createElement('div');
      connector.className = `map-connector map-connector-zig-${sideName}`;
      // Only the route above a boss needs the extra span required by the
      // oversized boss artwork. The route to the preceding level stays normal.
      if (isBoss) connector.classList.add('map-connector-boss-link');
      biomeZone.appendChild(connector);
    }

    const element = document.createElement('div');
    element.className = `map-node ${visualState} map-node-zig-${sideName}${isBoss ? ' map-node-boss' : ''}`;

    const stars = document.createElement('div');
    stars.className = 'node-stars';
    for (let starIndex = 1; starIndex <= 3; starIndex++) {
      const star = document.createElement('span');
      star.className = starIndex <= node.stars ? 'earned' : '';
      star.textContent = '\u2605';
      stars.appendChild(star);
    }
    element.appendChild(stars);

    element.appendChild(createLevelArtwork(node.num, isBoss, visualState === 'locked'));

    if (node.num === playerLevel) {
      element.classList.add('map-node-player-position');
      element.appendChild(createPlayerPositionMarker());
    }

    if (visualState === 'locked') {
      element.setAttribute('aria-disabled', 'true');
    } else {
      element.style.setProperty('--node-accent', BIOME_META[biome].accent);
      element.addEventListener('click', () => {
        SFX.chooseLevel?.();
        window._nav.toBriefing(node.num);
      });
    }

    biomeZone.appendChild(element);
  });

  requestAnimationFrame(() => {
    const available = container.querySelector('.map-node.available');
    const target = available || container.querySelector('.map-node.completed:last-of-type');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
