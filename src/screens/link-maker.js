// Settings > LIEN DIRECT: build a link that starts a new player on a class
// and topics (jexongo.app/?niveau=5e&theme=fractions, read by
// systems/direct-link.js in the first questionnaire), then copy or share it.
// For teachers, parents, posts. Nothing is saved: the choices start from the
// player's own class each time.
import { G } from '../state.js';
import { getLang } from '../i18n.js';
import { schoolSections } from './onboarding.js';
import { buildDirectLink } from '../systems/direct-link.js';
import { schoolYearOfLevel, topicFromSchoolYear } from '../systems/school-questions.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const COUNTRIES = [['quebec', 'QUÉBEC', 'QUEBEC'], ['france', 'FRANCE', 'FRANCE'], ['usa', 'USA', 'USA']];

// Same order as the questionnaire topic screen.
function topicChoices(fr) {
  return [
    { value: '+', label: '+' }, { value: '-', label: '−' }, { value: '*', label: '×' }, { value: '/', label: '÷' },
    { value: 'fractions', label: 'Fractions' }, { value: 'percentages', label: fr ? 'Pourcentages' : 'Percentages' },
    { value: 'exponent', label: fr ? 'Exposant' : 'Exponent' }, { value: 'algebra', label: fr ? 'Algèbre' : 'Algebra' },
  ];
}

// Text copied: the clipboard, or the selected field on old browsers.
async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    input.select();
    try { return document.execCommand('copy'); } catch (__) { return false; }
  }
}

export function openLinkMaker() {
  const fr = getLang() === 'fr';
  let country = COUNTRIES.some(([c]) => c === G.playerCountry) ? G.playerCountry : 'france';
  const classesOf = c => schoolSections(c, fr).flatMap(sec => sec.choices);
  let level = classesOf(country).find(c => c.level === G.schoolLevel)?.level || classesOf(country)[0].level;
  let topics = [];

  const overlay = document.createElement('div');
  overlay.className = 'mr-overlay lm-overlay';
  overlay.innerHTML = `<div class="mr-card lm-card" role="dialog" aria-modal="true" aria-label="${fr ? 'Lien direct' : 'Direct link'}"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector('.mr-card');
  requestAnimationFrame(() => overlay.classList.add('show'));
  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 220);
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  const render = () => {
    const year = schoolYearOfLevel(level);
    const shown = topicChoices(fr).filter(t => year >= topicFromSchoolYear(t.value));
    // A topic the new class does not teach is taken off.
    topics = topics.filter(v => shown.some(t => t.value === v));
    const link = buildDirectLink(location.origin, level, topics, fr);
    card.innerHTML = `
      <div class="mr-head"><span>${fr ? 'LIEN DIRECT' : 'DIRECT LINK'}</span><button type="button" class="lm-close" aria-label="${fr ? 'Fermer' : 'Close'}">✕</button></div>
      <p class="lm-help">${fr
        ? 'Un nouveau joueur qui ouvre ce lien commence directement dans cette classe et ces thèmes.'
        : 'A new player who opens this link starts straight in this class and these topics.'}</p>
      <div class="lm-label">${fr ? 'PAYS' : 'COUNTRY'}</div>
      <div class="lm-chips lm-countries">${COUNTRIES.map(([c, frLabel, enLabel]) =>
        `<button type="button" class="lm-chip${c === country ? ' is-on' : ''}" data-country="${c}">${fr ? frLabel : enLabel}</button>`).join('')}</div>
      <div class="lm-label">${fr ? 'CLASSE' : 'CLASS'}</div>
      <select class="lm-select">${schoolSections(country, fr).map(sec => `<optgroup label="${esc(sec.title)}">${sec.choices.map(c =>
        `<option value="${c.level}"${c.level === level ? ' selected' : ''}>${esc(c.label)}</option>`).join('')}</optgroup>`).join('')}</select>
      <div class="lm-label">${fr ? 'THÈMES' : 'TOPICS'} <small>${fr ? '(aucun : le joueur choisit)' : '(none: the player picks)'}</small></div>
      <div class="lm-chips lm-topics">${shown.map(t =>
        `<button type="button" class="lm-chip${topics.includes(t.value) ? ' is-on' : ''}" data-topic="${esc(t.value)}">${esc(t.label)}</button>`).join('')}</div>
      <input class="lm-link" type="text" readonly value="${esc(link)}" aria-label="${fr ? 'Lien' : 'Link'}">
      <div class="lm-actions">
        <button type="button" class="mr-next lm-copy">${fr ? 'COPIER' : 'COPY'}</button>
        ${navigator.share ? `<button type="button" class="mr-next lm-share">${fr ? 'PARTAGER' : 'SHARE'}</button>` : ''}
      </div>`;

    card.querySelector('.lm-close').addEventListener('click', close);
    card.querySelectorAll('[data-country]').forEach(btn => btn.addEventListener('click', () => {
      if (btn.dataset.country === country) return;
      // Same school year in the other country when it has it.
      const keep = classesOf(btn.dataset.country).find(c => c.schoolYear === year);
      country = btn.dataset.country;
      level = (keep || classesOf(country)[0]).level;
      render();
    }));
    card.querySelector('.lm-select').addEventListener('change', e => { level = e.target.value; render(); });
    card.querySelectorAll('[data-topic]').forEach(btn => btn.addEventListener('click', () => {
      const v = btn.dataset.topic;
      topics = topics.includes(v) ? topics.filter(x => x !== v) : [...topics, v];
      // Keep the questionnaire order in the link.
      topics = shown.map(t => t.value).filter(x => topics.includes(x));
      render();
    }));
    const input = card.querySelector('.lm-link');
    input.addEventListener('focus', () => input.select());
    const copyBtn = card.querySelector('.lm-copy');
    copyBtn.addEventListener('click', async () => {
      const ok = await copyText(link, input);
      copyBtn.textContent = ok ? (fr ? 'COPIÉ !' : 'COPIED!') : (fr ? 'COPIE LE TEXTE' : 'COPY THE TEXT');
      setTimeout(() => { if (copyBtn.isConnected) copyBtn.textContent = fr ? 'COPIER' : 'COPY'; }, 1600);
    });
    card.querySelector('.lm-share')?.addEventListener('click', () => {
      navigator.share({ title: 'JexonGo', url: link }).catch(() => {});
    });
  };
  render();
}
