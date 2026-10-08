const env = import.meta.env || {};

const SUPABASE_URL = env.VITE_SUPABASE_URL
  || env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://sndpzdqijuxaagjdcgfx.supabase.co';

const SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY
  || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || 'sb_publishable_ibmq3oSAhc_xGYYXXH9qsw_GSPjth8K';

let _supabaseClientPromise = null;

const SUPABASE_REF = (() => {
  try { return new URL(SUPABASE_URL).hostname.split('.')[0]; }
  catch (_) { return ''; }
})();

export async function getSupabaseClient() {
  if (!_supabaseClientPromise) {
    // Vite resolves the package; a plain static server (Live Server) can't,
    // so fall back to the same library from the CDN.
    const cdn = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
    _supabaseClientPromise = import('@supabase/supabase-js')
      .catch(() => import(/* @vite-ignore */ cdn))
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        // Co-op sends its position 10 times a second plus shots
        // (online/coop-realtime.js); the library's default cap is 10.
        realtime: { params: { eventsPerSecond: 20 } },
      }))
      .catch(error => {
        _supabaseClientPromise = null;
        console.warn('[Supabase] Client unavailable:', error);
        return null;
      });
  }
  return _supabaseClientPromise;
}

export async function getSupabaseSession() {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data?.session || null;
}

export async function getSupabaseAccessToken() {
  const session = await getSupabaseSession();
  return session?.access_token || '';
}

export async function signInWithGoogleIdToken(idToken) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Supabase unavailable');
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return data;
}

export function clearSupabaseBrowserSession() {
  const authKeys = new Set([
    SUPABASE_REF ? `sb-${SUPABASE_REF}-auth-token` : '',
  ]);
  for (const store of [localStorage, sessionStorage]) {
    try {
      Object.keys(store)
        .filter(key => authKeys.has(key) || (key.startsWith('sb-') && key.endsWith('-auth-token')))
        .forEach(key => store.removeItem(key));
    } catch (_) {}
  }
}

export async function signOutSupabase() {
  try {
    const supabase = await getSupabaseClient();
    // 'local': sign out this device only. The default ('global') revoked the
    // account's sessions on every device, so a phone signing out (or giving
    // the game to another device with CONTINUER ICI) killed the other
    // device's login: its token refresh failed and its saves were refused.
    await supabase?.auth.signOut({ scope: 'local' });
  } finally {
    clearSupabaseBrowserSession();
  }
}
