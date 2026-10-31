// ── LIVERY EARNED POPUP ──────────────────────────────────────────────────────
// Shown once after a livery is earned (data/skins.js sets G.pendingSkinReveal).
// Same look as the secret plane reveal (.bdg-reveal in style.css).
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { skinDef } from '../data/skins.js';
import { getLang } from '../i18n.js';
import { SFX } from '../audio/sound.js';

// Must match BADGE_IMPACT_MS in result.js (timings in style.css, .bdg-reveal).
const IMPACT_MS = 1050;

// Shows the popup if a livery is waiting and no other popup is open.
// Returns true when it was shown.
export function showPendingSkinReveal() {
  const pending = G.pendingSkinReveal;
  if (!pending) return false;
  if (document.querySelector('.bdg-reveal') || document.getElementById('connect-prompt')) return false;
  const [aircraftId, skinId] = pending.split(':');
  const skin = skinDef(aircraftId, skinId);
  G.pendingSkinReveal = null;
  save('pendingSkinReveal', null);
  if (!skin) return false;

  const fr = getLang() === 'fr';
  const lang = fr ? 'fr' : 'en';
  const plane = AIRCRAFT[aircraftId];
  const overlay = document.createElement('div');
  overlay.className = 'bdg-reveal bdg-rarity-epique bdg-plane-reveal';
  overlay.innerHTML = `
    <div class="bdg-beam"></div>
    <div class="bdg-rays"></div>
    <div class="bdg-flash"></div>
    <div class="bdg-stage" role="dialog" aria-modal="true" aria-label="${fr ? 'Skin débloqué' : 'Skin unlocked'} : ${skin.name[lang]}">
      <div class="bdg-ribbon"><span>${fr ? 'SKIN DÉBLOQUÉ' : 'SKIN UNLOCKED'}</span></div>
      <div class="bpr-stage">
        <img class="bpr-plane" src="/assets/hangar/${aircraftId}-${skinId}.webp" alt="${plane?.name || ''}" draggable="false">
        <span class="bdg-ring"></span><span class="bdg-ring bdg-ring-2"></span>
      </div>
      <em class="bdg-rarity">${fr ? 'ÉVÉNEMENT' : 'EVENT'} ${skin.name[lang]}</em>
      <h2 class="bdg-name">${plane?.name || ''}</h2>
      <p class="bdg-goal">${fr
        ? 'Ton avion porte déjà ce skin. Change-le quand tu veux dans le hangar en touchant le T-6.'
        : 'Your plane is already wearing it. Change it anytime in the hangar by tapping the T-6.'}</p>
      ${skin.legend ? `<p class="bdg-goal">${skin.legend[lang]}${skin.editor ? ` ${fr ? 'Éditeur' : 'Editor'} : ${skin.editor}` : ''}</p>` : ''}
      <strong class="bdg-reward">${fr ? 'À TOI POUR TOUJOURS' : 'YOURS FOR GOOD'}</strong>
      <div class="bpr-actions">
        <button type="button" class="bdg-continue bpr-close">${fr ? 'CONTINUER' : 'CONTINUE'}</button>
      </div>
    </div>`;
  overlay.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  overlay.addEventListener('dragstart', e => e.preventDefault());
  document.body.appendChild(overlay);
  document.documentElement.classList.add('badge-unlock-open');
  requestAnimationFrame(() => overlay.classList.add('show'));
  const impact = setTimeout(() => SFX.promoted?.(), IMPACT_MS);
  overlay.querySelector('.bpr-close').onclick = () => {
    clearTimeout(impact);
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.remove();
      document.documentElement.classList.remove('badge-unlock-open');
    }, 360);
  };
  return true;
}
