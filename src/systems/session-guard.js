// Single-active-session lock: one device plays an account at a time (see
// supabase/migrations/004). Each device keeps the same id across page loads,
// so reloading or reopening the game on the same device is never "another
// device". A sign-in on a second device can take the slot over; the first
// device notices on its next heartbeat and signs out.
import { getLang } from '../i18n.js';
import { getSupabaseClient, getSupabaseSession } from './supabase-client.js';
import { NO_ACCOUNT_WRITES } from '../utils/test-mode.js';

const STALE_MS = 2 * 60 * 1000; // no heartbeat in 2 min = treat as abandoned
const HEARTBEAT_MS = 30 * 1000;
const DEVICE_ID_KEY = 'jexongo_sessionDeviceId';

let _sessionId = null;
let _heartbeatTimer = null;
let _lost = false;
let _onLost = null;

function _newSessionId() {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Same id for this browser every time (kept apart from the save keys, so
// signing out — which clears the save — does not change it).
function _deviceSessionId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) { id = _newSessionId(); localStorage.setItem(DEVICE_ID_KEY, id); }
    return id;
  } catch (_) {
    return _sessionId || _newSessionId();
  }
}

function _startHeartbeat(supabase, userId) {
  clearInterval(_heartbeatTimer);
  _heartbeatTimer = setInterval(async () => {
    if (!_sessionId || _lost) return;
    try {
      const { data, error } = await supabase.from('saves')
        .update({ active_session_at: Date.now() })
        .eq('user_id', userId)
        .eq('active_session_id', _sessionId)
        .select('user_id');
      // No row matched: another device took the account over.
      if (!error && Array.isArray(data) && data.length === 0) {
        _lost = true;
        clearInterval(_heartbeatTimer);
        _onLost?.();
      }
    } catch (_) {}
  }, HEARTBEAT_MS);
}

/** Runs once when another device takes this account over (main.js). */
export function onSessionLost(cb) { _onLost = cb; }

/** False once another device has taken the account: stop saving to it. */
export function holdsSession() { return !_lost; }

/**
 * Call right after a Supabase sign-in succeeds, before any local player
 * state is written. Claims the account's session slot, or reports it's
 * held by another device. { takeover: true } claims it anyway.
 * @returns {Promise<{ blocked: boolean }>}
 */
export async function claimSessionOrBlock({ takeover = false } = {}) {
  // "test-debloque" deployment: it never takes the account's slot (the real
  // device keeps playing) and never saves to the account anyway.
  if (NO_ACCOUNT_WRITES) return { blocked: false };
  try {
    const supabase = await getSupabaseClient();
    const session = await getSupabaseSession();
    const userId = session?.user?.id;
    const email = (session?.user?.email || '').toLowerCase().trim();
    if (!supabase || !userId || !email) return { blocked: false };

    const myId = _deviceSessionId();
    const now = Date.now();
    if (!takeover) {
      const { data: row } = await supabase
        .from('saves')
        .select('active_session_id, active_session_at')
        .eq('user_id', userId)
        .maybeSingle();
      const isOccupied = !!row?.active_session_id
        && row.active_session_id !== myId
        && (now - (row.active_session_at || 0)) < STALE_MS;
      if (isOccupied) return { blocked: true };
    }

    _sessionId = myId;
    _lost = false;
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
  if (!sessionId || _lost) return;
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

export function sessionLostMessage() {
  return getLang() === 'fr'
    ? 'TON COMPTE A ETE OUVERT SUR UN AUTRE APPAREIL. TA PROGRESSION Y EST SAUVEGARDEE.'
    : 'YOUR ACCOUNT WAS OPENED ON ANOTHER DEVICE. YOUR PROGRESS IS SAVED THERE.';
}

/**
 * "This account is open on another device" — asks whether to continue here
 * (the other device is then signed out). Resolves true to take over.
 */
export function askTakeover() {
  return new Promise(resolve => {
    document.getElementById('session-takeover')?.remove();
    const fr = getLang() === 'fr';
    const overlay = document.createElement('div');
    overlay.id = 'session-takeover';
    overlay.className = 'cp pnp';
    overlay.innerHTML = `
      <div class="cp-card pnp-card">
        <div class="cp-title">${fr ? 'DÉJÀ CONNECTÉ' : 'ALREADY SIGNED IN'}</div>
        <div class="cp-sub">${fr
          ? 'Ce compte est ouvert sur un autre appareil.<br>Si tu continues ici, l’autre appareil sera déconnecté.'
          : 'This account is open on another device.<br>If you continue here, the other device will be signed out.'}</div>
        <button class="cp-btn pnp-ok" type="button" data-take="1"><span>${fr ? 'CONTINUER ICI' : 'CONTINUE HERE'}</span></button>
        <button class="cp-later" type="button" data-take="0">${fr ? 'Annuler' : 'Cancel'}</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-take]').forEach(btn => btn.addEventListener('click', () => {
      overlay.classList.add('cp-leave');
      setTimeout(() => { overlay.remove(); resolve(btn.dataset.take === '1'); }, 350);
    }, { once: true }));
  });
}
