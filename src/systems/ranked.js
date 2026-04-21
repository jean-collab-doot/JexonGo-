import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { newQuestion } from '../game/math-engine.js';
import {
  getRankInfo, calcLPChange, generateOpponent,
  simulateOpponentAnswer, getSeasonEnd, SEASON_DAYS, SOFT_RESET_PCT
} from '../data/ranked.js';

// ── SEASON MANAGEMENT ─────────────────────────────────────────────────────────

export function checkSeason() {
  const now = Date.now();
  if (!G.rankedSeasonStart) {
    G.rankedSeasonStart = now;
    save('rankedSeasonStart', now);
    return;
  }
  const end = getSeasonEnd(G.rankedSeasonStart);
  if (now >= end) _newSeason();
}

function _newSeason() {
  // Soft reset: keep SOFT_RESET_PCT of LP above 0
  const kept = Math.floor(Math.max(0, G.rankedLP) * SOFT_RESET_PCT);
  G.rankedLP          = kept;
  G.rankedSeasonStart = Date.now();
  G.rankedWins        = 0;
  G.rankedLosses      = 0;
  G.rankedWinStreak   = 0;
  G.rankedGamesPlayed = 0;
  G.rankedFirstWinToday = null;
  save('rankedLP',           G.rankedLP);
  save('rankedSeasonStart',  G.rankedSeasonStart);
  save('rankedWins',         0);
  save('rankedLosses',       0);
  save('rankedWinStreak',    0);
  save('rankedGamesPlayed',  0);
}

export function seasonTimeLeft() {
  if (!G.rankedSeasonStart) return null;
  const ms = getSeasonEnd(G.rankedSeasonStart) - Date.now();
  if (ms <= 0) return '0d 0h';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return `${d}d ${h}h`;
}

// ── MATCH GENERATION ──────────────────────────────────────────────────────────
// Returns a full match config: opponent info + 10 questions

export const MATCH_QUESTIONS = 10;

export function generateMatch() {
  checkSeason();
  const opponent  = generateOpponent(G.rankedLP || 0);
  const questions = [];
  const ops       = ['+', '-', '*', '/'];
  const level     = Math.min(10, Math.max(1, Math.floor((G.rankedLP || 0) / 200) + 1));

  const cap    = 10 + level * 2;
  const multCap = Math.min(12, 2 + level);

  for (let i = 0; i < MATCH_QUESTIONS; i++) {
    const q = newQuestion(ops, cap, multCap);
    questions.push({ ...q });
  }

  // Pre-simulate opponent answers
  const oppAnswers = questions.map(() => simulateOpponentAnswer(opponent.lp));

  return { opponent, questions, oppAnswers };
}

// ── RESULT PROCESSING ─────────────────────────────────────────────────────────

export function processMatchResult(won, opponentLP) {
  const today = new Date().toISOString().slice(0, 10);
  let firstWinBonus = 0;

  if (won) {
    G.rankedWins      = (G.rankedWins      || 0) + 1;
    G.rankedWinStreak = (G.rankedWinStreak || 0) + 1;

    // First win of the day bonus
    if (G.rankedFirstWinToday !== today) {
      G.rankedFirstWinToday = today;
      firstWinBonus = 10;
      save('rankedFirstWinToday', today);
    }
  } else {
    G.rankedLosses    = (G.rankedLosses    || 0) + 1;
    G.rankedWinStreak = 0;
  }

  G.rankedGamesPlayed = (G.rankedGamesPlayed || 0) + 1;

  const lpChange = calcLPChange({
    won,
    playerLP:    G.rankedLP || 0,
    opponentLP,
    gamesPlayed: G.rankedGamesPlayed,
    winStreak:   G.rankedWinStreak,
  }) + firstWinBonus;

  const oldLP = G.rankedLP || 0;
  G.rankedLP  = Math.max(0, oldLP + lpChange);

  const oldRank = getRankInfo(oldLP);
  const newRank = getRankInfo(G.rankedLP);
  const promoted = newRank.tier.id !== oldRank.tier.id && G.rankedLP > oldLP;
  const demoted  = newRank.tier.id !== oldRank.tier.id && G.rankedLP < oldLP;

  save('rankedLP',          G.rankedLP);
  save('rankedWins',        G.rankedWins);
  save('rankedLosses',      G.rankedLosses);
  save('rankedWinStreak',   G.rankedWinStreak);
  save('rankedGamesPlayed', G.rankedGamesPlayed);

  return { lpChange, firstWinBonus, promoted, demoted, newRank, oldRank };
}
