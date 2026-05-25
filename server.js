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
  });
  send(room.p2, {
    type:'game_over', won:p2Won, draw:isDraw, isPerfect:p2Perf,
    yourScore:room.p2Score, oppScore:room.p1Score,
    yourHP:room.p2HP,       oppHP:room.p1HP,
    lpChange: calcLP(p2Won, isDraw, p2Perf),
  });
}

// ── WS EVENTS ─────────────────────────────────────────────────────────────────
wss.on('connection', ws => {
  ws._rid  = null;
  ws._seat = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case 'join': {
        // Leave any existing room
        if (ws._rid) {
          const r = rooms.get(ws._rid);
          if (r) {
            send(ws._seat === 'p1' ? r.p2 : r.p1, { type:'opponent_left' });
            if (r.timeout) clearTimeout(r.timeout);
            rooms.delete(ws._rid);
          }
          ws._rid = null; ws._seat = null;
        }
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
        const room = rooms.get(ws._rid);
        if (room) {
          const opp = ws._seat === 'p1' ? room.p2 : room.p1;
          send(opp, { type:'opponent_left' });
          if (room.timeout) clearTimeout(room.timeout);
          rooms.delete(ws._rid);
        }
        const qi = queue.findIndex(e => e.ws === ws);
        if (qi !== -1) queue.splice(qi, 1);
        ws._rid = null; ws._seat = null;
        break;
      }

      case 'ping': send(ws, { type:'pong' }); break;
    }
  });

  ws.on('close', () => {
    const qi = queue.findIndex(e => e.ws === ws);
    if (qi !== -1) queue.splice(qi, 1);

    if (ws._rid) {
      const room = rooms.get(ws._rid);
      if (room) {
        const opp = ws._seat === 'p1' ? room.p2 : room.p1;
        send(opp, { type:'opponent_left' });
        if (room.timeout) clearTimeout(room.timeout);
        rooms.delete(ws._rid);
      }
    }
  });

  ws.on('error', () => {});
});

_ensureSavesDir();
server.listen(PORT, () =>
  console.log(`[JexonGo] Server → http://localhost:${PORT}  |  ws://localhost:${PORT}`)
);
