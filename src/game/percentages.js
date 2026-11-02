// Percentages, for mental math (about 10 seconds), by SCHOOL YEAR: the tens
// from 10 % to 100 %, plus 25 % and 75 %, of easy numbers, whole answers
// inside the range the player chose. Each question carries a one-line tip,
// the calculation lines of the correction and wrong choices made from
// classic mistakes (30 % de 70 → 49: the rest; 7: only 10 %; 40: took 30).
//
//   CP-CE2    50 %, 100 %                               50 % de 30
//   CM1       10 %, 50 %, 100 %                         10 % de 60
//   CM2       10, 20, 25, 50, 100 %                     20 % de 40
//   6e        every ten 10 % ... 100 %, 25 %            30 % de 70
//   5e-3e     and 75 %, price going down / up           75 % de 40, 60 − 30 %
//   lycée     and the other way round                   30 % de ? = 12, 14 = ? % de 20

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(list) { return list[rnd(0, list.length - 1)]; }

export const PERCENT_TIPS = {
  of: { fr: '10 %, c\'est diviser par 10 ; 50 %, c\'est la moitié ; 25 %, c\'est le quart.', en: '10% is dividing by 10; 50% is half; 25% is a quarter.' },
  tens: { fr: '30 %, c\'est 3 fois 10 % : divise par 10, puis multiplie.', en: '30% is 3 times 10%: divide by 10, then multiply.' },
  whole: { fr: '100 %, c\'est le nombre en entier.', en: '100% is the whole number.' },
  change: { fr: 'Calcule d\'abord le pourcentage, puis enlève-le (ou ajoute-le).', en: 'Work out the percentage first, then take it away (or add it).' },
  reverse: { fr: 'Retrouve 10 % (ou 25 %), puis le tout : 100 %.', en: 'Find 10% (or 25%) first, then the whole: 100%.' },
  which: { fr: 'Cherche combien de fois 10 % (ou la moitié, le quart) ça fait.', en: 'Count how many times 10% (or half, a quarter) it makes.' },
};

const TENS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// What p % is, as a fraction of 1: [divide by, multiply by].
// 30 % = ÷ 10 × 3, 25 % = ÷ 4, 50 % = ÷ 2, 75 % = ÷ 4 × 3, 100 % = × 1.
const PARTS = { 25: [4, 1], 50: [2, 1], 75: [4, 3], 100: [1, 1] };
TENS.forEach(p => { if (!PARTS[p]) PARTS[p] = [10, p / 10]; });

// An easy number for p %: multiples of 10 up to 100 (of 2 for 50 %, of 4
// in the tables or of 20 for 25 / 75 %), then hundreds.
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
  if (p === 100) return [`100 % = 100/100 = 1`, `1 × ${n} = ${n}`];
  const [by, times] = PARTS[p];
  return times === 1 ? [`${n} ÷ ${by} = ${n / by}`] : [`${n} ÷ ${by} = ${n / by}`, `${n / by} × ${times} = ${part(p, n)}`];
}
const tipOf = p => (p === 100 ? 'whole' : PARTS[p][0] === 10 && p !== 10 ? 'tens' : 'of');

const FORMS = {
  // 30 % de 70
  of(L, pcts) {
    const p = pick(pcts); const n = base(p, L); const r = part(p, n); const t = n / 10;
    return { text: `${p} % de ${n} = ?`, textEn: `${p}% of ${n} = ?`, answer: r, nums: [n], tip: tipOf(p),
      lines: partLines(p, n), mistakes: [n - r, p === 10 ? n / 2 : t, n - p, r + t, p === 50 ? t : n / 2, r * 10] };
  },
  // 60 − 30 % (a price going down), 50 + 10 % (going up)
  change(L, pcts) {
    const p = pick(pcts.filter(v => v !== 100)); const n = base(p, L); const r = part(p, n); const up = Math.random() < 0.4;
    const answer = up ? n + r : n - r;
    return { text: `${n} ${up ? '+' : '−'} ${p} % = ?`, answer, nums: [n, answer], tip: 'change',
      lines: [...partLines(p, n), `${n} ${up ? '+' : '−'} ${r} = ${answer}`],
      mistakes: [r, up ? n + p : n - p, up ? n - r : n + r, up ? n + r * 2 : n - r * 2] };
  },
  // 30 % de ? = 12
  reverse(L, pcts) {
    const p = pick(pcts.filter(v => v !== 100)); const n = base(p, L); const r = part(p, n);
    const [by, times] = PARTS[p];
    return { text: `${p} % de ? = ${r}`, textEn: `${p}% of ? = ${r}`, answer: n, nums: [n, r], tip: 'reverse',
      lines: times === 1 ? [`${r} × ${by} = ${n}`] : [`${r} ÷ ${times} = ${r / times}`, `${r / times} × ${by} = ${n}`],
      mistakes: [r * by, r / times, r + p, r * 2, n / 2] };
  },
  // 14 = ? % de 20
  which(L, pcts) {
    const p = pick(pcts.filter(v => v !== 100)); const n = base(p, L); const r = part(p, n);
    const [by] = PARTS[p];
    const lines = by === 10
      ? [`10 % de ${n} = ${n / 10}`, `${r} ÷ ${n / 10} = ${p / 10} → ${p} %`]
      : n % r === 0 ? [`${n} ÷ ${r} = ${n / r}`, `1/${n / r} = ${p} %`] : [`${n} ÷ 4 = ${n / 4}`, `${r} = 3 × ${n / 4} → 3/4 = 75 %`];
    return { text: `${r} = ? % de ${n}`, textEn: `${r} = ?% of ${n}`, answer: p, nums: [n, r], tip: 'which',
      lines, mistakes: [r, 100 - p, n / r, p + 10, p - 10, p * 2] };
  },
};

// The others twice in the short lists: 100 % (too easy) comes up less often.
function plan(year) {
  if (year <= 3) return { forms: ['of'], pcts: [50, 50, 100] };
  if (year <= 4) return { forms: ['of'], pcts: [10, 10, 50, 50, 100] };
  if (year <= 5) return { forms: ['of'], pcts: [10, 10, 20, 20, 25, 25, 50, 50, 100] };
  if (year <= 6) return { forms: ['of'], pcts: [...TENS, 25] };
  if (year <= 9) return { forms: ['of', 'of', 'change'], pcts: [...TENS, 25, 75] };
  return { forms: ['of', 'change', 'reverse', 'which'], pcts: [...TENS, 25, 75] };
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
