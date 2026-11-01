// Percentages, for mental math (about 10 seconds), by SCHOOL YEAR. Only 10,
// 20, 25, 50 and 75 % of easy numbers, whole answers inside the range the
// player chose. Each question carries a one-line tip, the calculation lines
// of the correction and wrong choices made from classic mistakes (25 % de 80
// → 55: took away 25; 8: did 10 % ; 40: did 50 %).
//
//   CP-CM1    50 % (then 10 %) of a number         50 % de 30
//   CM2-6e    10, 25, 50 %                          25 % de 80
//   5e-3e     all five, price going down / up       75 % de 40, 60 − 25 %
//   lycée     and the other way round               25 % de ? = 20, 15 = ? % de 60

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(list) { return list[rnd(0, list.length - 1)]; }

export const PERCENT_TIPS = {
  of: { fr: '10 %, c\'est diviser par 10 ; 50 %, c\'est la moitié ; 25 %, c\'est le quart.', en: '10% is dividing by 10; 50% is half; 25% is a quarter.' },
  change: { fr: 'Calcule d\'abord le pourcentage, puis enlève-le (ou ajoute-le).', en: 'Work out the percentage first, then take it away (or add it).' },
  reverse: { fr: '25 % c\'est le quart : le tout, c\'est 4 fois plus.', en: '25% is a quarter: the whole is 4 times as much.' },
  which: { fr: 'Cherche la fraction : la moitié = 50 %, le quart = 25 %, le dixième = 10 %.', en: 'Find the fraction: half = 50%, a quarter = 25%, a tenth = 10%.' },
};

// What p % is, as a fraction of 1: [divide by, multiply by].
const PARTS = { 10: [10, 1], 20: [10, 2], 25: [4, 1], 50: [2, 1], 75: [4, 3] };

// An easy number for p %: multiples of 10 up to 100, of 20 / 100 above.
function base(p, L) {
  const [by] = PARTS[p];
  const step = by === 4 ? 4 : by === 2 ? 2 : 10;
  const options = [];
  // ÷ 4 in the tables (up to 48), then multiples of 20: 25 % de 60, not of 92.
  for (let n = step; n <= Math.min(L, 100); n += step) if (by !== 4 || n <= 48 || n % 20 === 0) options.push(n);
  for (let n = 200; n <= Math.min(L, 1000); n += 100) options.push(n);
  // Prefer round numbers (multiples of 10 / 20) when there are some.
  const round = options.filter(n => n % (by === 4 ? 20 : 10) === 0);
  return pick(round.length >= 2 && Math.random() < 0.7 ? round : options);
}
function part(p, n) { const [by, times] = PARTS[p]; return (n / by) * times; }
function partLines(p, n) {
  const [by, times] = PARTS[p];
  return times === 1 ? [`${n} ÷ ${by} = ${n / by}`] : [`${n} ÷ ${by} = ${n / by}`, `${n / by} × ${times} = ${part(p, n)}`];
}

const FORMS = {
  // 25 % de 80
  of(L, pcts) {
    const p = pick(pcts); const n = base(p, L); const r = part(p, n);
    return { text: `${p} % de ${n} = ?`, textEn: `${p}% of ${n} = ?`, answer: r, nums: [n], tip: 'of',
      lines: partLines(p, n), mistakes: [n - p, p === 50 ? n / 10 : n / 2, p === 10 ? n / 2 : n / 10, n - r, r * 10] };
  },
  // 60 − 25 % (a price going down), 50 + 10 % (going up)
  change(L, pcts) {
    const p = pick(pcts.filter(v => v !== 75)); const n = base(p, L); const r = part(p, n); const up = Math.random() < 0.4;
    const answer = up ? n + r : n - r;
    return { text: `${n} ${up ? '+' : '−'} ${p} % = ?`, answer, nums: [n, answer], tip: 'change',
      lines: [...partLines(p, n), `${n} ${up ? '+' : '−'} ${r} = ${answer}`],
      mistakes: [r, up ? n + p : n - p, up ? n - r : n + r, up ? n + r * 2 : n - r * 2] };
  },
  // 25 % de ? = 20
  reverse(L, pcts) {
    const p = pick(pcts.filter(v => v !== 75)); const n = base(p, L); const r = part(p, n);
    const [by, times] = PARTS[p];
    return { text: `${p} % de ? = ${r}`, textEn: `${p}% of ? = ${r}`, answer: n, nums: [n, r], tip: 'reverse',
      lines: times === 1 ? [`${r} × ${by} = ${n}`] : [`${r} ÷ ${times} = ${r / times}`, `${r / times} × ${by} = ${n}`],
      mistakes: [r / by, r + p, n / 2, r * 2] };
  },
  // 15 = ? % de 60
  which(L) {
    const p = pick([10, 25, 50, 75, 20]); const n = base(p, L); const r = part(p, n);
    return { text: `${r} = ? % de ${n}`, textEn: `${r} = ?% of ${n}`, answer: p, nums: [n, r], tip: 'which',
      lines: n % r === 0 ? [`${n} ÷ ${r} = ${n / r}`, `1/${n / r} = ${p} %`] : [`${n} ÷ 4 = ${n / 4}`, `${r} = 3 × ${n / 4} → 3/4 = 75 %`],
      mistakes: [r, 100 - p, n / r, p * 2] };
  },
};

function plan(year) {
  if (year <= 3) return { forms: ['of'], pcts: [50] };
  if (year <= 4) return { forms: ['of'], pcts: [50, 10] };
  if (year <= 6) return { forms: ['of'], pcts: [10, 25, 50] };
  if (year <= 9) return { forms: ['of', 'of', 'change'], pcts: [10, 20, 25, 50, 75] };
  return { forms: ['of', 'change', 'reverse', 'which'], pcts: [10, 20, 25, 50, 75] };
}

// Four choices: the answer and classic mistakes, whole numbers inside the range.
function choices(answer, mistakes, L) {
  const set = new Set([answer]);
  for (const c of mistakes) if (set.size < 4 && Number.isInteger(c) && c > 0 && c <= Math.max(L, answer) && c !== answer) set.add(c);
  for (const k of [1, -1, 2, -2, 5, -5, 10, -10]) { const c = answer + k; if (set.size < 4 && c > 0 && c <= Math.max(L, answer) && !set.has(c)) set.add(c); }
  for (let k = 3; set.size < 4; k++) set.add(answer + k);
  return [...set].sort(() => Math.random() - 0.5);
}

function ok(q, L) {
  return Number.isInteger(q.answer) && q.answer > 0 && q.answer <= L && q.nums.every(n => Number.isInteger(n) && n > 0 && n <= L);
}

export function makePercentQuestion(year, limit) {
  const L = Math.max(10, limit);
  const { forms, pcts } = plan(year || 6);
  for (let i = 0; i < 80; i++) {
    const form = pick(forms);
    const q = FORMS[form](L, pcts);
    if (!ok(q, L)) continue;
    return { text: q.text, textEn: q.textEn, answer: q.answer, op: 'pct', form, a: 0, b: 0,
      tip: PERCENT_TIPS[q.tip], steps: q.lines, check: q.text.replace('?', q.answer), checkEn: (q.textEn || q.text).replace('?', q.answer),
      choices: choices(q.answer, q.mistakes, L) };
  }
  return { text: '50 % de 10 = ?', textEn: '50% of 10 = ?', answer: 5, op: 'pct', form: 'fallback', a: 0, b: 0,
    tip: PERCENT_TIPS.of, steps: ['10 ÷ 2 = 5'], check: '50 % de 10 = 5', checkEn: '50% of 10 = 5', choices: [5, 40, 1, 2].sort(() => Math.random() - 0.5) };
}
