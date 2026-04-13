import { $, showScreen } from '../utils/dom.js';
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { AIRCRAFT, AIRCRAFT_ORDER } from '../data/aircraft.js';
import { drawAircraftPreview } from '../game/aircraft-draw.js';

export function initHangar(nav) {
  $('btn-hangar-back').onclick = () => nav.toMenu();
}

export function renderHangar() {
  $('hangar-xp').textContent = `${G.xp} XP`;
  const grid = $('hangar-grid');
  grid.innerHTML = '';

  AIRCRAFT_ORDER.forEach(id => {
    const plane    = AIRCRAFT[id];
    const unlocked = G.unlockedAircraft.includes(id);
    const active   = G.activeAircraft === id;

    const card = document.createElement('div');
    card.className = 'hangar-card ' + (active ? 'active' : unlocked ? 'unlocked' : 'locked');

    // ── Ship preview (pixel-art sprite, frame 0) ──────────────────────────
    const cv  = document.createElement('canvas');
    cv.width  = 80;
    cv.height = 80;
    const cx  = cv.getContext('2d');
    // Dim locked ships
    if (!unlocked) cx.globalAlpha = 0.35;
    drawAircraftPreview(cx, id, 40, 40, 64);
    card.appendChild(cv);

    // ── Name ──────────────────────────────────────────────────────────────
    const name = document.createElement('div');
    name.className = 'plane-name';
    name.textContent = plane.name;
    card.appendChild(name);

    // ── Cost / status ─────────────────────────────────────────────────────
    const cost = document.createElement('div');
    cost.className = 'plane-cost';
    if (plane.starter)  cost.textContent = 'STARTER';
    else if (unlocked)  cost.textContent = `${plane.xpCost.toLocaleString()} XP ✓`;
    else                cost.textContent = `${plane.xpCost.toLocaleString()} XP`;
    card.appendChild(cost);

    // ── Ability label ─────────────────────────────────────────────────────
    if (plane.abilityDesc) {
      const ab = document.createElement('div');
      ab.className = 'plane-ability';
      ab.textContent = plane.abilityDesc;
      card.appendChild(ab);
    }

    // ── Active badge ──────────────────────────────────────────────────────
    if (active) {
      const badge = document.createElement('div');
      badge.className = 'active-badge';
      badge.textContent = 'ACTIVE';
      card.appendChild(badge);
    }

    // ── Interactions ──────────────────────────────────────────────────────
    if (unlocked && !active) {
      card.addEventListener('click', () => {
        G.activeAircraft = id;
        save('activeAircraft', id);
        renderHangar();
      });
    } else if (!unlocked && G.xp >= plane.xpCost) {
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
