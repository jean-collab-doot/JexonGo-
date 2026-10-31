// ── AIRCRAFT SKINS (liveries) ────────────────────────────────────────────────
// A skin changes only how a plane looks (its sprite sheets and hangar art),
// never its stats. Event skins can be earned only during their event week;
// once earned, a skin is kept forever.
import { G } from '../state.js';
import { save } from '../utils/storage.js';

export const HALLOWEEN_2026 = 'halloween2026';

export const AIRCRAFT_SKINS = {
  t6: [
    { id: 'default', name: { fr: 'PAR DÉFAUT', en: 'DEFAULT' } },
    {
      id: HALLOWEEN_2026,
      name: { fr: 'HALLOWEEN 2026', en: 'HALLOWEEN 2026' },
      legend: { fr: 'Le tout premier skin du jeu.', en: 'The very first skin in the game.' },
      editor: 'Luca Corbat',
      // One week, in the player's local time: Oct 31 to Nov 6 included.
      eventStart: new Date(2026, 9, 31),
      eventEnd: new Date(2026, 10, 7),
      how: {
        fr: 'Termine le tutoriel au complet (nouveau pilote) ou réussis un niveau sans aucune faute.',
        en: 'Finish the full tutorial (new pilot) or clear a level without a single mistake.',
      },
    },
  ],
};

export function skinsFor(aircraftId) {
  return AIRCRAFT_SKINS[aircraftId] || [];
}

export function skinDef(aircraftId, skinId) {
  return skinsFor(aircraftId).find(s => s.id === skinId) || null;
}

export function ownsSkin(aircraftId, skinId) {
  if (skinId === 'default') return true;
  return (G.ownedSkins || []).includes(`${aircraftId}:${skinId}`);
}

export function skinEventOpen(skin, now = new Date()) {
  return !!skin?.eventStart && now >= skin.eventStart && now < skin.eventEnd;
}

// The skin the player flies with this plane ('default' when none is owned).
export function activeSkin(aircraftId) {
  const id = G.aircraftSkins?.[aircraftId];
  return id && skinDef(aircraftId, id) && ownsSkin(aircraftId, id) ? id : 'default';
}

export function setActiveSkin(aircraftId, skinId) {
  if (!ownsSkin(aircraftId, skinId)) return;
  G.aircraftSkins = { ...(G.aircraftSkins || {}), [aircraftId]: skinId };
  save('aircraftSkins', G.aircraftSkins);
}

// Hangar / lobby picture of a plane, with its active skin.
export function aircraftArt(aircraftId) {
  const skin = activeSkin(aircraftId);
  return skin === 'default' ? `/assets/hangar/${aircraftId}.webp` : `/assets/hangar/${aircraftId}-${skin}.webp`;
}

// Halloween 2026: new pilots earn it by finishing the full tutorial, regular
// pilots by clearing a level without a mistake. Only during the event week.
// Returns true when the skin was just earned (the caller shows the reveal).
export function earnHalloweenSkin() {
  const skin = skinDef('t6', HALLOWEEN_2026);
  if (!skinEventOpen(skin) || ownsSkin('t6', HALLOWEEN_2026)) return false;
  G.ownedSkins = [...(G.ownedSkins || []), `t6:${HALLOWEEN_2026}`];
  save('ownedSkins', G.ownedSkins);
  // Worn right away: the player sees the reward on the next flight.
  setActiveSkin('t6', HALLOWEEN_2026);
  G.pendingSkinReveal = `t6:${HALLOWEEN_2026}`;
  save('pendingSkinReveal', G.pendingSkinReveal);
  return true;
}
