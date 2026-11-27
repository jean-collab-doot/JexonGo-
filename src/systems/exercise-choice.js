// "MES EXERCICES": the player picks a category, then one or more kinds of
// calculation in it (screens/exercise-picker.js). Saved in the profile
// (G.exerciseChoice, cloud-save PERSIST_KEYS), on the device for a guest.
//   { cat: 'mix' | 'ops' | 'dec' | 'frac' | 'pct' | 'exp' | 'alg',
//     types: [...]   kinds ticked in the category ([] = all of the category),
//     mode: 'tables' | 'random', tables: [7], order: 'ordered' | 'random',
//     range: 10 | 20 | 50 | 100 }        (mode / tables / order / range: ops)
// 'mix' keeps the game's own questions of the player's level (as before).
// Each kind is shown from its school year (Québec / France / USA / other all
// map to the same years: 3e année = CE2 = 3rd grade = Grade 3).
import { G, saveAll } from '../state.js';
import { load, save } from '../utils/storage.js';
import { schoolYearOfLevel, topicFromSchoolYear } from './school-questions.js';
import { makeFractionQuestion } from '../game/fractions.js';
import { makePercentQuestion } from '../game/percentages.js';
import { makeSchoolAlgebraQuestion } from '../game/algebra.js';
import { makeDecimalQuestion, decimalSettings } from '../game/decimals.js';
import { mistakeChoices } from '../game/tips.js';
import {
  tableQuestion, randomQuestion, compareFractionQuestion, exponentRuleQuestion,
  scientificQuestion, substituteQuestion, expandQuestion,
} from '../game/exercise-extra.js';

// Kinds of each category and the school year each one starts.
export const EXERCISE_CATEGORIES = {
  ops:  { topic: null, types: { '+': 1, '-': 2, '*': 3, '/': 3 } },
  dec:  { topic: 'decimals', types: { '+': 5, '-': 5, '*': 5, '/': 5 } },
  frac: { topic: 'fractions', types: { of: 3, add: 3, equiv: 5, compare: 5, sub: 5, simplify: 7, mul: 7, div: 10 } },
  pct:  { topic: 'percentages', types: { of: 5, change: 7, which: 10, reverse: 10 } },
  exp:  { topic: 'exponent', types: { squares: 6, powers: 6, rules: 8, sci: 9 } },
  alg:  { topic: 'algebra', types: { one: 7, subst: 7, two: 8, expand: 9 } },
};
export const CATEGORY_ORDER = ['ops', 'dec', 'frac', 'pct', 'exp', 'alg'];
export const RANGES = [10, 20, 50, 100];

const NAMES = {
  cat: {
    mix: ['Tout mélanger', 'Mix everything'], ops: ['Les 4 opérations', 'The 4 operations'], dec: ['Nombres à virgule', 'Decimals'],
    frac: ['Fractions', 'Fractions'], pct: ['Pourcentages', 'Percentages'], exp: ['Exposants', 'Exponents'], alg: ['Algèbre', 'Algebra'],
  },
  ops: { '+': ['Addition', 'Addition'], '-': ['Soustraction', 'Subtraction'], '*': ['Multiplication', 'Multiplication'], '/': ['Division', 'Division'] },
  frac: {
    of: ['Fraction d’un nombre', 'Fraction of a number'], add: ['Additionner', 'Add'], equiv: ['Fractions égales', 'Equal fractions'],
    compare: ['Comparer', 'Compare'], sub: ['Soustraire', 'Subtract'], simplify: ['Simplifier', 'Simplify'],
    mul: ['Multiplier', 'Multiply'], div: ['Diviser', 'Divide'],
  },
  pct: { of: ['Pourcentage d’un nombre', 'Percent of a number'], change: ['Augmentation ou réduction', 'Increase or decrease'],
    which: ['Trouver le pourcentage', 'Find the percentage'], reverse: ['Trouver le nombre de départ', 'Find the starting number'] },
  exp: { squares: ['Carrés', 'Squares'], powers: ['Puissances', 'Powers'], rules: ['Règles des exposants', 'Exponent rules'], sci: ['Notation scientifique', 'Scientific notation'] },
  alg: { one: ['Équation en une étape', 'One-step equation'], subst: ['Remplacer une lettre', 'Substitute a letter'],
    two: ['Équation en deux étapes', 'Two-step equation'], expand: ['Développer et réduire', 'Expand and simplify'] },
};
const nm = (pair, fr) => (pair ? pair[fr ? 0 : 1] : '');
export const categoryName = (cat, fr) => nm(NAMES.cat[cat], fr);
export const typeName = (cat, type, fr) => nm((NAMES[cat === 'dec' ? 'ops' : cat] || {})[type], fr);

// Examples shown under each kind's button.
const TYPE_EXAMPLE = {
  ops: { '+': '7 + 5', '-': '12 − 7', '*': '7 × 6', '/': '42 ÷ 7' },
  dec: { '+': '3,5 + 2,4', '-': '7,2 − 1,8', '*': '0,5 × 6', '/': '4,8 ÷ 2' },
  frac: { of: '1/4 de 20', add: '1/5 + 2/5', equiv: '1/2 = ?/10', compare: '3/4 ou 2/3', sub: '5/6 − 1/6', simplify: '6/8 = ?', mul: '2/3 × 12', div: '1/2 ÷ 1/4' },
  pct: { of: '25 % de 80', change: '60 − 20 %', which: '15 = ? % de 60', reverse: '30 % de ? = 12' },
  exp: { squares: '7²', powers: '2³', rules: 'x² × x³', sci: '3 000 = 3 × 10^?' },
  alg: { one: 'x + 5 = 12', subst: 'si x = 3, 2x + 1', two: '3x + 2 = 11', expand: '3(x + 2)' },
};
export const typeExample = (cat, type, fr) => {
  const ex = TYPE_EXAMPLE[cat]?.[type] || '';
  return fr ? ex : ex.replace(/,(\d)/g, '.$1').replace(' de ', ' of ').replace(' ou ', ' or ').replace('si x', 'if x');
};

export function playerYear() {
  return schoolYearOfLevel(G.schoolLevel || '') || Number(G.playerGrade) || 0;
}
// Kinds of a category the player's year allows (unknown year: all).
export function typesFor(cat, year = playerYear()) {
  const t = EXERCISE_CATEGORIES[cat]?.types || {};
  return Object.keys(t).filter(k => !year || year >= t[k]);
}
export function categoriesFor(year = playerYear()) {
  return CATEGORY_ORDER.filter(c => typesFor(c, year).length);
}
// "Conseillé": tables in primary school (years 1-6), random numbers after.
export const recommendedMode = (year = playerYear()) => (year && year <= 6 ? 'tables' : 'random');

export function normalizeChoice(raw, year = playerYear()) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const cat = c.cat === 'mix' || categoriesFor(year).includes(c.cat) ? c.cat : 'mix';
  const allowed = cat === 'mix' ? [] : typesFor(cat, year);
  const types = Array.isArray(c.types) ? c.types.filter(t => allowed.includes(t)) : [];
  const tables = Array.isArray(c.tables) ? [...new Set(c.tables.map(Number).filter(n => n >= 1 && n <= 12))].sort((a, b) => a - b) : [];
  return {
    cat, types,
    mode: c.mode === 'random' || c.mode === 'tables' ? c.mode : recommendedMode(year),
    tables: tables.length ? tables : [year && year <= 2 ? 2 : 7],
    order: c.order === 'ordered' ? 'ordered' : 'random',
    range: RANGES.includes(Number(c.range)) ? Number(c.range) : (year === 1 ? 10 : year === 2 ? 20 : 100),
  };
}

// Read at start so the cloud save always carries it (exportSaveSnapshot).
if (G.exerciseChoice === undefined) G.exerciseChoice = load('exerciseChoice', null);

export function getExerciseChoice() {
  if (G.exerciseChoice === undefined) G.exerciseChoice = load('exerciseChoice', null);
  return normalizeChoice(G.exerciseChoice);
}

// Saves the choice and keeps the older settings in step (topics of the
// levels, practice operations, decimal operations, number range).
export function setExerciseChoice(raw) {
  const year = playerYear();
  const c = normalizeChoice(raw, year);
  G.exerciseChoice = c;
  save('exerciseChoice', c);
  const types = c.types.length ? c.types : typesFor(c.cat, year);
  if (c.cat === 'mix') {
    G.focusTopics = []; G.focusOperations = []; G.focusOperation = null;
    G.practiceOps = ['+', '-', '*', '/', 'frac', 'pct', 'dec', '^', 'alg'].filter(op => !year || year >= topicFromSchoolYear(op));
  } else if (c.cat === 'ops') {
    G.focusTopics = [...types]; G.focusOperations = [...types]; G.focusOperation = types[0] ?? null;
    G.practiceOps = [...types];
    if (c.mode === 'random') G.numberRangeMax = c.range;
  } else {
    G.focusTopics = [EXERCISE_CATEGORIES[c.cat].topic]; G.focusOperations = []; G.focusOperation = null;
    G.practiceOps = [{ dec: 'dec', frac: 'frac', pct: 'pct', exp: '^', alg: 'alg' }[c.cat]];
    if (c.cat === 'dec') G.decimalSettings = { ...decimalSettings(G.decimalSettings), ops: types };
  }
  save('focusTopics', G.focusTopics);
  save('focusOperations', G.focusOperations);
  save('practiceOps', G.practiceOps);
  saveAll();   // also sends the profile to the cloud (signed in)
  return c;
}

// Short label of what the player works on ("Table de 7", "Mélange : 6, 7, 8",
// "Virgules : multiplication"...). '' for 'mix'.
export function choiceLabel(choice, fr) {
  const c = normalizeChoice(choice);
  if (c.cat === 'mix') return '';
  const year = playerYear();
  const all = typesFor(c.cat, year);
  const list = (c.types.length ? c.types : all).map(t => typeName(c.cat, t, fr).toLowerCase());
  const allTicked = !c.types.length || c.types.length === all.length;
  if (c.cat === 'ops') {
    const onlyTimes = c.mode === 'tables' && c.types.length === 1 && c.types[0] === '*';
    const ops = allTicked || onlyTimes ? '' : ` (${list.join(', ')})`;
    if (c.mode === 'random') return (fr ? `Au hasard : 0 à ${c.range}` : `Random: 0 to ${c.range}`) + ops;
    if (c.tables.length === 12) return (fr ? 'Toutes les tables' : 'All the tables') + ops;
    if (c.tables.length > 1) return (fr ? `Mélange : ${c.tables.join(', ')}` : `Mix: ${c.tables.join(', ')}`) + ops;
    return (fr ? `Table de ${c.tables[0]}` : `${c.tables[0]} times table`) + ops;
  }
  const short = { dec: fr ? 'Virgules' : 'Decimals' }[c.cat] || categoryName(c.cat, fr);
  return allTicked ? categoryName(c.cat, fr) : `${short} : ${list.join(', ')}`.replace(' : ', fr ? ' : ' : ': ');
}

// For the Endless leaderboard: a short code ("X|ops|t|7,8|*") turned back into
// words in each reader's language (screens/endless.js).
export function choiceCode(choice) {
  const c = normalizeChoice(choice);
  if (c.cat === 'mix') return '';
  return ['X', c.cat, c.mode === 'random' ? `r${c.range}` : `t${c.order === 'ordered' ? 'o' : ''}`, c.tables.join(','), c.types.join(',')].join('|').slice(0, 60);
}
export function choiceFromCode(code) {
  const [x, cat, m = '', tables = '', types = ''] = String(code || '').split('|');
  if (x !== 'X') return null;
  return { cat, mode: m.startsWith('r') ? 'random' : 'tables', range: Number(m.slice(1)) || 100, order: m === 'to' ? 'ordered' : 'random',
    tables: tables ? tables.split(',').map(Number) : [], types: types ? types.split(',') : [] };
}

// ── Questions ───────────────────────────────────────────────────────────────
// "Dans l'ordre": the next step of the table, game after game it restarts.
let _seq = { key: '', n: 0 };
export function resetExerciseSequence() { _seq = { key: '', n: 0 }; }

function square(year) {
  const b = Math.floor(Math.random() * ((year >= 9 ? 15 : 12) - 1)) + 2;
  const q = { text: `${b}² = ?`, answer: b * b, a: b, b: 2, op: '^', steps: [`${b}² = ${b} × ${b}`, `= ${b * b}`], check: `${b}² = ${b * b}` };
  q.choices = mistakeChoices(q, { low: 0, high: Math.max(225, b * b + 20), mistakes: [b * 2, b + 2, b * b + b, (b - 1) * (b - 1)] });
  return q;
}

const SUPS = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', 10: '¹⁰' };
function power(year) {
  const forms = [() => [Math.floor(Math.random() * 4) + 2, 3], () => [2, Math.floor(Math.random() * (year >= 9 ? 7 : 4)) + 4], () => [10, Math.floor(Math.random() * 4) + 2]];
  if (year >= 9) forms.push(() => [3, 4], () => [Math.floor(Math.random() * 3) + 2, 4]);
  const [b, e] = pick(forms)();
  const answer = b ** e;
  const q = { text: `${b}${SUPS[e]} = ?`, answer, a: b, b: e, op: '^', steps: [`${b}${SUPS[e]} = ${Array(e).fill(b).join(' × ')}`, `= ${answer}`], check: `${b}${SUPS[e]} = ${answer}` };
  q.choices = mistakeChoices(q, { low: 0, high: Math.max(answer * 2, 30), mistakes: [b * e, b ** (e - 1), b ** (e + 1), answer + b] });
  return q;
}

const FRACTION_FORMS = year => ({
  of: year < 5 ? ['ofUnit'] : ['of', 'ofUnit'],
  add: year <= 4 ? ['addHalf'] : year <= 6 ? ['addSame'] : year <= 9 ? ['addSame', 'addMultiple'] : ['addMultiple', 'addDiff'],
  equiv: ['equiv'], sub: ['subSame'], simplify: ['simplify'],
  mul: year < 9 ? ['timesInt'] : ['timesInt', 'mulFrac'], div: ['divFrac'],
});
const ALGEBRA_FORMS = year => ({
  one: year >= 8 ? ['add', 'sub', 'mul', 'div'] : ['add', 'sub', 'missingMul'],
  two: year >= 10 ? ['twoStep', 'twoStepMinus', 'paren', 'bothSides'] : ['twoStep', 'twoStepMinus', 'paren'],
});
const pick = list => list[Math.floor(Math.random() * list.length)];

// A question from the player's choice, or null ('mix': the game's own).
export function exerciseQuestion(choice = getExerciseChoice(), year = playerYear()) {
  const c = normalizeChoice(choice, year);
  if (c.cat === 'mix') return null;
  const types = c.types.length ? c.types : typesFor(c.cat, year);
  if (!types.length) return null;
  const y = year || 6;
  const cap = Math.max(100, Number(G.numberRangeMax) || 0);
  const type = pick(types);
  let q = null;
  if (c.cat === 'ops') {
    if (c.mode === 'random') q = randomQuestion(type, c.range);
    else {
      let t, n;
      if (c.order === 'ordered' && c.tables.length === 1) {
        const key = `${c.tables[0]}|${types.join(',')}`;
        if (_seq.key !== key) _seq = { key, n: 0 };
        _seq.n = (_seq.n % 12) + 1;
        t = c.tables[0]; n = _seq.n;
      } else { t = pick(c.tables); n = Math.floor(Math.random() * 12) + 1; }
      q = tableQuestion(type, t, n);
    }
  } else if (c.cat === 'dec') {
    q = makeDecimalQuestion({ ...decimalSettings(G.decimalSettings), ops: types });
  } else if (c.cat === 'frac') {
    q = type === 'compare' ? compareFractionQuestion(y) : makeFractionQuestion(y, cap, FRACTION_FORMS(y)[type]);
  } else if (c.cat === 'pct') {
    q = makePercentQuestion(y, cap, [type]);
  } else if (c.cat === 'exp') {
    q = type === 'squares' ? square(y) : type === 'rules' ? exponentRuleQuestion() : type === 'sci' ? scientificQuestion() : power(y);
  } else if (c.cat === 'alg') {
    q = type === 'subst' ? substituteQuestion(cap) : type === 'expand' ? expandQuestion() : makeSchoolAlgebraQuestion(Math.max(y, 6), cap, ALGEBRA_FORMS(y)[type]);
  }
  if (q) q.exerciseType = `${c.cat}:${type}`;
  return q;
}

// Three example calculations for the picker's live preview.
export function previewExamples(choice, year = playerYear()) {
  const c = normalizeChoice(choice, year);
  if (c.cat === 'mix') return [];
  const saved = _seq;
  _seq = { key: '', n: 0 };
  const out = [];
  for (let i = 0; i < 3; i++) {
    const q = exerciseQuestion(c, year);
    if (q) out.push(q);
  }
  _seq = saved;
  return out;
}
