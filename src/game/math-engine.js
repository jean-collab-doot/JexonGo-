function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function normalizeOps(ops) {
  const map = {
    '+': '+', add: '+', addition: '+',
    "moins": '-',
    '-': '-', sub: '-', subtraction: '-',
    '*': '*', x: '*', '×': '*', mul: '*', multiplication: '*',
    '/': '/', '÷': '/', div: '/', division: '/',
    '^': '^', exponent: '^', exposant: '^',
    alg: 'alg', algebra: 'alg', algebre: 'alg', 'algèbre': 'alg',
  };
  const list = Array.isArray(ops) ? ops : [ops];
  const normalized = [...new Set(list.map(op => map[String(op || '').toLowerCase().trim()]).filter(Boolean))];
  return normalized.length ? normalized : ['+'];
}

const SUPERSCRIPT = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸' };

// Kind of exponent / algebra question, 1 (easiest) to 4. Levels pass it from
// the player's school year (systems/school-questions.js), so a small number
// limit only makes the numbers smaller, never the question simpler. Without
// it (practice), the kind follows the size of the numbers as before.
function tierFromCap(cap) {
  return cap <= 15 ? 1 : cap <= 30 ? 2 : 3;
}

// Exponent: "3² = ?". Tier 1 squares, 2 squares and cubes, 3-4 also powers
// of 2. `cap` limits the base.
function makeExponentQuestion(cap, tier = tierFromCap(cap)) {
  let base, exp;
  const roll = Math.random();
  const top = n => Math.max(2, Math.min(n, cap));
  if (tier <= 1) {
    base = rnd(2, top(cap <= 15 ? 5 : 10)); exp = 2;
  } else if (tier === 2) {
    if (roll < 0.7) { base = rnd(2, top(10)); exp = 2; } else { base = rnd(2, top(4)); exp = 3; }
  } else if (roll < 0.5) {
    base = rnd(2, top(tier >= 4 ? 15 : 12)); exp = 2;
  } else if (roll < 0.8) {
    base = rnd(2, top(5)); exp = 3;
  } else {
    base = 2; exp = rnd(4, 8);
  }
  const answer = base ** exp;
  return { text: `${base}${SUPERSCRIPT[exp]} = ?`, answer, a: base, b: exp, op: '^' };
}

// Algebra: find x (always a whole number). Tier 1 one-step + / −, tier 2
// adds one-step × / ÷, tier 3 adds two-step "ax + b = c", tier 4 is mostly
// two-step, with "a(x + b) = c". `cap` limits x and the numbers added.
const ALGEBRA_KINDS = {
  1: ['add', 'sub'],
  2: ['add', 'sub', 'mul', 'div'],
  3: ['add', 'sub', 'mul', 'div', 'two', 'two'],
  4: ['mul', 'div', 'two', 'two', 'two', 'paren', 'paren'],
};
function makeAlgebraQuestion(cap, tier = tierFromCap(cap)) {
  const x = rnd(1, Math.max(5, Math.min(cap, 20)));
  const kinds = ALGEBRA_KINDS[Math.max(1, Math.min(4, tier))];
  const kind = kinds[rnd(0, kinds.length - 1)];
  const addMax = Math.max(5, Math.min(cap, tier >= 3 ? 50 : 20));
  let eq;
  if (kind === 'add') {
    const a = rnd(1, addMax); eq = `x + ${a} = ${x + a}`;
  } else if (kind === 'sub') {
    const a = rnd(1, addMax); eq = `x − ${a} = ${x}`;
    return { text: `${eq}, x = ?`, answer: x + a, a: x + a, b: a, op: 'alg' };
  } else if (kind === 'mul') {
    const a = rnd(2, 9); eq = `${a}x = ${a * x}`;
  } else if (kind === 'div') {
    const a = rnd(2, 9); eq = `x ÷ ${a} = ${x}`;
    return { text: `${eq}, x = ?`, answer: x * a, a: x * a, b: a, op: 'alg' };
  } else if (kind === 'paren') {
    const a = rnd(2, 6); const b = rnd(1, Math.min(addMax, 12)); eq = `${a}(x + ${b}) = ${a * (x + b)}`;
  } else {
    const a = rnd(2, tier >= 4 ? 9 : 6); const b = rnd(1, Math.min(addMax, tier >= 4 ? 30 : 15));
    eq = `${a}x + ${b} = ${a * x + b}`;
  }
  return { text: `${eq}, x = ?`, answer: x, a: x, b: 0, op: 'alg' };
}

// `mins` (optional, from the school year): smallest numbers in + − (add, 0
// allowed: "0 - 10") and in the × ÷ tables (table), so older players do not
// get 2 + 3 or 2 × 2.
function makeQuestion(ops, cap, multCap, tier, mins = {}) {
  const safeOps = normalizeOps(ops);
  const op = safeOps[rnd(0, safeOps.length - 1)];
  if (op === '^') return makeExponentQuestion(cap, tier);
  if (op === 'alg') return makeAlgebraQuestion(cap, tier);
  let a, b, answer;
  const lo = Math.max(0, Math.min(mins.add ?? 1, Math.floor(cap / 2)));
  const mc = multCap || 12;
  const tlo = Math.max(2, Math.min(mins.table || 2, mc));

  switch (op) {
    case '+':
      a = rnd(lo, cap);  b = rnd(lo, cap);  answer = a + b;
      break;
    case '-':
      a = rnd(Math.max(2, lo), cap);  b = rnd(Math.min(Math.ceil(lo / 2), a), a);  answer = a - b;
      break;
    case '*':
      a = rnd(tlo, mc);   b = rnd(2, mc);   answer = a * b;
      break;
    default: // '/'  — always yields whole-number results
      b = rnd(tlo, mc);   answer = rnd(Math.max(1, tlo - 1), mc);  a = b * answer;
      break;
  }

  // Real minus sign (−): wider and easier to read than '-', on phones too.
  const sym = op === '*' ? '×' : op === '/' ? '÷' : op === '-' ? '−' : op;
  return { text: `${a} ${sym} ${b} = ?`, answer, a, b, op };
}

// `max` (optional): the player's number range; wrong choices stay in it
// when there is room.
function makeChoices(answer, max = Infinity) {
  const set  = new Set([answer]);
  const pool = [-3,-2,-1,1,2,3,-4,4,-5,5,6,-6,7,-7].sort(() => Math.random() - 0.5);
  for (const off of pool) {
    if (set.size >= 4) break;
    const c = answer + off;
    if (c > 0 && c <= max && !set.has(c)) set.add(c);
  }
  for (const off of pool) {
    if (set.size >= 4) break;
    const c = answer + off;
    if (c > 0 && !set.has(c)) set.add(c);
  }
  while (set.size < 4) set.add(answer + set.size * 11);
  return [...set].sort(() => Math.random() - 0.5);
}

// A question made elsewhere (game/algebra.js) gets its 4 choices here.
export function withChoices(q, max) {
  q.choices = makeChoices(q.answer, max);
  return q;
}

export function newQuestion(ops, cap, multCap, tier, mins) {
  const q = makeQuestion(ops, cap, multCap, tier, mins);
  q.choices = makeChoices(q.answer);
  return q;
}

// ============================================================================
// ZONE DE PRATIQUE — c'est ici que tu t'entraînes, pour de vrai, dans ton jeu
// ============================================================================
// Rien ici n'est utilisé par le jeu pour l'instant (aucune autre fonction ne
// l'appelle) — donc tu peux essayer, te tromper, recommencer, sans AUCUN
// risque de casser une vraie partie. C'est un vrai bac à sable, dans un vrai
// fichier de ton vrai projet.

// ── Exercice A (petit, une ligne) ────────────────────────────────────────
// Remonte dans normalizeOps() ci-dessus et ajoute l'alias "moins" pour la
// soustraction, à côté de "'-': '-', sub: '-', subtraction: '-',".
// Teste dans la console du navigateur (F12) une fois le jeu lancé :
//   normalizeOps(['moins'])   →  doit donner ['-']
// (Cette fonction n'est pas exportée, donc pour tester facilement, ajoute
// temporairement "export" devant "function normalizeOps" pendant que tu testes.)

// ── Exercice B (plus grand) — écris cette fonction toi-même ─────────────
// makeSquareQuestion(cap) doit créer une question du genre "7² = ?"
//   1. a = un nombre entre 2 et cap → utilise rnd(2, cap), déjà tout en haut
//   2. answer = a * a
//   3. text = `${a}² = ?`
//   4. renvoie un objet { text, answer, a, b: a, op: '²' }  (même forme que
//      ce que renvoie makeQuestion plus haut)

export function makeSquareQuestion(cap) {
  const a = rnd(2, cap);
  const answer = a * a;
  return { text: `${a}² = ?`, answer, a, b: a, op: '²' };
}

// Pour voir ta fonction tourner pour de vrai dans le jeu : lance
// "npm run dev", ouvre jexongo.app en local, appuie sur F12 pour ouvrir la
// console du navigateur, et tape :  makeSquareQuestion(10)
// (il faudra peut-être d'abord taper : import('/src/game/math-engine.js').then(m => window.msq = m.makeSquareQuestion)
// puis utiliser window.msq(10) — demande-moi si cette étape te perd, on la
// fera ensemble.)


// ============================================================================
//                  ⬇ SOLUTION DE L'EXERCICE B EN DESSOUS ⬇
//               (essaie vraiment avant d'aller voir celle-là)
// ============================================================================
//
// export function makeSquareQuestion(cap) {
//   const a = rnd(2, cap);
//   const answer = a * a;
//   return { text: `${a}² = ?`, answer, a, b: a, op: '²' };
// }
