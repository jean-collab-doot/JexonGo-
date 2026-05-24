import { $, showScreen } from '../utils/dom.js';
import { G } from '../state.js';
import { getLevel, TOTAL_LEVELS, BIOMES, BIOME_META } from '../data/levels.js';
import { levelState } from '../systems/progression.js';
import { t } from '../i18n.js';

const GUEST_MAX_LEVEL = 3;

const ZIG = 55;

export function initLevelMap(nav) {
  $('btn-map-back').onclick = () => nav.toMenu();
}

export function renderLevelMap() {
  $('map-xp-display').textContent = `${G.xp} XP`;
  const container = $('levelmap-nodes');
  container.innerHTML = '';

  // Build all nodes (we'll render top-to-bottom = high level first)
  const nodes = [];
  for (let n = 1; n <= TOTAL_LEVELS; n++) {
    nodes.push({ num: n, state: levelState(n, G.levelStars), stars: G.levelStars[n] || 0 });
  }
  nodes.reverse(); // level 50 at top, level 1 at bottom

  let lastBiome = null;

  nodes.forEach((node, idx) => {
    const biome = getLevel(node.num).biome;

    // Biome label when biome changes (going top→bottom = descending level numbers)
    if (biome !== lastBiome) {
      const label = document.createElement('div');
      label.className = 'map-biome-label';
      label.textContent = BIOME_META[biome].label;
      label.style.color = BIOME_META[biome].accent;
      container.appendChild(label);
      lastBiome = biome;
    }

    // Connector (not before first item)
    if (idx > 0) {
      const conn = document.createElement('div');
      conn.className = 'map-connector';
      container.appendChild(conn);
    }

    const isBoss = node.num % 10 === 0;
    const el = document.createElement('div');
    el.className = `map-node ${node.state}` + (isBoss ? ' map-node-boss' : '');
    // Zig-zag: alternate left/right offset
    const side = node.num % 2 === 0 ? ZIG : -ZIG;
    el.style.marginLeft = side + 'px';

    if (isBoss) {
      const img = document.createElement('img');
      img.src       = '/assets/fx/JEXONGO.png';
      img.className = 'boss-skull-img';
      const num = document.createElement('div');
      num.className   = 'boss-num';
      num.textContent = node.num;
      el.appendChild(img);
      el.appendChild(num);
    } else {
      el.textContent = node.num;
    }

    if (node.state === 'completed') {
      const stars = document.createElement('div');
      stars.className = 'node-stars';
      stars.textContent = '★'.repeat(node.stars);
      el.appendChild(stars);
    }

    const guestLocked = !G.playerRegistered && node.num > GUEST_MAX_LEVEL;

    if (guestLocked) {
      el.classList.add('locked');
      el.style.opacity = '0.4';
      el.title = t('signInToUnlock');
      el.addEventListener('click', () => {
        alert(t('signInAlert'));
      });
    } else if (node.state !== 'locked') {
      el.style.borderColor = BIOME_META[biome].accent;
      if (node.state === 'available') el.style.boxShadow = `0 0 14px ${BIOME_META[biome].accent}66`;
      el.addEventListener('click', () => window._nav.toBriefing(node.num));
    }

    container.appendChild(el);
  });

  // Scroll to first available or last completed
  requestAnimationFrame(() => {
    const avail = container.querySelector('.map-node.available');
    const target = avail || container.querySelector('.map-node.completed:last-of-type');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
