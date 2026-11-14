// CRÉDITS page (RÉGLAGE drawer › CRÉDITS): every music and sound of the game
// with its author, where it is used, a link to its source and its license
// (data/credits.js), as cards side by side over the lobby's hangar floor.
// ◀ RETOUR, Escape or the system back gesture close it.
import { getLang, t } from '../i18n.js';
import { SFX } from '../audio/sound.js';
import { LICENSES, MUSIC_CREDITS, SOUND_CREDITS } from '../data/credits.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function card(c, lang) {
  const lic = LICENSES[c.license];
  return `<li class="crp-card">
    <b class="crp-title">${esc(c.title)}</b>
    <span class="crp-author">${esc(c.author)}</span>
    <span class="crp-use">${esc(c.use[lang])}</span>
    <span class="crp-links">
      <a href="${c.source}" target="_blank" rel="noopener noreferrer">${lang === 'fr' ? 'SOURCE' : 'SOURCE'}</a>
      <a class="crp-license" href="${lic.url}" target="_blank" rel="noopener noreferrer">${esc(lic.name)}</a>
    </span>
  </li>`;
}

function pageHTML() {
  const lang = getLang() === 'en' ? 'en' : 'fr';
  const used = [...new Set([...MUSIC_CREDITS, ...SOUND_CREDITS].map(c => c.license))];
  return `
    <div class="crp-sheet">
      <header class="crp-head">
        <button class="crp-back" type="button">${lang === 'fr' ? '◀ RETOUR' : '◀ BACK'}</button>
        <h2 id="crp-heading">${t('jxCredits')}</h2>
      </header>
      <div class="crp-body">
        <h3>${t('jxCreditsMusic')}</h3>
        <ul class="crp-grid">${MUSIC_CREDITS.map(c => card(c, lang)).join('')}</ul>
        <h3>${t('jxCreditsSounds')}</h3>
        <ul class="crp-grid">${SOUND_CREDITS.map(c => card(c, lang)).join('')}</ul>
        <h3>${lang === 'fr' ? 'LICENCES' : 'LICENSES'}</h3>
        <ul class="crp-grid crp-grid-licenses">${used.map(k => `<li class="crp-card">
          <b class="crp-title">${esc(LICENSES[k].name)}</b>
          <span class="crp-use">${esc(LICENSES[k].text[lang])}</span>
          <span class="crp-links"><a href="${LICENSES[k].url}" target="_blank" rel="noopener noreferrer">${lang === 'fr' ? 'LIRE LA LICENCE' : 'READ THE LICENSE'}</a></span>
        </li>`).join('')}</ul>
      </div>
    </div>`;
}

function onKey(e) { if (e.key === 'Escape') closeCreditsPage(); }

export function openCreditsPage() {
  closeCreditsPage(true);
  const page = document.createElement('div');
  page.id = 'credits-page';
  page.className = 'crp';
  page.setAttribute('role', 'dialog');
  page.setAttribute('aria-modal', 'true');
  page.setAttribute('aria-labelledby', 'crp-heading');
  page.innerHTML = pageHTML();
  page.querySelector('.crp-back').addEventListener('click', () => { SFX.click?.(); closeCreditsPage(); });
  document.body.appendChild(page);
  document.addEventListener('keydown', onKey);
  page.querySelector('.crp-back').focus({ preventScroll: true });
}

export function closeCreditsPage(instant = false) {
  const page = document.getElementById('credits-page');
  document.removeEventListener('keydown', onKey);
  if (!page) return;
  if (instant) { page.remove(); return; }
  page.classList.add('is-leaving');
  setTimeout(() => page.remove(), 220);
}
