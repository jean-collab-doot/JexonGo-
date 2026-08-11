import { $ } from '../utils/dom.js';
import { G, saveAll, clampCoins } from '../state.js';
import { load, save } from '../utils/storage.js';
import { t, applyI18n, getLang } from '../i18n.js';
import { coinIcon } from '../utils/icons.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { AIRCRAFT_SPRITE, drawFrame, getImage, preloadSprite } from '../game/sprites.js';

let _nav = null;
let _activeTab = 'featured';
let _selectedPlan = null;
let _previewRaf = null;
let _oceanSheet = null;

const TAB_META = {
  featured: { icon: '*', key: 'shopTabFeatured' },
  rewards:  { icon: '!', key: 'shopTabRewards' },
};

export const MISSILE_TYPES = [
  {
    id: 'fire',
    price: 500,
    sprite: '/assets/fx/Missile/Fire%20missiles.png',
    title: { fr: 'Missile feu', en: 'Fire Missile' },
    detail: { fr: 'Missile offensif avec flammes rapides.', en: 'Fast offensive flame missile.' },
  },
  {
    id: 'ice',
    price: 750,
    sprite: '/assets/fx/Missile/Ice%20missile.png',
    title: { fr: 'Missile glace', en: 'Ice Missile' },
    detail: { fr: 'Missile de glace avec effet bleu.', en: 'Ice missile with a blue effect.' },
  },
  {
    id: 'nuke',
    price: 1500,
    sprite: '/assets/fx/Missile/Nuke%20missile.png',
    title: { fr: 'Missile nuke', en: 'Nuke Missile' },
    detail: { fr: 'Missile lourd pour une attaque totale.', en: 'Heavy missile for a total attack.' },
  },
  {
    id: 'ray',
    price: 2000,
    sprite: '/assets/fx/Missile/Ray%20gun%20missile.png',
    title: { fr: 'Missile rayon', en: 'Ray Missile' },
    detail: { fr: 'Missile energie avec rayon cyan.', en: 'Energy missile with a cyan ray.' },
  },
];

export const SHOOTING_PLANS = [
  {
    id: 'default',
    price: 0,
    cadence: 3,
    missiles: [{ x: 0, y: 0, angle: 0 }],
    title: { fr: 'Tir standard', en: 'Standard Shot' },
    detail: { fr: '1 missile droit toutes les 3 s', en: '1 straight missile every 3s' },
    icon: 'focus',
  },
  {
    id: 'quick_single',
    price: 250,
    cadence: 2,
    missiles: [{ x: 0, y: 0, angle: 0 }],
    title: { fr: 'Tir rapide', en: 'Quick Shot' },
    detail: { fr: '1 missile droit toutes les 2 s', en: '1 straight missile every 2s' },
    icon: 'focus',
  },
  {
    id: 'double_wing',
    price: 800,
    cadence: 2,
    simultaneous: true,
    missiles: [{ x: -46, y: 0, angle: -0.34 }, { x: 46, y: 0, angle: 0.34 }],
    title: { fr: 'Double tir', en: 'Twin Shot' },
    detail: { fr: '2 missiles en V toutes les 2 s', en: '2 V-shaped missiles every 2s' },
    icon: 'spread',
  },
  {
    id: 'triple_fan',
    price: 1200,
    cadence: 2,
    simultaneous: true,
    missiles: [{ x: -52, y: 10, angle: -0.34 }, { x: 0, y: -18, angle: 0 }, { x: 52, y: 10, angle: 0.34 }],
    title: { fr: 'Triple tir', en: 'Triple Shot' },
    detail: { fr: 'V gauche/droite + 1 missile droit', en: 'Left/right V + 1 straight missile' },
    icon: 'spread',
  },
  {
    id: 'squadron_plus',
    price: 2000,
    cadence: 2,
    wingmen: true,
    simultaneous: true,
    missiles: [
      { x: 0, y: 0, angle: 0, source: 'leftWingman' },
      { x: -108, y: -12, angle: -0.42 },
      { x: 0, y: -62, angle: 0 },
      { x: 108, y: -12, angle: 0.42 },
      { x: 0, y: 0, angle: 0, source: 'rightWingman' },
    ],
    title: { fr: 'Tir en V', en: 'V-Formation Shot' },
    detail: { fr: '5 missiles: gauche, centre et droite', en: '5 missiles: left, center and right' },
    icon: 'flame',
  },
  {
    id: 'blackbird_overload',
    price: 8000,
    cadence: 2,
    wingmen: true,
    simultaneous: true,
    bonusSeconds: 5,
    missiles: [
      { x: 0, y: 0, angle: 0, source: 'leftWingman' },
      { x: -72, y: -6, angle: 0 },
      { x: 0, y: -24, angle: 0 },
      { x: 72, y: -6, angle: 0 },
      { x: 0, y: 0, angle: 0, source: 'rightWingman' },
    ],
    title: { fr: 'Assaut total', en: 'Total Assault' },
    detail: { fr: 'Bouton B-2: nuke toutes les 1 min pendant 10 s', en: 'B-2 button: nuke every 1 min for 10s' },
    icon: 'rocket',
  },
];

const SHOP_VISIBLE_PLAN_COUNT = SHOOTING_PLANS.filter(plan => plan.id !== 'default').length;

export function initShop(nav) {
  _nav = nav;

  $('btn-shop-back')?.addEventListener('click', () => _nav.toMenu());
  document.querySelectorAll('.shop-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = TAB_META[btn.dataset.tab] ? btn.dataset.tab : 'featured';
      renderShop();
    });
  });
}

export function renderShop() {
  stopShopPreview();
  applyI18n();
  ensureShootingState();

  const coins = $('shop-coins-val');
  const xp = $('shop-xp-val');
  G.coins = clampCoins(G.coins);
  if (coins) coins.textContent = (G.coins || 0).toLocaleString();
  if (xp) xp.textContent = (G.xp || 0).toLocaleString();

  document.querySelectorAll('.shop-tab').forEach(btn => {
    btn.classList.toggle('shop-tab-active', btn.dataset.tab === _activeTab);
  });

  const content = $('shop-content');
  if (!content) return;

  const lang = getLang() === 'fr' ? 'fr' : 'en';
  const filteredPlans = getFilteredPlans(lang);
  const isMissileTab = _activeTab === 'rewards';
  const specialWeapon = activeAircraftHasSpecialWeapon();
  const activePlane = AIRCRAFT[getActiveAircraftId()];

  content.innerHTML = `
    <section class="shop-shooting-list ${specialWeapon ? 'shop-special-weapon-locked' : ''}">
      ${specialWeapon ? `
        <div class="shop-special-weapon-notice">
          <strong>${lang === 'fr' ? 'ARSENAL INDISPONIBLE' : 'ARSENAL UNAVAILABLE'}</strong>
          <span>${activePlane.name} ${lang === 'fr' ? 'utilise sa propre arme speciale.' : 'uses its own special weapon.'}</span>
        </div>
      ` : ''}
      <div class="shop-section-head">
        <div>
          <p>${t(TAB_META[_activeTab]?.key || 'shopTabFeatured')}</p>
          <h3>${isMissileTab ? (lang === 'fr' ? 'Types de missiles' : 'Missile types') : (lang === 'fr' ? 'Ameliorations de tir' : 'Shooting upgrades')}</h3>
        </div>
        <span>${isMissileTab ? MISSILE_TYPES.length : `${filteredPlans.length}/${SHOP_VISIBLE_PLAN_COUNT}`}</span>
      </div>
      <div class="${isMissileTab ? 'shop-missile-grid' : 'shop-plan-grid'}">
        ${isMissileTab
          ? MISSILE_TYPES.map(missile => renderMissileCard(missile, lang)).join('')
          : (filteredPlans.map(plan => renderPlanCard(plan, lang)).join('') || renderEmptySearch(lang))}
      </div>
    </section>
  `;

  bindPlanCards();
  startShopPreview();
}

function ensureShootingState() {
  const owned = load('ownedShootingPlans', ['default']);
  const validIds = new Set(SHOOTING_PLANS.map(plan => plan.id));
  G.ownedShootingPlans = Array.isArray(G.ownedShootingPlans) && G.ownedShootingPlans.length
    ? G.ownedShootingPlans
    : (Array.isArray(owned) && owned.length ? owned : ['default']);
  G.ownedShootingPlans = G.ownedShootingPlans.filter(id => validIds.has(id));
  if (!G.ownedShootingPlans.includes('default')) G.ownedShootingPlans.unshift('default');

  const active = load('activeShootingPlan', 'default');
  G.activeShootingPlan = validIds.has(G.activeShootingPlan) && G.ownedShootingPlans.includes(G.activeShootingPlan)
    ? G.activeShootingPlan
    : (validIds.has(active) && G.ownedShootingPlans.includes(active) ? active : 'default');
  _selectedPlan = validIds.has(_selectedPlan) ? _selectedPlan : G.activeShootingPlan;
  save('ownedShootingPlans', G.ownedShootingPlans);
  save('activeShootingPlan', G.activeShootingPlan);

  const missileIds = new Set(MISSILE_TYPES.map(missile => missile.id));
  const ownedMissiles = load('ownedMissileTypes', []);
  G.ownedMissileTypes = Array.isArray(G.ownedMissileTypes) && G.ownedMissileTypes.length
    ? G.ownedMissileTypes
    : (Array.isArray(ownedMissiles) && ownedMissiles.length ? ownedMissiles : []);
  G.ownedMissileTypes = G.ownedMissileTypes.filter(id => missileIds.has(id));
  const migratedMissileStore = load('missileStoreVersion', 1) >= 2;
  if (!migratedMissileStore) {
    G.ownedMissileTypes = G.ownedMissileTypes.filter(id => id !== 'fire');
    save('missileStoreVersion', 2);
  }
  // Older test saves could incorrectly mark the complete missile catalogue as
  // owned even though no purchase was made. Correct that exact legacy state
  // once; normal partial ownership and all future purchases remain untouched.
  if (load('missileOwnershipFixVersion', 0) < 1) {
    const incorrectlyOwnsEntireCatalogue = missileIds.size > 0
      && G.ownedMissileTypes.length === missileIds.size
      && [...missileIds].every(id => G.ownedMissileTypes.includes(id));
    if (incorrectlyOwnsEntireCatalogue) {
      G.ownedMissileTypes = [];
      G.activeMissileType = 'default';
    }
    save('missileOwnershipFixVersion', 1);
  }
  if (G.activeMissileType !== 'default' && (!missileIds.has(G.activeMissileType) || !G.ownedMissileTypes.includes(G.activeMissileType))) {
    G.activeMissileType = 'default';
  }
  save('ownedMissileTypes', G.ownedMissileTypes);
  save('activeMissileType', G.activeMissileType);
}

function getActiveAircraftId() {
  return AIRCRAFT[G.activeAircraft] ? G.activeAircraft : 't6';
}

function activeAircraftHasSpecialWeapon() {
  return Boolean(AIRCRAFT[getActiveAircraftId()]?.ability?.weapon);
}

function getPlan(id) {
  return SHOOTING_PLANS.find(plan => plan.id === id) || null;
}

function getMissile(id) {
  return MISSILE_TYPES.find(missile => missile.id === id) || null;
}

function getFilteredPlans(lang) {
  return SHOOTING_PLANS.filter(plan => {
    if (plan.id === 'default') return false;
    return Boolean(plan?.title?.[lang]);
  });
}

function renderPlanCard(plan, lang) {
  const specialWeapon = activeAircraftHasSpecialWeapon();
  const owned = G.ownedShootingPlans.includes(plan.id);
  const active = G.activeShootingPlan === plan.id;
  const selected = _selectedPlan === plan.id;
  const canBuy = (G.coins || 0) >= plan.price;
  const disabled = specialWeapon || (!owned && !canBuy);
  const action = active
    ? (lang === 'fr' ? 'Equipe' : 'Equipped')
    : owned
      ? (lang === 'fr' ? 'Choisir' : 'Select')
      : (lang === 'fr' ? 'Acheter' : 'Buy');

  return `
    <article class="shop-plan-card shop-weapon-card ${selected ? 'shop-plan-selected' : ''} ${active ? 'shop-plan-equipped' : ''} ${specialWeapon ? 'shop-plan-unavailable' : ''}" data-plan-id="${plan.id}">
      <h4>${plan.title[lang]}</h4>
      <div class="shop-weapon-window">
        <canvas class="shop-plan-mini-canvas" data-mini-plan="${plan.id}"></canvas>
      </div>
      <div class="shop-plan-description" id="shop-plan-desc-${plan.id}" hidden>${plan.detail[lang]}</div>
      <div class="shop-weapon-footer">
        <button class="shop-plan-info" type="button" data-plan-info="${plan.id}" aria-expanded="false" aria-controls="shop-plan-desc-${plan.id}">
          ${lang === 'fr' ? 'DESCRIPTION' : 'DESCRIPTION'}
        </button>
        <button class="shop-plan-action ${owned ? 'shop-action-bought' : ''}" type="button" data-plan-action="${plan.id}" ${disabled ? 'disabled' : ''}>
          ${owned
            ? `<b>${lang === 'fr' ? 'ACHETE' : 'BOUGHT'}</b>`
            : `<b>${plan.price ? plan.price.toLocaleString() : '0'}</b>${coinIcon('jg-coin-icon-small')}`}
        </button>
      </div>
      <p>${specialWeapon
        ? (lang === 'fr' ? 'Indisponible avec cet avion' : 'Unavailable with this aircraft')
        : disabled
          ? (lang === 'fr' ? 'Pas assez de coins' : 'Not enough coins')
          : action}</p>
    </article>
  `;
}

function renderMissileCard(missile, lang) {
  const specialWeapon = activeAircraftHasSpecialWeapon();
  const owned = G.ownedMissileTypes?.includes(missile.id);
  const active = !specialWeapon && G.activeMissileType === missile.id;
  const canBuy = (G.coins || 0) >= missile.price;
  const disabled = specialWeapon || (!owned && !canBuy);
  const action = active
    ? (lang === 'fr' ? 'Equipe' : 'Equipped')
    : owned
      ? (lang === 'fr' ? 'Choisir' : 'Select')
      : (lang === 'fr' ? 'Acheter' : 'Buy');
  return `
    <article class="shop-missile-card shop-missile-${missile.id} ${active ? 'shop-missile-equipped' : ''} ${specialWeapon ? 'shop-missile-unavailable' : ''}" data-missile-id="${missile.id}">
      <div class="shop-missile-window">
        <span class="shop-missile-sprite" style="background-image:url('${missile.sprite}')"></span>
      </div>
      <div class="shop-missile-copy">
        <h4>${missile.title[lang]}</h4>
        <p>${missile.detail[lang]}</p>
      </div>
      <div class="shop-missile-footer">
        <button class="shop-missile-action ${owned ? 'shop-action-bought' : ''}" type="button" data-missile-action="${missile.id}" ${disabled ? 'disabled' : ''}>
          ${owned
            ? `<b>${lang === 'fr' ? 'ACHETE' : 'BOUGHT'}</b>`
            : `<b>${missile.price.toLocaleString()}</b>${coinIcon('jg-coin-icon-small')}`}
        </button>
        <span>${specialWeapon
          ? (lang === 'fr' ? 'Indisponible : arme speciale de cet avion' : 'Unavailable: this aircraft uses a special weapon')
          : disabled
            ? (lang === 'fr' ? 'Pas assez de coins' : 'Not enough coins')
            : action}</span>
      </div>
    </article>
  `;
}

function renderEmptySearch(lang) {
  return `
    <div class="shop-plan-empty">
      <h4>${lang === 'fr' ? 'Aucun plan trouve' : 'No plan found'}</h4>
      <p>${lang === 'fr' ? 'Change la recherche ou le filtre.' : 'Change the search or filter.'}</p>
    </div>
  `;
}

function bindPlanCards() {
  document.querySelectorAll('.shop-plan-card').forEach(card => {
    card.addEventListener('click', event => {
      if (event.target.closest('.shop-plan-action, .shop-plan-info')) return;
      _selectedPlan = card.dataset.planId || 'default';
      renderShop();
    });
  });

  document.querySelectorAll('.shop-plan-info').forEach(btn => {
    btn.addEventListener('click', event => {
      event.stopPropagation();
      const card = btn.closest('.shop-plan-card');
      const desc = card?.querySelector('.shop-plan-description');
      if (!card || !desc) return;
      const open = desc.hidden;
      desc.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      card.classList.toggle('shop-plan-info-open', open);
    });
  });

  document.querySelectorAll('.shop-plan-action').forEach(btn => {
    btn.addEventListener('click', event => {
      event.stopPropagation();
      buyOrEquipPlan(btn.dataset.planAction);
    });
  });

  document.querySelectorAll('.shop-missile-card').forEach(card => {
    card.addEventListener('click', event => {
      if (event.target.closest('.shop-missile-action')) return;
      buyOrEquipMissile(card.dataset.missileId);
    });
  });

  document.querySelectorAll('.shop-missile-action').forEach(btn => {
    btn.addEventListener('click', event => {
      event.stopPropagation();
      buyOrEquipMissile(btn.dataset.missileAction);
    });
  });
}

function buyOrEquipPlan(planId) {
  if (activeAircraftHasSpecialWeapon()) return;
  const plan = getPlan(planId);
  if (!plan) return;
  const owned = G.ownedShootingPlans.includes(plan.id);

  if (!owned) {
    if ((G.coins || 0) < plan.price) return;
    G.coins = Math.max(0, (G.coins || 0) - plan.price);
    G.ownedShootingPlans.push(plan.id);
    save('coins', G.coins);
    save('ownedShootingPlans', G.ownedShootingPlans);
  }

  G.activeShootingPlan = plan.id;
  _selectedPlan = plan.id;
  save('activeShootingPlan', G.activeShootingPlan);
  saveAll();
  window.dispatchEvent(new CustomEvent('jexongo:shooting-plan-changed', {
    detail: { planId: plan.id },
  }));
  renderShop();
}

function buyOrEquipMissile(missileId) {
  if (activeAircraftHasSpecialWeapon()) return;
  const missile = getMissile(missileId);
  if (!missile) return;
  if (!Array.isArray(G.ownedMissileTypes)) G.ownedMissileTypes = [];

  const owned = G.ownedMissileTypes.includes(missile.id);
  if (!owned) {
    if ((G.coins || 0) < missile.price) return;
    G.coins = Math.max(0, (G.coins || 0) - missile.price);
    G.ownedMissileTypes.push(missile.id);
    save('coins', G.coins);
    save('ownedMissileTypes', G.ownedMissileTypes);
  }

  G.activeMissileType = missile.id;
  save('activeMissileType', G.activeMissileType);
  saveAll();
  renderShop();
}

function stopShopPreview() {
  if (_previewRaf) {
    cancelAnimationFrame(_previewRaf);
    _previewRaf = null;
  }
}

function startShopPreview() {
  const canvas = $('shop-shooting-preview');
  if (!canvas && !document.querySelector('.shop-plan-mini-canvas')) return;
  ensureOceanSheet();
  preloadSprite('bolt').catch(() => {});
  const activeSprite = AIRCRAFT_SPRITE[getActiveAircraftId()] || 'ship-t6';
  preloadSprite(activeSprite).catch(() => {});
  Object.values(AIRCRAFT_SPRITE).forEach(spriteKey => preloadSprite(spriteKey).catch(() => {}));
  const startedAt = performance.now();

  const tick = now => {
    const shopScreen = $('s-shop');
    const miniCanvases = Array.from(document.querySelectorAll('.shop-plan-mini-canvas'));
    const hasPreviewCanvas = canvas && document.body.contains(canvas);
    if (!shopScreen || shopScreen.classList.contains('hidden') || (!hasPreviewCanvas && miniCanvases.length === 0)) {
      stopShopPreview();
      return;
    }
    if (hasPreviewCanvas) {
      const layout = setupPreviewCanvas(canvas);
      drawShootingPreview(layout.ctx, layout.w, layout.h, now - startedAt);
    }
    miniCanvases.forEach(mini => {
      const plan = getPlan(mini.dataset.miniPlan);
      if (!plan) return;
      const miniLayout = setupPreviewCanvas(mini, 520, 420);
      drawMiniShootingPreview(miniLayout.ctx, miniLayout.w, miniLayout.h, plan, now - startedAt);
    });
    _previewRaf = requestAnimationFrame(tick);
  };

  _previewRaf = requestAnimationFrame(tick);
}

function setupPreviewCanvas(canvas, fallbackW = 520, fallbackH = 340) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = Math.max(80, rect.width || fallbackW);
  const cssH = Math.max(60, rect.height || fallbackH);
  const pxW = Math.round(cssW * dpr);
  const pxH = Math.round(cssH * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: cssW, h: cssH };
}

function drawShootingPreview(ctx, w, h, elapsedMs) {
  const plan = getPlan(_selectedPlan) || getPlan(G.activeShootingPlan) || SHOOTING_PLANS[0];
  const aircraftId = getActiveAircraftId();
  const spriteKey = AIRCRAFT_SPRITE[aircraftId] || 'ship-t6';
  const frame = Math.floor(elapsedMs / (1000 / 12));
  const cx = w / 2;
  const cy = h * 0.72;
  const size = Math.min(w * 0.34, h * 0.42, 176);
  const wingSize = size * 0.44;
  const wingOffsetX = Math.min(210, w * 0.31);
  const wingY = cy + size * 0.34;

  drawPreviewBackground(ctx, w, h, elapsedMs);

  if (plan.wingmen) {
    drawPlanePreview(ctx, spriteKey, frame, cx - wingOffsetX, wingY, wingSize, 0.72);
    drawPlanePreview(ctx, spriteKey, frame, cx + wingOffsetX, wingY, wingSize, 0.72);
  }

  const bob = Math.sin(elapsedMs / 360) * 4;
  drawPlanePreview(ctx, spriteKey, frame, cx, cy + bob, size, 1);

  const cadenceMs = plan.cadence * 1000;
  plan.missiles.forEach((shot, index) => {
    const shotProgress = getPreviewShotProgress(elapsedMs, cadenceMs, plan.simultaneous ? 0 : index, plan.missiles.length);
    if (!shotProgress) return;
    const travel = easeOutCubic(shotProgress.progress);
    const laneScale = Math.min(1, w / 680);
    const { x: startX, y: startY } = getStoreShotStart(shot, cx, cy, size, laneScale, {
      leftWingman: { x: cx - wingOffsetX, y: wingY, size: wingSize },
      rightWingman: { x: cx + wingOffsetX, y: wingY, size: wingSize },
    });
    const angle = shot.angle || 0;
    const distance = travel * h * 0.74;
    const x = startX + Math.sin(angle) * distance * 0.42;
    const y = startY - Math.cos(angle) * distance;
    const alpha = shotProgress.alpha * (shotProgress.progress < 0.82 ? 1 : Math.max(0, (1 - shotProgress.progress) / 0.18));
    drawRocket(ctx, x, y, size * 0.24, angle, alpha, index);
  });

  if (plan.bonusSeconds) drawOverloadHint(ctx, w, h, elapsedMs);
}

function drawMiniShootingPreview(ctx, w, h, plan, elapsedMs) {
  const aircraftId = getActiveAircraftId();
  const spriteKey = AIRCRAFT_SPRITE[aircraftId] || 'ship-t6';
  const frame = Math.floor(elapsedMs / (1000 / 12));
  const cx = w / 2;
  const cy = h * 0.4;
  const size = Math.min(w * 0.54, h * 0.3, 190);
  const wingSize = size * 0.5;
  const wingOffsetX = w * 0.32;
  const wingY = cy + size * 0.22;

  drawOceanPreviewBackground(ctx, w, h, elapsedMs, true);

  const cadenceMs = plan.cadence * 1000;
  const scale = Math.min(1.05, w / 560);
  const passOffsets = [0, cadenceMs * 0.34, cadenceMs * 0.68];
  passOffsets.forEach((passOffset, passIndex) => {
    plan.missiles.forEach((shot, index) => {
      const shotProgress = getPreviewShotProgress(elapsedMs + passOffset, cadenceMs, plan.simultaneous ? 0 : index, plan.missiles.length);
      if (!shotProgress) return;
      const travel = easeOutCubic(shotProgress.progress);
      const { x: startX, y: startY } = getStoreShotStart(shot, cx, cy, size, scale, {
        leftWingman: { x: cx - wingOffsetX, y: wingY, size: wingSize },
        rightWingman: { x: cx + wingOffsetX, y: wingY, size: wingSize },
      });
      const angle = shot.angle || 0;
      const distance = travel * h * 0.8;
      const x = startX + Math.sin(angle) * distance * 0.42;
      const y = startY - Math.cos(angle) * distance;
      const alpha = shotProgress.alpha * (shotProgress.progress < 0.82 ? 1 : Math.max(0, (1 - shotProgress.progress) / 0.18));
      drawRocket(ctx, x, y, Math.max(34, size * 0.3), angle, alpha * (passIndex ? 0.72 : 1), index);
    });
  });

  if (plan.wingmen) {
    drawPlanePreview(ctx, spriteKey, frame, cx - wingOffsetX, wingY, wingSize, 0.82);
    drawPlanePreview(ctx, spriteKey, frame, cx + wingOffsetX, wingY, wingSize, 0.82);
  }

  drawPlanePreview(ctx, spriteKey, frame, cx, cy, size, 1);
}

function getPreviewShotProgress(elapsedMs, cadenceMs, index, total) {
  const shotDelayMs = total <= 1 ? 0 : Math.min(360, Math.max(150, cadenceMs * 0.14));
  const launchFadeMs = 80;
  const flightMs = Math.min(980, Math.max(560, cadenceMs * 0.46));
  const waveMs = Math.max(cadenceMs, launchFadeMs + flightMs + shotDelayMs * Math.max(0, total - 1) + 180);
  const localMs = ((elapsedMs - index * shotDelayMs) % waveMs + waveMs) % waveMs;
  const activeMs = Math.max(0, localMs - launchFadeMs);
  if (activeMs > flightMs) return null;
  const progress = activeMs / flightMs;
  return { progress, alpha: Math.max(0.35, Math.min(1, localMs / launchFadeMs)) };
}

function getStoreShotStart(shot, cx, cy, planeSize, scale = 1, sources = {}) {
  const source = shot.source ? sources[shot.source] : null;
  if (source) {
    return {
      x: source.x + (shot.x || 0) * scale * 0.18,
      y: source.y - source.size * 0.48 + (shot.y || 0) * scale * 0.18,
    };
  }
  const maxBodyOffset = shot.wide ? planeSize * 0.92 : planeSize * 0.28;
  const x = cx + Math.max(-maxBodyOffset, Math.min(maxBodyOffset, (shot.x || 0) * scale * 0.42));
  const y = cy - planeSize * 0.48 + (shot.y || 0) * scale * 0.18;
  return { x, y };
}

function drawPlanePreview(ctx, spriteKey, frame, cx, cy, size, alpha = 1) {
  if (getImage(spriteKey)) {
    drawFrame(ctx, spriteKey, frame, cx, cy, size, size, { alpha });
    return;
  }

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  ctx.fillStyle = '#dce8f4';
  ctx.strokeStyle = '#071026';
  ctx.lineWidth = Math.max(2, size * 0.035);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.48);
  ctx.lineTo(size * 0.18, -size * 0.05);
  ctx.lineTo(size * 0.48, size * 0.05);
  ctx.lineTo(size * 0.16, size * 0.18);
  ctx.lineTo(size * 0.09, size * 0.42);
  ctx.lineTo(0, size * 0.3);
  ctx.lineTo(-size * 0.09, size * 0.42);
  ctx.lineTo(-size * 0.16, size * 0.18);
  ctx.lineTo(-size * 0.48, size * 0.05);
  ctx.lineTo(-size * 0.18, -size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#19d7ff';
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.14, size * 0.08, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPreviewBackground(ctx, w, h, elapsedMs) {
  drawOceanPreviewBackground(ctx, w, h, elapsedMs, false);
}

function ensureOceanSheet() {
  if (_oceanSheet) return _oceanSheet;
  _oceanSheet = new Image();
  _oceanSheet.src = '/assets/Maps/ocean.png';
  return _oceanSheet;
}

function drawOceanPreviewBackground(ctx, w, h, elapsedMs, bright = false) {
  ctx.clearRect(0, 0, w, h);
  const img = ensureOceanSheet();
  if (img.complete && img.naturalWidth > 0) {
    const cols = 4;
    const rows = 3;
    const frame = Math.floor(elapsedMs / 110) % (cols * rows);
    const sw = img.naturalWidth / cols;
    const sh = img.naturalHeight / rows;
    const sx = (frame % cols) * sw;
    const sy = Math.floor(frame / cols) * sh;
    const scale = Math.max(w / sw, h / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.globalAlpha = bright ? 0.08 : 0.28;
    ctx.fillStyle = bright ? '#0b4fae' : '#020713';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  } else {
    const water = ctx.createLinearGradient(0, 0, w, h);
    water.addColorStop(0, '#0b5fc4');
    water.addColorStop(0.55, '#063f8a');
    water.addColorStop(1, '#041b49');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, w, h);
  }

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, bright ? 'rgba(8,19,38,0.08)' : 'rgba(8,19,38,0.36)');
  grad.addColorStop(0.56, bright ? 'rgba(17,26,54,0.06)' : 'rgba(17,26,54,0.26)');
  grad.addColorStop(1, bright ? 'rgba(6,10,24,0.18)' : 'rgba(6,10,24,0.48)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w / 2, h * 0.62, 20, w / 2, h * 0.62, Math.max(w, h) * 0.55);
  glow.addColorStop(0, 'rgba(234,255,128,0.18)');
  glow.addColorStop(0.45, 'rgba(0,212,255,0.11)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

function drawRocket(ctx, x, y, size, angle, alpha, index) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (getImage('bolt')) {
    const frame = Math.floor(performance.now() / 70 + index * 2) % 12;
    drawFrame(ctx, 'bolt', frame, x, y, size * 0.48, size * 1.14, { rotate: angle });
    ctx.restore();
    return;
  }
  ctx.translate(x, y);
  ctx.rotate(angle);
  const bodyW = size * 0.2;
  const bodyH = size * 0.82;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.beginPath();
  ctx.rect(-bodyW / 2, -bodyH / 2, bodyW, bodyH);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(0, -bodyH * 0.68);
  ctx.lineTo(bodyW * 0.58, -bodyH * 0.34);
  ctx.lineTo(-bodyW * 0.58, -bodyH * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(0, bodyH * 0.64);
  ctx.lineTo(bodyW * 0.58, bodyH * 0.38);
  ctx.lineTo(-bodyW * 0.58, bodyH * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawOverloadHint(ctx, w, h, elapsedMs) {
  const pulse = 0.5 + Math.sin(elapsedMs / 180) * 0.5;
  ctx.save();
  ctx.globalAlpha = 0.25 + pulse * 0.22;
  ctx.fillStyle = '#eaff80';
  ctx.font = '700 11px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('5 SEC', w / 2, 30);
  ctx.restore();
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
