// Unique player names (Supabase table "player_names", migration 008): the
// name shown in the game, the multiplayer and the TOP 20 belongs to one
// account. Until that migration is run (or offline), nothing can be checked
// and every name is accepted, as before.
import { getSupabaseClient, getSupabaseSession } from './supabase-client.js';

/** true / false, or null when it can't be checked. Works without an account. */
export async function isPlayerNameAvailable(name) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('is_player_name_available', { p_name: name });
    return error ? null : data === true;
  } catch (_) {
    return null;
  }
}

/**
 * Reserves the name for the signed-in account: 'ok', 'taken', 'invalid', or
 * 'unknown' (not signed in, offline, migration not run).
 */
export async function claimPlayerName(name) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return 'unknown';
    const { data, error } = await supabase.rpc('claim_player_name', { p_name: name });
    if (error) return 'unknown';
    return ['ok', 'taken', 'invalid'].includes(data) ? data : 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

/** The signed-in account's reserved name: '' when none, null when unknown. */
export async function reservedPlayerName() {
  try {
    const supabase = await getSupabaseClient();
    const userId = (await getSupabaseSession())?.user?.id;
    if (!supabase || !userId) return null;
    const { data, error } = await supabase.from('player_names')
      .select('name').eq('user_id', userId).maybeSingle();
    if (error) return null;
    return data?.name || '';
  } catch (_) {
    return null;
  }
}
