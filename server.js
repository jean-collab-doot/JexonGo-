// ╔══════════════════════════════════════════════════════════════╗
// ║   JexonGo Online Multiplayer Server                         ║
// ║   Run: npm install ws && node server.js                     ║
// ╚══════════════════════════════════════════════════════════════╝
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const SAVES_DIR = path.join(__dirname, 'data', 'saves');
const AIR_CUP_START_SERVER = new Date('2026-06-11T00:00:00Z').getTime();
const AIR_CUP_END_SERVER   = new Date('2026-07-15T23:59:59Z').getTime();
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'JexonGo <onboarding@resend.dev>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jeanlouisahyee72@gmail.com';
const SUPABASE_REST_URL = process.env.SUPABASE_REST_URL || 'https://sndpzdqijuxaagjdcgfx.supabase.co/rest/v1/';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

const isAirCupActive = () => {
  const now = Date.now();
  return now >= AIR_CUP_START_SERVER && now <= AIR_CUP_END_SERVER;
};

const tournaments = new Map();
let _tid = 0;

function _ensureSavesDir() {
  fs.mkdirSync(SAVES_DIR, { recursive: true });
}

function _accountFile(email) {
  const key = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
  return path.join(SAVES_DIR, `${key}.json`);
}

function _hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw)).digest('hex');
}

function _readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 2e6) { req.destroy(); reject(new Error('too large')); } });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

function _cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function _json(res, status, obj) {
  _cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function _loadAccount(email) {
  const file = _accountFile(email);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function _escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function _sendResendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    throw new Error('missing RESEND_API_KEY');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Resend failed (${response.status})`);
  }
  return payload;
}

async function _handleEmailApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/api/email') return false;

  if (req.method === 'OPTIONS') {
    _cors(res);
    res.writeHead(204);
    res.end();
    return true;
  }

  if (req.method !== 'POST') {
    _json(res, 405, { error: 'method not allowed' });
    return true;
  }

  let body;
  try { body = await _readBody(req); }
  catch { _json(res, 400, { error: 'bad request' }); return true; }

  try {
    const type = body.type || 'feedback';
    const now = new Date();

    if (type === 'new-player') {
      const playerName = _escapeHtml(body.playerName || 'PILOT');
      const playerEmail = _escapeHtml(body.playerEmail || '(no email)');
      const playerGrade = _escapeHtml(body.playerGrade || '0');
      const language = _escapeHtml(body.language || 'unknown');
      const html = `
        <h2>New JexonGo pilot</h2>
        <p><strong>Name:</strong> ${playerName}</p>
        <p><strong>Email:</strong> ${playerEmail}</p>
        <p><strong>Grade:</strong> ${playerGrade}</p>
        <p><strong>Language:</strong> ${language}</p>
        <p><strong>Date:</strong> ${now.toLocaleString()}</p>
      `;

      _sendResendEmail({
          to: ADMIN_EMAIL,
          subject: `New JexonGo pilot: ${playerName}`,
          html,
      }).catch(err => console.warn('[Email] Admin new-player notification failed:', err?.message || err));

      let playerTemplateSent = false;
      if (body.playerEmail && String(body.playerEmail).includes('@')) {
        await _sendResendEmail({
          to: body.playerEmail,
          subject: 'Bienvenue sur JexonGo',
          html: `
            <h2>Bienvenue, ${playerName}!</h2>
            <p>Ton compte JexonGo est pret. Bon vol, pilote.</p>
            <p><strong>Nom:</strong> ${playerName}</p>
            <p><strong>Niveau:</strong> ${playerGrade}</p>
          `,
        });
        playerTemplateSent = true;
      }

      _json(res, 200, { ok: true, playerTemplateSent });
      return true;
    }

    if (type === 'feedback') {
      const playerName = _escapeHtml(body.playerName || 'PILOT');
      const playerEmail = _escapeHtml(body.playerEmail || '(no email)');
      const html = `
        <h2>JexonGo feedback</h2>
        <p><strong>Player:</strong> ${playerName}</p>
        <p><strong>Email:</strong> ${playerEmail}</p>
        <p><strong>Grade:</strong> ${_escapeHtml(body.grade || '0')}</p>
        <p><strong>Stars:</strong> ${_escapeHtml(body.rating || '0')}</p>
        <p><strong>Comment:</strong> ${_escapeHtml(body.comment || '(no comment)')}</p>
        <p><strong>Level:</strong> ${_escapeHtml(body.level || '0')}</p>
        <p><strong>XP:</strong> ${_escapeHtml(body.xp || '0')}</p>
        <p><strong>Aircraft:</strong> ${_escapeHtml(body.aircraft || '')}</p>
        <p><strong>Playtime:</strong> ${_escapeHtml(body.playtime || '0 min')}</p>
        <p><strong>Date:</strong> ${now.toLocaleString()}</p>
      `;

      await _sendResendEmail({
        to: ADMIN_EMAIL,
        subject: `JexonGo feedback: ${body.rating || 0} stars`,
        html,
      });
      _json(res, 200, { ok: true });
      return true;
    }

    _json(res, 400, { error: 'unknown email type' });
    return true;
  } catch (err) {
    console.error('[Resend] email failed:', err);
    _json(res, 500, { error: err?.message || 'email failed' });
    return true;
  }
}

function _authAccount(record, { authType, password }) {
  if (!record) return false;
  if (authType === 'google') return true;
  if (!record.passwordHash) return true;
  return password && _hashPassword(password) === record.passwordHash;
}

async function _handleSaveApi(req, res) {
  _ensureSavesDir();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    _cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/save') {
    const email = (url.searchParams.get('email') || '').toLowerCase().trim();
    const password = url.searchParams.get('password') || '';
    const authType = url.searchParams.get('authType') || 'email';
    if (!email || !email.includes('@')) return _json(res, 400, { error: 'invalid email' });

    const record = _loadAccount(email);
    if (!record) return _json(res, 404, { error: 'not found' });
    if (!_authAccount(record, { authType, password })) return _json(res, 403, { error: 'unauthorized' });

    return _json(res, 200, { data: record.data, updatedAt: record.updatedAt });
  }

  if (req.method === 'POST' && url.pathname === '/api/save') {
    let body;
    try { body = await _readBody(req); }
    catch { return _json(res, 400, { error: 'bad request' }); }

    const email = (body.email || '').toLowerCase().trim();
    const password = body.password || '';
    const authType = body.authType || 'email';
    if (!email || !email.includes('@')) return _json(res, 400, { error: 'invalid email' });
    if (!body.data || typeof body.data !== 'object') return _json(res, 400, { error: 'missing data' });

    const file = _accountFile(email);
    let record = _loadAccount(email);

    if (record && !_authAccount(record, { authType, password })) {
      return _json(res, 403, { error: 'unauthorized' });
    }

    const updatedAt = Math.max(Number(body.updatedAt) || 0, record?.updatedAt || 0, Date.now());
    const passwordHash = record?.passwordHash
      || (authType === 'email' && password ? _hashPassword(password) : null);

    record = { email, passwordHash, authType: record?.authType || authType, data: body.data, updatedAt };
    fs.writeFileSync(file, JSON.stringify(record), 'utf8');
    return _json(res, 200, { ok: true, updatedAt });
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  if (await _handleEmailApi(req, res)) return;
  if (await _handleSaveApi(req, res)) return;
  _cors(res);
  res.writeHead(200);
  res.end('JexonGo WS server running');
});
const wss = new WebSocketServer({ server });

// ── MATH ENGINE ─────────────────────────────────────────────────────────────
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generateQuestion(difficulty) {
  const diff = Math.max(1, Math.min(difficulty, 6));
  const cap  = 6 + diff * 4;         // 10 → 30 as diff goes 1→6
  const ops  = diff >= 4 ? ['+','-','*'] : diff >= 2 ? ['+','-'] : ['+'];
  const op   = ops[Math.floor(Math.random() * ops.length)];

  let a, b, answer;
  switch (op) {
    case '+':
      a = randInt(1, cap); b = randInt(1, cap); answer = a + b; break;
    case '-':
      a = randInt(2, cap); b = randInt(1, a);   answer = a - b; break;
    case '*':
      a = randInt(2, Math.min(12, diff * 2 + 2));
      b = randInt(2, Math.min(12, diff * 2 + 2));
      answer = a * b; break;
    default:
      a = randInt(1, cap); b = randInt(1, cap); answer = a + b;
  }

  const sym = op === '*' ? '×' : op;
  const text = `${a} ${sym} ${b} = ?`;

  const choices = new Set([answer]);
  let tries = 0;
  while (choices.size < 4 && tries++ < 40) {
    const delta  = randInt(1, Math.max(3, Math.round(Math.abs(answer) * 0.35)));
    const wrong  = answer + (Math.random() < 0.5 ? delta : -delta);
    if (wrong >= 0 && wrong !== answer) choices.add(wrong);
  }
  while (choices.size < 4) choices.add(answer + choices.size);

  return { text, answer, choices: [...choices].sort(() => Math.random() - 0.5) };
}

function diffFromLP(lp) {
  if (lp < 100)  return 1;
  if (lp < 250)  return 2;
  if (lp < 500)  return 3;
  if (lp < 900)  return 4;
  if (lp < 1500) return 5;
  return 6;
}

// ── LP CALC ──────────────────────────────────────────────────────────────────
function calcLP(won, draw, isPerfect) {
  if (draw)    return 0;
  if (won)     return isPerfect ? 40 : 25;
  return -15;
}

// ── SEND HELPERS ─────────────────────────────────────────────────────────────
function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify(data));
}
function sendBoth(room, data) { send(room.p1, data); send(room.p2, data); }

// ── QUEUE & ROOMS ─────────────────────────────────────────────────────────────
const queue = [];     // { ws, name, lp }
const rooms = new Map();
let _rid = 0;

function tryMatch() {
  // Remove stale entries first
  for (let i = queue.length - 1; i >= 0; i--)
    if (queue[i].ws.readyState !== WebSocket.OPEN) queue.splice(i, 1);

  while (queue.length >= 2) {
    const a = queue.shift(), b = queue.shift();
    if (a.ws.readyState !== WebSocket.OPEN) { queue.unshift(b); continue; }
    if (b.ws.readyState !== WebSocket.OPEN) { queue.unshift(a); continue; }
    _createRoom(a, b);
  }
}

const TOTAL_Q = 10;

function _createRoom(a, b) {
  const id   = ++_rid;
  const diff = diffFromLP(Math.max(a.lp, b.lp));

  const room = {
    id,
    p1: a.ws, p1Name: a.name, p1LP: a.lp, p1HP: 3, p1Score: 0,
    p2: b.ws, p2Name: b.name, p2LP: b.lp, p2HP: 3, p2Score: 0,
    questions: Array.from({ length: TOTAL_Q }, () => generateQuestion(diff)),
    qIdx:      0,
    answered:  { p1: false, p2: false },
    timeout:   null,
    rematch:   { p1: false, p2: false },
  };

  rooms.set(id, room);
  a.ws._rid = id; a.ws._seat = 'p1';
  b.ws._rid = id; b.ws._seat = 'p2';

  send(a.ws, { type:'matched', roomId:id, opponentName:b.name, opponentLP:b.lp, isP1:true  });
  send(b.ws, { type:'matched', roomId:id, opponentName:a.name, opponentLP:a.lp, isP1:false });

  // Brief VS pause then start
  setTimeout(() => { if (rooms.has(id)) _nextQ(room); }, 3200);
}

function _nextQ(room) {
  if (room.qIdx >= TOTAL_Q) { _endGame(room); return; }
  room.answered = { p1: false, p2: false };
  const q = room.questions[room.qIdx];

  sendBoth(room, {
    type: 'question',
    qNum:   room.qIdx + 1,
    total:  TOTAL_Q,
    text:   q.text,
    choices: q.choices,
  });

  room._botCallback?.(q);

  if (room.timeout) clearTimeout(room.timeout);
  room.timeout = setTimeout(() => {
    if (rooms.has(room.id)) { room.qIdx++; _nextQ(room); }
  }, 12000);
}

function _handleAnswer(room, seat, rawAnswer) {
  if (room.answered[seat]) return;

  const q       = room.questions[room.qIdx];
  const correct = String(rawAnswer) === String(q.answer);
  room.answered[seat] = true;

  const opp    = seat === 'p1' ? 'p2' : 'p1';
  const ownWs  = room[seat];
  const oppWs  = room[opp];

  if (correct && !room.answered[opp]) {
    // First correct answer — fire missile
    room[`${seat}Score`]++;
    if (seat === 'p1') room.p2HP = Math.max(0, room.p2HP - 1);
    else               room.p1HP = Math.max(0, room.p1HP - 1);

    if (room.timeout) { clearTimeout(room.timeout); room.timeout = null; }

    send(ownWs, { type:'q_result', result:'won' });
    send(oppWs, { type:'q_result', result:'hit' });
    sendBoth(room, { type:'hp_update', p1HP: room.p1HP, p2HP: room.p2HP });

    const hitHP = seat === 'p1' ? room.p2HP : room.p1HP;
    if (hitHP <= 0) {
      setTimeout(() => { if (rooms.has(room.id)) _endGame(room); }, 1000);
      return;
    }
    setTimeout(() => {
      if (!rooms.has(room.id)) return;
      room.qIdx++;
      _nextQ(room);
    }, 1500);

  } else if (!correct) {
    send(ownWs, { type:'q_result', result:'wrong' });
    if (room.answered.p1 && room.answered.p2) {
      if (room.timeout) { clearTimeout(room.timeout); room.timeout = null; }
      setTimeout(() => {
        if (!rooms.has(room.id)) return;
        room.qIdx++;
        _nextQ(room);
      }, 900);
    }
  }
  // Correct but opponent already answered? — do nothing, let opp missile resolve
}

function _endGame(room) {
  if (room.timeout) clearTimeout(room.timeout);
  rooms.delete(room.id);

  let winner = 'draw';
  if (room.p1HP > room.p2HP)        winner = 'p1';
  else if (room.p2HP > room.p1HP)   winner = 'p2';
  else if (room.p1Score > room.p2Score) winner = 'p1';
  else if (room.p2Score > room.p1Score) winner = 'p2';

  const p1Won  = winner === 'p1';
  const p2Won  = winner === 'p2';
  const isDraw = winner === 'draw';
  const p1Perf = p1Won && room.p1HP === 3;
  const p2Perf = p2Won && room.p2HP === 3;

  send(room.p1, {
    type:'game_over', won:p1Won, draw:isDraw, isPerfect:p1Perf,
    yourScore:room.p1Score, oppScore:room.p2Score,
    yourHP:room.p1HP,       oppHP:room.p2HP,
    lpChange: calcLP(p1Won, isDraw, p1Perf),
    tournament: !!room.tournamentId,
  });
  send(room.p2, {
    type:'game_over', won:p2Won, draw:isDraw, isPerfect:p2Perf,
    yourScore:room.p2Score, oppScore:room.p1Score,
    yourHP:room.p2HP,       oppHP:room.p1HP,
    lpChange: calcLP(p2Won, isDraw, p2Perf),
    tournament: !!room.tournamentId,
  });

  const advancingSeat = winner === 'draw'
    ? (Math.random() < 0.5 ? 'p1' : 'p2')
    : winner;
  room._onComplete?.(advancingSeat);
}

// ── TOURNAMENT ───────────────────────────────────────────────────────────────
const BOT_NAMES = ['ACE-7','VIPER','GHOST','NOVA','STORM','BLAZE','RAVEN','FALCON'];

function _createTournament(players) {
  const tid = ++_tid;
  const slots = [...players];
  while (slots.length < 8) {
    slots.push({
      ws: null,
      name: BOT_NAMES[(slots.length - players.length) % BOT_NAMES.length],
      lp: randInt(120, 950),
      bot: true,
    });
  }

  const tournament = {
    id: tid,
    round: 0,
    slots,
    bracket: [
      _makeBracketRound(slots, 4),
      _makeBracketRound([], 2),
      _makeBracketRound([], 1),
    ],
    activeRooms: new Set(),
  };

  tournaments.set(tid, tournament);
  slots.forEach(p => { if (p.ws) p.ws._tournamentId = tid; });
  _broadcastBracketUpdate(tournament);
  setTimeout(() => _startTournamentRound(tournament), 900);
  return tournament;
}

function _leaveCurrentRoom(ws, notifyOpponent = true) {
  if (ws._rid) {
    const r = rooms.get(ws._rid);
    if (r) {
      const opp = ws._seat === 'p1' ? r.p2 : r.p1;
      if (notifyOpponent) send(opp, { type:'opponent_left' });
      if (r.timeout) clearTimeout(r.timeout);
      rooms.delete(ws._rid);
    }
    ws._rid = null;
    ws._seat = null;
  }
}

function _makeBracketRound(players, matches) {
  return Array.from({ length: matches }, (_, i) => ({
    a: players[i * 2]?.name || 'TBD',
    b: players[i * 2 + 1]?.name || 'TBD',
    winner: null,
  }));
}

function _startTournamentRound(tournament) {
  const players = tournament.round === 0
    ? tournament.slots
    : tournament.bracket[tournament.round - 1].map(m => m.winnerPlayer);

  if (players.length <= 1) {
    _broadcastTournamentResult(tournament, players[0]);
    return;
  }

  tournament.activeRooms.clear();
  for (let i = 0; i < players.length; i += 2) {
    _createTournamentRoom(tournament, players[i], players[i + 1], i / 2);
  }
  _broadcastBracketUpdate(tournament);
}

function _createTournamentRoom(tournament, a, b, matchIndex) {
  const id = ++_rid;
  const diff = diffFromLP(Math.max(a.lp || 0, b.lp || 0)) + tournament.round;
  const room = {
    id,
    p1: a.ws, p1Name: a.name, p1LP: a.lp || 0, p1HP: 3, p1Score: 0,
    p2: b.ws, p2Name: b.name, p2LP: b.lp || 0, p2HP: 3, p2Score: 0,
    questions: Array.from({ length: TOTAL_Q }, () => generateQuestion(diff)),
    qIdx: 0,
    answered: { p1: false, p2: false },
    timeout: null,
    rematch: { p1: false, p2: false },
    tournamentId: tournament.id,
    _onComplete: winnerSeat => _advanceTournament(tournament, matchIndex, winnerSeat, a, b),
  };

  rooms.set(id, room);
  tournament.activeRooms.add(id);

  if (a.ws) { a.ws._rid = id; a.ws._seat = 'p1'; }
  if (b.ws) { b.ws._rid = id; b.ws._seat = 'p2'; }

  send(a.ws, { type:'matched', roomId:id, opponentName:b.name, opponentLP:b.lp || 0, isP1:true, tournament:true, round:tournament.round + 1 });
  send(b.ws, { type:'matched', roomId:id, opponentName:a.name, opponentLP:a.lp || 0, isP1:false, tournament:true, round:tournament.round + 1 });

  _runBotInRoom(room, a.bot ? 'p1' : null, tournament.round);
  _runBotInRoom(room, b.bot ? 'p2' : null, tournament.round);
  setTimeout(() => { if (rooms.has(id)) _nextQ(room); }, 2600);
}

function _runBotInRoom(room, botSeat, round) {
  if (!botSeat) return;
  const accuracy = Math.min(0.90, 0.48 + round * 0.13);
  const delayBase = Math.max(800, 3000 - round * 450);
  const previous = room._botCallback;

  room._botCallback = q => {
    previous?.(q);
    const missilesThisQuestion = Math.max(1, Math.min(3, round + 1));
    const shouldAnswerCorrect = Math.random() < accuracy;
    if (!shouldAnswerCorrect && missilesThisQuestion === 1) {
      setTimeout(() => {
        if (rooms.has(room.id) && !room.answered[botSeat]) _handleAnswer(room, botSeat, null);
      }, delayBase + Math.random() * 1200);
      return;
    }

    for (let i = 0; i < missilesThisQuestion; i++) {
      setTimeout(() => {
        if (!rooms.has(room.id) || room.answered[botSeat]) return;
        _handleAnswer(room, botSeat, q.answer);
      }, delayBase + i * 260 + Math.random() * 700);
    }
  };
}

function _advanceTournament(tournament, matchIndex, winnerSeat, a, b) {
  tournament.activeRooms.delete([...tournament.activeRooms][matchIndex]);
  const winner = winnerSeat === 'p1' ? a : b;
  const match = tournament.bracket[tournament.round][matchIndex];
  if (match) {
    match.winner = winner.name;
    match.winnerPlayer = winner;
  }
  _broadcastBracketUpdate(tournament);

  const roundDone = tournament.bracket[tournament.round].every(m => m.winnerPlayer);
  if (!roundDone) return;

  const winners = tournament.bracket[tournament.round].map(m => m.winnerPlayer);
  if (winners.length === 1) {
    _broadcastTournamentResult(tournament, winners[0]);
    tournaments.delete(tournament.id);
    return;
  }

  tournament.round++;
  tournament.bracket[tournament.round] = _makeBracketRound(winners, winners.length / 2);
  setTimeout(() => _startTournamentRound(tournament), 1800);
}

function _broadcastBracketUpdate(tournament) {
  const bracket = tournament.bracket.map(round => round.map(m => ({
    a: m.a,
    b: m.b,
    winner: m.winner,
  })));
  tournament.slots.forEach(p => send(p.ws, {
    type: 'bracket_update',
    tournamentId: tournament.id,
    round: tournament.round + 1,
    bracket,
  }));
}

function _broadcastTournamentResult(tournament, winner) {
  tournament.slots.forEach(p => send(p.ws, {
    type: 'tournament_end',
    winner: winner?.name || 'TBD',
    won: p.name === winner?.name,
  }));
}

// ── WS EVENTS ─────────────────────────────────────────────────────────────────
wss.on('connection', ws => {
  ws._rid  = null;
  ws._seat = null;
  ws._tournamentId = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case 'join': {
        // Leave any existing room
        _leaveCurrentRoom(ws);
        // Remove from queue if already there
        const qi = queue.findIndex(e => e.ws === ws);
        if (qi !== -1) queue.splice(qi, 1);

        queue.push({
          ws,
          name: String(msg.name || 'PILOT').toUpperCase().slice(0, 14),
          lp:   Math.max(0, Number(msg.lp) || 0),
        });
        send(ws, { type:'waiting', pos: queue.length });
        tryMatch();
        break;
      }

      case 'join_tournament': {
        if (!isAirCupActive()) {
          send(ws, { type:'error', code:'TOURNAMENT_INACTIVE', message:'TOURNAMENT IS NOT ACTIVE' });
          break;
        }

        _leaveCurrentRoom(ws);
        const qi = queue.findIndex(e => e.ws === ws);
        if (qi !== -1) queue.splice(qi, 1);

        const player = {
          ws,
          name: String(msg.name || 'PILOT').toUpperCase().slice(0, 14),
          lp: Math.max(0, Number(msg.lp) || 0),
          bot: false,
        };
        send(ws, { type:'tournament_joined', name: player.name });
        _createTournament([player]);
        break;
      }

      case 'answer': {
        const room = rooms.get(ws._rid);
        if (room && ws._seat) _handleAnswer(room, ws._seat, msg.answer);
        break;
      }

      case 'rematch': {
        const room = rooms.get(ws._rid);
        if (!room) break;
        room.rematch[ws._seat] = true;
        if (room.rematch.p1 && room.rematch.p2) {
          // Re-queue both
          const p1w = room.p1, p1n = room.p1Name, p1l = room.p1LP;
          const p2w = room.p2, p2n = room.p2Name, p2l = room.p2LP;
          rooms.delete(room.id);
          sendBoth(room, { type:'rematch_accept' });
          queue.push({ ws:p1w, name:p1n, lp:p1l });
          queue.push({ ws:p2w, name:p2n, lp:p2l });
          tryMatch();
        } else {
          send(ws, { type:'rematch_pending' });
        }
        break;
      }

      case 'leave': {
        _leaveCurrentRoom(ws);
        const qi = queue.findIndex(e => e.ws === ws);
        if (qi !== -1) queue.splice(qi, 1);
        ws._rid = null; ws._seat = null;
        ws._tournamentId = null;
        break;
      }

      case 'ping': send(ws, { type:'pong' }); break;
    }
  });

  ws.on('close', () => {
    const qi = queue.findIndex(e => e.ws === ws);
    if (qi !== -1) queue.splice(qi, 1);

    _leaveCurrentRoom(ws);
    ws._tournamentId = null;
  });

  ws.on('error', () => {});
});

_ensureSavesDir();
server.listen(PORT, () =>
  console.log(`[JexonGo] Server → http://localhost:${PORT}  |  ws://localhost:${PORT}`)
);
