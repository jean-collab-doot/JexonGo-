// Questions of the normal levels, set by the player's SCHOOL YEAR (the class
// chosen at onboarding, G.schoolLevel). Used by the game (game.js
// nextQuestion) and by the level description (briefing.js) so they agree.
//  - The school year sets the kind of question and the size of the numbers;
//    the level number only makes the numbers grow (up to level 30).
//  - Only the topics chosen by the player (G.focusTopics) are asked, each
//    about as often as the others, at the level of their school year.
//    Nothing chosen: the year's own topics.
//  - Algebra comes from game/algebra.js: one kind of equation per school
//    year, every number (question and answer) inside the number range.
//  - + − × ÷ and exponent come from game/arithmetic.js: friendly numbers
//    for mental math, simple decimals from 6e in small ranges.
//  - Fractions (game/fractions.js) and percentages (game/percentages.js):
//    only when chosen, at the level of the school year.
//  - Negative numbers (game/negatives.js) are not a topic: they come inside
//    the chosen topics, by school year. CM2-6e: some + − questions use them
//    (thermometer); from 5e: some + − × ÷ questions and some equations (sign
//    rules). Range "0 - 100" becomes −100 ... 100.
//  - Each year also has smallest numbers (no 2 + 3 or 2 × 2 in high school).
//  - Number limit (G.numberRangeMax, "0 - 100"...): only changes the size of
//    the numbers, never the kind of question.
// No school year saved (old accounts): null, game.js keeps the old rule.
// Pure (no game state import), so it can be tested on its own.
import { withChoices } from '../game/math-engine.js';
import { makeSchoolArithmetic, makeSchoolExponent } from '../game/arithmetic.js';
import { makeSchoolAlgebraQuestion } from '../game/algebra.js';
import { makeNegativeQuestion, NEGATIVES_FROM_SCHOOL_YEAR, SIGN_RULES_FROM_SCHOOL_YEAR } from '../game/negatives.js';
import { makeFractionQuestion } from '../game/fractions.js';
import { makePercentQuestion } from '../game/percentages.js';

// School year 1-12 from the onboarding class (qc-prim3, fr-2nde, us-10...);
// 0 when unknown.
export function schoolYearOfLevel(level = '') {
  const qc = level.match(/^qc-(prim|sec)(\d)/);
  if (qc) return qc[1] === 'sec' ? 6 + Number(qc[2]) : Number(qc[2]);
  const us = level.match(/^us-(\d+)/);
  if (us) return Number(us[1]);
  const fr = { 'fr-cp': 1, 'fr-ce1': 2, 'fr-ce2': 3, 'fr-cm1': 4, 'fr-cm2': 5, 'fr-6e': 6, 'fr-5e': 7, 'fr-4e': 8, 'fr-3e': 9, 'fr-2nde': 10, 'fr-1re': 11, 'fr-term': 12 };
  return fr[level] || 0;
}

// Per school year: topics with their weight (how often they come up), size
// of + − numbers [level 1, level 30+], size of × ÷ tables, smallest numbers
// (min: + − / × ÷ tables) and the kind of exponent / algebra question
// (math-engine.js tier).
const ARITH = { '+': 1, '-': 1, '*': 1, '/': 1 };
const SCHOOL_YEAR_PROFILES = {
  1:  { ops: { '+': 1 },                          cap: [5, 10],      mCap: [5, 5],   min: [0, 2],   tier: 1 },
  2:  { ops: { '+': 1, '-': 1 },                  cap: [10, 20],     mCap: [5, 5],   min: [0, 2],   tier: 1 },
  3:  { ops: { '+': 1, '-': 1, '*': 1 },          cap: [20, 100],    mCap: [5, 5],   min: [5, 2],   tier: 1 },
  4:  { ops: ARITH,                               cap: [50, 100],    mCap: [6, 10],  min: [5, 2],   tier: 1 },
  5:  { ops: ARITH,                               cap: [100, 500],   mCap: [10, 12], min: [10, 3],  tier: 1 },
  6:  { ops: ARITH,                               cap: [100, 1000],  mCap: [12, 12], min: [10, 3],  tier: 1 },
  7:  { ops: { ...ARITH, '^': 1 },                cap: [100, 1000],  mCap: [12, 12], min: [20, 4],  tier: 2 },
  8:  { ops: { ...ARITH, '^': 1, alg: 2 },        cap: [200, 1000],  mCap: [12, 12], min: [20, 4],  tier: 2 },
  9:  { ops: { ...ARITH, '^': 1, alg: 3 },        cap: [500, 1000],  mCap: [12, 15], min: [30, 5],  tier: 3 },
  10: { ops: { '*': 1, '/': 1, '^': 2, alg: 4 },  cap: [500, 1000],  mCap: [12, 15], min: [50, 6],  tier: 4 },
  11: { ops: { '*': 1, '/': 1, '^': 2, alg: 4 },  cap: [1000, 1000], mCap: [15, 15], min: [50, 6],  tier: 4 },
  12: { ops: { '*': 1, '/': 1, '^': 2, alg: 4 },  cap: [1000, 1000], mCap: [15, 15], min: [50, 6],  tier: 4 },
};
const FULL_SIZE_LEVEL = 30;
// Algebra and negative numbers range without a chosen one: [level 1, level 30+].
const ALGEBRA_RANGE = [30, 100];
// From CM2, share of + − (and from 5e also × ÷) questions with negative numbers.
const NEGATIVE_SHARE = 0.25;
const TOPIC_OPS = { '+': '+', '-': '-', '*': '*', '/': '/', exponent: '^', algebra: 'alg', fractions: 'frac', percentages: 'pct' };

// Topics the player chose (onboarding / equation settings), as ops.
function chosenOps(state) {
  const topics = state.focusTopics?.length ? state.focusTopics
    : state.focusOperations?.length ? state.focusOperations
    : state.focusOperation ? [state.focusOperation] : [];
  return [...new Set(topics.map(t => TOPIC_OPS[t]).filter(Boolean))];
}

// What a level asks: { year, ops: [[op, weight]...], cap, mCap, mins, tier,
// algLimit }, or null when the school year is unknown.
export function schoolQuestionPlan(state, levelNum = 1) {
  const year = schoolYearOfLevel(state.schoolLevel || '') || Number(state.playerGrade) || 0;
  const p = SCHOOL_YEAR_PROFILES[Math.min(12, year)];
  if (!p) return null;
  const chosen = chosenOps(state);
  const ops = chosen.length ? chosen.map(op => [op, 1]) : Object.entries(p.ops);
  const t = Math.min(1, Math.max(0, (levelNum - 1) / (FULL_SIZE_LEVEL - 1)));
  const grow = ([lo, hi]) => Math.round(lo + (hi - lo) * t);
  let cap = grow(p.cap);
  let mCap = grow(p.mCap);
  let algLimit = grow(ALGEBRA_RANGE);
  const limit = Number(state.numberRangeMax) || 0;
  if (limit > 0) {
    cap = limit;
    mCap = Math.max(2, Math.min(limit, p.mCap[1]));
    algLimit = limit;
  }
  return { year, ops, cap, mCap, mins: { add: p.min[0], table: p.min[1] }, tier: p.tier, algLimit, limit };
}

export function planOps(plan) {
  return plan.ops.map(([op]) => op);
}

function makeOne(plan) {
  const total = plan.ops.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  const [op] = plan.ops.find(([, w]) => (roll -= w) < 0) || plan.ops[0];
  if (op === 'alg') {
    const q = makeSchoolAlgebraQuestion(plan.year, plan.algLimit);
    return q.choices ? q : withChoices(q, plan.algLimit);
  }
  // Fractions and percentages (chosen topics only): numbers inside the range.
  if (op === 'frac') return makeFractionQuestion(plan.year, plan.cap);
  if (op === 'pct') return makePercentQuestion(plan.year, plan.cap);
  // Negative numbers inside the topic: + − from CM2 (thermometer), × ÷ from 5e.
  const negOps = plan.year >= SIGN_RULES_FROM_SCHOOL_YEAR ? ['+', '-', '*', '/']
    : plan.year >= NEGATIVES_FROM_SCHOOL_YEAR ? ['+', '-'] : [];
  if (negOps.includes(op) && Math.random() < NEGATIVE_SHARE) {
    const q = makeNegativeQuestion(plan.year, plan.cap, op, { mins: plan.mins.add, mCap: plan.mCap });
    if (q) return q;
  }
  if (op === '^') return makeSchoolExponent(plan.year, plan.limit || 1024);
  return makeSchoolArithmetic(op, plan);
}

// Every question must come from one of the plan's topics: anything else is
// thrown away and drawn again.
export function questionFromPlan(plan) {
  const topics = planOps(plan);
  let q = makeOne(plan);
  for (let i = 0; i < 20 && !topics.includes(q.op); i++) q = makeOne(plan);
  return q;
}
