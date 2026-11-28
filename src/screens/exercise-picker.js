// "MES EXERCICES" chooser (systems/exercise-choice.js holds the data):
//   step 1  the category (or "Tout mélanger" = the questions of the level)
//   step 2  the kinds in it; for the 4 operations also Tables (1-12, in order
//           or mixed) or Nombres au hasard (0-10 / 20 / 50 / 100); a live
//           preview of 3 calculations; VALIDER saves (profile / device).
// Opened after the questionnaire, from RÉGLAGE, the practice drawer and the
// Endless screen. Big buttons for the youngest (years 1-2).
import { getLang } from '../i18n.js';
import { load, save } from '../utils/storage.js';
import { uiIcon } from '../utils/icons.js';
import { G } from '../state.js';
import { decimalSettings } from '../game/decimals.js';
import { numberRangeMaxForYear } from '../systems/school-questions.js';
import {
  getExerciseChoice, setExerciseChoice, normalizeChoice, categoriesFor, typesFor, playerYear,
  recommendedMode, categoryName, typeName, typeExample, previewExamples, RANGES,
} from '../systems/exercise-choice.js';

const CAT_ICON = { mix: '?', ops: '+ ×', dec: '3,5', frac: '1/2', pct: '%', exp: 'x²', alg: 'x=?' };
const CAT_COLOR = { mix: '#1EC8FF', ops: '#00c040', dec: '#22b8d8', frac: '#e0a800', pct: '#e8408c', exp: '#f43f5e', alg: '#14a898' };
const OP_SYM = { '+': '+', '-': '−', '*': '×', '/': '÷' };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shownText = (q, fr) => {
  const s = fr ? q.text : (q.textEn || q.text);
  return fr ? s.replace(/(\d)\.(\d)/g, '$1,$2') : s;
};
const shownAnswer = (a, fr) => {
  const s = typeof a === 'number' && a < 0 ? `−${-a}` : String(a);
  return fr ? s.replace(/(\d)\.(\d)/g, '$1,$2') : s;
};

let _open = null;

// required: the new player's first setup (after the questionnaire): no X,
// a choice must be made to go on. Later (RÉGLAGE, practice, Endless): X.
export function showExercisePicker({ onDone, startAt = null, required = false } = {}) {
  _open?.remove();
  const fr = getLang() === 'fr';
  const year = playerYear();
  const kid = !!year && year <= 2;
  let choice = getExerciseChoice();
  let step = startAt === 'types' && choice.cat !== 'mix' ? 2 : 1;

  const root = document.createElement('div');
  root.className = `xp-overlay${kid ? ' xp-kid' : ''}`;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', fr ? 'Mes exercices' : 'My exercises');
  document.body.appendChild(root);
  _open = root;

  const close = (saved) => {
    root.remove();
    if (_open === root) _open = null;
    onDone?.(saved);
  };

  function header(title, back) {
    return `<div class="xp-head">
      ${back ? `<button class="xp-back" type="button" data-back aria-label="${fr ? 'Retour' : 'Back'}">‹</button>` : '<span class="xp-back-space"></span>'}
      <h2 class="xp-title">${esc(title)}</h2>
      ${required ? '<span class="xp-back-space"></span>' : `<button class="xp-close" type="button" data-close aria-label="${fr ? 'Fermer' : 'Close'}">${uiIcon('x')}</button>`}
    </div>`;
  }

  // ── Step 1: the category ──────────────────────────────────────────────────
  function renderCategories() {
    const cats = ['mix', ...categoriesFor(year)];
    const sub = cat => {
      if (cat === 'mix') return fr ? 'Les calculs de ton niveau, un peu de tout' : 'Calculations of your level, a bit of everything';
      return typesFor(cat, year).slice(0, 3).map(t => typeExample(cat, t, fr)).join('   ');
    };
    root.innerHTML = `<div class="xp-card">
      ${header(fr ? 'MES EXERCICES' : 'MY EXERCISES', false)}
      <p class="xp-guide">${fr ? 'Sur quoi veux-tu travailler ?' : 'What do you want to work on?'}</p>
      <div class="xp-cats">
        ${cats.map(cat => `<button type="button" class="xp-cat${choice.cat === cat ? ' is-on' : ''}" data-cat="${cat}" style="--cat:${CAT_COLOR[cat]}">
          <span class="xp-cat-icon">${esc(cat === 'dec' && !fr ? '3.5' : CAT_ICON[cat])}</span>
          <span class="xp-cat-txt"><b>${esc(categoryName(cat, fr))}</b><small>${esc(sub(cat))}</small></span>
          ${choice.cat === cat ? `<span class="xp-tick">${uiIcon('check')}</span>` : ''}
        </button>`).join('')}
      </div>
      ${tipBubble(fr ? 'Choisis d’abord un thème, puis le type de calcul.' : 'First pick a topic, then the kind of calculation.')}
    </div>`;
    root.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => {
      const cat = b.dataset.cat;
      if (cat === 'mix') { setExerciseChoice({ ...choice, cat: 'mix', types: [] }); close(true); return; }
      if (cat !== choice.cat) choice = normalizeChoice({ ...choice, cat, types: [] }, year);
      step = 2; render();
    }));
  }

  // First visit only: a small bubble explaining the two steps.
  function tipBubble(text) {
    if (load('exPickerTipSeen', false)) return '';
    save('exPickerTipSeen', true);
    return `<div class="xp-bubble">${uiIcon('help')}<span>${esc(text)}</span></div>`;
  }

  // ── Step 2: kinds, tables / numbers, preview ──────────────────────────────
  function renderTypes() {
    const cat = choice.cat;
    const all = typesFor(cat, year);
    const ticked = choice.types.length ? choice.types : all;
    const isOps = cat === 'ops';
    const rec = recommendedMode(year);
    const maxRange = year ? numberRangeMaxForYear(year) : 1000;
    const ranges = RANGES.filter(r => r <= Math.max(20, maxRange));
    const dec = decimalSettings(G.decimalSettings);
    const typeBtn = t => `<button type="button" class="xp-type${ticked.includes(t) ? ' is-on' : ''}" data-type="${t}">
        <span class="xp-type-sym">${esc(isOps || cat === 'dec' ? OP_SYM[t] : '')}</span>
        <span class="xp-type-txt"><b>${esc(typeName(cat, t, fr))}</b><small>${esc(typeExample(cat, t, fr))}</small></span>
      </button>`;
    const badge = `<span class="xp-badge">${fr ? 'Conseillé' : 'Recommended'}</span>`;
    const single = choice.tables.length === 1;
    const tNum = single ? choice.tables[0] : 7;
    const tSym = OP_SYM[ticked.includes('*') ? '*' : ticked[0]] || '×';
    root.innerHTML = `<div class="xp-card xp-card-full">
      ${header(categoryName(cat, fr).toUpperCase(), true)}
      <div class="xp-scroll">
      <p class="xp-guide">${fr ? (all.length > 1 ? 'Coche un ou plusieurs types de calcul.' : 'Voici le type de calcul de ton niveau.') : (all.length > 1 ? 'Tick one or more kinds of calculation.' : 'Here is the kind of calculation for your level.')}</p>
      <div class="xp-types">
        ${all.length > 1 ? `<button type="button" class="xp-type xp-type-all${!choice.types.length || choice.types.length === all.length ? ' is-on' : ''}" data-all>
          <span class="xp-type-sym">${uiIcon('sparkle')}</span><span class="xp-type-txt"><b>${fr ? 'Tout mélanger' : 'Mix them all'}</b><small>${fr ? 'Un peu de chaque' : 'A bit of each'}</small></span></button>` : ''}
        ${all.map(typeBtn).join('')}
      </div>
      ${isOps ? `
        <div class="xp-modes">
          <button type="button" class="xp-mode${choice.mode === 'tables' ? ' is-on' : ''}" data-mode="tables">
            ${rec === 'tables' ? badge : ''}
            <span class="xp-mode-icon xp-mode-txt">${tNum} ${tSym}</span>
            <b>${fr ? 'Les tables' : (tSym === '×' ? 'Times tables' : 'Tables')}</b><small>${tNum} ${tSym} 1, ${tNum} ${tSym} 2, ${tNum} ${tSym} 3…</small>
          </button>
          <button type="button" class="xp-mode${choice.mode === 'random' ? ' is-on' : ''}" data-mode="random">
            ${rec === 'random' ? badge : ''}
            <span class="xp-mode-icon">${uiIcon('burst')}</span>
            <b>${fr ? 'Nombres au hasard' : 'Random numbers'}</b><small>${year && year <= 2 ? '8 + 5, 13 + 4…' : '14 + 27, 63 − 18…'}</small>
          </button>
        </div>
        ${choice.mode === 'tables' ? `
          <p class="xp-label">${fr ? 'Quelle table ?' : 'Which table?'} <span>${fr ? '(touche-en plusieurs pour les mélanger)' : '(tap several to mix them)'}</span></p>
          <div class="xp-tables">
            ${Array.from({ length: 12 }, (_, i) => i + 1).map(n => `<button type="button" class="xp-num${choice.tables.includes(n) ? ' is-on' : ''}" data-table="${n}">${n}</button>`).join('')}
            <button type="button" class="xp-num xp-num-all${choice.tables.length === 12 ? ' is-on' : ''}" data-table="all">${fr ? 'Toutes' : 'All'}</button>
          </div>
          ${single ? `<div class="xp-row">
            <button type="button" class="xp-pill${choice.order === 'ordered' ? ' is-on' : ''}" data-order="ordered">${fr ? 'Dans l’ordre' : 'In order'}</button>
            <button type="button" class="xp-pill${choice.order !== 'ordered' ? ' is-on' : ''}" data-order="random">${fr ? 'Au hasard' : 'Shuffled'}</button>
          </div>` : ''}
        ` : `
          <p class="xp-label">${fr ? 'Avec quels nombres ?' : 'Which numbers?'}</p>
          <div class="xp-row">
            ${ranges.map(r => `<button type="button" class="xp-pill${choice.range === r ? ' is-on' : ''}" data-range="${r}">${fr ? `0 à ${r}` : `0 to ${r}`}</button>`).join('')}
          </div>
        `}
      ` : ''}
      ${cat === 'dec' ? `
        <p class="xp-label">${fr ? 'Chiffres après la virgule' : 'Digits after the point'}</p>
        <div class="xp-row">
          <button type="button" class="xp-pill${dec.places === 1 ? ' is-on' : ''}" data-places="1">${fr ? '1 (3,5)' : '1 (3.5)'}</button>
          <button type="button" class="xp-pill${dec.places === 2 ? ' is-on' : ''}" data-places="2">${fr ? '2 (3,25)' : '2 (3.25)'}</button>
        </div>
        <p class="xp-label">${fr ? 'Taille des nombres' : 'Size of the numbers'}</p>
        <div class="xp-row">
          <button type="button" class="xp-pill${dec.max === 10 ? ' is-on' : ''}" data-dmax="10">${fr ? 'jusqu’à 10' : 'up to 10'}</button>
          <button type="button" class="xp-pill${dec.max === 100 ? ' is-on' : ''}" data-dmax="100">${fr ? 'jusqu’à 100' : 'up to 100'}</button>
        </div>
      ` : ''}
      <p class="xp-hint">${esc(guidance())}</p>
      <div class="xp-preview">
        <span class="xp-preview-title">${fr ? 'Exemples' : 'Examples'}</span>
        ${previewExamples(choice, year).map(q => {
          // the answer in place of the "?" (7 × 6 = 42, 3 000 = 3 × 10^3)
          const txt = shownText(q, fr), at = txt.indexOf('?');
          const ans = `<i>${esc(shownAnswer(q.answer, fr))}</i>`;
          return `<span class="xp-ex">${at < 0 ? `${esc(txt)} → ${ans}` : `${esc(txt.slice(0, at))}${ans}${esc(txt.slice(at + 1))}`}</span>`;
        }).join('')}
      </div>
      </div>
      <div class="xp-foot">
        <button type="button" class="xp-validate" data-validate>${fr ? 'VALIDER' : 'CONFIRM'}</button>
      </div>
    </div>`;

    root.querySelector('[data-all]')?.addEventListener('click', () => { choice.types = []; render(); });
    root.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.type;
      let list = choice.types.length ? [...choice.types] : (all.length > 1 ? [] : [...all]);
      if (!choice.types.length) list = [t];                     // from "all": only this one
      else if (list.includes(t)) { if (list.length > 1) list = list.filter(x => x !== t); }
      else list.push(t);
      choice.types = list.length === all.length ? [] : list;
      render();
    }));
    root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { choice.mode = b.dataset.mode; render(); }));
    root.querySelectorAll('[data-table]').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.table;
      if (v === 'all') choice.tables = choice.tables.length === 12 ? [7] : Array.from({ length: 12 }, (_, i) => i + 1);
      else {
        const n = Number(v);
        if (choice.tables.length === 12) choice.tables = [n];
        else if (choice.tables.includes(n)) { if (choice.tables.length > 1) choice.tables = choice.tables.filter(x => x !== n); }
        else choice.tables = [...choice.tables, n].sort((a, b) => a - b);
      }
      render();
    }));
    root.querySelectorAll('[data-order]').forEach(b => b.addEventListener('click', () => { choice.order = b.dataset.order; render(); }));
    root.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => { choice.range = Number(b.dataset.range); render(); }));
    root.querySelectorAll('[data-places]').forEach(b => b.addEventListener('click', () => {
      G.decimalSettings = { ...decimalSettings(G.decimalSettings), places: Number(b.dataset.places) };
      save('decimalSettings', G.decimalSettings); render();
    }));
    root.querySelectorAll('[data-dmax]').forEach(b => b.addEventListener('click', () => {
      G.decimalSettings = { ...decimalSettings(G.decimalSettings), max: Number(b.dataset.dmax) };
      save('decimalSettings', G.decimalSettings); render();
    }));
    root.querySelector('[data-validate]').addEventListener('click', () => { setExerciseChoice(choice); close(true); });
  }

  // One sentence that says what the choice will do.
  function guidance() {
    const c = choice;
    if (c.cat === 'ops' && c.mode === 'tables') {
      if (c.tables.length === 1) {
        return c.order === 'ordered'
          ? (fr ? `Tu vas réciter la table de ${c.tables[0]} dans l’ordre, de × 1 à × 12.` : `You will go through the ${c.tables[0]} times table in order, from × 1 to × 12.`)
          : (fr ? `Les calculs de la table de ${c.tables[0]}, dans le désordre : parfait pour la connaître par cœur.` : `The ${c.tables[0]} times table, shuffled: great to learn it by heart.`);
      }
      return c.tables.length === 12
        ? (fr ? 'Toutes les tables mélangées : le grand défi !' : 'All the tables mixed: the big challenge!')
        : (fr ? `Les tables de ${c.tables.join(', ')} mélangées, pour réviser.` : `The ${c.tables.join(', ')} tables mixed, to review.`);
    }
    if (c.cat === 'ops') return fr ? `Des calculs avec des nombres de 0 à ${c.range}.` : `Calculations with numbers from 0 to ${c.range}.`;
    return fr ? 'Les calculs viendront comme dans les exemples, avec d’autres nombres.' : 'The calculations will look like the examples, with other numbers.';
  }

  function render() {
    // Same scroll place after a tap (the page is drawn again).
    const keep = step === 2 ? root.querySelector('.xp-scroll')?.scrollTop || 0 : 0;
    if (step === 1) renderCategories(); else renderTypes();
    const sc = root.querySelector('.xp-scroll');
    if (sc && keep) sc.scrollTop = keep;
    root.querySelector('[data-close]')?.addEventListener('click', () => close(false));
    root.querySelector('[data-back]')?.addEventListener('click', () => { step = 1; render(); });
  }
  render();
}
