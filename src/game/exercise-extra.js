// New question kinds for "Mes exercices" (systems/exercise-choice.js):
//   tables       7 × 1 … 7 × 12, 7 + n, (7 + n) − 7, (7 × n) ÷ 7 (never over 12 × 12)
//   random       + − × ÷ with numbers from 0 to a range (10, 20, 50, 100)
//   compare      the bigger of two fractions (3/4 or 2/3?)
//   expRules     x² × x³ = x^?, x⁵ ÷ x² = x^?, (x²)³ = x^?
//   sci          3 000 = 3 × 10^?, 4 × 10³ = ?
//   substitute   if x = 3, 2x + 1 = ?
//   expand       3(x + 2) = 3x + ?, 2x + 5x = ?x
// Every question has the game's usual shape: text, answer, op, a, b,
// choices (the answer and classic mistakes), and for the new kinds a tip and
// the correction steps.
import { mistakeChoices } from './tips.js';

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(list) { return list[rnd(0, list.length - 1)]; }
function shuffle(list) { return [...list].sort(() => Math.random() - 0.5); }
const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = n => String(n).split('').map(d => SUP[d] || d).join('');

function arith(op, a, b, answer, high) {
  const q = { text: `${a} ${SYM[op]} ${b} = ?`, answer, a, b, op };
  q.choices = mistakeChoices(q, { low: 0, high: Math.max(high, answer + 5) });
  return q;
}

// Tables: table t, step n (1 to 12).
//   +  t + n        −  (t + n) − t   (the other way round of +, never below 0)
//   ×  t × n        ÷  (t × n) ÷ t   (the other way round of ×)
export function tableQuestion(op, t, n) {
  if (op === '+') return arith('+', t, n, t + n, 24);
  if (op === '-') return arith('-', t + n, t, n, 24);
  if (op === '/') return arith('/', t * n, t, n, 144);
  return arith('*', t, n, t * n, 144);
}

// Numbers from 0 to `range` (× and ÷ stay in the tables up to 12).
export function randomQuestion(op, range) {
  const R = Math.max(5, range);
  if (op === '+') { const a = rnd(0, R); const b = rnd(0, R - a); return arith('+', a, b, a + b, R); }
  if (op === '-') { const a = rnd(1, R); const b = rnd(0, a); return arith('-', a, b, a - b, R); }
  const top = Math.min(12, R);
  const a = rnd(1, top), b = rnd(1, top);
  if (op === '/') return arith('/', a * b, a, b, Math.max(R, 12));
  return arith('*', a, b, a * b, Math.max(R, a * b));
}

// ── Fractions: compare ──────────────────────────────────────────────────────
const DENS = [2, 3, 4, 5, 6, 8, 10, 12];
function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }
const COMPARE_TIP = {
  fr: 'Même dénominateur : le plus grand numérateur gagne. Sinon, mets-les sur le même dénominateur.',
  en: 'Same denominator: the bigger top wins. Otherwise, give them the same denominator.',
};
export function compareFractionQuestion(year = 5) {
  for (let i = 0; i < 50; i++) {
    const d1 = pick(year >= 7 ? DENS : [2, 4, 8, 10, 3, 6]);
    const d2 = year >= 7 && Math.random() < 0.7 ? pick(DENS) : d1;
    const n1 = rnd(1, d1 - 1), n2 = rnd(1, d2 - 1);
    if (d1 === d2 && n1 === n2) continue;
    const a = `${n1}/${d1}`, b = `${n2}/${d2}`;
    const l = n1 * d2, r = n2 * d1;
    const answer = l === r ? '=' : l > r ? a : b;
    const common = d1 * d2 / gcd(d1, d2);
    const steps = d1 === d2 ? [`${n1} ${n1 > n2 ? '>' : '<'} ${n2}`]
      : [`${a} = ${n1 * common / d1}/${common}`, `${b} = ${n2 * common / d2}/${common}`];
    return {
      text: `${a} ou ${b} : la plus grande ?`, textEn: `${a} or ${b}: which is bigger?`,
      answer, op: 'frac', form: 'compare', a: 0, b: 0, tip: COMPARE_TIP, steps,
      check: answer === '=' ? `${a} = ${b}` : `${answer} > ${answer === a ? b : a}`,
      choices: shuffle([a, b, '=']),
    };
  }
  return compareFractionQuestion(5);
}

// ── Exponents: rules and scientific notation ────────────────────────────────
const RULES_TIP = {
  fr: 'Même base : × on additionne les exposants, ÷ on les soustrait, (aⁿ)ᵐ on les multiplie.',
  en: 'Same base: × add the exponents, ÷ subtract them, (aⁿ)ᵐ multiply them.',
};
export function exponentRuleQuestion() {
  const kind = pick(['mul', 'mul', 'div', 'pow']);
  let m = rnd(2, 6), n = rnd(2, 5), answer, text, mistakes, step;
  if (kind === 'mul') { answer = m + n; text = `x${sup(m)} × x${sup(n)} = x^?`; mistakes = [m * n, Math.abs(m - n), answer + 1]; step = `${m} + ${n} = ${answer}`; }
  else if (kind === 'div') { if (n >= m) [m, n] = [n + 2, m]; answer = m - n; text = `x${sup(m)} ÷ x${sup(n)} = x^?`; mistakes = [m + n, Math.round(m / n), answer + 1]; step = `${m} − ${n} = ${answer}`; }
  else { answer = m * n; text = `(x${sup(m)})${sup(n)} = x^?`; mistakes = [m + n, answer - 1, answer + m]; step = `${m} × ${n} = ${answer}`; }
  const q = { text, answer, op: '^', form: 'rules', a: m, b: n, tip: RULES_TIP, steps: [step], check: text.replace('^?', sup(answer)) };
  q.choices = mistakeChoices(q, { low: 0, high: 60, mistakes });
  return q;
}

const SCI_TIP = {
  fr: '10ⁿ, c’est un 1 suivi de n zéros : compte les zéros (ou les rangs).',
  en: '10ⁿ is a 1 followed by n zeros: count the zeros (or the places).',
};
const spaced = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export function scientificQuestion() {
  const d = rnd(2, 9);
  if (Math.random() < 0.5) {
    const k = rnd(2, 6);
    const big = d * 10 ** k;
    const q = { text: `${spaced(big)} = ${d} × 10^?`, answer: k, op: '^', form: 'sci', a: d, b: k, tip: SCI_TIP,
      steps: [`${spaced(big)} = ${d} × ${spaced(10 ** k)}`, `${spaced(10 ** k)} = 10${sup(k)}`], check: `${spaced(big)} = ${d} × 10${sup(k)}` };
    q.choices = mistakeChoices(q, { low: 1, high: 9, mistakes: [k + 1, k - 1, String(big).length] });
    return q;
  }
  const k = rnd(1, 4);
  const answer = d * 10 ** k;
  const q = { text: `${d} × 10${sup(k)} = ?`, answer, op: '^', form: 'sci', a: d, b: k, tip: SCI_TIP,
    steps: [`10${sup(k)} = ${spaced(10 ** k)}`, `${d} × ${spaced(10 ** k)} = ${spaced(answer)}`], check: `${d} × 10${sup(k)} = ${spaced(answer)}` };
  const set = new Set([answer]);
  for (const v of [d * 10 ** (k + 1), d * 10 ** (k - 1), (d + 1) * 10 ** k, d * k * 10, answer + d, answer * 2]) if (set.size < 4 && v > 0) set.add(v);
  q.choices = shuffle([...set]);
  return q;
}

// ── Algebra: substitute, expand and simplify ────────────────────────────────
const SUBST_TIP = { fr: 'Remplace x par sa valeur, puis calcule (× avant +).', en: 'Put the value in place of x, then work it out (× before +).' };
export function substituteQuestion(limit = 100) {
  for (let i = 0; i < 40; i++) {
    const x = rnd(1, 9), a = rnd(2, 9), b = rnd(1, 15);
    const minus = Math.random() < 0.35 && a * x > b;
    const answer = minus ? a * x - b : a * x + b;
    if (answer > Math.max(limit, 30)) continue;
    const expr = `${a}x ${minus ? '−' : '+'} ${b}`;
    const q = { text: `Si x = ${x}, ${expr} = ?`, textEn: `If x = ${x}, ${expr} = ?`, answer, op: 'alg', form: 'substitute', a: answer, b: 0,
      tip: SUBST_TIP, steps: [`${a} × ${x} = ${a * x}`, `${a * x} ${minus ? '−' : '+'} ${b} = ${answer}`], check: `${a} × ${x} ${minus ? '−' : '+'} ${b} = ${answer}` };
    q.choices = mistakeChoices(q, { low: 0, high: Math.max(limit, answer + 10), mistakes: [a + x + (minus ? -b : b), Number(`${a}${x}`) + (minus ? -b : b), minus ? a * x + b : a * x - b] });
    return q;
  }
  return substituteQuestion(100);
}

const EXPAND_TIP = {
  fr: 'Développer : le nombre devant multiplie chaque terme. Réduire : on additionne les x ensemble.',
  en: 'Expand: the number in front multiplies each term. Simplify: add the x terms together.',
};
export function expandQuestion() {
  const kind = pick(['expand', 'expand', 'expandMinus', 'collect']);
  if (kind === 'collect') {
    const a = rnd(2, 9), b = rnd(2, 9), minus = Math.random() < 0.3 && a > b;
    const answer = minus ? a - b : a + b;
    const q = { text: `${a}x ${minus ? '−' : '+'} ${b}x = ?x`, answer, op: 'alg', form: 'expand', a: answer, b: 0, tip: EXPAND_TIP,
      steps: [`${a} ${minus ? '−' : '+'} ${b} = ${answer}`], check: `${a}x ${minus ? '−' : '+'} ${b}x = ${answer}x` };
    q.choices = mistakeChoices(q, { low: 0, high: 40, mistakes: [a * b, minus ? a + b : Math.abs(a - b), answer + 1] });
    return q;
  }
  const k = rnd(2, 9), c = rnd(1, 9), minus = kind === 'expandMinus';
  const answer = k * c;
  const q = { text: `${k}(x ${minus ? '−' : '+'} ${c}) = ${k}x ${minus ? '−' : '+'} ?`, answer, op: 'alg', form: 'expand', a: answer, b: 0, tip: EXPAND_TIP,
    steps: [`${k} × x = ${k}x`, `${k} × ${c} = ${answer}`], check: `${k}(x ${minus ? '−' : '+'} ${c}) = ${k}x ${minus ? '−' : '+'} ${answer}` };
  q.choices = mistakeChoices(q, { low: 0, high: 100, mistakes: [c, k + c, answer + k] });
  return q;
}
