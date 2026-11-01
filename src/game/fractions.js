// Fractions, for mental math (about 10 seconds), by SCHOOL YEAR. Small
// denominators only (2, 3, 4, 5, 6, 8, 10, 12), whole numbers in the range
// the player chose, answers as a whole number or a simple fraction ("5/7").
// Each question carries a one-line tip, the calculation lines of the
// correction, and wrong choices made from classic mistakes (adding the
// denominators: 2/7 + 3/7 → 5/14).
//
//   CP-CM1    unit fraction of a number     1/4 de 12, 1/2 + 1/2
//   CM2-6e    fraction of a number, same denominator, equal fractions
//             3/4 de 20, 2/7 + 3/7, 1/2 = ?/10
//   5e-3e     one denominator a multiple of the other, fraction × number,
//             simplify        1/2 + 1/4, 2/3 × 12, 6/8 = ?/4
//   lycée     fraction × fraction, ÷ fraction, different denominators
//             2/3 × 3/4, 1/2 ÷ 1/4, 1/3 + 1/4

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(list) { return list[rnd(0, list.length - 1)]; }
function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }

// "6/8" → "3/4", "4/4" → "1"
export function fracText(n, d) {
  const g = gcd(n, d); n /= g; d /= g;
  return d === 1 ? String(n) : `${n}/${d}`;
}
// n ÷ d stays in the tables (up to 12), or is a round number in big ranges
// (3/4 de 80), so the division is easy.
function quotient(d, L) {
  if (L >= 100 && Math.random() < 0.3 && L >= 10 * d) return 10 * rnd(1, Math.min(5, Math.floor(L / (10 * d))));
  return rnd(1, Math.max(1, Math.min(12, Math.floor(L / d))));
}
const SMALL_DEN = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const value = c => (typeof c === 'string' && c.includes('/') ? Number(c.split('/')[0]) / Number(c.split('/')[1]) : Number(c));

export const FRACTION_TIPS = {
  of: { fr: 'Fraction d\'un nombre : divise par le bas, puis multiplie par le haut.', en: 'Fraction of a number: divide by the bottom, then multiply by the top.' },
  same: { fr: 'Même dénominateur : on calcule les numérateurs, le dénominateur ne bouge pas.', en: 'Same denominator: work out the tops, the bottom stays.' },
  diff: { fr: 'Mets d\'abord le même dénominateur.', en: 'First give them the same denominator.' },
  equal: { fr: 'Multiplie (ou divise) le haut et le bas par le même nombre.', en: 'Multiply (or divide) the top and the bottom by the same number.' },
  times: { fr: '× : haut × haut et bas × bas, puis simplifie.', en: '×: top × top and bottom × bottom, then simplify.' },
  divide: { fr: 'Diviser par une fraction, c\'est multiplier par son inverse.', en: 'Dividing by a fraction is multiplying by its flip.' },
};

const FORMS = {
  // 1/4 de 12
  ofUnit(L) {
    const d = pick([2, 2, 3, 4, 5, 10]); const k = quotient(d, L); const n = d * k;
    return { text: `1/${d} de ${n} = ?`, textEn: `1/${d} of ${n} = ?`, answer: k, nums: [n], tip: 'of',
      lines: [`${n} ÷ ${d} = ${k}`], mistakes: [n - d, n * d, d === 2 ? k + 1 : n / 2, k + 1] };
  },
  // 3/4 de 20
  of(L) {
    const d = pick([3, 4, 5, 8, 10]); const p = rnd(2, d - 1); if (gcd(p, d) > 1) return null;
    const k = quotient(d, L); const n = d * k;
    return { text: `${p}/${d} de ${n} = ?`, textEn: `${p}/${d} of ${n} = ?`, answer: p * k, nums: [n], tip: 'of',
      lines: [`${n} ÷ ${d} = ${k}`, `${k} × ${p} = ${p * k}`], mistakes: [k, n - p * k, n / p, p * k + k] };
  },
  // 1/2 + 1/2 (first years): halves, quarters, tenths of one whole
  addHalf() {
    const d = pick([2, 4, 10]); const a = rnd(1, d - 1); const b = d - a;
    return { text: `${a}/${d} + ${b}/${d} = ?`, answer: '1', nums: [], tip: 'same',
      lines: [`${a} + ${b} = ${d}`, `${d}/${d} = 1`], mistakes: [`${d}/${2 * d}`, `${d}/${d * 2}`, '2', `1/${d}`] };
  },
  // 2/7 + 3/7
  addSame() {
    const d = pick([3, 4, 5, 6, 7, 8, 9, 10, 12]); const a = rnd(1, d - 2); const b = rnd(1, d - 1 - a);
    if (gcd(a + b, d) > 1) return null;
    return { text: `${a}/${d} + ${b}/${d} = ?`, answer: `${a + b}/${d}`, nums: [], tip: 'same',
      lines: [`${a} + ${b} = ${a + b}`, `→ ${a + b}/${d}`], mistakes: [`${a + b}/${2 * d}`, `${a * b}/${d}`, `${a + b + 1}/${d}`] };
  },
  // 5/7 − 2/7
  subSame() {
    const d = pick([3, 4, 5, 6, 7, 8, 9, 10, 12]); const a = rnd(2, d - 1); const b = rnd(1, a - 1);
    if (gcd(a - b, d) > 1) return null;
    return { text: `${a}/${d} − ${b}/${d} = ?`, answer: `${a - b}/${d}`, nums: [], tip: 'same',
      lines: [`${a} − ${b} = ${a - b}`, `→ ${a - b}/${d}`], mistakes: [`${a + b}/${d}`, `${a - b + 1}/${d}`, `${a - b}/${2 * d}`] };
  },
  // 1/2 = ?/10
  equiv() {
    const [a, b] = pick([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5]]); const m = rnd(2, Math.floor(12 / b)); const c = b * m;
    return { text: `${a}/${b} = ?/${c}`, answer: a * m, nums: [c], tip: 'equal',
      lines: [`${b} × ${m} = ${c}`, `${a} × ${m} = ${a * m}`], mistakes: [a + (c - b), a * m + 1, m, c - a] };
  },
  // 6/8 = ?/4
  simplify() {
    const [a, b] = pick([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5]]); const m = rnd(2, Math.floor(12 / b));
    return { text: `${a * m}/${b * m} = ?/${b}`, answer: a, nums: [b * m], tip: 'equal',
      lines: [`${b * m} ÷ ${m} = ${b}`, `${a * m} ÷ ${m} = ${a}`], mistakes: [a * m - (b * m - b), a + 1, m, a * m] };
  },
  // 1/2 + 1/4, 2/3 − 1/6: one denominator a multiple of the other
  addMultiple() {
    const [d1, d2] = pick([[2, 4], [2, 6], [2, 8], [3, 6], [4, 8], [2, 10], [5, 10], [3, 12], [4, 12], [6, 12]]); const m = d2 / d1;
    const a = rnd(1, d1 - 1); const b = rnd(1, d2 - 1); if (gcd(a, d1) > 1 || gcd(b, d2) > 1) return null;
    const sub = Math.random() < 0.4 && a * m > b;
    const top = sub ? a * m - b : a * m + b; if (top >= d2 || top <= 0) return null;
    const s = sub ? '−' : '+';
    return { text: `${a}/${d1} ${s} ${b}/${d2} = ?`, answer: fracText(top, d2), nums: [], tip: 'diff',
      lines: [`${a}/${d1} = ${a * m}/${d2}`, `${a * m} ${s} ${b} = ${top} → ${fracText(top, d2)}`],
      mistakes: [`${sub ? a - b : a + b}/${d1 + d2}`, `${sub ? Math.abs(a - b) : a + b}/${d2}`, fracText(top + 1, d2)] };
  },
  // 2/3 × 12
  timesInt(L) {
    const d = pick([2, 3, 4, 5, 10]); const p = rnd(1, d - 1); if (gcd(p, d) > 1) return null;
    const k = quotient(d, L); const n = d * k;
    return { text: `${p}/${d} × ${n} = ?`, answer: p * k, nums: [n, p * n], tip: 'of',
      lines: p === 1 ? [`${n} ÷ ${d} = ${k}`] : [`${n} ÷ ${d} = ${k}`, `${k} × ${p} = ${p * k}`], mistakes: [p * n, k, p * k + 1, n - p] };
  },
  // 2/3 × 3/4
  mulFrac() {
    const p1 = rnd(1, 4); const q1 = rnd(p1 + 1, 6); const p2 = rnd(1, 4); const q2 = rnd(p2 + 1, 6);
    if (gcd(p1, q1) > 1 || gcd(p2, q2) > 1 || !SMALL_DEN.includes(q1 * q2 / gcd(p1 * p2, q1 * q2))) return null;
    return { text: `${p1}/${q1} × ${p2}/${q2} = ?`, answer: fracText(p1 * p2, q1 * q2), nums: [], tip: 'times',
      lines: [`${p1} × ${p2} = ${p1 * p2}`, `${q1} × ${q2} = ${q1 * q2} → ${fracText(p1 * p2, q1 * q2)}`],
      mistakes: [`${p1 + p2}/${q1 + q2}`, fracText(p1 * q2, q1 * p2), `${p1 * p2}/${q1 + q2}`] };
  },
  // 1/2 ÷ 1/4
  divFrac() {
    const p1 = rnd(1, 3); const q1 = rnd(p1 + 1, 6); const p2 = rnd(1, 3); const q2 = rnd(p2 + 1, 6);
    if (gcd(p1, q1) > 1 || gcd(p2, q2) > 1 || (p1 === p2 && q1 === q2)) return null;
    const n = p1 * q2; const d = q1 * p2; if (d / gcd(n, d) > 6 || n / gcd(n, d) > 12) return null;
    return { text: `${p1}/${q1} ÷ ${p2}/${q2} = ?`, answer: fracText(n, d), nums: [], tip: 'divide',
      lines: [`${p1}/${q1} × ${q2}/${p2}`, fracText(n, d) === `${n}/${d}` ? `= ${n}/${d}` : `= ${n}/${d} → ${fracText(n, d)}`],
      mistakes: [fracText(p1 * p2, q1 * q2), fracText(d, n), `${p1 + p2}/${q1 + q2}`] };
  },
  // 1/3 + 1/4: different denominators, common one at most 12
  addDiff() {
    const [d1, d2] = pick([[2, 3], [2, 5], [3, 4], [4, 6], [2, 3], [3, 4]]); const l = d1 * d2 / gcd(d1, d2);
    const a = rnd(1, d1 - 1); const b = rnd(1, d2 - 1); if (gcd(a, d1) > 1 || gcd(b, d2) > 1) return null;
    const top = a * (l / d1) + b * (l / d2);
    return { text: `${a}/${d1} + ${b}/${d2} = ?`, answer: fracText(top, l), nums: [], tip: 'diff',
      lines: [`${a}/${d1} = ${a * l / d1}/${l} ; ${b}/${d2} = ${b * l / d2}/${l}`, `${a * l / d1} + ${b * l / d2} = ${top} → ${fracText(top, l)}`],
      mistakes: [`${a + b}/${d1 + d2}`, `${a + b}/${l}`, fracText(top + 1, l)] };
  },
};

const YEAR_FORMS = {
  1: ['ofUnit'], 2: ['ofUnit'], 3: ['ofUnit', 'ofUnit', 'addHalf'], 4: ['ofUnit', 'addHalf', 'addSame'],
  5: ['of', 'addSame', 'subSame', 'equiv'], 6: ['of', 'addSame', 'subSame', 'equiv'],
  7: ['of', 'addMultiple', 'timesInt', 'simplify'], 8: ['of', 'addMultiple', 'timesInt', 'simplify'], 9: ['addMultiple', 'timesInt', 'simplify', 'mulFrac'],
  10: ['mulFrac', 'divFrac', 'addDiff', 'addMultiple'], 11: ['mulFrac', 'divFrac', 'addDiff', 'of'], 12: ['mulFrac', 'divFrac', 'addDiff', 'of'],
};

// Four choices: the answer and classic mistakes, never another way of writing
// the answer (2/4 when it is 1/2), whole numbers in the range when possible.
export function fractionChoices(answer, mistakes, L) {
  const out = [answer]; const seen = new Set([value(answer)]);
  const add = c => {
    const v = value(c);
    const [n, d] = String(c).split('/').map(Number);
    if (d && n === d) return;   // "7/7" is just 1
    if (out.length < 4 && Number.isFinite(v) && v > 0 && !seen.has(v) && (typeof c === 'string' && c.includes('/') || (Number.isInteger(v) && v <= L))) {
      seen.add(v); out.push(typeof c === 'number' ? c : c);
    }
  };
  mistakes.forEach(add);
  const v = value(answer);
  if (typeof answer === 'string' && answer.includes('/')) {
    const [n, d] = answer.split('/').map(Number);
    [`${n + 1}/${d}`, `${n}/${d + 1}`, `${Math.max(1, n - 1)}/${d}`, `${n + 2}/${d}`, `${n}/${d * 2}`].forEach(add);
  } else for (const k of [1, -1, 2, -2, 3, 5, 10]) add(typeof answer === 'number' ? v + k : String(v + k));
  for (let k = 4; out.length < 4; k++) out.push(typeof answer === 'number' ? v + k * 7 : `${k}/${k + 1}`);
  return out.sort(() => Math.random() - 0.5);
}

// Mental-math check: every number in the range, whole answers in it too.
function ok(q, L) {
  if (!q) return false;
  if (typeof q.answer === 'number' && (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > L)) return false;
  return q.nums.every(n => Number.isInteger(n) && n <= L);
}

export function makeFractionQuestion(year, limit) {
  const L = Math.max(10, limit);
  const forms = YEAR_FORMS[Math.max(1, Math.min(12, year || 6))];
  for (let i = 0; i < 80; i++) {
    const form = pick(forms);
    const q = FORMS[form](L);
    if (!ok(q, L)) continue;
    return { text: q.text, textEn: q.textEn, answer: q.answer, op: 'frac', form, a: 0, b: 0,
      tip: FRACTION_TIPS[q.tip], steps: q.lines, check: q.text.replace('?', q.answer), checkEn: (q.textEn || q.text).replace('?', q.answer),
      choices: fractionChoices(q.answer, q.mistakes, L) };
  }
  return { text: '1/2 de 10 = ?', textEn: '1/2 of 10 = ?', answer: 5, op: 'frac', form: 'fallback', a: 0, b: 0,
    tip: FRACTION_TIPS.of, steps: ['10 ÷ 2 = 5'], check: '1/2 de 10 = 5', checkEn: '1/2 of 10 = 5', choices: [5, 20, 8, 6].sort(() => Math.random() - 0.5) };
}
