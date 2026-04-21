import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { SFX } from '../audio/sound.js';
import { getRankInfo, PLACEMENT_MATCHES } from '../data/ranked.js';
import { generateMatch, processMatchResult, seasonTimeLeft, MATCH_QUESTIONS, checkSeason } from '../systems/ranked.js';
import { trackMission } from '../systems/daily.js';
import { t } from '../i18n.js';

// ── RANK BADGE BUILDER ────────────────────────────────────────────────────────
export function buildRankBadge(lp, small = false) {
  const info  = getRankInfo(lp);
  const el    = document.createElement('div');
  el.className = small ? 'rank-badge rank-badge-sm' : 'rank-badge';
  el.style.setProperty('--rc', info.tier.color);
  el.style.setProperty('--rg', info.tier.glow);
  el.innerHTML = `
    <span class="rb-icon">${info.tier.icon}</span>
    <span class="rb-label">${info.divLabel}</span>
    ${!small ? `<span class="rb-lp">${info.lpInDiv} LP</span>` : ''}
  `;
  return el;
}

// ── RANKED LOBBY ──────────────────────────────────────────────────────────────
let _nav = null;

export function initRanked(nav) {
  _nav = nav;
  $('btn-ranked-back').onclick    = () => nav.toMenu();
  $('btn-ranked-play').onclick    = () => _startFindMatch();
  $('btn-ranked-history').onclick = () => _renderHistory();
}

export function renderRankedLobby() {
  checkSeason();
  const lp   = G.rankedLP || 0;
  const info = getRankInfo(lp);
  const games = G.rankedGamesPlayed || 0;
  const isPlacement = games < PLACEMENT_MATCHES;

  // Rank badge
  const badgeWrap = $('ranked-badge-wrap');
  badgeWrap.innerHTML = '';
  badgeWrap.appendChild(buildRankBadge(lp));

  // LP bar
  const bar = $('ranked-lp-bar');
  if (info.lpMax) {
    const pct = Math.round((info.lpInDiv / info.lpMax) * 100);
    bar.style.width = pct + '%';
    bar.style.background = info.tier.color;
  } else {
    bar.style.width = '100%';
  }

  // Stats
  $('ranked-stats').innerHTML =
    isPlacement
      ? `<span class="rk-placement">${t('placementLabel')} ${games}/${PLACEMENT_MATCHES}</span>`
      : `<span class="rk-stat">✔ ${G.rankedWins || 0}</span><span class="rk-stat-sep">/</span><span class="rk-stat rk-stat-loss">✘ ${G.rankedLosses || 0}</span>`;

  // Win streak badge
  const streak = G.rankedWinStreak || 0;
  $('ranked-streak').textContent = streak >= 2 ? `🔥 ${streak} ${t('winStreak')}` : '';
  $('ranked-streak').style.display = streak >= 2 ? '' : 'none';

  // Season timer
  $('ranked-season-timer').textContent = `${t('seasonEnds')}: ${seasonTimeLeft() || '--'}`;

  // Daily first-win bonus indicator
  const today = new Date().toISOString().slice(0, 10);
  const fwDone = G.rankedFirstWinToday === today;
  $('ranked-firstwin').textContent = fwDone ? t('dailyClaimed') : t('dailyBonus');
  $('ranked-firstwin').style.color = fwDone ? '#555' : '#00e84b';
}

// ── FIND MATCH FLOW ───────────────────────────────────────────────────────────
let _matchData = null;

function _startFindMatch() {
  _showScreen('s-ranked-find');
  let dots = 0;
  const iv = setInterval(() => {
    dots = (dots + 1) % 4;
    $('ranked-find-dots').textContent = '.'.repeat(dots);
  }, 400);

  setTimeout(() => {
    clearInterval(iv);
    _matchData = generateMatch();
    _showVsIntro(_matchData);
  }, 1800 + Math.random() * 1200);
}

// ── VS INTRO SCREEN ───────────────────────────────────────────────────────────
function _showVsIntro(match) {
  _showScreen('s-ranked-intro');

  const playerInfo = getRankInfo(G.rankedLP || 0);
  const oppInfo    = getRankInfo(match.opponent.lp);

  // Player side
  $('intro-player-name').textContent = (G.playerName || t('you'));
  $('intro-player-rank').textContent = playerInfo.divLabel;
  $('intro-player-rank').style.color = playerInfo.tier.color;

  // Opponent side
  $('intro-opp-name').textContent = match.opponent.name;
  $('intro-opp-rank').textContent = oppInfo.divLabel;
  $('intro-opp-rank').style.color = oppInfo.tier.color;

  // Animate in
  const sides = document.querySelectorAll('.intro-side');
  sides.forEach(s => s.classList.remove('intro-slide-in'));
  setTimeout(() => sides.forEach(s => s.classList.add('intro-slide-in')), 50);

  setTimeout(() => _startDuel(match), 3200);
}

// ── ROUND HELPER ──────────────────────────────────────────────────────────────
function _getRound(qIdx) {
  if (qIdx <= 3) return 1;
  if (qIdx <= 6) return 2;
  return 3;
}

// Show the round banner for 1200ms (non-blocking)
function _showRoundBanner(roundNum, sid) {
  const banner   = $('duel-round-banner');
  const textEl   = $('duel-round-banner-text');
  const scoreEl  = $('duel-round-score-text');
  if (!banner) return;

  textEl.textContent  = `ROUND ${roundNum}`;
  scoreEl.textContent = `${_playerScore} — ${_oppScore}`;
  banner.classList.remove('hidden', 'duel-round-banner-hide');
  banner.classList.add('duel-round-banner-show');

  setTimeout(() => {
    if (_duelSession !== sid) return;
    banner.classList.remove('duel-round-banner-show');
    banner.classList.add('duel-round-banner-hide');
    setTimeout(() => {
      banner.classList.add('hidden');
      banner.classList.remove('duel-round-banner-hide');
    }, 350);
  }, 1200);
}

// ── DUEL GAME ─────────────────────────────────────────────────────────────────
let _duelSession = 0;
let _playerScore = 0;
let _oppScore    = 0;
let _qIdx        = 0;
let _timerVal    = 0;
let _timerIv     = null;
let _locked      = false;
let _playerTimes = [];
let _oppTimes    = [];

function _startDuel(match) {
  _showScreen('s-ranked-duel');
  _duelSession++;
  const sid = _duelSession;

  _playerScore = 0;
  _oppScore    = 0;
  _qIdx        = 0;
  _playerTimes = [];
  _oppTimes    = [];
  _locked      = false;

  _updateDuelScores();
  _askQuestion(match, sid);
}

function _askQuestion(match, sid) {
  if (_duelSession !== sid) return;
  if (_qIdx >= MATCH_QUESTIONS) { _finishDuel(match); return; }

  const q   = match.questions[_qIdx];
  const opp = match.oppAnswers[_qIdx];
  _locked   = false;

  // Question display
  $('duel-q-num').textContent   = `Q ${_qIdx + 1} / ${MATCH_QUESTIONS}`;
  $('duel-question').textContent = q.text || `${q.a} ${q.op} ${q.b} = ?`;

  // Build answer buttons
  const grid = $('duel-answers');
  grid.innerHTML = '';
  q.choices.forEach(c => {
    const btn = document.createElement('button');
    btn.className   = 'duel-ans-btn';
    btn.textContent = c;
    btn.onclick     = () => { if (!_locked) _playerAnswer(c === q.answer, match, sid); };
    grid.appendChild(btn);
  });

  // Timer
  _timerVal = 10;
  $('duel-timer').textContent = _timerVal;
  if (_timerIv) clearInterval(_timerIv);
  const startTs = Date.now();
  _timerIv = setInterval(() => {
    if (_duelSession !== sid) { clearInterval(_timerIv); return; }
    _timerVal--;
    $('duel-timer').textContent = _timerVal;
    if (_timerVal <= 0) {
      clearInterval(_timerIv);
      if (!_locked) _playerAnswer(false, match, sid, true); // timeout = wrong
    }
  }, 1000);

  // Schedule opponent answer
  const oppDelay = Math.min(opp.time * 1000, 9800);
  setTimeout(() => {
    if (_duelSession !== sid || _locked) return;
    _oppAnswerThisQ(opp.correct, match, sid, (Date.now() - startTs) / 1000);
  }, oppDelay);
}

function _playerAnswer(correct, match, sid, timeout = false) {
  if (_locked || _duelSession !== sid) return;
  clearInterval(_timerIv);

  const rt = 10 - _timerVal + (timeout ? 0 : 0);
  _playerTimes.push(rt);

  if (correct) {
    _playerScore++;
    SFX.correct?.();
    _flashDuelResult('✔', '#00e84b');
  } else {
    SFX.wrong?.();
    _flashDuelResult('✘', '#ff2233');
  }

  // If opp hasn't answered yet, resolve it now
  const opp = match.oppAnswers[_qIdx];
  _oppAnswerThisQ(opp.correct, match, sid, opp.time, true);
}

function _oppAnswerThisQ(correct, match, sid, time, fromPlayer = false) {
  _oppTimes.push(time);
  if (correct && !fromPlayer) {
    _oppScore++;
    _showOppFeedback('✔');
  } else if (!correct && !fromPlayer) {
    _showOppFeedback('✘');
  } else if (!fromPlayer) {
    _showOppFeedback(correct ? '✔' : '✘');
  }
  // Only lock once (prevent double-trigger)
  if (_locked) return;
  _locked = true;
  if (correct && fromPlayer) {
    // Player already scored; now show opp result
    _showOppFeedback(match.oppAnswers[_qIdx].correct ? '✔' : '✘');
    if (match.oppAnswers[_qIdx].correct) _oppScore++;
  }
  _updateDuelScores();

  // Round boundary check: show banner after q4 (idx=3) and q7 (idx=6)
  const prevIdx = _qIdx;
  _qIdx++;
  const isRoundBoundary = prevIdx === 3 || prevIdx === 6;
  const nextRound = _getRound(_qIdx);

  if (isRoundBoundary && _qIdx < MATCH_QUESTIONS) {
    const capSid = sid;
    _showRoundBanner(nextRound, capSid);
    setTimeout(() => _askQuestion(match, capSid), 900 + 1200);
  } else {
    setTimeout(() => _askQuestion(match, sid), 900);
  }
}

function _flashDuelResult(symbol, color) {
  const el = $('duel-player-feedback');
  el.textContent = symbol;
  el.style.color = color;
  el.classList.remove('duel-flash'); void el.offsetWidth;
  el.classList.add('duel-flash');
}

function _showOppFeedback(symbol) {
  const el = $('duel-opp-feedback');
  el.textContent = symbol === '✔' ? '✔' : '✘';
  el.style.color = symbol === '✔' ? '#00e84b' : '#ff2233';
  el.classList.remove('duel-flash'); void el.offsetWidth;
  el.classList.add('duel-flash');
}

function _updateDuelScores() {
  $('duel-player-score').textContent = _playerScore;
  $('duel-opp-score').textContent    = _oppScore;
}

// ── DUEL FINISH ───────────────────────────────────────────────────────────────
function _finishDuel(match) {
  _duelSession++; // invalidate any pending callbacks
  clearInterval(_timerIv);

  const won = _playerScore > _oppScore;
  const draw = _playerScore === _oppScore;

  const result = processMatchResult(won, match.opponent.lp);
  trackMission('ranked_games', 1);
  if (won) trackMission('ranked_wins', 1);

  _showResult(match, won, draw, result);
}

// ── RESULT SCREEN ─────────────────────────────────────────────────────────────
function _showResult(match, won, draw, result) {
  _showScreen('s-ranked-result');

  const { lpChange, firstWinBonus, promoted, demoted, newRank } = result;

  // Outcome label
  const outcomeEl = $('rr-outcome');
  outcomeEl.textContent = draw ? t('draw') : won ? t('victory') : t('defeat');
  outcomeEl.className   = 'rr-outcome ' + (won ? 'rro-win' : draw ? 'rro-draw' : 'rro-loss');

  // Score
  $('rr-score').textContent = `${_playerScore} — ${_oppScore}`;

  // LP change
  const sign = lpChange >= 0 ? '+' : '';
  $('rr-lp-change').textContent = `${sign}${lpChange} LP`;
  $('rr-lp-change').className   = 'rr-lp-change ' + (lpChange >= 0 ? 'rrlp-pos' : 'rrlp-neg');

  // Rank badge
  const badgeWrap = $('rr-rank-badge');
  badgeWrap.innerHTML = '';
  badgeWrap.appendChild(buildRankBadge(G.rankedLP));

  // Breakdown
  let breakdown = '';
  if (firstWinBonus > 0)    breakdown += `<div class="rr-bonus">⚡ ${t('dailyFirstWin')}  +${firstWinBonus} LP</div>`;
  if ((G.rankedWinStreak||0) >= 2) breakdown += `<div class="rr-bonus">🔥 ${t('winStreak')}  +${(G.rankedWinStreak||0) >= 3 ? 10 : 5} LP</div>`;
  $('rr-breakdown').innerHTML = breakdown;

  // Promotion / demotion banner
  const banner = $('rr-promo-banner');
  if (promoted) {
    banner.textContent = `▲ ${t('promotedTo')} ${newRank.tier.name}!`;
    banner.style.color = newRank.tier.color;
    banner.style.display = '';
    SFX.streak?.();
  } else if (demoted) {
    banner.textContent = `▼ ${t('demotedTo')} ${newRank.tier.name}`;
    banner.style.color = '#ff2233';
    banner.style.display = '';
  } else {
    banner.style.display = 'none';
  }

  // LP progress bar
  const info = getRankInfo(G.rankedLP);
  const pct  = info.lpMax ? Math.round((info.lpInDiv / info.lpMax) * 100) : 100;
  const barEl = $('rr-lp-bar');
  barEl.style.width      = '0%';
  barEl.style.background = info.tier.color;
  setTimeout(() => { barEl.style.width = pct + '%'; }, 200);

  // Buttons
  $('btn-rr-rematch').onclick  = () => _startFindMatch();
  $('btn-rr-lobby').onclick    = () => { renderRankedLobby(); _showScreen('s-ranked'); };
}

function _renderHistory() {
  // placeholder — history feature coming soon
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function _showScreen(id) {
  ['s-ranked','s-ranked-find','s-ranked-intro','s-ranked-duel','s-ranked-result']
    .forEach(sid => {
      const el = document.getElementById(sid);
      if (el) el.classList.toggle('hidden', sid !== id);
    });
}
