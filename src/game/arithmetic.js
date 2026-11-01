// + − × ÷ and exponent questions by SCHOOL YEAR, for mental math (about 10
// seconds, no paper). Used by systems/school-questions.js for the levels.
//  - The number range chosen by the player (plan.cap: "0 - 100") holds every
//    number of + − (question and answer); × ÷ keep their factors / divisor
//    and quotient in the times tables (option A).
//  - Friendly numbers: in big ranges one number of + − is a multiple of 10;
//    × ÷ stay in the tables, or use friendly factors (25 × 4, 15 × 6,
//    120 ÷ 4); no remainder.
//  - From 6e with a small range (up to 20): half of + − use simple decimals
//    (2.5 + 1.5), so older players do not get primary-school sums. Decimals
//    are halves (quarters from 3e), always exact.
//  - Exponent: squares (CE2-CM2), then cubes (6e-5e), powers of 2 and 10
//    (4e-3e), bigger squares and powers (lycée); the answer stays in the
//    range when one is chosen.
// Every question goes through mentalOk; anything too hard is drawn again.

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(list) { return list[rnd(0, list.length - 1)]; }
const round2 = n => Math.round(n * 100) / 100;
const SUPERSCRIPT = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', 10: '¹⁰' };

// Decimal numbers are written with "." here; game.js shows "," in French.
function question(op, a, b, answer, extra = {}) {
  const sym = { '+': '+', '-': '−', '*': '×', '/': '÷' }[op];
  return { text: `${a} ${sym} ${b} = ?`, answer: round2(answer), a, b, op,
    ...(extra.steps ? { check: `${a} ${sym} ${b} = ${round2(answer)}` } : {}), ...extra };
}

// Wrong choices close to the answer, inside the range when possible.
function choicesFor(answer, cap) {
  const step = Number.isInteger(answer) ? 1 : 0.5;
  const set = new Set([answer]);
  const offs = [1, -1, 2, -2, 3, -3, 10, -10, 5, -5].map(k => k * step).sort(() => Math.random() - 0.5);
  for (const off of offs) {
    if (set.size >= 4) break;
    const c = round2(answer + off);
    if (c >= 0 && c <= Math.max(cap, answer + 3) && !set.has(c)) set.add(c);
  }
  for (let k = 4; set.size < 4; k++) set.add(round2(answer + k * step));
  return [...set].sort(() => Math.random() - 0.5);
}

// A whole number from lo to hi; over 100, often a multiple of 10.
function friendly(lo, hi, tens) {
  if (tens && hi >= 20) {
    const options = [];
    for (let v = Math.ceil(lo / 10) * 10; v <= hi; v += 10) options.push(v);
    if (options.length) return pick(options);
  }
  return rnd(lo, Math.max(lo, hi));
}

const FORMS = {
  '+'(p) {
    if (p.decimals && Math.random() < 0.5) {
      const unit = p.year >= 9 ? 0.25 : 0.5;
      const max = Math.floor(p.cap / unit);
      const s = rnd(2, max); const x = rnd(1, s - 1);
      const a = x * unit; const b = (s - x) * unit;
      return question('+', a, b, a + b, { decimal: true,
        steps: [`${Math.floor(a)} + ${Math.floor(b)} = ${Math.floor(a) + Math.floor(b)}`, `${round2(a % 1)} + ${round2(b % 1)} = ${round2(a % 1 + b % 1)}`, `→ ${round2(a + b)}`] });
    }
    // Pick the sum first (inside the range), then split it: no "88 + 0".
    const lo = Math.max(p.cap > 10 ? 1 : 0, Math.min(p.minAdd, Math.floor(p.cap / 4)));
    const sum = rnd(Math.max(2, 2 * lo), p.cap);
    const b = friendly(lo, Math.max(lo, sum - lo), p.cap > 100);
    return question('+', sum - b, b, sum);
  },
  '-'(p) {
    if (p.decimals && Math.random() < 0.5) {
      const unit = p.year >= 9 ? 0.25 : 0.5;
      const max = Math.floor(p.cap / unit);
      const x = rnd(2, max); const y = rnd(1, x - 1);
      const a = x * unit; const b = y * unit;
      return question('-', a, b, a - b, { decimal: true,
        steps: [`${a} − ${Math.floor(b)} = ${round2(a - Math.floor(b))}`, `${round2(a - Math.floor(b))} − ${round2(b % 1)} = ${round2(a - b)}`] });
    }
    const lo = Math.max(p.cap > 10 ? 1 : 0, Math.min(p.minAdd, Math.floor(p.cap / 4)));
    const a = rnd(Math.max(1, lo), p.cap);
    const b = friendly(Math.min(lo, a), a, p.cap > 100);
    return question('-', a, b, a - b);
  },
  '*'(p) {
    // Friendly factors from 6e: 25 × 4, 15 × 6, 12 × 5; lycée with a small
    // range: halves (0.5 × 18).
    if (p.year >= 10 && p.cap <= 20 && Math.random() < 0.3) {
      const n = 2 * rnd(1, Math.floor(p.cap / 2));
      return question('*', 0.5, n, n / 2, { decimal: true, steps: [`0.5 × ${n} = ${n} ÷ 2`, `= ${n / 2}`] });
    }
    if (p.year >= 6 && Math.random() < 0.3) {
      const a = pick([11, 12, 15, 20, 25, 50].filter(v => v <= Math.max(p.cap, 12)));
      if (a) return question('*', a, rnd(2, 9), 0);
    }
    const a = rnd(Math.min(p.tableMin, p.mCap), p.mCap); const b = rnd(2, p.mCap);
    return question('*', a, b, a * b);
  },
  '/'(p) {
    if (p.year >= 6 && p.cap >= 100 && Math.random() < 0.3) {
      const b = pick([2, 4, 5]); const q = 10 * rnd(1, Math.max(1, Math.floor(p.cap / (10 * b))));
      return question('/', b * q, b, q);
    }
    const b = rnd(Math.min(p.tableMin, p.mCap), p.mCap); const q = rnd(Math.max(1, p.tableMin - 1), p.mCap);
    return question('/', b * q, b, q);
  },
};

// Too hard for 10 seconds of mental math, or outside the range: false.
export function mentalOk(q, p) {
  if (Math.abs(q.answer * 100 - Math.round(q.answer * 100)) > 1e-9) return false;   // 2 decimals max
  if (q.op === '+' || q.op === '-') {
    return [q.a, q.b, q.answer].every(n => n >= 0 && n <= p.cap);
  }
  if (q.op === '*') {
    if (q.a === 0.5) return q.b <= p.cap;                                            // half of a number
    const easy = v => v <= 10 || [11, 12, 15, 20, 25, 50].includes(v);
    return easy(q.a) && (q.b <= 10 || easy(q.b)) && !(q.a > 12 && q.b > 12);
  }
  if (q.op === '/') {
    if (!Number.isInteger(q.answer)) return false;                                  // no remainder
    if ([2, 4, 5, 10].includes(q.b) && q.answer % 10 === 0) return q.a <= Math.max(p.cap, 100);
    return q.b <= 12 && q.answer <= 12;
  }
  return true;
}

export function makeSchoolArithmetic(op, plan) {
  const p = {
    year: plan.year, cap: plan.cap, mCap: plan.mCap, minAdd: plan.mins.add, tableMin: plan.mins.table,
    decimals: plan.year >= 6 && plan.cap <= 20,
  };
  for (let i = 0; i < 60; i++) {
    const q = FORMS[op](p);
    if (op === '*') q.answer = round2(q.a * q.b);
    if (mentalOk(q, p)) return { ...q, choices: choicesFor(q.answer, op === '+' || op === '-' ? p.cap : Infinity) };
  }
  const a = Math.min(2, p.cap); const q = question(op === '-' ? '+' : op, a, 1, op === '*' ? a : op === '/' ? a : a + 1);
  return { ...q, op, choices: choicesFor(q.answer, p.cap) };
}

// Exponent: base and power by school year; answer <= limit when a range is
// chosen (so "0 - 10" keeps 2², 3², 2³).
export function makeSchoolExponent(year, limit) {
  const forms = [];
  const sq = max => () => { const b = rnd(2, max); return [b, 2]; };
  if (year <= 3) forms.push(sq(5));
  else if (year <= 5) forms.push(sq(10));
  else if (year <= 7) forms.push(sq(12), sq(12), () => [rnd(2, 5), 3]);
  else if (year <= 9) forms.push(sq(12), () => [rnd(2, 5), 3], () => [2, rnd(4, 8)], () => [10, rnd(2, 4)]);
  else forms.push(sq(15), () => [rnd(2, 6), 3], () => [2, rnd(5, 10)], () => [10, rnd(2, 6)], () => [3, 4]);
  for (let i = 0; i < 60; i++) {
    const [base, exp] = pick(forms)();
    const answer = base ** exp;
    if (answer <= Math.max(limit, 4)) {
      return { text: `${base}${SUPERSCRIPT[exp]} = ?`, answer, a: base, b: exp, op: '^', choices: choicesFor(answer, limit),
        steps: [`${base}${SUPERSCRIPT[exp]} = ${Array(exp).fill(base).join(' × ')}`, `= ${answer}`], check: `${base}${SUPERSCRIPT[exp]} = ${answer}` };
    }
  }
  return { text: '2² = ?', answer: 4, a: 2, b: 2, op: '^', choices: choicesFor(4, limit), steps: ['2² = 2 × 2', '= 4'] };
}
