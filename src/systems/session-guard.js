// Single-active-session lock: refuses a sign-in when the account already
// has a live session on another device (see supabase/migrations/004).
import { getLang } from '../i18n.js';
import { getSupabaseClient, getSupabaseSession } from './supabase-client.js';

const STALE_MS = 3 * 60 * 1000; // no heartbeat in 3 min = treat as abandoned
const HEARTBEAT_MS = 60 * 1000;

let _sessionId = null;
let _heartbeatTimer = null;

function _newSessionId() {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function _startHeartbeat(supabase, userId) {
  clearInterval(_heartbeatTimer);
  _heartbeatTimer = setInterval(() => {
    if (!_sessionId) return;
    supabase.from('saves')
      .update({ active_session_at: Date.now() })
      .eq('user_id', userId)
      .eq('active_session_id', _sessionId)
      .then(() => {}, () => {});
  }, HEARTBEAT_MS);
}

/**
 * Call right after a Supabase sign-in succeeds, before any local player
 * state is written. Claims the account's session slot, or reports it's
 * already held by another device.
 * @returns {Promise<{ blocked: boolean }>}
 */
export async function claimSessionOrBlock() {
  try {
    const supabase = await getSupabaseClient();
    const session = await getSupabaseSession();
    const userId = session?.user?.id;
    const email = (session?.user?.email || '').toLowerCase().trim();
    if (!supabase || !userId || !email) return { blocked: false };

    const { data: row } = await supabase
      .from('saves')
      .select('active_session_id, active_session_at')
      .eq('user_id', userId)
      .maybeSingle();

    const now = Date.now();
    const isOccupied = !!row?.active_session_id
      && (now - (row.active_session_at || 0)) < STALE_MS;
    if (isOccupied) return { blocked: true };

    _sessionId = _newSessionId();
    await supabase.from('saves').upsert({
      email,
      user_id: userId,
      active_session_id: _sessionId,
      active_session_at: now,
      updated_at: now,
    }, { onConflict: 'email', ignoreDuplicates: false });

    _startHeartbeat(supabase, userId);
    return { blocked: false };
  } catch (_) {
    // Network/offline hiccup: fail open rather than locking a player out
    // of their own account over a transient error.
    return { blocked: false };
  }
}

/** Call on sign-out so the slot frees up immediately for another device. */
export async function releaseSession() {
  clearInterval(_heartbeatTimer);
  _heartbeatTimer = null;
  const sessionId = _sessionId;
  _sessionId = null;
  if (!sessionId) return;
  try {
    const supabase = await getSupabaseClient();
    const session = await getSupabaseSession();
    const userId = session?.user?.id;
    if (supabase && userId) {
      await supabase.from('saves')
        .update({ active_session_id: null, active_session_at: null })
        .eq('user_id', userId)
        .eq('active_session_id', sessionId);
    }
  } catch (_) {}
}

export function sessionBlockedMessage() {
  return getLang() === 'fr'
    ? 'CE COMPTE EST DEJA CONNECTE SUR UN AUTRE APPAREIL. DECONNECTE-LE D\'ABORD.'
    : 'THIS ACCOUNT IS ALREADY SIGNED IN ON ANOTHER DEVICE. DISCONNECT IT FIRST.';
}
