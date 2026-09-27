import { $ } from '../utils/dom.js';
import { uiIcon } from '../utils/icons.js';
import { G } from '../state.js';
import { getLevel, TOTAL_LEVELS, BIOME_META, BIOMES } from '../data/levels.js';
import { levelState } from '../systems/progression.js';
import { SFX } from '../audio/sound.js';
import { getLang } from '../i18n.js';
import { nodePositions, buildMapBackdrop, routeSegment, territoryArt } from './levelmap-territories.js';
import { paintFisheye, warmFisheye, lensPositions } from './levelmap-fisheye.js';

const REGULAR_OPEN_SHEET = '/assets/levels/Unlock/Apercu_Niveaux_Cadenas_Ouverts_Transparent.png';
const REGULAR_LOCKED_SHEET = '/assets/levels/Lock/Apercu_Niveaux_Cadenas_Fermes_Transparent.png';
const BOSS_OPEN_SHEET = '/assets/levels/Unlock/Apercu_Boss_Rouges_Cadenas_Ouvert_Transparent.png';

// One page per biome (10 levels each) instead of one long 50-level scroll,
// with < > arrows in the title bar to switch world - see BIOME_META for the
// display names (PACIFIQUE/SAHARA/USA/ARCTIQUE/ESPACE in French).
let _activeBiomeIdx = 0;
let _allNodes = [];
// Last level opened from the map (briefing or game). Coming back from it
// reopens that level's world; opening the map from the lobby (null focus)
// starts on PACIFIQUE.
let _focusLevel = null;
// MULTI (multiplayer.js): the same solo map picks the level of the co-op
// game. { onPick(levelNum), onBack() } while picking, null for solo.
let _picker = null;

export function setLevelMapPicker(picker) {
  _picker = picker || null;
}

export function getLevelMapPicker() {
  return _picker;
}

export function setMapFocusLevel(levelNum) {
  _focusLevel = levelNum >= 1 && levelNum <= TOTAL_LEVELS ? levelNum : null;
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

function _biomeTitle(biome) {
  const meta = BIOME_META[biome];
  return getLang() === 'fr' ? meta.labelFr : meta.label;
}

// Same slide as the lobby carousel arrows (SWIPE_MS in utils/dom.js), applied
// to the map content only - territory artwork, route and level nodes. The old
// world is kept as a ghost layer and pushed out while the new one comes in:
// 'next' (▶︎) to the left, 'prev' (◀︎) to the right. The CRT glass overlay, the
// bezel and the title bar stay put.
const BIOME_SWIPE_MS = 320;
let _swiping = false;

function _swipeLayer() {
  const layer = document.createElement('div');
  layer.className = 'tmap-swipe-layer';
  layer.style.cssText = 'position:absolute;inset:0;';
  return layer;
}

function _showBiome(idx, dir) {
  const nextIdx = ((idx % BIOMES.length) + BIOMES.length) % BIOMES.length;
  if (_swiping) return;
  const container = $('levelmap-nodes');
  if (!dir || !container || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    _activeBiomeIdx = nextIdx;
    _renderBiomePage();
    return;
  }

  _swiping = true;
  const content = () => [...container.children].filter(el => !el.classList.contains('tmap-glass'));

  const oldLayer = _swipeLayer();
  oldLayer.style.pointerEvents = 'none';
  oldLayer.append(...content()); // moved out of the container, so the re-render below keeps them

  _activeBiomeIdx = nextIdx;
  _renderBiomePage();

  const newLayer = _swipeLayer();
  container.insertBefore(newLayer, container.firstChild);
  newLayer.append(...content().filter(el => el !== newLayer));
  // The seam between the two maps must show a page's LEFT edge (its right
  // edge carries the dark lens rim): going back, the old page slides right on
  // top; going forward, the new page slides in on top from the right.
  if (dir === 'next') newLayer.before(oldLayer);
  else newLayer.after(oldLayer);

  const enterFrom = dir === 'next' ? '100%' : '-100%';
  const exitTo = dir === 'next' ? '-100%' : '100%';
  newLayer.style.transform = `translateX(${enterFrom})`;
  void newLayer.offsetWidth; // flush the starting position before animating in
  requestAnimationFrame(() => {
    const ease = `transform ${BIOME_SWIPE_MS}ms ease`;
    newLayer.style.transition = ease;
    oldLayer.style.transition = ease;
    newLayer.style.transform = 'translateX(0)';
    oldLayer.style.transform = `translateX(${exitTo})`;
  });

  setTimeout(() => {
    oldLayer.remove();
    newLayer.replaceWith(...newLayer.childNodes);
    _swiping = false;
  }, BIOME_SWIPE_MS + 60);
}

function _paintBackdrop() {
  const container = $('levelmap-nodes');
  paintFisheye(container, territoryArt(BIOMES[_activeBiomeIdx]));
  // Build the other worlds' backdrops now so the slide to them stays smooth.
  warmFisheye(container, BIOMES.map(territoryArt));
}

// Puts nodes and route on their exact spot of the lens-distorted artwork.
function _layoutPoints() {
  const container = $('levelmap-nodes');
  container.querySelectorAll('.tmap-board').forEach(board => {
    const biome = board.dataset.biome;
    if (!biome) return;
    const pts = lensPositions(container, territoryArt(biome), nodePositions(biome));
    if (!pts) return;
    board.querySelectorAll('.tmap-node').forEach((el, i) => {
      if (!pts[i]) return;
      el.style.left = `${pts[i][0]}%`;
      el.style.top = `${pts[i][1]}%`;
    });
    board.querySelectorAll('.tmap-route > path').forEach((path, i) => {
      if (pts[i + 1]) path.setAttribute('d', `M${pts[i][0]} ${pts[i][1]} L${pts[i + 1][0]} ${pts[i + 1][1]}`);
    });
  });
}

export function initLevelMap(nav) {
  if (typeof ResizeObserver !== 'undefined') {
    let queued = false;
    new ResizeObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; _paintBackdrop(); _layoutPoints(); });
    }).observe($('levelmap-nodes'));
  }
  $('btn-map-back').onclick = () => {
    if (_picker) { const { onBack } = _picker; _picker = null; onBack?.(); return; }
    nav.toMenu();
  };
  $('btn-map-biome-prev').onclick = () => { SFX.click?.(); _showBiome(_activeBiomeIdx - 1, 'prev'); };
  $('btn-map-biome-next').onclick = () => { SFX.click?.(); _showBiome(_activeBiomeIdx + 1, 'next'); };
}

export function renderLevelMap() {
  $('map-coins').textContent = (G.coins || 0).toLocaleString();
  $('map-xp').textContent = (G.xp || 0).toLocaleString();

  _allNodes = [];
  for (let n = 1; n <= TOTAL_LEVELS; n++) {
    _allNodes.push({
      num: n,
      state: levelState(n, G.levelStars, G.highestLevel, G.tutorialPlan?.startLevel || 1),
      stars: G.levelStars[n] || 0,
    });
  }
  const playerLevel = [...(_allNodes)].reverse().find(node => node.state === 'available')?.num
    ?? [...(_allNodes)].reverse().find(node => node.state === 'completed')?.num
    ?? 1;

  _activeBiomeIdx = BIOMES.indexOf(_focusLevel ? getLevel(_focusLevel).biome : 'ocean');
  _renderBiomePage(playerLevel);
}

function _renderBiomePage(playerLevel) {
  const biome = BIOMES[_activeBiomeIdx];
  const container = $('levelmap-nodes');
  container.innerHTML = '';

  $('map-biome-title').textContent = _picker ? `MULTI · ${_biomeTitle(biome)}` : _biomeTitle(biome);

  const pageNodes = _allNodes.filter(node => getLevel(node.num).biome === biome);

  const positions = nodePositions(biome);
  let route = '';
  for (let i = 1; i < pageNodes.length; i++) {
    route += routeSegment(positions, i - 1, i, pageNodes[i].state !== 'locked');
  }
  container.insertAdjacentHTML('beforeend', buildMapBackdrop(route));
  _paintBackdrop();
  const board = container.querySelector('.tmap-board');
  board.dataset.biome = biome;

  pageNodes.forEach((node, idx) => {
    const visualState = node.state;
    const isBoss = node.num % 10 === 0;
    const [x, y] = positions[idx];

    const element = document.createElement('div');
    element.className = `tmap-node ${visualState}${isBoss ? ' tmap-node-boss' : ''}${x > 60 ? ' tmap-node-right' : ''}`;
    element.style.left = `${x}%`;
    element.style.top = `${y}%`;

    const stars = document.createElement('div');
    stars.className = 'node-stars';
    for (let starIndex = 1; starIndex <= 3; starIndex++) {
      const star = document.createElement('span');
      star.className = starIndex <= node.stars ? 'earned' : '';
      star.innerHTML = uiIcon('star');
      stars.appendChild(star);
    }
    element.appendChild(stars);

    element.appendChild(createLevelArtwork(node.num, isBoss, visualState === 'locked'));

    if (node.num === playerLevel) {
      element.classList.add('tmap-node-player');
    }

    if (visualState === 'locked') {
      element.setAttribute('aria-disabled', 'true');
    } else {
      element.style.setProperty('--node-accent', BIOME_META[biome].accent);
      element.addEventListener('click', () => {
        SFX.chooseLevel?.();
        // MULTI too: the level's briefing first (its fly button starts the co-op game).
        window._nav.toBriefing(node.num);
      });
    }

    board.appendChild(element);
  });

  _layoutPoints();

  // 20 chests total across the whole campaign (see systems/chest.js) — this
  // counter tracks overall progress, not just the world currently in view.
  const chestsEarned = _allNodes.filter(node =>
    (node.num % 5 === 0 || node.num % 5 === 3) && node.state === 'completed').length;
  $('map-biome-stars').textContent = `${chestsEarned}/20`;

  requestAnimationFrame(() => {
    const target = container.querySelector('.tmap-node-player')
      ?? container.querySelector('.tmap-node.available');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else $('levelmap-scroll').scrollTo({ top: 0 });
  });
}
