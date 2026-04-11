function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function makeQuestion(ops, level) {
  const op  = ops[rnd(0, ops.length - 1)];
  const cap = level <= 10 ? 10 : level <= 25 ? 20 : 12;
  let a, b, answer;

  switch (op) {
    case '+': a = rnd(1, cap);  b = rnd(1, cap);  answer = a + b;     break;
    case '-': a = rnd(2, cap);  b = rnd(1, a);    answer = a - b;     break;
    case '*': a = rnd(2, Math.min(cap, 12)); b = rnd(2, Math.min(cap, 12)); answer = a * b; break;
    default:  b = rnd(2, 12);   answer = rnd(1, 12); a = b * answer;  break; // '/'
  }

  const sym = op === '*' ? '×' : op === '/' ? '÷' : op;
  return { text: `${a} ${sym} ${b} = ?`, answer };
}

function makeChoices(answer) {
  const set = new Set([answer]);
  const pool = [-3,-2,-1,1,2,3,-4,4,-5,5,6,-6,7,-7].sort(() => Math.random() - 0.5);
  for (const off of pool) {
    if (set.size >= 4) break;
    const c = answer + off;
    if (c > 0 && !set.has(c)) set.add(c);
  }
  while (set.size < 4) set.add(answer + set.size * 11);
  return [...set].sort(() => Math.random() - 0.5);
}

export function newQuestion(ops, level) {
  const q = makeQuestion(ops, level);
  q.choices = makeChoices(q.answer);
  return q;
}
