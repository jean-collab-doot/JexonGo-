// ── JEXONGO ONLINE ARENA ───────────────────────────────────────────────────────
// Nose-to-nose 1v1 online duel with canvas aircraft, missile animations,
// and real-time WebSocket matchmaking.

import { $  }        from '../utils/dom.js';
import { G  }        from '../state.js';
import { SFX }       from '../audio/sound.js';
import { getRankInfo } from '../data/ranked.js';
import { save }      from '../utils/storage.js';
import { t }         from '../i18n.js';
import {
  wsConnect, wsSend, wsOn, wsOff, wsDisconnect, wsIsConnected, WS_URL,
} from '../online/ws-client.js';

// ── PLANE IMAGES ─────────────────────────────────────────────────────────────
function _loadImg(src) {
  const img = new Image();
  img.src = src;
  return img;
}
const _IMG_MY  = _loadImg('/assets/planes/my-plane.png');
const _IMG_OPP = _loadImg('/assets/planes/opp-plane.png');

// ── MODULE STATE ──────────────────────────────────────────────────────────────
let _nav     = null;
let _canvas  = null;
let _ctx     = null;
let _raf     = null;
let _session = 0;       // incremented on every enter/leave to cancel stale cbs

// Player info
let _isP1    = true;
let _myName  = '';
let _oppName = '';
let _oppLP   = 0;

// Live match state
let _myHP    = 3;
let _oppHP   = 3;
let _myScore = 0;
let _oppScore = 0;
let _locked  = false;
let _timerIv = null;
let _timerVal = 10;

// Canvas visuals
let _tick       = 0;
let _missiles   = [];   // { x,y,vx,vy,fromMe,id }
let _explosions = [];   // { x,y,t,maxT,color }
let _myHitFlash  = 0;
let _oppHitFlash = 0;
let _myBob   = 0;
let _oppBob  = 0;
let _midFlash = 0;      // flashes divider on round start
let _midMsg  = '';      // brief center message (VS, ROUND X)
let _midMsgT = 0;

let _msgId = 0;

// ── INIT (called once at boot) ────────────────────────────────────────────────
export function initArena(nav) {
  _nav = nav;
  $('btn-arena-back').onclick    = _leaveArena;
  $('btn-arena-rematch').onclick = _requestRematch;
  $('btn-arena-lobby').onclick   = _leaveArena;
}

// ── ENTRY POINT ───────────────────────────────────────────────────────────────
export async function enterArena() {
  _session++;
  const sid = _session;

  _canvas = $('arena-canvas');
  if (!_canvas) return;
  _ctx = _canvas.getContext('2d');

  _resetVisuals();
  SFX.playMusic('arena');
  _startLoop();          // render loop runs immediately — canvas draws even during connect

  _showStatus(t('findingOpp'), true);
  _hide('arena-question-box');
  _hide('arena-result');

  _myName  = (G.playerName || 'PILOT').toUpperCase();
  _oppName = '???';
  _updateNameplates();
  _updateHP();

  // Try live server — fall back to local AI if unavailable
  try {
    await wsConnect(WS_URL);
    if (_session !== sid) return;
    _registerHandlers(sid);
    wsSend({ type:'join', name:_myName, lp: G.rankedLP || 0 });
    _showStatus(t('searching'), true);
  } catch (_) {
    if (_session !== sid) return;
    // ── AI FALLBACK ── server offline → run local match inside arena
    _startAiMatch(sid);
  }
}

// ── LOCAL AI MATCH (no server needed) ────────────────────────────────────────
const AI_NAMES = ['ACE-7','VIPER','GHOST','NOVA','STORM','BLAZE','RAVEN'];

function _aiRandInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function _aiGenQuestion() {
  const lp   = G.rankedLP || 0;
  const ops  = lp < 200 ? ['+'] : lp < 600 ? ['+','-'] : ['+','-','*'];
  const cap  = Math.min(8 + Math.floor(lp / 80), 30);
  const op   = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;
  if (op === '+') { a = _aiRandInt(1,cap); b = _aiRandInt(1,cap); answer = a+b; }
  else if (op==='-') { a = _aiRandInt(2,cap); b = _aiRandInt(1,a); answer = a-b; }
  else { a = _aiRandInt(2,Math.min(cap,12)); b = _aiRandInt(2,Math.min(cap,12)); answer = a*b; }
  const sym  = op==='*' ? '×' : op;
  const text = `${a} ${sym} ${b} = ?`;
  const choices = new Set([answer]);
  let t2 = 0;
  while (choices.size < 4 && t2++ < 40) {
    const d = _aiRandInt(1, Math.max(3, Math.round(Math.abs(answer)*0.4)));
    const w = answer + (Math.random()<0.5 ? d : -d);
    if (w >= 0 && w !== answer) choices.add(w);
  }
  while (choices.size < 4) choices.add(answer + choices.size * 2);
  return { text, answer, choices:[...choices].sort(()=>Math.random()-0.5) };
}

function _startAiMatch(sid) {
  _isP1    = true;
  _oppName = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
  _updateNameplates();

  _showStatus(_oppName + ' FOUND!', false);
  _flashMidMsg('VS', 2600);

  setTimeout(() => {
    if (_session !== sid) return;
    _hideStatus();
    _aiNextQuestion(sid, 0);
  }, 2800);
}

const AI_TOTAL = 10;
let _aiQuestions = [];

function _aiNextQuestion(sid, idx) {
  if (_session !== sid) return;
  if (idx >= AI_TOTAL) { _aiEndMatch(sid); return; }
  if (idx === 0) _aiQuestions = Array.from({length:AI_TOTAL}, _aiGenQuestion);

  _locked  = false;
  const q  = _aiQuestions[idx];
  const lp = G.rankedLP || 0;
  // AI skill: faster & more accurate as LP grows
  const aiAcc  = Math.min(0.90, 0.50 + lp / 3000);
  const aiTime = Math.max(1200, 6000 - lp * 2) + Math.random() * 2000;

  // Show question
  $('arena-q-num').textContent = `Q ${idx+1} / ${AI_TOTAL}`;
  $('arena-question').textContent = q.text;
  const grid = $('arena-answers');
  grid.innerHTML = '';
  q.choices.forEach(c => {
    const btn = document.createElement('button');
    btn.className   = 'arena-ans-btn';
    btn.textContent = c;
    btn.onclick     = () => _aiPlayerAnswer(c, q, idx, sid, aiRef);
    grid.appendChild(btn);
  });
  _show('arena-question-box');
  _startTimer(sid);

  // Schedule AI response — reference captured via shared object so buttons can cancel it
  const aiRef = { id: null };
  aiRef.id = setTimeout(() => {
    if (_session !== sid || _locked) return;
    const aiCorrect = Math.random() < aiAcc;
    _aiOppAnswer(aiCorrect, q, idx, sid);
  }, aiTime);
}

function _aiPlayerAnswer(choice, q, idx, sid, aiRef) {
  if (_locked || _session !== sid) return;
  _locked = true;
  _stopTimer();
  clearTimeout(aiRef.id);
  document.querySelectorAll('.arena-ans-btn').forEach(b => b.disabled = true);

  const correct = String(choice) === String(q.answer);
  if (correct) {
    _myScore++;
    _fireMissile(true);
    _feedbackFlash($('arena-my-fb'), '✔', '#00e84b');
    SFX.correct?.();
    _oppHP = Math.max(0, _oppHP - 1);
    _updateHP();
    _oppHitFlash = 35;
    if (_oppHP <= 0) {
      setTimeout(() => _aiEndMatch(sid), 1000); return;
    }
  } else {
    _feedbackFlash($('arena-my-fb'), '✘', '#ff2233');
    SFX.wrong?.();
    // AI may still answer correctly after player is wrong
    const aiAcc2 = Math.min(0.85, 0.45 + (G.rankedLP||0)/3500);
    if (Math.random() < aiAcc2) {
      setTimeout(() => {
        if (_session !== sid) return;
        _oppScore++;
        _fireMissile(false);
        _feedbackFlash($('arena-opp-fb'), '✔', '#00e84b');
        _myHP = Math.max(0, _myHP - 1);
        _updateHP();
        _myHitFlash = 35;
        if (_myHP <= 0) {
          setTimeout(() => _aiEndMatch(sid), 1000); return;
        }
        setTimeout(() => _aiNextQuestion(sid, idx + 1), 1400);
      }, 600 + Math.random() * 800);
      return;
    }
  }
  setTimeout(() => _aiNextQuestion(sid, idx + 1), correct ? 1400 : 900);
}

function _aiOppAnswer(correct, q, idx, sid) {
  _locked = true;
  _stopTimer();
  document.querySelectorAll('.arena-ans-btn').forEach(b => b.disabled = true);

  if (correct) {
    _oppScore++;
    _fireMissile(false);
    _feedbackFlash($('arena-opp-fb'), '✔', '#00e84b');
    _myHP = Math.max(0, _myHP - 1);
    _updateHP();
    _myHitFlash = 35;
    if (_myHP <= 0) {
      setTimeout(() => _aiEndMatch(sid), 1000); return;
    }
  } else {
    _feedbackFlash($('arena-opp-fb'), '✘', '#ff2233');
  }
  setTimeout(() => _aiNextQuestion(sid, idx + 1), correct ? 1400 : 900);
}

function _aiEndMatch(sid) {
  if (_session !== sid) return;
  _stopTimer();
  _hide('arena-question-box');

  const won  = _myHP > _oppHP || (_myHP === _oppHP && _myScore > _oppScore);
  const draw = !won && _myHP === _oppHP && _myScore === _oppScore;
  const perf = won && _myHP === 3;
  const lp   = draw ? 0 : won ? (perf ? 40 : 25) : -15;

  _applyLPChange(lp, won && !draw);

  setTimeout(() => {
    if (_session !== sid) return;
    _showResult({ won, draw, isPerfect:perf, lpChange:lp,
                  yourScore:_myScore, oppScore:_oppScore });
  }, 1000);
}

function _requestRematch() {
  // Online match: tell server; it will send rematch_accept when both ready
  // AI / offline match: just restart directly
  if (wsIsConnected()) {
    wsSend({ type:'rematch' });
    const el = $('arena-rematch-status');
    if (el) el.textContent = 'Waiting for opponent...';
  } else {
    _resetMatch();
    _hide('arena-result');
    enterArena();   // re-enter → tries WS → falls back to AI
  }
}

// ── WS HANDLER REGISTRATION ───────────────────────────────────────────────────
const _WS_EVENTS = ['waiting','matched','question','q_result','hp_update',
                    'game_over','rematch_accept','rematch_pending',
                    'opponent_left','_disconnect'];

function _registerHandlers(sid) {

  wsOn('waiting', ({ pos }) => {
    if (_session !== sid) return;
    _showStatus(`${t('searching')} (${pos})`, true);
  });

  wsOn('matched', msg => {
    if (_session !== sid) return;
    _isP1    = msg.isP1;
    _myName  = (G.playerName || 'PILOT').toUpperCase();
    _oppName = msg.opponentName;
    _oppLP   = msg.opponentLP || 0;
    _hideStatus();
    _updateNameplates();
    _flashMidMsg('VS', 2800);
    SFX.streak?.();
  });

  wsOn('question', msg => {
    if (_session !== sid) return;
    _hide('arena-result');
    _locked   = false;
    _myHitFlash = _oppHitFlash = 0;
    _showQuestion(msg, sid);
  });

  wsOn('q_result', ({ result }) => {
    if (_session !== sid) return;
    if (result === 'won') {
      _myScore++;
      _fireMissile(true);
      _feedbackFlash($('arena-my-fb'),  '✔', '#00e84b');
      SFX.correct?.();
    } else if (result === 'hit') {
      _oppScore++;
      _fireMissile(false);
      _feedbackFlash($('arena-my-fb'),  '✘', '#ff2233');
    } else {
      _feedbackFlash($('arena-my-fb'),  '✘', '#ff2233');
      SFX.wrong?.();
    }
    _lockAnswers();
  });

  wsOn('hp_update', ({ p1HP, p2HP }) => {
    if (_session !== sid) return;
    const prevMy  = _myHP;
    const prevOpp = _oppHP;
    _myHP  = _isP1 ? p1HP : p2HP;
    _oppHP = _isP1 ? p2HP : p1HP;
    if (_myHP  < prevMy)  _myHitFlash  = 35;
    if (_oppHP < prevOpp) _oppHitFlash = 35;
    _updateHP();
  });

  wsOn('game_over', msg => {
    if (_session !== sid) return;
    _stopTimer();
    _lockAnswers();
    _hide('arena-question-box');
    _applyLPChange(msg.lpChange, msg.won);
    setTimeout(() => {
      if (_session !== sid) return;
      _showResult(msg);
    }, 1300);
  });

  wsOn('rematch_accept', () => {
    if (_session !== sid) return;
    _hide('arena-result');
    _resetMatch();
    _flashMidMsg('VS', 2800);
  });

  wsOn('rematch_pending', () => {
    if (_session !== sid) return;
    const el = $('arena-rematch-status');
    if (el) el.textContent = 'Waiting for opponent...';
  });

  wsOn('opponent_left', () => {
    if (_session !== sid) return;
    _stopTimer();
    _lockAnswers();
    _applyLPChange(25, true);
    _showResult({
      won:true, draw:false, isPerfect:false, lpChange:25,
      yourScore:_myScore, oppScore:_oppScore,
      opponentLeft:true,
    });
  });

  wsOn('_disconnect', () => {
    if (_session !== sid) return;
    _showStatus('DISCONNECTED', false);
  });
}

function _unregisterHandlers() {
  _WS_EVENTS.forEach(e => wsOff(e, undefined));
  // wsOff with no fn → noop; we increment _session to disable stale cbs
}

// ── QUESTION FLOW ─────────────────────────────────────────────────────────────
function _showQuestion(msg, sid) {
  $('arena-q-num').textContent  = `Q ${msg.qNum} / ${msg.total}`;
  $('arena-question').textContent = msg.text;

  const grid = $('arena-answers');
  grid.innerHTML = '';
  msg.choices.forEach(c => {
    const btn = document.createElement('button');
    btn.className   = 'arena-ans-btn';
    btn.textContent = c;
    btn.onclick     = () => _submitAnswer(c);
    grid.appendChild(btn);
  });

  _show('arena-question-box');
  _startTimer(sid);
}

function _submitAnswer(val) {
  if (_locked) return;
  _locked = true;
  _stopTimer();
  document.querySelectorAll('.arena-ans-btn').forEach(b => b.disabled = true);
  wsSend({ type:'answer', answer: val });
}

function _lockAnswers() {
  _locked = true;
  document.querySelectorAll('.arena-ans-btn').forEach(b => b.disabled = true);
}

// ── TIMER ─────────────────────────────────────────────────────────────────────
function _startTimer(sid) {
  _stopTimer();
  _timerVal = 10;
  const el = $('arena-timer');
  el.textContent = _timerVal;
  el.style.color = '#00e84b';

  _timerIv = setInterval(() => {
    if (_session !== sid) { clearInterval(_timerIv); return; }
    _timerVal--;
    el.textContent = _timerVal;
    if (_timerVal <= 3) { el.style.color = '#ff2233'; SFX.timerWarn?.(); }
    if (_timerVal <= 0) { clearInterval(_timerIv); if (!_locked) _submitAnswer(null); }
  }, 1000);
}

function _stopTimer() {
  if (_timerIv) { clearInterval(_timerIv); _timerIv = null; }
}

// ── LP APPLY ──────────────────────────────────────────────────────────────────
function _applyLPChange(delta, won) {
  G.rankedLP = Math.max(0, (G.rankedLP || 0) + delta);
  save('rankedLP', G.rankedLP);
  if (won) {
    G.rankedWins = (G.rankedWins || 0) + 1;
    G.rankedWinStreak = (G.rankedWinStreak || 0) + 1;
  } else {
    G.rankedLosses = (G.rankedLosses || 0) + 1;
    G.rankedWinStreak = 0;
  }
  save('rankedWins',     G.rankedWins);
  save('rankedLosses',   G.rankedLosses);
  save('rankedWinStreak', G.rankedWinStreak);
}

// ── RESULT SCREEN ─────────────────────────────────────────────────────────────
function _showResult(msg) {
  const title =
    msg.opponentLeft  ? `🏆 OPP DISCONNECTED` :
    msg.draw          ? `= ${t('draw')}` :
    msg.won           ? `✔ ${t('victory')}` :
                        `✘ ${t('defeat')}`;

  $('arena-result-title').textContent = title;
  $('arena-result-title').style.color =
    msg.opponentLeft || msg.won ? '#00e84b' :
    msg.draw ? '#fbbf24' : '#ff2233';

  $('arena-result-score').textContent =
    `${msg.yourScore ?? _myScore} — ${msg.oppScore ?? _oppScore}`;

  const sign = (msg.lpChange >= 0) ? '+' : '';
  $('arena-result-lp').textContent  = `${sign}${msg.lpChange} LP`;
  $('arena-result-lp').style.color  = msg.lpChange >= 0 ? '#00e84b' : '#ff2233';

  const info = getRankInfo(G.rankedLP);
  $('arena-result-rank').textContent  = info.divLabel;
  $('arena-result-rank').style.color  = info.tier.color;

  $('arena-rematch-status').textContent = '';
  _show('arena-result');

  if (msg.won || msg.opponentLeft) SFX.levelWin?.();
  else                             SFX.wrong?.();
}

// ── HP & NAMEPLATES ───────────────────────────────────────────────────────────
function _updateHP() {
  ['my','opp'].forEach(who => {
    const hp = who === 'my' ? _myHP : _oppHP;
    for (let i = 0; i < 3; i++) {
      const el = document.getElementById(`arena-${who}-h${i}`);
      if (el) el.style.opacity = i < hp ? '1' : '0.14';
    }
  });
}

function _updateNameplates() {
  const myEl  = $('arena-my-name');
  const oppEl = $('arena-opp-name');
  if (myEl)  myEl.textContent  = _myName;
  if (oppEl) oppEl.textContent = _oppName;
}

// ── MISSILE VISUALS ────────────────────────────────────────────────────────────
function _fireMissile(fromMe) {
  const W  = _canvas.width;
  const H  = _canvas.height;
  const myX  = W * 0.18, oppX = W * 0.82, midY = H * 0.42;

  const sx = fromMe ? myX  : oppX;
  const tx = fromMe ? oppX : myX;
  const dist = Math.abs(tx - sx);
  const speed = dist / 42;
  const vx = (tx - sx > 0 ? 1 : -1) * speed;
  const dy = (Math.random() - 0.5) * 18;

  _missiles.push({
    id: ++_msgId, x: sx, y: midY,
    vx, vy: dy / 42,
    fromMe, tx, ty: midY + dy,
  });
}

// ── CANVAS RENDER LOOP ────────────────────────────────────────────────────────
function _startLoop() {
  _stopLoop();
  const draw = () => { _raf = requestAnimationFrame(draw); _frame(); };
  _raf = requestAnimationFrame(draw);
}

function _stopLoop() {
  if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
}

function _frame() {
  // Sync canvas size
  const cw = _canvas.clientWidth || 400;
  const ch = _canvas.clientHeight || 700;
  if (_canvas.width !== cw || _canvas.height !== ch) {
    _canvas.width = cw; _canvas.height = ch;
  }
  const W = cw, H = ch;
  _tick++;

  // ── Background ─────────────────────────────────────────────────────────────
  const bg = _ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#010408');
  bg.addColorStop(1, '#060b1c');
  _ctx.fillStyle = bg;
  _ctx.fillRect(0, 0, W, H);

  // Stars (deterministic positions, subtle twinkle)
  for (let i = 0; i < 55; i++) {
    const sx = ((Math.sin(i * 134.7 + 0.3) * 0.5 + 0.5) * W) | 0;
    const sy = ((Math.cos(i * 89.1  + 1.1) * 0.5 + 0.5) * H * 0.72) | 0;
    const a  = 0.25 + 0.6 * Math.abs(Math.sin(_tick * 0.008 + i * 0.7));
    const s  = 0.5 + (i % 3) * 0.5;
    _ctx.globalAlpha = a;
    _ctx.fillStyle = '#fff';
    _ctx.fillRect(sx, sy, s, s);
  }
  _ctx.globalAlpha = 1;

  // ── Aircraft positions ──────────────────────────────────────────────────────
  const myX  = W * 0.18;
  const oppX = W * 0.82;
  const midY = H * 0.42;
  const U    = Math.max(4, Math.min(7, W / 60)); // pixel unit scales with screen

  _myBob  = Math.sin(_tick * 0.042) * 5;
  _oppBob = Math.sin(_tick * 0.042 + Math.PI) * 5;

  const myColor  = _myHitFlash  > 0 ? '#ff5555' : '#00d4ff';
  const oppColor = _oppHitFlash > 0 ? '#ff5555' : '#ff2277';
  if (_myHitFlash  > 0) _myHitFlash--;
  if (_oppHitFlash > 0) _oppHitFlash--;

  // Dashed divider
  _ctx.save();
  _ctx.strokeStyle = `rgba(255,255,255,0.06)`;
  _ctx.lineWidth = 1;
  _ctx.setLineDash([6, 10]);
  _ctx.beginPath();
  _ctx.moveTo(W / 2, H * 0.08);
  _ctx.lineTo(W / 2, H * 0.72);
  _ctx.stroke();
  _ctx.setLineDash([]);
  _ctx.restore();

  // Exhausts behind planes
  _drawExhaust(_ctx, myX,  midY + _myBob,  true,  myColor,  U);
  _drawExhaust(_ctx, oppX, midY + _oppBob, false, oppColor, U);

  // Planes
  _drawPlane(_ctx, myX,  midY + _myBob,  true,  myColor,  U);
  _drawPlane(_ctx, oppX, midY + _oppBob, false, oppColor, U);

  // ── Missiles ───────────────────────────────────────────────────────────────
  for (let i = _missiles.length - 1; i >= 0; i--) {
    const m = _missiles[i];
    m.x += m.vx; m.y += m.vy;
    const passed = m.fromMe ? m.x >= m.tx : m.x <= m.tx;
    if (passed) {
      _explosions.push({
        x: m.tx, y: m.ty, t: 0, maxT: 28,
        color: m.fromMe ? '#00d4ff' : '#ff2277',
      });
      SFX.explode?.();
      _missiles.splice(i, 1);
      continue;
    }
    _drawMissile(_ctx, m);
  }

  // ── Explosions ─────────────────────────────────────────────────────────────
  for (let i = _explosions.length - 1; i >= 0; i--) {
    const ex = _explosions[i];
    ex.t++;
    if (ex.t >= ex.maxT) { _explosions.splice(i, 1); continue; }
    _drawExplosion(_ctx, ex);
  }

  // ── Center message (VS / ROUND) ────────────────────────────────────────────
  if (_midMsgT > 0) {
    _midMsgT--;
    const alpha = Math.min(1, _midMsgT / 18) * Math.min(1, (120 - Math.max(0, 120 - _midMsgT)) / 18);
    _ctx.globalAlpha = alpha;
    _ctx.font        = `bold ${Math.round(W * 0.12)}px 'Press Start 2P', monospace`;
    _ctx.fillStyle   = '#ff2277';
    _ctx.textAlign   = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.shadowColor = '#ff2277';
    _ctx.shadowBlur  = 28;
    _ctx.fillText(_midMsg, W / 2, H * 0.38);
    _ctx.shadowBlur  = 0;
    _ctx.globalAlpha = 1;
  }
}

// ── PNG PLANE ─────────────────────────────────────────────────────────────────
function _drawPlane(ctx, cx, cy, facingRight, color, u) {
  const img  = facingRight ? _IMG_MY : _IMG_OPP;
  const size = u * 14;
  ctx.save();
  ctx.translate(cx, cy);
  // Both images face right by default; flip opponent to face left (inward)
  if (!facingRight) ctx.scale(-1, 1);

  // Coloured glow tint behind the image
  ctx.shadowColor = color;
  ctx.shadowBlur  = 18;

  // Hit-flash: tint red when _myHitFlash / _oppHitFlash is active
  const flashing = facingRight ? _myHitFlash > 0 : _oppHitFlash > 0;
  if (flashing) {
    ctx.filter = 'hue-rotate(160deg) saturate(3) brightness(1.4)';
  }

  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  } else {
    // Fallback rect while image loads
    ctx.fillStyle = color;
    ctx.fillRect(-size / 2, -size / 4, size, size / 2);
  }

  ctx.filter     = 'none';
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── EXHAUST FLAME ─────────────────────────────────────────────────────────────
function _drawExhaust(ctx, cx, cy, facingRight, color, u) {
  ctx.save();
  ctx.translate(cx, cy);
  if (!facingRight) ctx.scale(-1, 1);

  // Tail is at -7*u (half the image size is 7*u, exhaust at the back edge)
  const tailX   = -7 * u;
  const flicker  = 0.55 + 0.45 * Math.sin(_tick * 0.3 + (facingRight ? 0 : 1.7));
  const len      = 18 * flicker;
  const rad = _ctx.createRadialGradient(tailX, 0, 0, tailX, 0, len);
  rad.addColorStop(0,    'rgba(255,255,255,0.95)');
  rad.addColorStop(0.25, color + 'cc');
  rad.addColorStop(1,    'transparent');

  ctx.globalAlpha = 0.80;
  ctx.fillStyle   = rad;
  ctx.beginPath();
  ctx.ellipse(tailX - len * 0.6, 0, len, 5 * flicker, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── MISSILE ────────────────────────────────────────────────────────────────────
function _drawMissile(ctx, m) {
  ctx.save();
  const color = m.fromMe ? '#00d4ff' : '#ff2277';
  const angle = Math.atan2(m.vy, m.vx);

  // Trail
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(m.x - m.vx * 9, m.y - m.vy * 9);
  ctx.lineTo(m.x, m.y);
  ctx.stroke();

  // Body
  ctx.globalAlpha = 1;
  ctx.fillStyle   = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 8;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(angle);
  ctx.fillRect(-7, -2.5, 14, 5);
  // Tip
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(4, -2.5); ctx.lineTo(4, 2.5);
  ctx.fill();
  ctx.restore();

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── EXPLOSION ─────────────────────────────────────────────────────────────────
function _drawExplosion(ctx, ex) {
  const p = ex.t / ex.maxT;
  const r = 12 + p * 44;
  ctx.save();

  // Outer glow ring
  const g = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, r);
  g.addColorStop(0,   '#fff');
  g.addColorStop(0.2, ex.color);
  g.addColorStop(1,   'transparent');
  ctx.globalAlpha = (1 - p) * 0.88;
  ctx.fillStyle   = g;
  ctx.beginPath();
  ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Sparks
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + p * 2.5;
    const d = r * (0.4 + 0.5 * (i % 3) / 2);
    ctx.globalAlpha = (1 - p) * 0.65;
    ctx.fillStyle   = i % 2 === 0 ? ex.color : '#fff';
    ctx.beginPath();
    ctx.arc(ex.x + Math.cos(a)*d, ex.y + Math.sin(a)*d, 2.5 * (1-p), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ── UI HELPERS ────────────────────────────────────────────────────────────────
function _show(id) { const el = $(id); if (el) el.classList.remove('hidden'); }
function _hide(id) { const el = $(id); if (el) el.classList.add('hidden');    }

function _showStatus(text, animated) {
  _show('arena-status');
  const t = $('arena-status-text');
  if (t) t.textContent = text;
  const d = $('arena-status-dots');
  if (d) d.style.display = animated ? '' : 'none';
}

function _hideStatus() { _hide('arena-status'); }

function _feedbackFlash(el, symbol, color) {
  if (!el) return;
  el.textContent = symbol;
  el.style.color = color;
  el.classList.remove('arena-flash');
  void el.offsetWidth;
  el.classList.add('arena-flash');
}

function _flashMidMsg(msg, durationMs) {
  _midMsg  = msg;
  _midMsgT = Math.round(durationMs / (1000 / 60)); // convert ms → frames
}

function _leaveArena() {
  _session++;
  _stopLoop();
  _stopTimer();
  SFX.stopMusic();
  wsSend({ type: 'leave' });
  wsDisconnect();
  _nav.toRanked();
}

function _resetVisuals() {
  _tick = 0; _missiles = []; _explosions = [];
  _myHitFlash = _oppHitFlash = 0;
  _midMsgT = 0;
}

function _resetMatch() {
  _myHP = _oppHP = 3;
  _myScore = _oppScore = 0;
  _locked = false;
  _resetVisuals();
  _updateHP();
  _hide('arena-question-box');
}
