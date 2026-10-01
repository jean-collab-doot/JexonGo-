// "Choose your pilot name" after a Google sign-in: other players (leaderboard,
// arena, co-op) see a nickname, never the real name from the Google account.
import { getLang } from '../i18n.js';
import { isPilotNameAllowed } from '../utils/pilot-name.js';

export const PILOT_NAME_MIN = 3;
export const PILOT_NAME_MAX = 14;

const SUGGEST_WORDS = [
  'FAUCON', 'AIGLE', 'COMETE', 'ECLAIR', 'TONNERRE', 'ORAGE', 'METEORE', 'TURBO',
  'RADAR', 'NOVA', 'ORBITE', 'CONDOR', 'VIPER', 'JET', 'ROCKET', 'PHENIX',
  'ZENITH', 'SONIC', 'ALPHA', 'DELTA', 'BOLIDE', 'FUSEE', 'ATLAS', 'MACH',
];

function lettersOnly(text) {
  return String(text || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    // Digits used as letters (J3AN = JEAN), as in utils/pilot-name.js.
    .replace(/0/g, 'o').replace(/[@4]/g, 'a').replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e').replace(/[5$]/g, 's').replace(/7/g, 't')
    .replace(/[^a-z]/g, '');
}

// Parts of the real identity a nickname may not contain: first name, last
// name and the words of the e-mail address (3 letters or more).
function realNameParts(realNames) {
  const parts = new Set();
  for (const raw of realNames || []) {
    for (const word of String(raw || '').split(/[\s._@+-]+/)) {
      const clean = lettersOnly(word.replace(/[^\p{L}]/gu, ''));   // jean2012 -> jean
      if (clean.length >= 3) parts.add(clean);
    }
  }
  return [...parts];
}

/** Error message for a pilot name, or '' when it is fine. */
export function pilotNameError(name, realNames = []) {
  const fr = getLang() === 'fr';
  const value = String(name || '').trim();
  if (value.length < PILOT_NAME_MIN) return fr ? `Au moins ${PILOT_NAME_MIN} caractères.` : `At least ${PILOT_NAME_MIN} characters.`;
  if (value.length > PILOT_NAME_MAX) return fr ? `${PILOT_NAME_MAX} caractères maximum.` : `${PILOT_NAME_MAX} characters max.`;
  if (!/^[\p{L}\p{N} _-]+$/u.test(value)) return fr ? 'Lettres, chiffres, espace, - et _ seulement.' : 'Letters, numbers, space, - and _ only.';
  if (!/\p{L}/u.test(value)) return fr ? 'Mets au moins une lettre.' : 'Use at least one letter.';
  if (!isPilotNameAllowed(value)) return fr ? 'Ce pseudo n’est pas permis. Choisis-en un autre.' : 'This name is not allowed. Pick another one.';
  const squashed = lettersOnly(value);
  if (realNameParts(realNames).some(part => squashed.includes(part))) {
    return fr ? 'N’utilise pas ton vrai nom. Invente un pseudo de pilote!' : 'Don’t use your real name. Make up a pilot name!';
  }
  return '';
}

function suggestions(count, realNames) {
  const out = new Set();
  let guard = 0;
  while (out.size < count && guard++ < 50) {
    const word = SUGGEST_WORDS[Math.floor(Math.random() * SUGGEST_WORDS.length)];
    const name = `${word} ${10 + Math.floor(Math.random() * 90)}`;
    if (!pilotNameError(name, realNames)) out.add(name);
  }
  return [...out];
}

/**
 * Asks for a pilot name. Cannot be skipped: onDone(name) runs once a valid
 * name is confirmed. realNames: the Google first / last name and e-mail.
 */
export function showPilotNamePrompt({ realNames = [], onDone } = {}) {
  document.getElementById('pilot-name-prompt')?.remove();
  const fr = getLang() === 'fr';
  const overlay = document.createElement('div');
  overlay.id = 'pilot-name-prompt';
  overlay.className = 'cp pnp';
  overlay.innerHTML = `
    <div class="cp-card pnp-card">
      <div class="cp-title">${fr ? 'TON PSEUDO' : 'YOUR PILOT NAME'}</div>
      <div class="cp-sub">${fr
        ? 'C’est le nom que les autres joueurs verront.<br>N’écris pas ton vrai nom.'
        : 'This is the name other players will see.<br>Don’t use your real name.'}</div>
      <input class="pnp-input" type="text" maxlength="${PILOT_NAME_MAX}" autocomplete="off" autocapitalize="characters" spellcheck="false"
        placeholder="${fr ? 'EX. : FAUCON 27' : 'E.G. FALCON 27'}" aria-label="${fr ? 'Pseudo' : 'Pilot name'}">
      <div class="pnp-error" role="alert"></div>
      <div class="pnp-ideas-label">${fr ? 'Besoin d’une idée?' : 'Need an idea?'}</div>
      <div class="pnp-ideas"></div>
      <button class="cp-btn pnp-ok" type="button"><span>${fr ? 'CONFIRMER' : 'CONFIRM'}</span></button>
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('.pnp-input');
  const error = overlay.querySelector('.pnp-error');
  const ideas = overlay.querySelector('.pnp-ideas');
  const renderIdeas = () => {
    ideas.innerHTML = suggestions(3, realNames)
      .map(name => `<button type="button" class="pnp-idea">${name}</button>`).join('')
      + `<button type="button" class="pnp-idea pnp-reroll" aria-label="${fr ? 'Autres idées' : 'More ideas'}">↻</button>`;
  };
  renderIdeas();
  ideas.addEventListener('click', e => {
    const btn = e.target.closest('.pnp-idea');
    if (!btn) return;
    if (btn.classList.contains('pnp-reroll')) { renderIdeas(); return; }
    input.value = btn.textContent;
    error.textContent = '';
  });
  input.addEventListener('input', () => {
    const upper = input.value.toUpperCase();
    if (upper !== input.value) input.value = upper;
    error.textContent = '';
  });

  let done = false;
  const confirm = () => {
    if (done) return;
    const name = input.value.replace(/\s+/g, ' ').trim().toUpperCase();
    const msg = pilotNameError(name, realNames);
    if (msg) {
      error.textContent = msg;
      input.classList.remove('pnp-shake'); void input.offsetWidth; input.classList.add('pnp-shake');
      return;
    }
    done = true;
    overlay.classList.add('cp-leave');
    setTimeout(() => { overlay.remove(); onDone?.(name); }, 350);
  };
  overlay.querySelector('.pnp-ok').addEventListener('click', confirm);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); });
  setTimeout(() => input.focus({ preventScroll: true }), 700);
}
