// Algebra questions by SCHOOL YEAR (6e = 6 ... Terminale = 12), for mental
// math: whole-number answers, at most two steps, friendly coefficients.
// `limit` is the number range the player chose ("0 - 100"): every number in
// the question and the answer stays at or under it; the school year only
// picks the kind of equation. Each question also carries `steps`: the short
// solution shown in the correction (game.js buildClearCorrectionSteps).
//
//   6  6e         missing number      □ + 7 = 15, □ × 6 = 42
//   7  5e         one step + −        x + 12 = 30, x − 8 = 15
//   8  4e         one step × ÷, ax+b  4x = 28, x ÷ 3 = 6, 2x + 3 = 11
//   9  3e         two steps           3x − 4 = 11, 2(x + 3) = 14
//  10  Seconde    x on both sides     3x + 5 = x + 13, a(x + b) = c
//  11  Première   fractions, inequalities  x/4 + 3 = 8, (2/3)x = 10, 2x + 3 < 11 → x < ?
//  12  Terminale  mix of 10 and 11

import { fmt, SIGN_RULES_FROM_SCHOOL_YEAR } from './negatives.js';
import { mistakeChoices, ALGEBRA_TIPS, ALGEBRA_FORM_TIP } from './tips.js';

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(list) { return list[rnd(0, list.length - 1)]; }

// Biggest x for a range: small in small ranges, never above 20 (mental math);
// in big ranges (over 100) constants become multiples of 10.
function xMax(limit) { return Math.max(3, Math.min(20, Math.floor(limit / 2))); }
function constant(lo, hi, limit) {
  if (limit > 100 && hi >= 20) return pick([...Array(Math.floor(hi / 10)).keys()].map(i => (i + 1) * 10).filter(v => v >= lo)) ?? lo;
  return rnd(lo, Math.max(lo, hi));
}

const FORMS = {
  missingAdd(L) {
    const x = rnd(1, Math.min(L - 1, 50)); const a = constant(1, L - x, L);
    return { text: `□ + ${a} = ${x + a}, □ = ?`, answer: x, nums: [a, x + a], steps: [`□ = ${x + a} − ${a}`, `□ = ${x}`] };
  },
  missingSub(L) {
    const a = constant(1, Math.floor(L / 2), L); const r = rnd(0, L - a);
    return { text: `□ − ${a} = ${r}, □ = ?`, answer: r + a, nums: [a, r], steps: [`□ = ${r} + ${a}`, `□ = ${r + a}`] };
  },
  missingMul(L) {
    const a = rnd(2, 10); const x = rnd(1, Math.max(1, Math.min(10, Math.floor(L / a))));
    return { text: `${a} × □ = ${a * x}, □ = ?`, answer: x, nums: [a, a * x], div: [a, x], steps: [`□ = ${a * x} ÷ ${a}`, `□ = ${x}`] };
  },
  add(L) {
    const x = rnd(1, Math.min(L - 1, 50)); const a = constant(1, L - x, L);
    return { text: `x + ${a} = ${x + a}, x = ?`, answer: x, nums: [a, x + a], steps: [`x = ${x + a} − ${a}`, `x = ${x}`] };
  },
  sub(L) {
    const a = constant(1, Math.floor(L / 2), L); const r = rnd(1, L - a);
    return { text: `x − ${a} = ${r}, x = ?`, answer: r + a, nums: [a, r], steps: [`x = ${r} + ${a}`, `x = ${r + a}`] };
  },
  mul(L) {
    const a = pick([2, 3, 4, 5, 6, 10]); const x = rnd(1, Math.max(1, Math.min(xMax(L), Math.floor(L / a))));
    return { text: `${a}x = ${a * x}, x = ?`, answer: x, nums: [a, a * x], div: [a, x], steps: [`x = ${a * x} ÷ ${a}`, `x = ${x}`] };
  },
  div(L) {
    const a = pick([2, 3, 4, 5, 10]); const r = rnd(1, Math.max(1, Math.min(xMax(L), Math.floor(L / a))));
    return { text: `x ÷ ${a} = ${r}, x = ?`, answer: r * a, nums: [a, r], steps: [`x = ${r} × ${a}`, `x = ${r * a}`] };
  },
  // ax + b = c
  twoStep(L) {
    const a = pick([2, 3, 4, 5, 10]); const x = rnd(1, xMax(L)); const b = constant(1, Math.max(1, L - a * x), L);
    return { text: `${a}x + ${b} = ${a * x + b}, x = ?`, answer: x, nums: [a, b, a * x + b], div: [a, x],
      steps: [`${a}x = ${a * x + b} − ${b} = ${a * x}`, `x = ${a * x} ÷ ${a} = ${x}`] };
  },
  // ax − b = c
  twoStepMinus(L) {
    const a = pick([2, 3, 4, 5, 10]); const x = rnd(1, xMax(L)); const b = rnd(1, Math.max(1, Math.min(a * x - 1, 20)));
    return { text: `${a}x − ${b} = ${a * x - b}, x = ?`, answer: x, nums: [a, b, a * x - b, a * x], div: [a, x],
      steps: [`${a}x = ${a * x - b} + ${b} = ${a * x}`, `x = ${a * x} ÷ ${a} = ${x}`] };
  },
  // a(x + b) = c
  paren(L) {
    const a = pick([2, 3, 4, 5]); const x = rnd(1, xMax(L)); const b = rnd(1, Math.max(1, Math.min(10, Math.floor(L / a) - x)));
    return { text: `${a}(x + ${b}) = ${a * (x + b)}, x = ?`, answer: x, nums: [a, b, a * (x + b)], div: [a, x + b],
      steps: [`x + ${b} = ${a * (x + b)} ÷ ${a} = ${x + b}`, `x = ${x + b} − ${b} = ${x}`] };
  },
  // ax + b = cx + d (a > c)
  bothSides(L) {
    const c = rnd(1, 3); const k = pick([1, 2, 3, 4]); const a = c + k; const x = rnd(1, xMax(L));
    const b = rnd(1, Math.max(1, Math.min(20, L - a * x))); const d = b + k * x;
    const cx = c === 1 ? 'x' : `${c}x`;
    return { text: `${a}x + ${b} = ${cx} + ${d}, x = ?`, answer: x, nums: [a, b, c, d, a * x + b], div: [k, x],
      steps: k === 1 ? [`${a}x − ${cx} = ${d} − ${b}`, `x = ${x}`]
        : [`${a}x − ${cx} = ${d} − ${b}  →  ${k}x = ${d - b}`, `x = ${d - b} ÷ ${k} = ${x}`] };
  },
  // x/a + b = c
  fractionPlus(L) {
    const a = pick([2, 3, 4, 5, 10]); const r = rnd(1, Math.max(1, Math.min(10, Math.floor(L / a)))); const b = rnd(1, Math.max(1, Math.min(20, L - r)));
    return { text: `x/${a} + ${b} = ${r + b}, x = ?`, answer: r * a, nums: [a, b, r + b, r * a],
      steps: [`x/${a} = ${r + b} − ${b} = ${r}`, `x = ${r} × ${a} = ${r * a}`] };
  },
  // (p/q)x = r
  fractionTimes(L) {
    const [p, q] = pick([[1, 2], [1, 3], [2, 3], [3, 4], [1, 4], [2, 5]]); const m = rnd(1, Math.max(1, Math.min(10, Math.floor(L / q))));
    const x = q * m; const r = p * m;
    return { text: `(${p}/${q})x = ${r}, x = ?`, answer: x, nums: [p, q, r, x], div: [p, x],
      steps: p === 1 ? [`x = ${r} × ${q}`, `x = ${x}`] : [`x = ${r} × ${q} ÷ ${p}`, `x = ${r * q} ÷ ${p} = ${x}`] };
  },
  // Negative solution (5e and up): x + a = b with b < a, e.g. x + 7 = 2.
  addNeg(L) {
    const x = -rnd(1, Math.min(xMax(L), 10)); const a = rnd(-x + 1, Math.min(L, -x + 20));
    return { text: `x + ${a} = ${x + a}, x = ?`, answer: x, nums: [a, x + a], negative: true,
      steps: [`x = ${x + a} − ${a}`, `x = ${fmt(x)}`] };
  },
  // Negative solution, two steps (3e and up): ax + b = c, e.g. 2x + 10 = 4.
  twoStepNeg(L) {
    const a = pick([2, 3, 4, 5]); const x = -rnd(1, Math.min(xMax(L), 6)); const b = rnd(1, Math.min(L, 20)); const c = a * x + b;
    return { text: `${a}x + ${b} = ${fmt(c)}, x = ?`, answer: x, nums: [a, b, c, a * x], negative: true, div: [a, x],
      steps: [`${a}x = ${fmt(c)} − ${b} = ${fmt(a * x)}`, `x = ${fmt(a * x)} ÷ ${a} = ${fmt(x)}`] };
  },
  // ax + b < c → x < ? (answer: the bound)
  inequality(L) {
    const a = pick([2, 3, 4, 5]); const k = rnd(2, xMax(L)); const b = rnd(1, Math.max(1, Math.min(20, L - a * k)));
    const sign = pick(['<', '>']);
    return { text: `${a}x + ${b} ${sign} ${a * k + b}, x ${sign} ?`, answer: k, nums: [a, b, a * k + b], div: [a, k],
      steps: [`${a}x ${sign} ${a * k + b} − ${b} = ${a * k}`, `x ${sign} ${a * k} ÷ ${a} = ${k}`] };
  },
};

// Classic mistakes of each kind of equation (wrong choices), from its
// numbers (q.nums, in the order of the form above) and its answer x.
// Wrong inverse operation, forgotten step, sign forgotten, off by one.
const MISTAKES = {
  missingAdd: ([a, c], x) => [c + a, x + 1, x - 1],
  add: ([a, c], x) => [c + a, x + 1, x - 1],
  missingSub: ([a, r], x) => [r - a, r, x + 1, x - 1],
  sub: ([a, r], x) => [r - a, r, x + 1, x - 1],
  missingMul: ([a, c], x) => [c - a, c, x + 1, x - 1],
  mul: ([a, c], x) => [c - a, c, x + 1, x - 1],
  div: ([a, r], x) => [r, r + a, x - a, x + a],
  twoStep: ([a, b, c], x) => [(c + b) / a, c - b, x + 1, x - 1],
  twoStepMinus: ([a, b, c], x) => [(c - b) / a, c + b, x + 1, x - 1],
  paren: ([a, b, c], x) => [c / a + b, c / a, (c - b) / a, x + 1],
  bothSides: ([a, b, c, d], x) => [(d - b) / (a + c), d - b, (d + b) / (a - c), x + 1],
  fractionPlus: ([a, b, c], x) => [c - b, c * a - b, (c + b) * a, x + a],
  fractionTimes: ([p, q, r], x) => [r * p / q, p === 1 ? r : r * q, r, x + q],
  addNeg: ([a, c], x) => [-x, c + a, x + 1, x - 1],
  twoStepNeg: ([a, b, c], x) => [-x, (c + b) / a, c - b, x + 1],
  inequality: ([a, b, c], k) => [(c + b) / a, c - b, k + 1, k - 1],
};

const YEAR_FORMS = {
  6: ['missingAdd', 'missingSub', 'missingMul'],
  7: ['add', 'sub', 'add', 'sub', 'missingMul', 'addNeg'],
  8: ['mul', 'div', 'twoStep', 'addNeg'],
  9: ['twoStep', 'twoStepMinus', 'paren', 'twoStepNeg'],
  10: ['bothSides', 'bothSides', 'paren', 'twoStepMinus', 'twoStepNeg'],
  11: ['fractionPlus', 'fractionTimes', 'inequality', 'bothSides', 'twoStepNeg'],
  12: ['bothSides', 'fractionPlus', 'fractionTimes', 'inequality', 'paren', 'twoStepNeg'],
};

// Mental-math check: whole answer, every number in range (−limit ... limit
// for the negative forms), and the division step stays in the times tables
// (÷ 3, 4, 6... only up to 12; ÷ 2, 5, 10 up to 20).
export function algebraQuestionOk(q, limit) {
  const low = q.negative ? -limit : 0;
  if (!Number.isInteger(q.answer) || q.answer < low || q.answer > limit) return false;
  if (q.div) {
    const [by, result] = q.div;
    if (Math.abs(result) > ([1, 2, 5, 10].includes(by) ? 20 : 12)) return false;
  }
  return q.nums.every(n => Number.isInteger(n) && n >= low && n <= limit);
}

// The equation with x replaced by the answer ("3 × 4 + 5 = 4 + 13"), shown
// as the check of the correction. Inequalities just restate the bound.
function checkLine(q) {
  const eq = q.text.split(', ')[0];
  if (/[<>]/.test(eq)) return q.text.replace('?', q.answer);
  const v = q.answer < 0 ? `(${fmt(q.answer)})` : String(q.answer);
  return eq.replace(/(\d|\))x/g, `$1 × ${v}`).replace(/[x□]/g, fmt(q.answer));
}

// Check line, one-line tip (game/tips.js) and wrong choices from the classic
// mistakes of the form; negative answers start with the sign mistake (−5 → 5).
function finish(q, L, form) {
  const out = { ...q, form, check: checkLine(q), op: 'alg', a: q.answer, b: 0, tip: ALGEBRA_TIPS[ALGEBRA_FORM_TIP[form]] };
  out.choices = mistakeChoices(out, { low: q.negative ? -L : 0, high: L, mistakes: MISTAKES[form](q.nums, q.answer) });
  return out;
}

export function makeSchoolAlgebraQuestion(year, limit) {
  const forms = YEAR_FORMS[Math.max(6, Math.min(12, year))]
    .filter(f => year >= SIGN_RULES_FROM_SCHOOL_YEAR || !f.endsWith('Neg'));
  const L = Math.max(10, limit);
  for (let i = 0; i < 60; i++) {
    const form = pick(forms);
    const q = FORMS[form](L);
    if (algebraQuestionOk(q, L)) return finish(q, L, form);
  }
  // Very small range: the year's first form with its smallest numbers.
  return finish(FORMS[forms[0]](L), L, forms[0]);
}
