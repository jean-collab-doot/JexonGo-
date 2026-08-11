import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { AIRCRAFT, AIRCRAFT_ORDER } from '../data/aircraft.js';
import { getPilotGrade } from '../data/pilots.js';
import { t, getLang } from '../i18n.js';
import { MISSILE_TYPES, SHOOTING_PLANS } from './shop.js';
import { expIcon } from '../utils/icons.js';
import { BADGES, unlockEligibleBadges } from '../data/badges.js';

let _hangarPage = 'planes';

export function initHangar(nav) {
  $('btn-hangar-back').onclick = () => nav.toMenu();
}

function meetsGradeRequirement(plane) {
  if (!plane.gradeRequired) return true;
  return (G.highestLevel || 0) >= plane.gradeRequired;
}

export function renderHangar() {
  ensureHangarPages();
  unlockEligibleBadges();
  const grade = getPilotGrade(G.highestLevel || 0);
  const xpEl = $('hangar-xp');
  if (xpEl) xpEl.innerHTML = `${expIcon()} ${(G.xp || 0).toLocaleString()} &nbsp;|&nbsp; ${grade.emoji} ${grade.name}`;

  const grid = $('hangar-grid');
  grid.innerHTML = '';

  AIRCRAFT_ORDER.forEach(id => {
    const plane = AIRCRAFT[id];
    const unlocked = G.unlockedAircraft.includes(id);
    const active = G.activeAircraft === id;
    const gradeOk = meetsGradeRequirement(plane);
    const planeCost = G.activeBadge === 'collector' ? Math.ceil(plane.xpCost * 0.9) : plane.xpCost;

    const card = document.createElement('div');
    card.className = `hangar-card ${active ? 'active' : unlocked ? 'unlocked' : 'locked'}`;

    const img = document.createElement('img');
    img.src = `/assets/hangar/${id}.png`;
    img.className = 'hangar-plane-img';
    if (!unlocked) img.style.opacity = '0.35';
    if (plane.secret && !unlocked) {
      img.classList.add('secret-silhouette');
      img.style.opacity = '0.9';
    }
    card.appendChild(img);

    const name = document.createElement('div');
    name.className = 'plane-name';
    name.textContent = plane.secret && !unlocked ? '???' : plane.name;
    card.appendChild(name);

    if (plane.ability && !(plane.secret && !unlocked)) {
      const ability = document.createElement('div');
      ability.className = 'plane-ability';
      ability.innerHTML = `<b>${plane.ability.icon} ${plane.ability.name}</b><span>${plane.ability.description}</span>`;
      card.appendChild(ability);
    } else if (plane.secret && !unlocked) {
      const ability = document.createElement('div');
      ability.className = 'plane-ability secret-ability';
      ability.innerHTML = '<b>???</b><span>Capacités inconnues</span>';
      card.appendChild(ability);
    }

    const cost = document.createElement('div');
    cost.className = 'plane-cost';
    if (plane.secret && !unlocked) {
      cost.textContent = 'SECRET · BOSS BADGE';
      cost.style.color = '#c084fc';
    } else if (plane.starter) {
      cost.textContent = t('starter');
    } else if (unlocked) {
      cost.textContent = `${planeCost.toLocaleString()} XP OK`;
    } else if (plane.gradeRequired && !gradeOk) {
      cost.textContent = `${planeCost.toLocaleString()} XP`;
      cost.style.color = 'var(--yellow)';
    } else {
      cost.textContent = `${planeCost.toLocaleString()} XP`;
    }
    card.appendChild(cost);

    if (!unlocked && plane.gradeRequired) {
      const hint = document.createElement('div');
      hint.className = 'plane-grade-req';
      if (!gradeOk) {
        hint.textContent = `LOCKED · ${plane.gradeLabel} · LV ${plane.gradeRequired}`;
        hint.style.color = '#ef4444';
      } else {
        hint.textContent = `${plane.gradeLabel} OK`;
        hint.style.color = '#00e84b';
      }
      card.appendChild(hint);
    }

    if (active) {
      const badge = document.createElement('div');
      badge.className = 'active-badge';
      badge.textContent = t('active');
      card.appendChild(badge);
    }

    if (unlocked) {
      card.addEventListener('click', () => {
        G.activeAircraft = id;
        save('activeAircraft', G.activeAircraft);
        renderHangar();
      });
    } else if (!plane.secret && gradeOk && G.xp >= planeCost) {
      card.style.cursor = 'pointer';
      card.style.borderColor = 'var(--yellow)';
      cost.style.color = 'var(--green)';
      cost.textContent = `${t('unlock')} (${planeCost} XP)`;
      card.addEventListener('click', () => {
        G.xp -= planeCost;
        G.unlockedAircraft.push(id);
        if (!G.acquiredAircraft.includes(id)) G.acquiredAircraft.push(id);
        save('xp', G.xp);
        save('unlockedAircraft', G.unlockedAircraft);
        save('acquiredAircraft', G.acquiredAircraft);
        renderHangar();
      });
    }

    grid.appendChild(card);
  });

  renderHangarArmory();
  updateHangarPage();
}

function ensureHangarPages() {
  const grid = $('hangar-grid');
  if (!grid?.parentElement) return;

  if (!$('hangar-page-tabs')) {
    const tabs = document.createElement('div');
    tabs.id = 'hangar-page-tabs';
    tabs.className = 'hangar-page-tabs';
    tabs.innerHTML = `
      <button class="hangar-page-tab active" type="button" data-hangar-page="planes">AVIONS</button>
      <button class="hangar-page-tab" type="button" data-hangar-page="armory">ARMEMENT</button>
      <button class="hangar-page-tab" type="button" data-hangar-page="badges">BADGES</button>
    `;
    grid.parentElement.insertBefore(tabs, grid);
    tabs.querySelectorAll('[data-hangar-page]').forEach(button => {
      button.addEventListener('click', () => {
        _hangarPage = button.dataset.hangarPage || 'planes';
        updateHangarPage();
      });
    });
  }

  if (!$('hangar-armory')) {
    const armory = document.createElement('section');
    armory.id = 'hangar-armory';
    armory.className = 'hangar-armory';
    grid.parentElement.appendChild(armory);
  }
  if (!$('hangar-badges')) {
    const badges = document.createElement('section');
    badges.id = 'hangar-badges'; badges.className = 'hangar-badges';
    grid.parentElement.appendChild(badges);
  }
}

function updateHangarPage() {
  const grid = $('hangar-grid');
  const armory = $('hangar-armory');
  const badges = $('hangar-badges');
  const isArmory = _hangarPage === 'armory';
  const isBadges = _hangarPage === 'badges';
  const lang = getLang() === 'fr' ? 'fr' : 'en';
  const labels = {
    planes: lang === 'fr' ? 'AVIONS' : 'PLANES',
    armory: lang === 'fr' ? 'ARMEMENT' : 'WEAPONS',
    badges: 'BADGES',
  };
  grid?.classList.toggle('hidden', isArmory || isBadges);
  armory?.classList.toggle('hidden', !isArmory);
  badges?.classList.toggle('hidden', !isBadges);
  $('hangar-page-tabs')?.querySelectorAll('[data-hangar-page]').forEach(button => {
    button.textContent = labels[button.dataset.hangarPage] || button.textContent;
    button.classList.toggle('active', button.dataset.hangarPage === _hangarPage);
  });
  if (isBadges) renderHangarBadges();
}

function renderHangarBadges() {
  const root=$('hangar-badges'); if(!root)return;
  const owned=new Set(G.unlockedBadges||[]);
  root.innerHTML=`<div class="hangar-badges-head"><h2>BADGES</h2><span>${owned.size}/${BADGES.length}</span></div><p class="hangar-badge-preview-hint">Équipe un seul badge à la fois. Clique sur son image pour voir l'animation.</p><div class="hangar-badge-grid">${BADGES.map(b=>{const unlocked=owned.has(b.id);const active=G.activeBadge===b.id;const [value,max]=b.progress?.({})||[0,1];return `<article data-preview-badge="${b.id}" class="hangar-badge-card ${unlocked?'unlocked':'locked'} ${active?'active':''}"><img src="${b.image}" alt="${b.name}"><div><em>${b.rarity}</em><h3>${b.name}</h3><p>${b.goal}</p><strong>${b.reward}</strong><small>${active?'ÉQUIPÉ':unlocked?'DÉBLOQUÉ':`${value.toLocaleString()} / ${max.toLocaleString()}`}</small>${unlocked?`<button type="button" class="hangar-equip-badge" data-equip-badge="${b.id}" ${active?'disabled':''}>${active?'ÉQUIPÉ':'ÉQUIPER'}</button>`:''}</div></article>`}).join('')}</div>`;
  root.querySelectorAll('[data-preview-badge]').forEach(button => button.addEventListener('click', () => {
    const badgeId = button.dataset.previewBadge;
    // Locked cards only display progress. The unlock animation is reserved
    // for badges the player has actually earned.
    if (!owned.has(badgeId)) return;
    const badge = BADGES.find(item => item.id === badgeId);
    if (badge) window._previewBadgeUnlock?.(badge);
  }));
  root.querySelectorAll('[data-equip-badge]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    G.activeBadge = button.dataset.equipBadge;
    save('activeBadge', G.activeBadge);
    renderHangar();
  }));
}

function renderHangarArmory() {
  const armory = $('hangar-armory');
  if (!armory) return;
  const lang = getLang() === 'fr' ? 'fr' : 'en';
  const owned = Array.isArray(G.ownedShootingPlans) ? G.ownedShootingPlans : ['default'];
  const ownedMissiles = Array.isArray(G.ownedMissileTypes) && G.ownedMissileTypes.length
    ? G.ownedMissileTypes
    : [];
  G.ownedMissileTypes = ownedMissiles;
  const visiblePlans = SHOOTING_PLANS;
  const activeMissileType = MISSILE_TYPES.some(type => type.id === G.activeMissileType) && ownedMissiles.includes(G.activeMissileType)
    ? G.activeMissileType
    : 'default';
  G.activeMissileType = activeMissileType;

  armory.innerHTML = `
    <div class="hangar-armory-title">
      <span>${lang === 'fr' ? 'ARMEMENT' : 'WEAPONS'}</span>
      <h2>${lang === 'fr' ? 'Tirs et missiles' : 'Shots and missiles'}</h2>
    </div>

    <div class="hangar-armory-block">
      <div class="hangar-armory-head">
        <h3>${lang === 'fr' ? 'Tir de missile' : 'Missile shot'}</h3>
        <p>${lang === 'fr' ? 'Choisis le tir equipe pour ton avion.' : 'Choose the shot equipped on your plane.'}</p>
      </div>
      <div class="hangar-shot-grid">
        ${visiblePlans.map(plan => renderShotOption(plan, lang, owned)).join('')}
      </div>
    </div>

    <div class="hangar-armory-block">
      <div class="hangar-armory-head">
        <h3>${lang === 'fr' ? 'Type de missile' : 'Missile type'}</h3>
        <p>${lang === 'fr' ? 'Style visuel du missile, a l effigie de JexonGO.' : 'Visual missile style for JexonGO.'}</p>
      </div>
      <div class="hangar-missile-grid">
        ${MISSILE_TYPES.map(type => renderMissileOption(type, lang, activeMissileType, ownedMissiles)).join('')}
      </div>
    </div>
  `;

  armory.querySelectorAll('[data-hangar-shot]').forEach(button => {
    button.addEventListener('click', () => {
      const planId = button.dataset.hangarShot;
      if (!owned.includes(planId)) return;
      G.activeShootingPlan = planId;
      save('activeShootingPlan', G.activeShootingPlan);
      window.dispatchEvent(new CustomEvent('jexongo:shooting-plan-changed', { detail: { planId } }));
      renderHangar();
    });
  });

  armory.querySelectorAll('[data-hangar-missile]').forEach(button => {
    button.addEventListener('click', () => {
      const missileId = button.dataset.hangarMissile || '';
      if (!ownedMissiles.includes(missileId)) return;
      G.activeMissileType = missileId;
      save('ownedMissileTypes', G.ownedMissileTypes);
      save('activeMissileType', G.activeMissileType);
      renderHangar();
    });
  });
}

function renderShotOption(plan, lang, ownedPlans) {
  const owned = ownedPlans.includes(plan.id);
  const active = G.activeShootingPlan === plan.id;
  const status = active
    ? (lang === 'fr' ? 'EQUIPE' : 'EQUIPPED')
    : owned
      ? (lang === 'fr' ? 'CHOISIR' : 'SELECT')
      : (lang === 'fr' ? 'BLOQUE' : 'LOCKED');
  const missileCount = Array.isArray(plan.missiles) ? plan.missiles.length : 1;
  return `
    <button class="hangar-shot-card ${active ? 'active' : ''} ${owned ? '' : 'locked'}" type="button" data-hangar-shot="${plan.id}">
      <span class="hangar-shot-icon">${missileCount}</span>
      <strong>${plan.title[lang]}</strong>
      <small>${plan.detail[lang]}</small>
      <em>${status}</em>
    </button>
  `;
}

function renderMissileOption(type, lang, activeMissileType, ownedMissiles) {
  const owned = ownedMissiles.includes(type.id);
  const active = activeMissileType === type.id;
  const status = active
    ? (lang === 'fr' ? 'EQUIPE' : 'EQUIPPED')
    : owned
      ? (lang === 'fr' ? 'DEBLOQUE' : 'UNLOCKED')
      : (lang === 'fr' ? 'BLOQUE' : 'LOCKED');
  return `
    <button class="hangar-missile-card ${active ? 'active' : ''} ${owned ? 'unlocked' : 'locked'}" type="button" data-hangar-missile="${type.id}" aria-disabled="${owned ? 'false' : 'true'}">
      <span class="hangar-locker ${owned ? 'is-unlocked' : 'is-locked'}" aria-hidden="true">
        <span class="hangar-locker-shackle"></span>
        <span class="hangar-locker-body"></span>
      </span>
      <span class="hangar-missile-thumb">
        <span class="hangar-missile-sprite" style="background-image:url('${type.sprite}')"></span>
      </span>
      <strong>${type.title[lang]}</strong>
      <small>${type.detail[lang]}</small>
      <em>${status}</em>
    </button>
  `;
}
