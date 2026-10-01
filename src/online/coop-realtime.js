// ── CO-OP OVER SUPABASE REALTIME ─────────────────────────────────────────────
// Two teammates in the same level without a game server of our own: both
// players join a Supabase Realtime channel named after the room code, and
// the player who created the code does what server.js used to do (accept or
// refuse the teammate). Same messages as the old WebSocket server, so
// multiplayer.js and game.js only switched imports:
//   send: coop_create, coop_join, coop_state, coop_shot, coop_done, coop_leave
//   receive: coop_created, coop_join_refused, coop_locked, coop_invalid,
//            coop_start, coop_state, coop_shot, coop_done, coop_partner_left
import { getSupabaseClient } from '../systems/supabase-client.js';
import { publicPilotName } from '../utils/pilot-name.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const SUBSCRIBE_TIMEOUT_MS = 8000;
const JOIN_TIMEOUT_MS = 6000;
const RELAYED = new Set(['coop_state', 'coop_shot', 'coop_done']);

const _handlers = new Map();   // type -> Set<fn>
let _channel = null;
let _me = '';                  // this player's id in the channel
let _role = null;              // 'host' | 'guest'
let _partnerId = null;
let _host = null;              // host: { name, aircraft, level }
let _joinWait = null;          // guest: resolver while waiting for the host's answer

function _id() {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function _code() {
  const bytes = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

function _emit(type, msg = {}) {
  const fns = _handlers.get(type);
  if (!fns) return;
  for (const fn of fns) {
    try { fn({ ...msg, type }); } catch (err) { console.error('[coop]', err); }
  }
}

function _post(payload) {
  _channel?.send({ type: 'broadcast', event: 'm', payload: { ...payload, from: _me } })
    .catch?.(() => {});
}

function _aircraft(value) {
  return String(value || 't6').replace(/[^a-z0-9]/gi, '').slice(0, 12) || 't6';
}

// Everything the other player sends arrives here.
function _onMessage(msg) {
  if (!msg || typeof msg !== 'object' || typeof msg.from !== 'string' || msg.from === _me) return;
  if (msg.to && msg.to !== _me) return;

  // Gameplay: only from the teammate.
  if (RELAYED.has(msg.type)) {
    if (msg.from === _partnerId) _emit(msg.type, msg);
    return;
  }
  if (msg.type === 'bye') {
    if (msg.from === _partnerId) { _partnerId = null; _emit('coop_partner_left'); }
    return;
  }

  if (_role === 'host' && msg.type === 'join') {
    const name = publicPilotName(msg.name, 14);
    if (_partnerId) { _post({ type: 'full', to: msg.from }); return; }
    // Both players must have unlocked the host's level (as server.js did).
    const joinerMax = Math.max(1, Number(msg.maxLevel) || 1);
    if (_host.level > joinerMax) {
      _post({ type: 'locked', to: msg.from, level: _host.level, hostName: _host.name });
      _emit('coop_join_refused', { name, level: _host.level, maxLevel: joinerMax });
      return;
    }
    _partnerId = msg.from;
    _post({ type: 'accept', to: msg.from, level: _host.level, hostName: _host.name, hostAircraft: _host.aircraft });
    _emit('coop_start', { level: _host.level, partnerName: name, partnerAircraft: _aircraft(msg.aircraft) });
    return;
  }

  if (_role === 'guest' && _joinWait && ['accept', 'locked', 'full'].includes(msg.type)) {
    _joinWait(msg);
  }
}

async function _open(code) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Supabase unavailable');
  _me = _id();
  const channel = supabase.channel(`jexongo-coop-${code}`, {
    config: { broadcast: { self: false }, presence: { key: _me } },
  });
  channel.on('broadcast', { event: 'm' }, ({ payload }) => _onMessage(payload));
  // Teammate closed the game or lost the connection.
  channel.on('presence', { event: 'leave' }, ({ key }) => {
    if (key && key === _partnerId) { _partnerId = null; _emit('coop_partner_left'); }
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), SUBSCRIBE_TIMEOUT_MS);
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timer); reject(new Error(status));
      }
    });
  }).catch(err => { supabase.removeChannel(channel); throw err; });
  _channel = channel;
  await channel.track({ role: _role }).catch(() => {});
}

async function _create(msg) {
  coopDisconnect();
  _role = 'host';
  _host = {
    name: publicPilotName(msg.name, 14),
    aircraft: _aircraft(msg.aircraft),
    level: Math.max(1, Math.min(50, Number(msg.level) || 1)),
  };
  const code = _code();
  try {
    await _open(code);
    _emit('coop_created', { code });
  } catch (_) {
    _reset();
    _emit('coop_unavailable');
  }
}

async function _join(msg) {
  coopDisconnect();
  const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 5 || code.length > 7) { _emit('coop_invalid'); return; }
  _role = 'guest';
  try {
    await _open(code);
  } catch (_) {
    _reset();
    _emit('coop_unavailable');
    return;
  }
  const answer = await new Promise(resolve => {
    _joinWait = resolve;
    setTimeout(() => resolve(null), JOIN_TIMEOUT_MS);
    _post({ type: 'join', name: publicPilotName(msg.name, 14), aircraft: _aircraft(msg.aircraft), maxLevel: Number(msg.maxLevel) || 1 });
  });
  _joinWait = null;
  if (answer?.type === 'accept') {
    _partnerId = answer.from;
    _emit('coop_start', {
      level: Math.max(1, Math.min(50, Number(answer.level) || 1)),
      partnerName: publicPilotName(answer.hostName, 14),
      partnerAircraft: _aircraft(answer.hostAircraft),
    });
    return;
  }
  coopDisconnect();
  if (answer?.type === 'locked') _emit('coop_locked', { level: Number(answer.level) || 1, hostName: publicPilotName(answer.hostName, 14) });
  else _emit('coop_invalid');   // no game with this code, or it already has a teammate
}

function _reset() {
  _channel = null;
  _role = null;
  _partnerId = null;
  _host = null;
  _joinWait = null;
}

// ── PUBLIC API (same shape as ws-client.js) ─────────────────────────────────
export function coopOn(type, fn) {
  if (!_handlers.has(type)) _handlers.set(type, new Set());
  _handlers.get(type).add(fn);
}

export function coopOff(type, fn) {
  _handlers.get(type)?.delete(fn);
}

/** Resolves when Realtime can be used, rejects otherwise. */
export async function coopConnect() {
  if (!(await getSupabaseClient())) throw new Error('Supabase unavailable');
}

export function coopSend(msg) {
  if (!msg?.type) return;
  if (msg.type === 'coop_create') { _create(msg); return; }
  if (msg.type === 'coop_join') { _join(msg); return; }
  if (msg.type === 'coop_leave') { if (_partnerId) _post({ type: 'bye', to: _partnerId }); return; }
  if (RELAYED.has(msg.type) && _partnerId) _post({ ...msg, to: _partnerId });
}

export function coopDisconnect() {
  const channel = _channel;
  _reset();
  if (!channel) return;
  // Let a last "bye" go out before closing.
  setTimeout(() => {
    getSupabaseClient().then(supabase => supabase?.removeChannel(channel)).catch(() => {});
  }, 250);
}
