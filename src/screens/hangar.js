import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { AIRCRAFT, AIRCRAFT_ORDER } from '../data/aircraft.js';
import { SKINS } from '../data/skins.js';

export function initHangar(nav) {
  $('btn-hangar-back').onclick = () => {
    hideLiveryPanel();
    nav.toMenu();
  };
}

// ── LIVERY PANEL ──────────────────────────────────────────────────────────────

let _selectedAircraft = null;

function hideLiveryPanel() {
  const panel = $('hangar-livery-panel');
  panel.classList.add('hidden');
  _selectedAircraft = null;
}

function showLiveryPanel(id) {
  _selectedAircraft = id;
  const plane  = AIRCRAFT[id];
  const panel  = $('hangar-livery-panel');
  panel.innerHTML = '';

  const title = document.createElement('div');
  title.className   = 'hlp-title';
  title.textContent = plane.name + ' — LIVERIES';
  panel.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'hlp-grid';

  // Default livery
  grid.appendChild(makeLiveryCard('Default', `/public/assets/hangar/${id}.png`, null, id));

  // Owned skins for this aircraft
  SKINS
    .filter(s => s.aircraft === id && G.ownedSkins.includes(s.id))
    .forEach(skin => {
      const imgSrc = skin.offerImg || `/public/assets/hangar/${id}.png`;
      grid.appendChild(makeLiveryCard(skin.name, imgSrc, skin, id));
    });

  panel.appendChild(grid);
  panel.classList.remove('hidden');
}

function makeLiveryCard(label, imgSrc, skin, aircraftId) {
  const isActive = skin
    ? G.activeSkin === skin.id && G.activeAircraft === aircraftId
    : G.activeAircraft === aircraftId && !G.activeSkin;

  const card = document.createElement('div');
  card.className = 'hlp-card' + (isActive ? ' hlp-card-active' : '');

  const img = document.createElement('img');
  img.src = imgSrc;
  img.className = 'hlp-img';
  if (skin && skin.filter && !skin.offerImg) img.style.filter = skin.filter;
  card.appendChild(img);

  const lbl = document.createElement('div');
  lbl.className   = 'hlp-label';
  lbl.textContent = label;
  card.appendChild(lbl);

  if (isActive) {
    const badge = document.createElement('div');
    badge.className   = 'hlp-badge';
    badge.textContent = '✓';
    card.appendChild(badge);
  }

  card.onclick = () => {
    G.activeAircraft = aircraftId;
    G.activeSkin     = skin ? skin.id : null;
    save('activeAircraft', G.activeAircraft);
    save('activeSkin',     G.activeSkin);
    renderHangar();
    showLiveryPanel(aircraftId);
  };

  return card;
}

// ── HANGAR GRID ───────────────────────────────────────────────────────────────

export function renderHangar() {
  $('hangar-xp').textContent = `${G.xp} XP`;
  const grid = $('hangar-grid');
  grid.innerHTML = '';

  AIRCRAFT_ORDER.forEach(id => {
    const plane    = AIRCRAFT[id];
    const unlocked = G.unlockedAircraft.includes(id);
    const active   = G.activeAircraft === id;
    const selected = _selectedAircraft === id;

    const card = document.createElement('div');
    card.className = 'hangar-card '
      + (active ? 'active ' : unlocked ? 'unlocked ' : 'locked ')
      + (selected ? 'selected' : '');

    const img = document.createElement('img');
    img.src       = `/public/assets/hangar/${id}.png`;
    img.className = 'hangar-livery';
    if (!unlocked) img.style.opacity = '0.35';
    card.appendChild(img);

    const name = document.createElement('div');
    name.className   = 'plane-name';
    name.textContent = plane.name;
    card.appendChild(name);

    const cost = document.createElement('div');
    cost.className = 'plane-cost';
    if (plane.starter)  cost.textContent = 'STARTER';
    else if (unlocked)  cost.textContent = `${plane.xpCost.toLocaleString()} XP ✓`;
    else                cost.textContent = `${plane.xpCost.toLocaleString()} XP`;
    card.appendChild(cost);

    if (plane.abilityDesc) {
      const ab = document.createElement('div');
      ab.className   = 'plane-ability';
      ab.textContent = plane.abilityDesc;
      card.appendChild(ab);
    }

    if (active) {
      const badge = document.createElement('div');
      badge.className   = 'active-badge';
      badge.textContent = 'ACTIVE';
      card.appendChild(badge);
    }

    if (unlocked) {
      card.addEventListener('click', () => {
        if (_selectedAircraft === id) {
          hideLiveryPanel();
          renderHangar();
        } else {
          showLiveryPanel(id);
          renderHangar();
        }
      });
    } else if (G.xp >= plane.xpCost) {
      card.style.cursor      = 'pointer';
      card.style.borderColor = 'var(--yellow)';
      cost.style.color       = 'var(--green)';
      cost.textContent       = `UNLOCK (${plane.xpCost} XP)`;
      card.addEventListener('click', () => {
        G.xp -= plane.xpCost;
        G.unlockedAircraft.push(id);
        save('xp', G.xp);
        save('unlockedAircraft', G.unlockedAircraft);
        renderHangar();
      });
    }

    grid.appendChild(card);
  });
}
