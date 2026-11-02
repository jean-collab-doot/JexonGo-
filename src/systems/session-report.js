// End-of-game report and mistake notebook.
//  - Every answer of the game is counted by theme (op: + − × ÷ ^ alg frac pct):
//    right or wrong, and how long it took. The report gives the number of
//    questions, the success %, the average answer time, the best theme and
//    the theme to work on again.
//  - Missed questions (wrong answer or time out) go into the notebook, kept
//    for the whole visit (memory only: nothing is saved, nothing is sent).
//    At the end of a game a few of them can be played again; a question
//    answered right in the replay leaves the notebook.
// Pure (no game state import), so it can be tested on its own.

const NOTEBOOK_MAX = 20;
export const REPLAY_COUNT = 3;

let _answers = [];      // this game: { op, outcome: 'correct' | 'wrong' | 'timeout' | 'hit', seconds }
let _notebook = [];     // missed questions, newest first: { q, misses, game }
let _game = 0;          // number of the current game (this game's misses are replayed first)

export function startSessionReport() {
  _answers = [];
  _game++;
}

// outcome: 'correct', 'wrong', 'timeout' or 'hit' (a missile took the
// question away: counted as a question, not as a math mistake).
export function recordAnswer(q, outcome, seconds) {
  if (!q) return;
  _answers.push({ op: q.op || '+', outcome, seconds: Math.max(0, Number(seconds) || 0) });
  if (outcome !== 'wrong' && outcome !== 'timeout') return;
  const key = `${q.text}|${q.answer}`;
  const old = _notebook.findIndex(e => `${e.q.text}|${e.q.answer}` === key);
  const misses = old >= 0 ? _notebook[old].misses + 1 : 1;
  if (old >= 0) _notebook.splice(old, 1);
  const { typed, ...copy } = q;   // replayed with its choices, never typed
  _notebook.unshift({ q: copy, misses, game: _game });
  _notebook.length = Math.min(_notebook.length, NOTEBOOK_MAX);
}

// { total, correct, successPct, avgSeconds, best, rework, mistakes }
// best / rework: { op, correct, total, pct } or null.
export function sessionReport() {
  const total = _answers.length;
  const correct = _answers.filter(a => a.outcome === 'correct').length;
  const timed = _answers.filter(a => a.outcome === 'correct' || a.outcome === 'wrong');
  const avgSeconds = timed.length ? timed.reduce((s, a) => s + a.seconds, 0) / timed.length : null;
  const byOp = {};
  for (const a of _answers) {
    if (a.outcome === 'hit') continue;   // not a math answer
    const t = byOp[a.op] || (byOp[a.op] = { op: a.op, correct: 0, total: 0, seconds: 0 });
    t.total++;
    if (a.outcome === 'correct') t.correct++;
    t.seconds += a.seconds;
  }
  const themes = Object.values(byOp).map(t => ({ ...t, pct: Math.round((t.correct / t.total) * 100), avg: t.seconds / t.total }));
  // To work on: the lowest success (then the slowest), only if not perfect.
  const rework = themes.filter(t => t.pct < 100)
    .sort((x, y) => x.pct - y.pct || y.avg - x.avg)[0] || null;
  // Best: the highest success (then the fastest), another theme than rework,
  // with at least one right answer.
  const best = themes.filter(t => t !== rework && t.correct > 0)
    .sort((x, y) => y.pct - x.pct || x.avg - y.avg)[0] || null;
  const strip = t => t && { op: t.op, correct: t.correct, total: t.total, pct: t.pct };
  return {
    total, correct,
    successPct: total ? Math.round((correct / total) * 100) : 0,
    avgSeconds,
    best: strip(best), rework: strip(rework),
    mistakes: _notebook.length,
  };
}

// Up to `count` missed questions to play again: this game's first, then the
// older ones, the most missed first.
export function mistakesToReplay(count = REPLAY_COUNT) {
  const order = (x, y) => (y.game === _game) - (x.game === _game) || y.misses - x.misses;
  return [..._notebook].sort(order).slice(0, count).map(e => e.q);
}

// A replayed question answered right leaves the notebook.
export function markReplayed(q, correct) {
  if (!correct) return;
  const key = `${q.text}|${q.answer}`;
  _notebook = _notebook.filter(e => `${e.q.text}|${e.q.answer}` !== key);
}
