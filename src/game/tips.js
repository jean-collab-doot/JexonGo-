// Teaching after a mistake: a one-line METHOD TIP (shown in the correction,
// game.js buildClearCorrectionSteps) and WRONG CHOICES made from classic
// mistakes (7 × 8 → 54, 63, 48 instead of random neighbours).
//
// ── TO EDIT A TIP ───────────────────────────────────────────────────────────
// Change the fr / en text below. For + − × ÷ and exponent, the first line
// whose `op` matches and whose `when` is true is used (put the specific ones
// first, the general one of each op last). Algebra tips are by kind of
// equation (game/algebra.js FORMS), negative-number tips by kind of question.
//
// `lines` (+ − × ÷): the calculation of that method, one short step per line,
// shown under the tip in the correction ("5 × 12 → 12 × 10 = 120 / 120 ÷ 2 =
// 60"), so the tip and the calculation always say the same thing.

const ends = (n, d) => Number.isInteger(n) && Math.abs(n) % 10 === d;
const has = (q, ...values) => values.includes(q.a) || values.includes(q.b);
const other = (q, v) => (q.a === v ? q.b : q.a);
const isDecimal = q => !Number.isInteger(q.a) || !Number.isInteger(q.b) || !Number.isInteger(q.answer);
const small = q => Math.min(q.a, q.b);
const big = q => Math.max(q.a, q.b);

// 338 → [300, 30, 8]
function placeParts(n) {
  return String(n).split('').map((d, i, all) => Number(d) * 10 ** (all.length - 1 - i)).filter(Boolean);
}
// Decomposition: start from the big number, add / take away the other one
// piece by piece (hundreds, tens, ones). A single ones digit that crosses a
// ten goes to the round ten first: 47 + 8 → 47 + 3 = 50, 50 + 5 = 55.
function pieceLines(start, n, sign) {
  const lines = [];
  let cur = start;
  const step = p => { const next = sign > 0 ? cur + p : cur - p; lines.push(`${cur} ${sign > 0 ? '+' : '−'} ${p} = ${next}`); cur = next; };
  const parts = placeParts(n);
  if (!parts.length) step(0);
  if (parts.length === 1 && n < 10) {
    const toTen = sign > 0 ? (10 - cur % 10) % 10 : cur % 10;
    if (toTen > 0 && toTen < n) { step(toTen); step(n - toTen); return lines; }
  }
  parts.forEach(step);
  return lines;
}
const addSplit = q => pieceLines(big(q), small(q), 1);
const addNine = q => { const n = small(q); const s = big(q); return [`${s} + ${n + 1} = ${s + n + 1}`, `${s + n + 1} − 1 = ${q.answer}`]; };
const subSplit = q => pieceLines(q.a, q.b, -1);
const subNine = q => [`${q.a} − ${q.b + 1} = ${q.a - q.b - 1}`, `${q.a - q.b - 1} + 1 = ${q.answer}`];

export const TIPS = [
  // ── Addition ──
  { op: '+', when: isDecimal, fr: "Additionne les entiers, puis les décimales : 0,5 + 0,5 = 1.", en: 'Add the whole numbers, then the decimals: 0.5 + 0.5 = 1.' },
  { op: '+', when: q => ends(small(q), 9), lines: addNine, fr: '+ 9, c\'est + 10 puis − 1.', en: '+ 9 is + 10, then − 1.' },
  { op: '+', when: q => small(q) < 10 && big(q) % 10 + small(q) > 10, lines: addSplit,
    fr: 'Passe par la dizaine : 47 + 8 = 47 + 3 + 5.', en: 'Go through the ten: 47 + 8 = 47 + 3 + 5.' },
  { op: '+', when: q => small(q) < 10, lines: addSplit, fr: 'Pars du plus grand nombre et avance.', en: 'Start from the bigger number and count on.' },
  { op: '+', when: q => small(q) < 100, lines: addSplit, fr: 'Décompose : ajoute les dizaines, puis les unités.', en: 'Split it: add the tens, then the ones.' },
  { op: '+', when: () => true, lines: addSplit, fr: 'Décompose : ajoute les centaines, puis les dizaines, puis les unités.', en: 'Split it: add the hundreds, then the tens, then the ones.' },
  // ── Soustraction ──
  { op: '-', when: isDecimal, fr: 'Enlève d\'abord les entiers, puis les décimales.', en: 'Take away the whole numbers first, then the decimals.' },
  { op: '-', when: q => ends(q.b, 9) && q.a > q.b, lines: subNine, fr: '− 9, c\'est − 10 puis + 1.', en: '− 9 is − 10, then + 1.' },
  { op: '-', when: q => q.b < 10 && q.a % 10 > 0 && q.a % 10 < q.b, lines: subSplit,
    fr: 'Passe par la dizaine : 52 − 7 = 52 − 2 − 5.', en: 'Go through the ten: 52 − 7 = 52 − 2 − 5.' },
  { op: '-', when: q => q.b < 10, lines: subSplit, fr: 'Recule à partir du premier nombre.', en: 'Count back from the first number.' },
  { op: '-', when: q => q.b < 100, lines: subSplit, fr: 'Décompose : enlève les dizaines, puis les unités.', en: 'Split it: take away the tens, then the ones.' },
  { op: '-', when: () => true, lines: subSplit, fr: 'Décompose : enlève les centaines, puis les dizaines, puis les unités.', en: 'Split it: take away the hundreds, then the tens, then the ones.' },
  // ── Multiplication ──
  { op: '*', when: q => has(q, 0.5), fr: '× 0,5, c\'est la moitié.', en: '× 0.5 is half.' },
  { op: '*', when: q => has(q, 10), lines: q => [`${other(q, 10)} × 10 = ${q.answer}`],
    fr: '× 10 : on ajoute un zéro à la fin.', en: '× 10: put a zero at the end.' },
  { op: '*', when: q => has(q, 20), lines: q => { const o = other(q, 20); return [`${o} × 2 = ${o * 2}`, `${o * 2} × 10 = ${q.answer}`]; },
    fr: '× 20, c\'est × 2 puis × 10.', en: '× 20 is × 2, then × 10.' },
  { op: '*', when: q => has(q, 50), lines: q => { const o = other(q, 50); return [`${o} × 100 = ${o * 100}`, `${o * 100} ÷ 2 = ${q.answer}`]; },
    fr: '× 50, c\'est × 100 puis la moitié.', en: '× 50 is × 100, then half.' },
  { op: '*', when: q => has(q, 25), lines: q => { const o = other(q, 25); return [`${o} × 100 = ${o * 100}`, `${o * 100} ÷ 4 = ${q.answer}`]; },
    fr: '× 25, c\'est × 100 puis ÷ 4.', en: '× 25 is × 100, then ÷ 4.' },
  { op: '*', when: q => has(q, 15), lines: q => { const o = other(q, 15); return [`${o} × 10 = ${o * 10}`, `${o * 10} ÷ 2 = ${o * 5}`, `${o * 10} + ${o * 5} = ${q.answer}`]; },
    fr: '× 15, c\'est × 10 plus sa moitié.', en: '× 15 is × 10 plus half of it.' },
  { op: '*', when: q => has(q, 5), lines: q => { const o = other(q, 5); return [`${o} × 10 = ${o * 10}`, `${o * 10} ÷ 2 = ${q.answer}`]; },
    fr: '× 5, c\'est la moitié de × 10.', en: '× 5 is half of × 10.' },
  { op: '*', when: q => has(q, 9), lines: q => { const o = other(q, 9); return [`${o} × 10 = ${o * 10}`, `${o * 10} − ${o} = ${q.answer}`]; },
    fr: '× 9, c\'est × 10 moins une fois le nombre.', en: '× 9 is × 10 minus the number once.' },
  { op: '*', when: q => has(q, 11), lines: q => { const o = other(q, 11); return [`${o} × 10 = ${o * 10}`, `${o * 10} + ${o} = ${q.answer}`]; },
    fr: '× 11, c\'est × 10 plus une fois le nombre.', en: '× 11 is × 10 plus the number once.' },
  { op: '*', when: q => has(q, 2), lines: q => { const o = other(q, 2); return [`${o} + ${o} = ${q.answer}`]; },
    fr: '× 2, c\'est le double.', en: '× 2 is the double.' },
  { op: '*', when: q => has(q, 4), lines: q => { const o = other(q, 4); return [`${o} × 2 = ${o * 2}`, `${o * 2} × 2 = ${q.answer}`]; },
    fr: '× 4, c\'est doubler deux fois.', en: '× 4 is doubling twice.' },
  { op: '*', when: q => has(q, 12), lines: q => { const o = other(q, 12); return [`${o} × 10 = ${o * 10}`, `${o} × 2 = ${o * 2}`, `${o * 10} + ${o * 2} = ${q.answer}`]; },
    fr: '× 12, c\'est × 10 plus × 2.', en: '× 12 is × 10 plus × 2.' },
  { op: '*', when: q => big(q) < 6 && small(q) > 1, lines: q => [`${Array(small(q)).fill(big(q)).join(' + ')} = ${q.answer}`],
    fr: 'Multiplier, c\'est additionner plusieurs fois le même nombre.', en: 'Multiplying is adding the same number several times.' },
  { op: '*', when: q => big(q) >= 6 && big(q) <= 10 && small(q) > 1, lines: q => { const s = small(q); const r = big(q) - 5; return [`${s} × 5 = ${s * 5}`, `${s} × ${r} = ${s * r}`, `${s * 5} + ${s * r} = ${q.answer}`]; },
    fr: 'Décompose : 7 × 8 = 7 × 5 + 7 × 3.', en: 'Split it: 7 × 8 = 7 × 5 + 7 × 3.' },
  { op: '*', when: () => true, fr: 'Décompose un des nombres en morceaux faciles.', en: 'Split one number into easy pieces.' },
  // ── Division ──
  { op: '/', when: q => q.b === 2 && q.a >= 20 && q.a % 20 !== 0, lines: q => { const t = q.a - q.a % 20; const u = q.a % 20; return [`${t} ÷ 2 = ${t / 2}`, `${u} ÷ 2 = ${u / 2}`, `${t / 2} + ${u / 2} = ${q.answer}`]; },
    fr: '÷ 2, c\'est la moitié : coupe le nombre en morceaux faciles.', en: '÷ 2 is half: split the number into easy pieces.' },
  { op: '/', when: q => q.b === 2, lines: q => [`${q.a} ÷ 2 = ${q.answer}`, `${q.answer} + ${q.answer} = ${q.a}`],
    fr: '÷ 2, c\'est la moitié.', en: '÷ 2 is half.' },
  { op: '/', when: q => q.b === 4, lines: q => [`${q.a} ÷ 2 = ${q.a / 2}`, `${q.a / 2} ÷ 2 = ${q.answer}`],
    fr: '÷ 4, c\'est la moitié de la moitié.', en: '÷ 4 is half of half.' },
  { op: '/', when: q => q.b === 5, lines: q => [`${q.a} × 2 = ${q.a * 2}`, `${q.a * 2} ÷ 10 = ${q.answer}`],
    fr: '÷ 5 : double, puis ÷ 10.', en: '÷ 5: double it, then ÷ 10.' },
  { op: '/', when: q => q.b === 10, lines: q => [`${q.a} ÷ 10 = ${q.answer}`],
    fr: '÷ 10 : on enlève un zéro à la fin.', en: '÷ 10: take a zero off the end.' },
  { op: '/', when: () => true, lines: q => [`? × ${q.b} = ${q.a}`, `${q.answer} × ${q.b} = ${q.a}`],
    fr: 'Diviser, c\'est chercher dans la table : ? × diviseur = nombre.', en: 'Dividing is finding it in the table: ? × divisor = number.' },
  // ── Exposant ──
  { op: '^', when: q => q.a === 10, fr: '10 puissance n : un 1 suivi de n zéros.', en: '10 to the n: a 1 followed by n zeros.' },
  { op: '^', when: () => true, fr: 'Le petit nombre dit combien de fois on multiplie : 3² = 3 × 3, pas 3 × 2.', en: 'The small number says how many times to multiply: 3² = 3 × 3, not 3 × 2.' },
];

// Algebra: by kind of equation (game/algebra.js FORMS).
export const ALGEBRA_TIPS = {
  inverse: { fr: 'Fais l\'opération inverse : + devient −, × devient ÷.', en: 'Do the opposite operation: + becomes −, × becomes ÷.' },
  twoStep: { fr: 'D\'abord enlève le nombre seul, puis divise par le nombre devant x.', en: 'First remove the lone number, then divide by the number in front of x.' },
  paren: { fr: 'Divise d\'abord les deux côtés, puis enlève le nombre de la parenthèse.', en: 'Divide both sides first, then remove the number in the brackets.' },
  bothSides: { fr: 'Rassemble les x d\'un côté et les nombres de l\'autre.', en: 'Put the x\'s on one side and the numbers on the other.' },
  fractionPlus: { fr: 'Enlève le nombre seul, puis multiplie par le dénominateur.', en: 'Remove the lone number, then multiply by the denominator.' },
  fractionTimes: { fr: 'Multiplie par le dénominateur, puis divise par le numérateur.', en: 'Multiply by the denominator, then divide by the numerator.' },
  inequality: { fr: 'Résous comme une équation : + − et ÷ par un positif ne changent pas le signe.', en: 'Solve it like an equation: + − and ÷ by a positive keep the sign.' },
  negative: { fr: 'Opération inverse ; si on enlève plus qu\'on a, le résultat est négatif.', en: 'Opposite operation; taking away more than you have gives a negative.' },
};
export const ALGEBRA_FORM_TIP = {
  missingAdd: 'inverse', missingSub: 'inverse', missingMul: 'inverse', add: 'inverse', sub: 'inverse', mul: 'inverse', div: 'inverse',
  twoStep: 'twoStep', twoStepMinus: 'twoStep', twoStepNeg: 'twoStep', paren: 'paren', bothSides: 'bothSides',
  fractionPlus: 'fractionPlus', fractionTimes: 'fractionTimes', inequality: 'inequality', addNeg: 'negative',
};

// Negative numbers (game/negatives.js).
export const NEGATIVE_TIPS = {
  thermo: { fr: 'Imagine un thermomètre : + monte, − descend.', en: 'Picture a thermometer: + goes up, − goes down.' },
  signs: { fr: 'Deux signes pareils donnent +, deux signes différents donnent −.', en: 'Same signs give +, different signs give −.' },
};

// The tip of a question: its own (algebra, negatives) or the first matching line.
export function tipFor(q) {
  if (q.tip) return q.tip;
  const line = TIPS.find(t => t.op === q.op && t.when(q));
  return line ? { fr: line.fr, en: line.en } : null;
}

// The calculation lines of that tip (+ − × ÷ whole numbers), or null.
export function tipLines(q) {
  if (q.tip || q.steps) return null;
  const line = TIPS.find(t => t.op === q.op && t.when(q));
  return line?.lines ? line.lines(q) : null;
}

// ── Classic mistakes ────────────────────────────────────────────────────────
const shuffle = list => [...list].sort(() => Math.random() - 0.5);
const round2 = n => Math.round(n * 100) / 100;

// Typical wrong answers of + − × ÷ and exponent, most typical first.
export function classicMistakes(q) {
  const { a, b, answer: r } = q;
  if (q.op === '+') {
    if (isDecimal(q)) {
      const carry = round2(a % 1 + b % 1) >= 1;
      return [carry ? r - 1 : r + 1, Math.floor(a) + Math.floor(b), r - 0.5, r + 0.5];
    }
    const carry = a % 10 + b % 10 >= 10;
    return [carry ? r - 10 : r + 10, ...shuffle([r + 1, r - 1]), carry ? r + 10 : r - 10];
  }
  if (q.op === '-') {
    if (isDecimal(q)) return [r + 1, r - 0.5, r + 0.5, r - 1];
    // "Smaller from bigger" in the ones: 52 − 17 → 45 (7 − 2 instead of a borrow).
    const ua = a % 10; const ub = b % 10;
    const noBorrow = ua < ub ? (a - ua) - (b - ub) + (ub - ua) : null;
    return [noBorrow, ua < ub ? r - 10 : r + 10, ...shuffle([r + 1, r - 1]), r + 10];
  }
  if (q.op === '*') {
    if (a === 0.5) return [b * 2, r + 1, r - 1, b];
    // Table neighbours: 7 × 8 → 7 × 9, 6 × 8, 6 × 9; sometimes + instead of ×.
    const near = shuffle([a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, (a - 1) * (b + 1), (a + 1) * (b - 1)]);
    const zeros = [10, 20, 50].some(v => has(q, v)) ? [r * 10, r / 10] : [];
    return [...zeros, ...near.slice(0, 2), Math.random() < 0.3 ? a + b : null, ...near.slice(2)];
  }
  if (q.op === '/') {
    const zeros = r % 10 === 0 ? [r / 10, r * 10] : [];
    return [...zeros, ...shuffle([r + 1, r - 1]), b, r + 2, a - b];
  }
  if (q.op === '^') {
    if (a === 10) return [10 ** (b - 1), 10 ** (b + 1), 10 * b];
    // 3² → 6 (base × exponent), 3³ → 9 (one × too few), 2⁵ → 64 (one too many).
    return [a * b, b > 2 ? a ** (b - 1) : a + b, r + a, a ** (b + 1)];
  }
  return [];
}

// Four choices: the answer, classic mistakes inside low ... high (the
// player's range), then near numbers (halves for decimal answers).
export function mistakeChoices(q, { low = 0, high = Infinity, mistakes = classicMistakes(q) } = {}) {
  const r = q.answer;
  const set = new Set([r]);
  const fits = c => typeof c === 'number' && Number.isFinite(c) && round2(c) === c
    && c >= low && c <= high && !set.has(c) && (Number.isInteger(c) || !Number.isInteger(r));
  for (const c of mistakes) { if (set.size >= 4) break; if (fits(c)) set.add(c); }
  const step = Number.isInteger(r) ? 1 : 0.5;
  for (const k of shuffle([1, -1, 2, -2, 3, -3]).concat([5, -5, 10, -10])) {
    if (set.size >= 4) break;
    const c = round2(r + k * step);
    if (fits(c)) set.add(c);
  }
  for (let k = 4; set.size < 4; k++) set.add(round2(r + k * step));
  return shuffle([...set]);
}
