// Keeps this player's row of the public TOP 20 table (Supabase
// "leaderboard", supabase/migrations/005) up to date: pilot name, total EXP
// earned since the start and EXP earned in multiplayer games. Only signed-in
// players have a row; guests never appear.
import { G } from '../state.js';
import { getSupabaseClient, getSupabaseSession } from './supabase-client.js';
import { publicPilotName } from '../utils/pilot-name.js';
import { NO_ACCOUNT_WRITES } from '../utils/test-mode.js';

const MIN_GAP_MS = 5000;
let _lastPushAt = 0;
let _pending = null;
let _lastSent = '';
let _tableMissing = false;   // migration 005 not run yet: don't keep writing

async function push() {
  _pending = null;
  _lastPushAt = Date.now();
  // "test-debloque" deployment: its test EXP never goes on the public TOP 20.
  if (!G.playerRegistered || _tableMissing || NO_ACCOUNT_WRITES) return;
  try {
    const supabase = await getSupabaseClient();
    const session = await getSupabaseSession();
    const userId = session?.user?.id;
    if (!supabase || !userId) return;
    const row = {
      user_id: userId,
      name: publicPilotName(G.playerName, 16),
      xp: Math.max(0, Math.floor(G.lifetimeXpEarned || 0)),
      multi_xp: Math.max(0, Math.floor(G.multiXpEarned || 0)),
      updated_at: new Date().toISOString(),
    };
    const key = `${row.user_id}|${row.name}|${row.xp}|${row.multi_xp}`;
    if (key === _lastSent) return;
    const { data, error } = await supabase.from('leaderboard')
      .upsert(row, { onConflict: 'user_id' }).select('xp, multi_xp').maybeSingle();
    if (!error) {
      // The server caps how fast a score grows (migration 006): if part of our
      // EXP was held back, send it again once its reserve has refilled.
      const held = data && (Number(data.xp) < row.xp || Number(data.multi_xp) < Math.min(row.multi_xp, row.xp));
      if (held) setTimeout(pushLeaderboardScore, 60000);
      else _lastSent = key;
    } else if (error.code === 'PGRST205' || error.code === '42P01' || error.status === 404) _tableMissing = true;
  } catch (_) { /* offline: the next EXP gain retries */ }
}

// Sends the score soon (at most one write every few seconds).
export function pushLeaderboardScore() {
  if (!G.playerRegistered || _pending) return;
  const wait = Math.max(0, MIN_GAP_MS - (Date.now() - _lastPushAt));
  _pending = setTimeout(push, wait);
}

// EXP gains (state.js addLifetimeXp) and sign-ins trigger an update.
window.addEventListener('jexongo:xp', pushLeaderboardScore);
