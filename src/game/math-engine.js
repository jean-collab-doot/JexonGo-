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

// Exponent: "3² = ?". Bigger `cap` (level / practice difficulty) = bigger
// bases and higher powers.
function makeExponentQuestion(cap) {
  let base, exp;
  const roll = Math.random();
  if (cap <= 15) {
    base = rnd(2, 5); exp = 2;
  } else if (cap <= 30) {
    if (roll < 0.7) { base = rnd(2, 10); exp = 2; } else { base = rnd(2, 4); exp = 3; }
  } else if (roll < 0.5) {
    base = rnd(2, 12); exp = 2;
  } else if (roll < 0.8) {
    base = rnd(2, 5); exp = 3;
  } else {
    base = 2; exp = rnd(4, 8);
  }
  const answer = base ** exp;
  return { text: `${base}${SUPERSCRIPT[exp]} = ?`, answer, a: base, b: exp, op: '^' };
}

// Algebra: find x (always a whole number). Small caps = one-step + / −,
// then one-step × / ÷, then two-step "ax + b = c".
function makeAlgebraQuestion(cap) {
  const x = rnd(1, Math.max(5, Math.min(cap, 20)));
  const kinds = cap <= 15 ? ['add', 'sub'] : cap <= 30 ? ['add', 'sub', 'mul', 'div'] : ['add', 'sub', 'mul', 'div', 'two', 'two'];
  const kind = kinds[rnd(0, kinds.length - 1)];
  let eq;
  if (kind === 'add') {
    const a = rnd(1, cap); eq = `x + ${a} = ${x + a}`;
  } else if (kind === 'sub') {
    const a = rnd(1, cap); eq = `x − ${a} = ${x}`;
    return { text: `${eq}, x = ?`, answer: x + a, a: x + a, b: a, op: 'alg' };
  } else if (kind === 'mul') {
    const a = rnd(2, 9); eq = `${a}x = ${a * x}`;
  } else if (kind === 'div') {
    const a = rnd(2, 9); eq = `x ÷ ${a} = ${x}`;
    return { text: `${eq}, x = ?`, answer: x * a, a: x * a, b: a, op: 'alg' };
  } else {
    const a = rnd(2, 6); const b = rnd(1, 15); eq = `${a}x + ${b} = ${a * x + b}`;
  }
  return { text: `${eq}, x = ?`, answer: x, a: x, b: 0, op: 'alg' };
}

function makeQuestion(ops, cap, multCap) {
  const safeOps = normalizeOps(ops);
  const op = safeOps[rnd(0, safeOps.length - 1)];
  if (op === '^') return makeExponentQuestion(cap);
  if (op === 'alg') return makeAlgebraQuestion(cap);
  let a, b, answer;

  switch (op) {
    case '+':
      a = rnd(1, cap);  b = rnd(1, cap);  answer = a + b;
      break;
    case '-':
      a = rnd(2, cap);  b = rnd(1, a);    answer = a - b;
      break;
    case '*': {
      const mc = multCap || 12;
      a = rnd(2, mc);   b = rnd(2, mc);   answer = a * b;
      break;
    }
    default: { // '/'  — always yields whole-number results
      const mc = multCap || 12;
      b = rnd(2, mc);   answer = rnd(1, mc);  a = b * answer;
      break;
    }
  }

  const sym = op === '*' ? '×' : op === '/' ? '÷' : op;
  return { text: `${a} ${sym} ${b} = ?`, answer, a, b, op };
}

function makeChoices(answer) {
  const set  = new Set([answer]);
  const pool = [-3,-2,-1,1,2,3,-4,4,-5,5,6,-6,7,-7].sort(() => Math.random() - 0.5);
  for (const off of pool) {
    if (set.size >= 4) break;
    const c = answer + off;
    if (c > 0 && !set.has(c)) set.add(c);
  }
  while (set.size < 4) set.add(answer + set.size * 11);
  return [...set].sort(() => Math.random() - 0.5);
}

export function newQuestion(ops, cap, multCap) {
  const q = makeQuestion(ops, cap, multCap);
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
