// Negative numbers, for mental math. Never before CM2 (school year 5).
//   5-6  CM2, 6e   first meetings, "thermometer": 3 − 5, −2 + 6
//   7+   5e ...    sign rules: −4 + 7, −6 − 2, −4 × 3, −12 ÷ 4, −3 × (−5)
// `limit` is the player's number range: with negatives "0 - 100" becomes
// −100 ... 100, and every number of the question and the answer stays in it
// (× keeps its factors in the range, like the other × questions).
// Each question carries a one-line tip, the solving steps and the check for
// the correction (game.js buildClearCorrectionSteps), and wrong choices made
// from classic sign mistakes.

export const NEGATIVES_FROM_SCHOOL_YEAR = 5;
export const SIGN_RULES_FROM_SCHOOL_YEAR = 7;

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(list) { return list[rnd(0, list.length - 1)]; }

// Display: a real minus sign (−, wider than "-"), and negative second
// numbers in brackets: −3 × (−5).
export function fmt(n) { return n < 0 ? `−${-n}` : String(n); }
function par(n) { return n < 0 ? `(${fmt(n)})` : fmt(n); }

const TIPS = {
  thermo: { fr: 'Imagine un thermomètre : + monte, − descend.', en: 'Picture a thermometer: + goes up, − goes down.' },
  signs: { fr: 'Deux signes pareils donnent +, deux signes différents donnent −.', en: 'Same signs give +, different signs give −.' },
};

// A nonzero whole number with |n| <= max, often friendly in big ranges.
function magnitude(lo, max) {
  const hi = Math.max(lo, max);
  if (hi > 100) return pick([...Array(Math.floor(hi / 10)).keys()].map(i => (i + 1) * 10).filter(v => v >= lo)) ?? lo;
  return rnd(lo, hi);
}
const signed = (lo, max) => (Math.random() < 0.5 ? -1 : 1) * magnitude(lo, max);

// Wrong choices from classic sign mistakes, inside the range when possible.
export function signChoices(answer, mistakes, limit) {
  const set = new Set([answer]);
  for (const c of mistakes) {
    if (set.size >= 4) break;
    if (Number.isInteger(c) && Math.abs(c) <= limit && !set.has(c)) set.add(c);
  }
  for (const off of [1, -1, 2, -2, 3, -3, 5, -5, 10, -10]) {
    if (set.size >= 4) break;
    const c = answer + off;
    if (Math.abs(c) <= limit && !set.has(c)) set.add(c);
  }
  for (let k = 11; set.size < 4; k++) set.add(answer + k);
  return [...set].sort(() => Math.random() - 0.5);
}

function build(op, a, b, answer, tip, steps, check, mistakes, limit) {
  const sym = { '+': '+', '-': '−', '*': '×', '/': '÷' }[op];
  return {
    text: `${fmt(a)} ${sym} ${par(b)} = ?`, answer, a, b, op, negative: true, tip, steps, check,
    nums: [a, b, answer], choices: signChoices(answer, mistakes, limit),
  };
}

// Thermometer (CM2, 6e): small numbers, + and − only, answer may go below 0.
function thermometer(L) {
  const M = Math.min(L, 20);
  if (Math.random() < 0.5) {
    const a = rnd(0, Math.max(1, M - 1)); const b = rnd(a + 1, M);       // 3 − 5
    return build('-', a, b, a - b, TIPS.thermo,
      [`${fmt(a)} − ${a} = 0`, `0 − ${b - a} = ${fmt(a - b)}`], `${fmt(a - b)} + ${b} = ${a}`,
      [b - a, a + b, -(a + b)], L);
  }
  const a = -rnd(1, M); const b = rnd(1, M);                                // −2 + 6
  return build('+', a, b, a + b, TIPS.thermo,
    a + b >= 0 ? [`${fmt(a)} + ${-a} = 0`, `0 + ${a + b} = ${fmt(a + b)}`] : [`${fmt(a)} + ${b} → ${fmt(a + b)}`],
    `${fmt(a + b)} − ${b} = ${fmt(a)}`, [-(a + b), b - a, a - b], L);
}

const SIGN_FORMS = {
  add(L, mins) {
    const a = signed(mins, L); const b = signed(mins, L); const r = a + b;
    return build('+', a, b, r, TIPS.signs,
      [Math.sign(a) === Math.sign(b) ? `${Math.abs(a)} + ${Math.abs(b)} = ${Math.abs(r)}`
        : `${Math.max(Math.abs(a), Math.abs(b))} − ${Math.min(Math.abs(a), Math.abs(b))} = ${Math.abs(r)}`,
       `→ ${fmt(r)}`], `${fmt(r)} − ${par(b)} = ${fmt(a)}`, [-r, a - b, b - a], L);
  },
  sub(L, mins) {
    const a = signed(mins, L); const b = signed(mins, L); const r = a - b;
    return build('-', a, b, r, TIPS.signs,
      [`${fmt(a)} − ${par(b)} = ${fmt(a)} + ${par(-b)}`, `= ${fmt(r)}`],
      `${fmt(r)} + ${par(b)} = ${fmt(a)}`, [-r, a + b, -(a + b)], L);
  },
  mul(L, mins, mCap) {
    const t = Math.max(2, Math.min(mCap, L));
    const a = (Math.random() < 0.6 ? -1 : 1) * rnd(2, t); const b = (a > 0 || Math.random() < 0.5 ? -1 : 1) * rnd(2, t); const r = a * b;
    return build('*', a, b, r, TIPS.signs,
      [`${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(r)}`, `${Math.sign(a) === Math.sign(b) ? '(− × −) → +' : '(+ × −) → −'}  ${fmt(r)}`],
      `${fmt(r)} ÷ ${par(b)} = ${fmt(a)}`, [-r, a + b, -(a + b)], Math.max(L, Math.abs(r)));
  },
  div(L, mins, mCap) {
    const t = Math.max(2, Math.min(mCap, L));
    const b = (Math.random() < 0.5 ? -1 : 1) * rnd(2, t); const r = (b > 0 || Math.random() < 0.5 ? -1 : 1) * rnd(2, t); const a = b * r;
    return build('/', a, b, r, TIPS.signs,
      [`${Math.abs(a)} ÷ ${Math.abs(b)} = ${Math.abs(r)}`, `${Math.sign(a) === Math.sign(b) ? '(− ÷ −) → +' : '(+ ÷ −) → −'}  ${fmt(r)}`],
      `${fmt(r)} × ${par(b)} = ${fmt(a)}`, [-r, r + 1, -(r + 1)], Math.max(L, Math.abs(a)));
  },
};

// Mental-math check: at least one negative number, whole numbers,
// everything inside −limit ... limit (× and ÷: factors / divisor and
// quotient in the tables).
function ok(q, limit) {
  if (!Number.isInteger(q.answer)) return false;
  if (q.a >= 0 && q.b >= 0 && q.answer >= 0) return false;
  const bound = q.op === '*' ? Infinity : limit;
  if (q.op === '/') return Math.abs(q.b) <= 12 && Math.abs(q.answer) <= 12;
  return q.nums.every(n => Number.isInteger(n) && Math.abs(n) <= bound);
}

// op: '+', '-', '*', '/', the topic the question stays in (× ÷ only from
// 5e). mins: smallest size of + − numbers.
export function makeNegativeQuestion(year, limit, op, { mins = 1, mCap = 10 } = {}) {
  const L = Math.max(10, limit);
  for (let i = 0; i < 60; i++) {
    let q;
    if (year < SIGN_RULES_FROM_SCHOOL_YEAR) {
      q = thermometer(L);
      if (q.op !== op) continue;
    } else {
      const form = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div' }[op];
      q = SIGN_FORMS[form](L, Math.max(1, Math.min(mins, Math.floor(L / 4))), mCap);
    }
    if (ok(q, L)) return q;
  }
  return null;   // nothing fitting: the caller asks a plain question
}
