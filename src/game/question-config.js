// Question settings of a game, from the player's onboarding choices and
// school year (moved out of screens/game.js): which operations a level asks,
// how big the numbers get, extra topics (exponents, algebra, fractions,
// percentages), the level length and the timer bonus.
import { G } from '../state.js';
import { chosenBasicOpsForLevel, chosenExtraOps } from '../systems/question-topics.js';
import { schoolYearOfLevel } from '../systems/school-questions.js';

// Each grade has its own ops, number cap, and multiplication cap.
// Level config values are clamped DOWN to the grade ceiling — never up.
const REASONABLE_GRADE_PROFILES = {
  1: { ops: ['+'],                cap: 20,  mCap: 4  },
  2: { ops: ['+', '-'],           cap: 30,  mCap: 5  },
  3: { ops: ['+', '-', '*'],      cap: 45,  mCap: 7  },
  4: { ops: ['+', '-', '*', '/'], cap: 70,  mCap: 9  },
  5: { ops: ['+', '-', '*', '/'], cap: 100, mCap: 11 },
  6: { ops: ['+', '-', '*', '/'], cap: 140, mCap: 12 },
};

function normalizeOps(ops) {
  const map = {
    '+': '+', add: '+', addition: '+',
    '-': '-', sub: '-', subtraction: '-',
    '*': '*', x: '*', '×': '*', mul: '*', multiplication: '*',
    '/': '/', '÷': '/', div: '/', division: '/',
  };
  const list = Array.isArray(ops) ? ops : [ops];
  return [...new Set(list.map(op => map[String(op || '').toLowerCase().trim()]).filter(Boolean))];
}

export function applyGradeToQuestion(ops, cap, mCap, grade) {
  const selectedOps = G.practiceMode ? normalizeOps(ops) : selectedFocusOperations();
  const selectedAllowedOps = selectedOps.filter(op => ['+', '-', '*', '/'].includes(op));
  // Levels ask only the operations the player chose: inside this level's own
  // set when some of them are in it, else the chosen ones
  // (systems/question-topics.js).
  const focusInLevel = G.practiceMode ? selectedAllowedOps : chosenBasicOpsForLevel(ops);
  if (!grade && !focusInLevel.length) return { ops, cap, mCap };
  const p = REASONABLE_GRADE_PROFILES[grade] || REASONABLE_GRADE_PROFILES[6];
  // Pilot setup choices apply for every grade; grade only keeps the numbers reasonable.
  const allowedOps = focusInLevel.length
    ? focusInLevel
    : ops.filter(o => p.ops.includes(o));
  const needsTables = allowedOps.some(op => op === '*' || op === '/');
  const selectedCap = Math.min(cap, p.cap);
  const selectedMCap = needsTables
    ? Math.max(2, Math.min(mCap || p.mCap || 12, p.mCap))
    : Math.min(mCap, p.mCap);
  return {
    ops:  allowedOps.length ? allowedOps : ['+'],
    cap:  selectedCap,
    mCap: selectedMCap,
  };
}

// Exponent / algebra: chosen at onboarding (G.focusTopics) or in the
// practice setup (G.practiceOps). Not part of any level's own op set, so they
// are mixed in on top of it (see nextQuestion).
export function selectedExtraTopicOps({ tutorial = false } = {}) {
  if (G.practiceMode) return (G.practiceOps || []).filter(op => ['^', 'alg', 'frac', 'pct'].includes(op));
  if (tutorial) return [];   // placement rounds stay on + - x /
  return chosenExtraOps();
}

// School year (1-12) from the onboarding class (qc-sec2, fr-4e, us-8...).
export function schoolYearOf(level = G.schoolLevel || '') {
  return schoolYearOfLevel(level);
}

// Size of exponent / algebra questions in levels: the level's own number cap,
// raised for secondary-school players so early levels are not trivial.
export function extraTopicCap(levelCap) {
  const year = schoolYearOf();
  return Math.max(levelCap || 10, year >= 9 ? 40 : year >= 7 ? 25 : 0);
}

export function selectedFocusOperations() {
  const list = Array.isArray(G.focusOperations) && G.focusOperations.length
    ? G.focusOperations
    : G.focusOperation ? [G.focusOperation] : [];
  return [...new Set(list.filter(Boolean))];
}

export function applyOnboardingFocus(ops) {
  const selectedOps = selectedFocusOperations();
  // Same rule as applyGradeToQuestion(): only weight towards the focus
  // operation(s) that this level's own op set already includes.
  const focusOps = selectedOps.filter(op => ops.includes(op));
  if (G.practiceMode || !focusOps.length) return ops;
  return [...focusOps, ...focusOps, ...focusOps];
}

// Practice difficulty also sets the size of the numbers in the equations.
export const PRACTICE_MATH_RANGE = {
  easy:   { cap: 10, mCap: 5 },
  normal: { cap: 20, mCap: 12 },
  hard:   { cap: 40, mCap: 12 },
};

export function applyOnboardingLevelLength(cfg) {
  if (G.practiceMode || cfg.isBossLevel) return cfg;
  const next = { ...cfg };
  if (G.onboardingLevelLength === 'short') {
    next.questionCount = Math.max(3, cfg.questionCount - 2);
  } else if (G.onboardingLevelLength === 'long') {
    next.questionCount = cfg.questionCount + 2;
  }
  return next;
}

export function getOnboardingTimerBonus() {
  let bonus = 0;
  if (G.likesMath === false) bonus += 4;
  if (G.pendingPlacement) bonus += 2;
  return bonus;
}
