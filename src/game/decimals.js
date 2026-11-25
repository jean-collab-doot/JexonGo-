// Decimal numbers ("Nombres à virgule" / "Decimals"), from 5e année / CM2 /
// 5th grade. Settings (G.decimalSettings, set in the practice drawer, used
// in the levels too):
//   ops     '+', '-', '*', '/' (one or more)
//   places  digits after the point: 1 (3.5) or 2 (3.25)
//   max     size of the numbers: 10 or 100
// Every calculation is done in whole units (tenths or hundredths), then the
// point is put back: 0.1 + 0.2 gives 0.3, never 0.30000000000000004.
//   +  3.5 + 2.4       −  7.2 − 1.8 (never below 0)
//   ×  0.5 × 6 (a decimal times a whole number from 2 to 9)
//   ÷  4.8 ÷ 2 (only exact ones: the answer is picked first, then × the divisor)
// Wrong choices are classic mistakes: the point in the wrong place (59 or
// 0.59 for 5.9), the carry forgotten (3.7 + 2.5 → 5.12), the numbers not
// lined up (3.5 + 2.25 → 2.60), a tenth too many or too few.
// The text uses a point; the game shows a comma in French (localDecimals).

export const DECIMAL_DEFAULTS = { ops: ['+', '-', '*', '/'], places: 1, max: 10 };
const OPS = ['+', '-', '*', '/'];
const SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(list) { return list[rnd(0, list.length - 1)]; }

// Cleaned settings (an old or broken save falls back to the defaults).
export function decimalSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const ops = Array.isArray(s.ops) ? s.ops.filter(op => OPS.includes(op)) : [];
  return {
    ops: ops.length ? [...new Set(ops)] : [...DECIMAL_DEFAULTS.ops],
    places: s.places === 2 ? 2 : 1,
    max: s.max === 100 ? 100 : 10,
  };
}

// Units (tenths / hundredths) → the number, rounded to the places.
const num = (u, scale) => Number((u / scale).toFixed(scale === 100 ? 2 : 1));
const text = n => String(n);

export const DECIMAL_TIPS = {
  add: { fr: 'Aligne les virgules, puis calcule comme avec des nombres entiers.', en: 'Line up the decimal points, then work as with whole numbers.' },
  sub: { fr: 'Aligne les virgules ; ajoute des 0 si besoin (7,2 = 7,20).', en: 'Line up the decimal points; add 0s if needed (7.2 = 7.20).' },
  mul: { fr: 'Multiplie sans la virgule, puis remets autant de chiffres après la virgule.', en: 'Multiply without the point, then put back as many digits after the point.' },
  div: { fr: 'Divise comme d’habitude ; la virgule de la réponse se place sous celle du nombre.', en: 'Divide as usual; the answer’s point goes under the number’s point.' },
};

// A number with a fractional part (no plain 4 or 4.0 in a decimal question).
function decimalUnits(lo, hi, scale) {
  for (let i = 0; i < 30; i++) {
    const u = rnd(lo, hi);
    if (u % scale !== 0) return u;
  }
  return lo % scale ? lo : lo + 1;
}

// Integer part and the digits after the point, as strings ("3.7" → 3, "7").
function parts(n, places) {
  const [i, f = ''] = n.toFixed(places).split('.');
  return [Number(i), f];
}

function build(op, places, max) {
  const scale = places === 2 ? 100 : 10;
  const top = max * scale;
  if (op === '+') {
    const a = decimalUnits(1, top - 1, scale);
    const b = decimalUnits(1, Math.max(1, top - a), scale);
    const A = num(a, scale), B = num(b, scale), ans = num(a + b, scale);
    const [ia, fa] = parts(A, places); const [ib, fb] = parts(B, places);
    const sumFrac = Number(fa) + Number(fb);
    const mistakes = [
      num((a + b) * 10, scale), num(Math.round((a + b) / 10), scale),
      sumFrac >= scale ? Number(`${ia + ib}.${sumFrac}`) : null,   // carry forgotten: 3.7 + 2.5 → 5.12
      ans + 1 / scale * (Math.random() < 0.5 ? 1 : -1) * (scale === 100 ? 10 : 1),
      Number(`${ia + ib}.${String(Number(fa) + Number(fb)).padStart(places, '0').slice(-places)}`),
    ];
    // Not lined up: 3.5 + 2.25 read as 35 + 225 hundredths → 2.60.
    const sa = String(A).replace('.', ''), sb = String(B).replace('.', '');
    if (String(A).split('.')[1]?.length !== String(B).split('.')[1]?.length) mistakes.push(num(Number(sa) + Number(sb), scale));
    return { a: A, b: B, ans, units: [a, b, a + b], scale, mistakes, tip: 'add',
      steps: [`${A} + ${B} → ${a} + ${b} = ${a + b}`, `${a + b} ÷ ${scale} = ${ans}`] };
  }
  if (op === '-') {
    const a = decimalUnits(2, top, scale);
    const b = decimalUnits(1, a - 1, scale);
    const A = num(a, scale), B = num(b, scale), ans = num(a - b, scale);
    const [ia, fa] = parts(A, places); const [ib, fb] = parts(B, places);
    const mistakes = [
      num((a - b) * 10, scale), num(Math.round((a - b) / 10), scale),
      // borrow forgotten: 7.2 − 1.8 → 6.6 (the small digit taken from the big one)
      Number(`${ia - ib}.${String(Math.abs(Number(fa) - Number(fb))).padStart(places, '0')}`),
      num(a + b, scale),
      ans + (scale === 100 ? 0.1 : 0.1) * (Math.random() < 0.5 ? 1 : -1),
    ];
    return { a: A, b: B, ans, units: [a, b, a - b], scale, mistakes, tip: 'sub',
      steps: [`${A} − ${B} → ${a} − ${b} = ${a - b}`, `${a - b} ÷ ${scale} = ${ans}`] };
  }
  if (op === '*') {
    const k = rnd(2, 9);
    const a = decimalUnits(1, Math.max(1, Math.floor(top / k)), scale);
    const A = num(a, scale), ans = num(a * k, scale);
    const mistakes = [
      a * k,                                   // point forgotten: 0.5 × 6 → 30
      num(a * k * 10, scale), num(Math.round(a * k / 10), scale),
      Math.trunc(A) * k + Number(`0.${parts(A, places)[1]}`) ,   // only the whole part multiplied
      ans + A,                                 // one time too many
    ];
    return { a: A, b: k, ans, units: [a, k, a * k], scale, mistakes, tip: 'mul',
      steps: [`${A} × ${k} → ${a} × ${k} = ${a * k}`, `${a * k} ÷ ${scale} = ${ans}`] };
  }
  // ÷: the answer first, then × the divisor, so it is always exact.
  const k = rnd(2, 9);
  const r = decimalUnits(1, Math.max(1, Math.floor(top / k)), scale);
  const A = num(r * k, scale), ans = num(r, scale);
  const mistakes = [
    r,                                         // point forgotten
    num(r * 10, scale), num(Math.round(r / 10), scale),
    num(r * k - k * scale, scale) > 0 ? num(r * k - k * scale, scale) : null,
    ans + (scale === 100 ? 0.01 : 0.1),
  ];
  return { a: A, b: k, ans, units: [r * k, k, r], scale, mistakes, tip: 'div',
    steps: [`${A} ÷ ${k} → ${r * k} ÷ ${k} = ${r}`, `${r} ÷ ${scale} = ${ans}`] };
}

// Four choices: the answer and classic mistakes (never the same value twice,
// never ≤ 0), then near values to fill.
function decimalChoices(ans, mistakes, places) {
  const key = v => Math.round(v * 100);
  const out = [ans]; const seen = new Set([key(ans)]);
  const add = v => {
    if (v == null || !Number.isFinite(v)) return;
    const n = Number(Number(v).toFixed(places === 2 ? 2 : 2));
    if (n <= 0 || seen.has(key(n)) || out.length >= 4) return;
    seen.add(key(n)); out.push(n);
  };
  mistakes.forEach(add);
  const step = places === 2 ? 0.01 : 0.1;
  for (const k of [1, -1, 2, -2, 10, -10, 3, 5]) add(ans + k * step);
  for (let k = 4; out.length < 4; k++) add(ans + k);
  return out.sort(() => Math.random() - 0.5);
}

export function makeDecimalQuestion(rawSettings) {
  const s = decimalSettings(rawSettings);
  const op = pick(s.ops);
  const q = build(op, s.places, s.max);
  const sym = SYMBOL[op];
  const line = `${text(q.a)} ${sym} ${text(q.b)}`;
  return {
    text: `${line} = ?`, answer: q.ans, op: 'dec', decOp: op, decimal: true, a: q.a, b: q.b,
    tip: DECIMAL_TIPS[q.tip], steps: q.steps, check: `${line} = ${text(q.ans)}`,
    choices: decimalChoices(q.ans, q.mistakes, s.places),
  };
}

// A typed or picked answer equals the decimal answer: 3.5, "3,5" and 3.50
// are the same (compared in hundredths, no floating-point surprise).
export function sameDecimal(a, b) {
  const v = x => Number(String(x).replace(',', '.'));
  const x = v(a), y = v(b);
  return Number.isFinite(x) && Number.isFinite(y) && Math.round(x * 100) === Math.round(y * 100);
}
