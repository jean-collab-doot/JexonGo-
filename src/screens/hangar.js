import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { AIRCRAFT, AIRCRAFT_ORDER } from '../data/aircraft.js';
import { SKINS } from '../data/skins.js';
import { getPilotGrade } from '../data/pilots.js';
import { t } from '../i18n.js';

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
  title.textContent = plane.name + ' — ' + t('liveries');
  panel.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'hlp-grid';

  grid.appendChild(makeLiveryCard('Default', `/assets/hangar/${id}.png`, null, id));

  SKINS
    .filter(s => s.aircraft === id && G.ownedSkins.includes(s.id))
    .forEach(skin => {
      const imgSrc = skin.offerImg || `/assets/hangar/${id}.png`;
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

// ── PILOT GRADE ───────────────────────────────────────────────────────────────
function meetsGradeRequirement(plane) {
  if (!plane.gradeRequired) return true;
  return (G.highestLevel || 0) >= plane.gradeRequired;
}

// ── HANGAR GRID ───────────────────────────────────────────────────────────────
export function renderHangar() {
  const grade = getPilotGrade(G.highestLevel || 0);
  const xpEl  = $('hangar-xp');
  if (xpEl) xpEl.textContent = `${G.xp} XP  |  ${grade.emoji} ${grade.name}`;

  const grid = $('hangar-grid');
  grid.innerHTML = '';

  AIRCRAFT_ORDER.forEach(id => {
    const plane    = AIRCRAFT[id];
    const unlocked = G.unlockedAircraft.includes(id);
    const active   = G.activeAircraft === id;
    const selected = _selectedAircraft === id;
    const gradeOk  = meetsGradeRequirement(plane);

    const card = document.createElement('div');
    card.className = 'hangar-card '
      + (active ? 'active ' : unlocked ? 'unlocked ' : 'locked ')
      + (selected ? 'selected' : '');

    const img = document.createElement('img');
    img.src       = `/assets/hangar/${id}.png`;
    img.className = 'hangar-livery';
    if (!unlocked) img.style.opacity = '0.35';
    card.appendChild(img);

    const name = document.createElement('div');
    name.className   = 'plane-name';
    name.textContent = plane.name;
    card.appendChild(name);

    // Buff row
    if (plane.abilityDesc) {
      const buff = document.createElement('div');
      buff.className   = 'plane-ability';
      buff.textContent = `⬆ ${plane.abilityDesc}`;
      card.appendChild(buff);
    }

    // Lives bonus row
    if (plane.livesDesc) {
      const lives = document.createElement('div');
      lives.className   = 'plane-ability';
      lives.textContent = `♥ ${plane.livesDesc}`;
      card.appendChild(lives);
    }

    // Debuff row
    if (plane.debuffDesc && plane.debuffDesc !== 'Standard — no debuff') {
      const debuff = document.createElement('div');
      debuff.className   = 'plane-debuff';
      debuff.textContent = `⬇ ${plane.debuffDesc}`;
      card.appendChild(debuff);
    }

    const cost = document.createElement('div');
    cost.className = 'plane-cost';

    if (plane.starter) {
      cost.textContent = t('starter');
    } else if (unlocked) {
      cost.textContent = `${plane.xpCost.toLocaleString()} XP ✓`;
    } else if (plane.gradeRequired && !gradeOk) {
      // Locked by grade requirement
      const reqGrade = plane.gradeLabel || 'CAPTAIN';
      cost.textContent = `■ ${reqGrade} + ${plane.xpCost.toLocaleString()} XP`;
      cost.style.color = '#ef4444';
    } else {
      cost.textContent = `${plane.xpCost.toLocaleString()} XP`;
    }
    card.appendChild(cost);

    // Grade requirement hint
    if (!unlocked && plane.gradeRequired) {
      const hint = document.createElement('div');
      hint.className = 'plane-grade-req';
      const lvlsLeft = Math.max(0, plane.gradeRequired - (G.highestLevel || 0));
      if (!gradeOk) {
        hint.textContent = `Need ${plane.gradeLabel} (reach lv ${plane.gradeRequired})`;
        hint.style.color = '#ef4444';
      } else {
        hint.textContent = `Grade: ${plane.gradeLabel} ✓`;
        hint.style.color = '#00e84b';
      }
      card.appendChild(hint);
    }

    if (active) {
      const badge = document.createElement('div');
      badge.className   = 'active-badge';
      badge.textContent = t('active');
      card.appendChild(badge);
    }

    if (unlocked) {
      card.addEventListener('click', () => {
        if (_selectedAircraft === id) { hideLiveryPanel(); renderHangar(); }
        else { showLiveryPanel(id); renderHangar(); }
      });
    } else if (gradeOk && G.xp >= plane.xpCost) {
      card.style.cursor      = 'pointer';
      card.style.borderColor = 'var(--yellow)';
      cost.style.color       = 'var(--green)';
      cost.textContent       = `${t('unlock')} (${plane.xpCost} XP)`;
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
