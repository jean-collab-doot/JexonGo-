import { SFX } from '../audio/sound.js';
import { $ } from '../utils/dom.js';
import { G, saveAll } from '../state.js';
import { save } from '../utils/storage.js';
import { AIRCRAFT, AIRCRAFT_ORDER } from '../data/aircraft.js';
import { paintPlaneInfoFisheye } from './plane-info-fisheye.js';
import { t, getLang, applyI18n } from '../i18n.js';
import { MISSILE_TYPES, SHOOTING_PLANS, renderShotPlanMiniCard, startShopPreview, stopShopPreview } from './shop.js';
import { BADGES, unlockEligibleBadges, isNewBadge } from '../data/badges.js';
import { coinIcon, uiIcon } from '../utils/icons.js';
import { isMultiLobby, renderBotPanel, onHangarTabShown } from './multiplayer.js';
import {
  LIFE_UPGRADE_PRICES, SHOT_UPGRADE_PRICES, HOMING_UPGRADE_PRICES, XP_UPGRADE_PRICES, XP_BONUS_PERCENT, WEAPONS,
  AIRDROP_BOOST_ITEMS, AIRDROP_CHANCE_PRICES, AIRDROP_CHANCE_MULT, AIRDROP_TIME_PRICES, AIRDROP_TIME_BONUS_S, AIRDROP_BASE_DURATION_S,
  planeUpgrades, setPlaneUpgrades, SHOT_DELAY_SECONDS,
} from '../data/upgrades.js';

let _hangarTab = 'planes';   // 'planes' | 'missiles' | 'upgrades'
const _panelScopes = new Set(['#s-hangar']);   // every place the hangar panel lives

export function initHangar(nav) {
  // Carousel: Hangar ‹ Lobby › Shop › Training — hangar's prev = Training (wrap), next = Lobby.
  $('btn-hangar-page-left')?.addEventListener('click', () => nav.toTraining('prev'));
  $('btn-hangar-page-right')?.addEventListener('click', () => nav.toMenu('next'));
  bindHangarTabs('#s-hangar');

  $('btn-plane-info-close')?.addEventListener('click', closePlaneInfo);
  $('plane-info-overlay')?.addEventListener('click', e => {
    if (e.target === $('plane-info-overlay')) closePlaneInfo();
  });
  $('btn-plane-info-prev')?.addEventListener('click', () => stepPlaneInfo(-1));
  $('btn-plane-info-next')?.addEventListener('click', () => stepPlaneInfo(1));
  $('btn-plane-info-action')?.addEventListener('click', () => {
    if (!_infoPlaneId) return;
    if (G.unlockedAircraft.includes(_infoPlaneId)) selectAircraft(_infoPlaneId);
    else if (canBuyAircraft(_infoPlaneId)) buyAircraft(_infoPlaneId);
    openPlaneInfo(_infoPlaneId);
  });
}

// ── PLANE INFO sheet (ⓘ button on each hangar plane card) ───────────────────
let _infoPlaneId = null;

export const TYPE_LABELS = {
  trainer:   { en: 'TRAINER',   fr: 'ÉCOLE' },
  transport: { en: 'TRANSPORT', fr: 'TRANSPORT' },
  attack:    { en: 'ATTACK',    fr: 'ATTAQUE' },
  fighter:   { en: 'FIGHTER',   fr: 'CHASSEUR' },
  stealth:   { en: 'STEALTH',   fr: 'FURTIF' },
  bomber:    { en: 'BOMBER',    fr: 'BOMBARDIER' },
  recon:     { en: 'RECON',     fr: 'RECONNAISSANCE' },
};

export function planeCost(plane) {
  return G.activeBadge === 'collector' ? Math.ceil(plane.xpCost * 0.9) : plane.xpCost;
}
function canBuyAircraft(id) {
  const plane = AIRCRAFT[id];
  return !G.unlockedAircraft.includes(id) && !plane.secret
    && meetsGradeRequirement(plane) && G.xp >= planeCost(plane);
}
// Lobby (◀︎ ▶︎ on a plane not owned yet): buy it if possible.
// Returns 'bought', or why not: 'grade' (level too low) / 'xp' (not enough EXP).
export function buyAircraftFromLobby(id) {
  const plane = AIRCRAFT[id];
  if (!plane || G.unlockedAircraft.includes(id)) return 'bought';
  if (!meetsGradeRequirement(plane)) return 'grade';
  if (!canBuyAircraft(id)) return 'xp';
  buyAircraft(id);
  return 'bought';
}
function selectAircraft(id) {
  G.activeAircraft = id;
  save('activeAircraft', G.activeAircraft);
  renderHangarPanels();
}
function buyAircraft(id) {
  SFX.buy();
  G.xp -= planeCost(AIRCRAFT[id]);
  G.unlockedAircraft.push(id);
  if (!G.acquiredAircraft.includes(id)) G.acquiredAircraft.push(id);
  save('xp', G.xp);
  save('unlockedAircraft', G.unlockedAircraft);
  save('acquiredAircraft', G.acquiredAircraft);
  renderHangarPanels();
}

function stepPlaneInfo(dir) {
  const i = AIRCRAFT_ORDER.indexOf(_infoPlaneId);
  const n = AIRCRAFT_ORDER.length;
  openPlaneInfo(AIRCRAFT_ORDER[(i + dir + n) % n]);
}

function setText(id, text) { const el = $(id); if (el) el.textContent = text; }

function openPlaneInfo(id) {
  const plane = AIRCRAFT[id];
  if (!plane) return;
  _infoPlaneId = id;
  const fr = getLang() === 'fr';
  const lang = fr ? 'fr' : 'en';
  const unlocked = G.unlockedAircraft.includes(id);
  const active = G.activeAircraft === id;
  const secretLocked = plane.secret && !unlocked;
  const hide = s => (secretLocked ? '???' : s);

  // Unhide first: the canvas below is measured/painted at its laid-out size,
  // which is 0×0 while the overlay is still display:none.
  $('plane-info-overlay')?.classList.remove('hidden');

  // Tier = position in the hangar progression, shown as 1–5 stars.
  const tier = Math.max(1, Math.ceil(((AIRCRAFT_ORDER.indexOf(id) + 1) / AIRCRAFT_ORDER.length) * 5));
  const stars = $('plane-info-stars');
  if (stars) stars.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < tier ? 'on' : ''}">${uiIcon('star')}</span>`).join('');

  const canvas = $('plane-info-canvas');
  if (canvas) {
    canvas.setAttribute('aria-label', secretLocked ? '' : plane.name);
    paintPlaneInfoFisheye(canvas, `/assets/hangar/${id}.webp`, secretLocked ? 'secret' : !unlocked);
  }
  const typeLabel = TYPE_LABELS[plane.type]?.[lang] || (plane.type || '').toUpperCase();
  setText('plane-info-type', hide(typeLabel));
  setText('plane-info-cost', plane.starter ? t('starter') : hide(`${planeCost(plane).toLocaleString()} XP`));
  setText('plane-info-grade', plane.gradeRequired ? `LV ${plane.gradeRequired}` : 'LV 1');

  setText('plane-info-name', hide(plane.name));
  setText('plane-info-desc', hide(plane.description?.[lang] || ''));
  const abilityIconEl = $('plane-info-ability-icon');
  if (abilityIconEl) abilityIconEl.innerHTML = secretLocked ? '???' : uiIcon(plane.ability?.icon);
  setText('plane-info-ability-name', hide(plane.ability?.name?.[lang] || ''));
  setText('plane-info-ability-desc', hide(plane.ability?.description?.[lang] || ''));

  const specs = $('plane-info-specs');
  if (specs) {
    const status = active ? (fr ? 'ÉQUIPÉ' : 'EQUIPPED')
      : unlocked ? (fr ? 'DÉBLOQUÉ' : 'UNLOCKED')
      : secretLocked ? 'SECRET' : (fr ? 'VERROUILLÉ' : 'LOCKED');
    const rows = [
      [fr ? 'TYPE' : 'TYPE', hide(typeLabel)],
      [fr ? 'COÛT' : 'COST', plane.starter ? t('starter') : hide(`${planeCost(plane).toLocaleString()} XP`)],
      [fr ? 'NIVEAU REQUIS' : 'LEVEL REQUIRED', plane.gradeRequired ? `${plane.gradeRequired}${plane.gradeLabel ? ` · ${plane.gradeLabel}` : ''}` : '—'],
      [fr ? 'STATUT' : 'STATUS', status],
    ];
    specs.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }

  const btn = $('btn-plane-info-action');
  if (btn) {
    let label, disabled = false;
    if (active)                 { label = fr ? 'ÉQUIPÉ' : 'EQUIPPED'; disabled = true; }
    else if (unlocked)          label = fr ? 'ÉQUIPER' : 'EQUIP';
    else if (secretLocked)      { label = 'SECRET'; disabled = true; }
    else if (!meetsGradeRequirement(plane)) { label = `LV ${plane.gradeRequired}`; disabled = true; }
    else if (canBuyAircraft(id)) label = `${t('unlock')} · ${planeCost(plane).toLocaleString()} XP`;
    else                        { label = `${planeCost(plane).toLocaleString()} XP`; disabled = true; }
    btn.textContent = label;
    btn.disabled = disabled;
    btn.classList.toggle('is-equipped', active);
  }
}
function closePlaneInfo() { $('plane-info-overlay')?.classList.add('hidden'); }

// Wires the AVIONS / TIR DE MISSILE tabs inside any container (the full hangar
// screen AND the lobby pull-up drawer share one tab state).
export function bindHangarTabs(scopeSelector) {
  _panelScopes.add(scopeSelector);
  document.querySelectorAll(`${scopeSelector} [data-hangar-tab]`).forEach(btn => {
    btn.addEventListener('click', () => {
      _hangarTab = btn.dataset.hangarTab || 'planes';
      renderHangarPanels();
    });
  });
}

export function meetsGradeRequirement(plane) {
  if (!plane.gradeRequired) return true;
  return (G.highestLevel || 0) >= plane.gradeRequired;
}

export function renderHangar() {
  const xpEl = $('hangar-xp');
  if (xpEl) xpEl.textContent = (G.xp || 0).toLocaleString();
  const coinsEl = $('hangar-coins');
  if (coinsEl) coinsEl.textContent = (G.coins || 0).toLocaleString();
  renderHangarPanels();
}

// Re-renders the hangar panel everywhere it is mounted (keeps the lobby drawer
// and the full screen in sync).
export function renderHangarPanels() {
  unlockEligibleBadges();
  applyI18n();
  for (const scope of _panelScopes) {
    const root = document.querySelector(scope);
    if (!root) continue;
    root.querySelectorAll('[data-hangar-tab]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.hangarTab === _hangarTab);
    });
    const body = root.querySelector('.jx-panel-body');
    if (!body) continue;
    // BOT tab: only in the lobby's MULTI mode (the tab is hidden otherwise).
    if (_hangarTab === 'bot' && !isMultiLobby()) {
      _hangarTab = 'planes';
      root.querySelectorAll('[data-hangar-tab]').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.hangarTab === _hangarTab);
      });
    }
    if (_hangarTab === 'bot') {
      // The full hangar screen has no BOT tab: it keeps showing AVIONS.
      if (root.querySelector('[data-hangar-tab="bot"]')) renderBotPanel(body);
      else renderPlanes(body);
    }
    else if (_hangarTab === 'missiles') renderMissilesTab(body);
    else if (_hangarTab === 'upgrades') renderUpgradesTab(body);
    else renderPlanes(body);
  }
  onHangarTabShown(_hangarTab);
}

// ── AVIONS ──────────────────────────────────────────────────────────────────
function renderPlanes(body) {
  body.className = 'jx-panel-body';
  const grid = document.createElement('div');
  grid.className = 'jx-grid';

  AIRCRAFT_ORDER.forEach(id => {
    const plane = AIRCRAFT[id];
    const unlocked = G.unlockedAircraft.includes(id);
    const active = G.activeAircraft === id;
    const gradeOk = meetsGradeRequirement(plane);
    const cost = planeCost(plane);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = `jx-slot ${active ? 'is-active' : unlocked ? '' : 'is-locked'}`;
    if (plane.secret && !unlocked) card.classList.add('jx-slot-secret');

    const secretLocked = plane.secret && !unlocked;
    const name = secretLocked ? '???' : plane.name;
    let status;
    if (secretLocked)       status = 'SECRET';
    else if (active)        status = t('active');
    else if (plane.starter) status = t('starter');
    else if (unlocked)      status = 'OK';
    else if (plane.gradeRequired && !gradeOk) status = `LV ${plane.gradeRequired}`;
    else                    status = `${cost.toLocaleString()} XP`;

    card.innerHTML = `
      <button type="button" class="jx-slot-info-btn" data-plane-info="${id}" aria-label="Info">ⓘ</button>
      <img src="/assets/hangar/${id}.webp" alt="" style="${unlocked || secretLocked ? '' : 'opacity:.4'}">${secretLocked ? '<span class="jx-slot-mystery" aria-hidden="true">???</span>' : ''}
      <strong>${name}</strong>
      <em>${status}</em>
    `;

    if (unlocked) {
      card.addEventListener('click', () => selectAircraft(id));
    } else if (canBuyAircraft(id)) {
      card.classList.remove('is-locked');
      card.querySelector('em').textContent = `${t('unlock')} (${cost} XP)`;
      card.addEventListener('click', () => buyAircraft(id));
    }

    grid.appendChild(card);
  });

  grid.querySelectorAll('[data-plane-info]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openPlaneInfo(btn.dataset.planeInfo);
    });
  });

  body.innerHTML = '';
  body.appendChild(grid);
}

// ── TIR DE MISSILE (shot plans + missile skins) ─────────────────────────────
function renderMissilesTab(body) {
  const lang = getLang() === 'fr' ? 'fr' : 'en';
  const owned = Array.isArray(G.ownedShootingPlans) ? G.ownedShootingPlans : ['default'];
  const ownedMissiles = Array.isArray(G.ownedMissileTypes) ? G.ownedMissileTypes : [];
  G.ownedMissileTypes = ownedMissiles;

  const activeMissileType = MISSILE_TYPES.some(type => type.id === G.activeMissileType) && ownedMissiles.includes(G.activeMissileType)
    ? G.activeMissileType : 'default';
  G.activeMissileType = activeMissileType;

  stopShopPreview();
  body.innerHTML = `
    <div class="jx-list">
      ${SHOOTING_PLANS.map(plan => renderShotPlanMiniCard(plan, lang)).join('')}
      ${MISSILE_TYPES.map(type => renderMissileOption(type, lang, activeMissileType, ownedMissiles)).join('')}
    </div>
  `;

  body.querySelectorAll('[data-plan-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const planId = btn.dataset.planId;
      if (!owned.includes(planId)) return;
      G.activeShootingPlan = planId;
      save('activeShootingPlan', G.activeShootingPlan);
      window.dispatchEvent(new CustomEvent('jexongo:shooting-plan-changed', { detail: { planId } }));
      renderHangarPanels();
    });
  });

  body.querySelectorAll('[data-hangar-missile]').forEach(btn => {
    btn.addEventListener('click', () => {
      const missileId = btn.dataset.hangarMissile || '';
      if (!ownedMissiles.includes(missileId)) return;
      G.activeMissileType = missileId;
      save('ownedMissileTypes', G.ownedMissileTypes);
      save('activeMissileType', G.activeMissileType);
      renderHangarPanels();
    });
  });

  // Same live "plane firing" preview used by the shop's shot-plan cards
  // (see startShopPreview in shop.js) — it self-stops once these canvases
  // are no longer visible, so no explicit stop is needed on tab/screen change.
  startShopPreview();
}

function renderMissileOption(type, lang, activeMissileType, ownedMissiles) {
  const owned = ownedMissiles.includes(type.id);
  const active = activeMissileType === type.id;
  const status = active
    ? (lang === 'fr' ? 'ÉQUIPÉ' : 'EQUIPPED')
    : owned ? (lang === 'fr' ? 'DÉBLOQUÉ' : 'UNLOCKED') : (lang === 'fr' ? 'BLOQUÉ' : 'LOCKED');
  return `
    <button class="jx-slot jx-slot-missile ${active ? 'is-active' : ''} ${owned ? '' : 'is-locked'}" type="button" data-hangar-missile="${type.id}">
      <span class="jx-slot-thumb" style="background-image:url('${type.sprite}')"></span>
      <span class="jx-slot-missile-copy">
        <strong>${type.title[lang]}</strong>
        <em>${status}</em>
      </span>
    </button>
  `;
}

// ── UPGRADE (per aircraft: extra lives, extra shots, weapon) ────────────────
// Laid out like the INFORMATION sheet: title bar, radar screen with ◀︎ ▶︎ to
// browse aircraft, then one bar + row per upgrade. Every aircraft keeps its
// own upgrades (G.planeUpgrades[planeId]).
let _upgradePlaneId = null;
// Same heart art as the in-game lives HUD (game.js updateLivesHUD).
const HEART_IMG = '/assets/fx/Iteam/heart-full.png';
// Same EXP art as the HUD / rewards (utils/icons.js expIcon).
const EXP_IMG = '/assets/fx/Caisse/JexonGo_EXP_frame_01.png';
// Explosion for the homing icon: the 7 frames of the in-game enemy explosion
// sheet (80×80 each), each shown in its own slice of the 2.4 s loop.
const HOMING_EXPLOSION_FRAMES = Array.from({ length: 7 }, (_, i) => {
  const from = (0.5 + i * 0.04).toFixed(2), to = (0.5 + (i + 1) * 0.04).toFixed(2);
  return `<g opacity="0">
    <animate attributeName="opacity" values="0;1;0;0" keyTimes="0;${from};${to};1" calcMode="discrete" dur="2.4s" repeatCount="indefinite"/>
    <svg x="62" y="4" width="42" height="42" viewBox="${i * 80} 0 80 80"><image href="/assets/enemies/enemy-explosion.png" width="560" height="80"/></svg>
  </g>`;
}).join('');

// "Guided missile" icon (2.4 s loop, SVG so it scales with the icon box):
// the T-6 fires, the rocket curves after the moving F-15 (dashed trail), the
// F-15 explodes with the in-game enemy explosion sheet, then it all restarts.
const HOMING_DEMO_ICON = `<svg class="upg-homing-demo" viewBox="0 0 100 100" aria-hidden="true">
  <path d="M46,60 C38,38 60,18 83,25" fill="none" stroke="#7dff9b" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="100 100" stroke-dashoffset="100" pathLength="100" opacity=".85">
    <animate attributeName="stroke-dashoffset" values="100;0;0" keyTimes="0;.5;1" dur="2.4s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values=".85;.85;0;0" keyTimes="0;.5;.62;1" dur="2.4s" repeatCount="indefinite"/>
  </path>
  <g>
    <animateTransform attributeName="transform" type="translate" values="53 5;68 10;68 10" keyTimes="0;.5;1" dur="2.4s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;.5;.52;.9;1" dur="2.4s" repeatCount="indefinite"/>
    <svg width="30" height="30" viewBox="0 0 384 384"><g transform="rotate(180 192 192)"><image href="/assets/enemies/planes/enemy-basic-normalized-v2.png" width="1536" height="1152"/></g></svg>
  </g>
  <svg x="26" y="56" width="40" height="40" viewBox="0 0 396 396"><image href="/assets/ships/player/t6-animation.webp" width="1980" height="792"/></svg>
  <g>
    <animateMotion path="M46,60 C38,38 60,18 83,25" keyPoints="0;1;1" keyTimes="0;.5;1" calcMode="linear" rotate="auto" dur="2.4s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.49;.5;1" dur="2.4s" repeatCount="indefinite"/>
    <g transform="rotate(90)"><svg x="-3.5" y="-11" width="7" height="22" viewBox="0 0 128 416"><image href="/assets/fx/Missile/rocket-straight.png" width="512" height="1248"/></svg></g>
  </g>
  ${HOMING_EXPLOSION_FRAMES}
</svg>`;
// Airdrop item icons (same art as the crate pickups / in-game effects).
const AIRDROP_ITEM_ICONS = {
  xray: '<img class="upg-drop-img upg-drop-xray" src="/assets/fx/Caisse/JexonGo_single_red_laser.png" alt="">',
  machinegun: '<span class="upg-drop-bullets" aria-hidden="true"><i></i><i></i><i></i></span>',
  shield: '<span class="upg-drop-shield" aria-hidden="true"></span>',
  support: '<span class="upg-drop-b2" aria-hidden="true"></span>',
};

// "Faster fire" icon: the in-game T-6 firing a real rocket in a loop.
const SHOT_DEMO_ICON = '<span class="upg-shot-demo" aria-hidden="true"><i class="upg-shot-missile"></i><i class="upg-shot-plane"></i></span>';

function stepUpgradePlane(dir) {
  const i = Math.max(0, AIRCRAFT_ORDER.indexOf(_upgradePlaneId));
  const n = AIRCRAFT_ORDER.length;
  _upgradePlaneId = AIRCRAFT_ORDER[(i + dir + n) % n];
  renderHangarPanels();
}

function renderUpgradesTab(body) {
  if (!AIRCRAFT[_upgradePlaneId]) _upgradePlaneId = G.activeAircraft;
  const id = _upgradePlaneId;
  const plane = AIRCRAFT[id];
  const fr = getLang() === 'fr';
  const lang = fr ? 'fr' : 'en';
  const coins = G.coins || 0;
  const unlocked = G.unlockedAircraft.includes(id);
  const active = G.activeAircraft === id;
  const secretLocked = plane.secret && !unlocked;
  const up = planeUpgrades(id);
  const specialWeapon = plane.ability?.weapon;

  const tier = Math.max(1, Math.ceil(((AIRCRAFT_ORDER.indexOf(id) + 1) / AIRCRAFT_ORDER.length) * 5));
  const typeLabel = TYPE_LABELS[plane.type]?.[lang] || (plane.type || '').toUpperCase();
  const pips = (level, max) =>
    `<span class="upg-pips">${Array.from({ length: max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')}</span>`;
  const price = amount => `${amount.toLocaleString()} ${coinIcon('jg-coin-icon-small')}`;

  const levelRow = (kind, icon, name, desc, level, prices) => {
    const maxed = level >= prices.length;
    const cost = prices[level];
    const canBuy = unlocked && !maxed && coins >= cost;
    return `
      <div class="pi-ability upg-row">
        <span class="pi-ability-icon upg-icon upg-icon-${kind}">${icon}</span>
        <div class="upg-copy">
          <strong>${name}</strong>
          <p>${desc}</p>
          ${pips(level, prices.length)}
        </div>
        <button class="upg-buy ${maxed ? 'is-max' : ''}" type="button" data-upgrade="${kind}" ${canBuy ? '' : 'disabled'}>
          ${maxed ? 'MAX' : price(cost)}
        </button>
      </div>`;
  };

  const weaponRow = weapon => {
    const owned = up.weapons.includes(weapon.id);
    const equipped = up.weapon === weapon.id;
    const canUse = unlocked && (owned || coins >= weapon.price);
    const label = equipped ? (fr ? 'ÉQUIPÉ' : 'EQUIPPED')
      : owned ? (fr ? 'CHOISIR' : 'SELECT')
      : price(weapon.price);
    return `
      <div class="pi-ability upg-row ${equipped ? 'is-equipped' : ''}">
        <span class="pi-ability-icon upg-weapon upg-weapon-${weapon.id}"></span>
        <div class="upg-copy">
          <strong>${weapon.title[lang]}</strong>
          <p>${weapon.detail[lang]}</p>
        </div>
        <button class="upg-buy ${equipped ? 'is-max' : ''}" type="button" data-weapon="${weapon.id}" ${canUse && !equipped ? '' : 'disabled'}>
          ${label}
        </button>
      </div>`;
  };

  const lockedNote = unlocked ? '' : `<p class="pi-text upg-locked">${fr
    ? 'Débloque cet avion pour l’améliorer.'
    : 'Unlock this aircraft to upgrade it.'}</p>`;

  let actionLabel, actionDisabled = false;
  if (active)          { actionLabel = fr ? 'ÉQUIPÉ' : 'EQUIPPED'; actionDisabled = true; }
  else if (unlocked)   actionLabel = fr ? 'ÉQUIPER' : 'EQUIP';
  else                 { actionLabel = fr ? 'VERROUILLÉ' : 'LOCKED'; actionDisabled = true; }

  body.className = 'jx-panel-body upg-body';
  body.innerHTML = `
    <div class="pi-card upg-card">
      <div class="pi-head">
        <h2 class="pi-title">UPGRADE</h2>
      </div>
      <div class="upg-left">
      <div class="pi-stars" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => `<span class="${i < tier ? 'on' : ''}">${uiIcon('star')}</span>`).join('')}</div>
      <div class="pi-stage">
        <button class="pi-arrow pi-arrow-left" type="button" data-upg-step="-1" aria-label="Previous">&#9664;&#65038;</button>
        <div class="pi-screen">
          <canvas class="pi-img" data-upg-canvas role="img" aria-label="${secretLocked ? '' : plane.name}"></canvas>
          <div class="pi-scanlines" aria-hidden="true"></div>
          <span class="pi-corner pi-corner-tl">${secretLocked ? '???' : typeLabel}</span>
          <span class="pi-corner pi-corner-bl"><img class="upg-heart-mini" src="${HEART_IMG}" alt=""> +${up.lives} · ${uiIcon('plus')} +${up.shots}</span>
          <span class="pi-corner pi-corner-br">${plane.gradeRequired ? `LV ${plane.gradeRequired}` : 'LV 1'}</span>
        </div>
        <button class="pi-arrow pi-arrow-right" type="button" data-upg-step="1" aria-label="Next">&#9654;&#65038;</button>
      </div>
      <h3 class="pi-bar pi-name">${secretLocked ? '???' : plane.name}</h3>
      ${lockedNote}
      <div class="pi-actions">
        <button class="pi-btn ${active ? 'is-equipped' : ''}" type="button" data-upg-equip ${actionDisabled ? 'disabled' : ''}>${actionLabel}</button>
      </div>
      </div>
      <div class="upg-scroll">
        <h4 class="pi-bar">${fr ? 'VIES SUPPLÉMENTAIRES' : 'EXTRA LIVES'}</h4>
        ${levelRow('lives', `<img class="upg-heart" src="${HEART_IMG}" alt="">`, fr ? `+1 VIE (${up.lives}/3)` : `+1 LIFE (${up.lives}/3)`,
          fr ? 'Une vie de plus au début de chaque mission.' : 'One more life at the start of every mission.',
          up.lives, LIFE_UPGRADE_PRICES)}
        <h4 class="pi-bar">${fr ? 'PLUS DE TIRS' : 'MORE SHOTS'}</h4>
        ${levelRow('shots', SHOT_DEMO_ICON, fr ? `TIR PLUS RAPIDE (${up.shots}/3)` : `FASTER FIRE (${up.shots}/3)`,
          up.shots < SHOT_DELAY_SECONDS.length
            ? (fr ? `Prochain niveau : un tir toutes les ${String(SHOT_DELAY_SECONDS[up.shots]).replace('.', ',')} s.`
                  : `Next level: one shot every ${SHOT_DELAY_SECONDS[up.shots]} s.`)
            : (fr ? `Un tir toutes les ${String(SHOT_DELAY_SECONDS[up.shots - 1]).replace('.', ',')} s.`
                  : `One shot every ${SHOT_DELAY_SECONDS[up.shots - 1]} s.`),
          up.shots, SHOT_UPGRADE_PRICES)}
        <h4 class="pi-bar">${fr ? 'MISSILE QUI SUIT' : 'HOMING MISSILE'}</h4>
        ${plane.ability?.homing
          ? `<p class="pi-text">${fr ? 'Cet avion a déjà des tirs qui suivent les ennemis.' : 'This aircraft already has homing shots.'}</p>`
          : levelRow('homing', HOMING_DEMO_ICON, fr ? 'MISSILE GUIDÉ' : 'GUIDED MISSILE',
              fr ? 'Tes tirs suivent l’ennemi le plus proche.' : 'Your shots follow the nearest enemy.',
              up.homing, HOMING_UPGRADE_PRICES)}
        <h4 class="pi-bar">${fr ? 'BONUS D’EXP' : 'XP BONUS'}</h4>
        ${levelRow('xp', `<img class="upg-exp" src="${EXP_IMG}" alt="">`, fr ? `+EXP (${up.xp}/3)` : `+XP (${up.xp}/3)`,
          up.xp < XP_BONUS_PERCENT.length
            ? (fr ? `Prochain niveau : +${XP_BONUS_PERCENT[up.xp]} % d’EXP par partie.`
                  : `Next level: +${XP_BONUS_PERCENT[up.xp]}% XP per game.`)
            : (fr ? `+${XP_BONUS_PERCENT[up.xp - 1]} % d’EXP par partie.`
                  : `+${XP_BONUS_PERCENT[up.xp - 1]}% XP per game.`),
          up.xp, XP_UPGRADE_PRICES)}
        <h4 class="pi-bar">${fr ? 'AIRDROP — CHANCE' : 'AIRDROP — CHANCE'}</h4>
        ${AIRDROP_BOOST_ITEMS.map(item => {
          const lvl = up.dropChance[item.id];
          const next = AIRDROP_CHANCE_MULT[Math.min(lvl + 1, AIRDROP_CHANCE_MULT.length - 1)];
          const desc = lvl < AIRDROP_CHANCE_PRICES.length
            ? (fr ? `Prochain niveau : apparaît ×${String(next).replace('.', ',')} plus souvent dans la caisse.`
                  : `Next level: shows up ×${next} more often in the crate.`)
            : (fr ? `Apparaît ×${String(AIRDROP_CHANCE_MULT[lvl]).replace('.', ',')} plus souvent dans la caisse.`
                  : `Shows up ×${AIRDROP_CHANCE_MULT[lvl]} more often in the crate.`);
          return levelRow(`drop-${item.id}`, AIRDROP_ITEM_ICONS[item.id], `${item.title[lang]} (${lvl}/3)`,
            desc, lvl, AIRDROP_CHANCE_PRICES);
        }).join('')}
        <h4 class="pi-bar">${fr ? 'AIRDROP — DURÉE' : 'AIRDROP — DURATION'}</h4>
        ${levelRow('dropTime', '<span class="upg-clock" aria-hidden="true"></span>',
          fr ? `ITEMS PLUS LONGS (${up.dropTime}/3)` : `LONGER ITEMS (${up.dropTime}/3)`,
          up.dropTime < AIRDROP_TIME_PRICES.length
            ? (fr ? `Prochain niveau : laser, mitrailleuse, champ de protection et soutien aérien durent ${AIRDROP_BASE_DURATION_S + AIRDROP_TIME_BONUS_S[up.dropTime + 1]} s.`
                  : `Next level: X-ray, machine gun, force field and air support last ${AIRDROP_BASE_DURATION_S + AIRDROP_TIME_BONUS_S[up.dropTime + 1]} s.`)
            : (fr ? `Laser, mitrailleuse, champ de protection et soutien aérien durent ${AIRDROP_BASE_DURATION_S + AIRDROP_TIME_BONUS_S[up.dropTime]} s.`
                  : `X-ray, machine gun, force field and air support last ${AIRDROP_BASE_DURATION_S + AIRDROP_TIME_BONUS_S[up.dropTime]} s.`),
          up.dropTime, AIRDROP_TIME_PRICES)}
        <h4 class="pi-bar">${fr ? 'ARME' : 'WEAPON'}</h4>
        ${specialWeapon
          ? `<p class="pi-text">${fr
              ? `Cet avion utilise son arme spéciale : ${plane.ability?.name?.fr || ''}.`
              : `This aircraft uses its special weapon: ${plane.ability?.name?.en || ''}.`}</p>`
          : WEAPONS.map(weaponRow).join('')}
      </div>
    </div>
  `;

  const canvas = body.querySelector('[data-upg-canvas]');
  if (canvas) paintPlaneInfoFisheye(canvas, `/assets/hangar/${id}.webp`, secretLocked ? 'secret' : !unlocked);

  body.querySelectorAll('[data-upg-step]').forEach(btn => {
    btn.addEventListener('click', () => stepUpgradePlane(Number(btn.dataset.upgStep) || 1));
  });
  body.querySelectorAll('[data-upgrade]').forEach(btn => {
    btn.addEventListener('click', () => buyLevelUpgrade(id, btn.dataset.upgrade));
  });
  body.querySelectorAll('[data-weapon]').forEach(btn => {
    btn.addEventListener('click', () => chooseWeapon(id, btn.dataset.weapon));
  });
  body.querySelector('[data-upg-equip]')?.addEventListener('click', () => {
    if (G.unlockedAircraft.includes(id)) selectAircraft(id);
  });
}

function saveUpgradePurchase(planeId, record) {
  setPlaneUpgrades(planeId, record);
  save('coins', G.coins);
  save('planeUpgrades', G.planeUpgrades);
  saveAll();
  renderHangar();
}

function buyLevelUpgrade(planeId, kind) {
  if (!G.unlockedAircraft.includes(planeId)) return;
  const record = planeUpgrades(planeId);
  // "drop-<item>" = airdrop chance for that item (record.dropChance[item]).
  const dropItem = kind.startsWith('drop-') ? kind.slice(5) : null;
  const prices = dropItem ? AIRDROP_CHANCE_PRICES : { lives: LIFE_UPGRADE_PRICES, shots: SHOT_UPGRADE_PRICES,
    homing: HOMING_UPGRADE_PRICES, xp: XP_UPGRADE_PRICES, dropTime: AIRDROP_TIME_PRICES }[kind];
  if (!prices || (dropItem && !(dropItem in record.dropChance))) return;
  const level = dropItem ? record.dropChance[dropItem] : record[kind];
  if (level >= prices.length) return;
  if ((G.coins || 0) < prices[level]) { SFX.noMoney(); return; }
  SFX.buy();
  G.coins = Math.max(0, (G.coins || 0) - prices[level]);
  if (dropItem) record.dropChance[dropItem] = level + 1;
  else record[kind] = level + 1;
  saveUpgradePurchase(planeId, record);
}

function chooseWeapon(planeId, weaponId) {
  const weapon = WEAPONS.find(w => w.id === weaponId);
  if (!weapon || !G.unlockedAircraft.includes(planeId)) return;
  const record = planeUpgrades(planeId);
  if (!record.weapons.includes(weaponId)) {
    if ((G.coins || 0) < weapon.price) { SFX.noMoney(); return; }
    SFX.buy();
    G.coins = Math.max(0, (G.coins || 0) - weapon.price);
    record.weapons.push(weaponId);
  }
  record.weapon = weaponId;
  saveUpgradePurchase(planeId, record);
}

// ── BADGES (rendered into an overlay opened from the settings drawer) ───────
export function renderBadges(root) {
  if (!root) return;
  const owned = new Set(G.unlockedBadges || []);
  root.innerHTML = `<div class="hangar-badges-head"><h2>BADGES</h2><span>${owned.size}/${BADGES.length}</span></div><div class="hangar-badge-grid">${BADGES.map(b => {
    const unlocked = owned.has(b.id);
    const active = G.activeBadge === b.id;
    const [value, max] = b.progress?.({}) || [0, 1];
    const fresh = unlocked && isNewBadge(b.id);   // won, not looked at yet
    return `<article data-preview-badge="${b.id}" class="hangar-badge-card ${unlocked ? 'unlocked' : 'locked'} ${active ? 'active' : ''}${fresh ? ' is-new' : ''}">${fresh ? '<span class="missions-badge badge-card-alert" aria-label="Nouveau">!</span>' : ''}<img src="${b.image}" alt="${b.name}"><div><em>${b.rarity}</em><h3>${b.name}</h3><p>${b.goal}</p><strong>${b.reward}</strong><small>${active ? 'ÉQUIPÉ' : unlocked ? 'DÉBLOQUÉ' : `${value.toLocaleString()} / ${max.toLocaleString()}`}</small>${unlocked ? `<button type="button" class="hangar-equip-badge ${active ? 'is-equipped' : ''}" data-equip-badge="${b.id}">${active ? 'DÉSÉQUIPER' : 'ÉQUIPER'}</button>` : ''}</div></article>`;
  }).join('')}</div>`;

  root.querySelectorAll('[data-preview-badge]').forEach(button => button.addEventListener('click', () => {
    const badgeId = button.dataset.previewBadge;
    if (!owned.has(badgeId)) return;
    const badge = BADGES.find(item => item.id === badgeId);
    if (badge) window._previewBadgeUnlock?.(badge);
  }));
  root.querySelectorAll('[data-equip-badge]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    // Only one badge can be equipped at a time; tapping the equipped one
    // removes it (no badge equipped).
    const badgeId = button.dataset.equipBadge;
    G.activeBadge = G.activeBadge === badgeId ? null : badgeId;
    save('activeBadge', G.activeBadge);
    renderBadges(root);
  }));
}
