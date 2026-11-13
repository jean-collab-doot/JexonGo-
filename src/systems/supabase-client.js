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

// ── E-mail + password accounts (screens/email-auth.js) ────────────────────
// Each returns Supabase's { data, error }; the screen turns errors into
// messages. "Confirm email" is off in Supabase: signUp signs the player in at
// once (the only e-mail is the welcome one). Turned on again, the account is
// confirmed with the 6-digit code of the e-mail ({{ .Token }} in its
// template). A forgotten password always uses such a code.

async function authCall(run) {
  const supabase = await getSupabaseClient();
  if (!supabase) return { data: null, error: { code: 'unavailable' } };
  try {
    return await run(supabase.auth);
  } catch (error) {
    return { data: null, error: { code: 'network', message: String(error?.message || error) } };
  }
}

export function signUpWithEmail(email, password, playerName, lang) {
  return authCall(auth => auth.signUp({
    email,
    password,
    options: { data: { player_name: playerName, lang } },
  }));
}

/** type 'email' confirms a new account, 'recovery' a forgotten password. */
export function verifyEmailCode(email, token, type) {
  return authCall(auth => auth.verifyOtp({ email, token, type }));
}

export function resendSignupCode(email) {
  return authCall(auth => auth.resend({ type: 'signup', email }));
}

export function signInWithEmail(email, password) {
  return authCall(auth => auth.signInWithPassword({ email, password }));
}

export function sendPasswordResetCode(email) {
  return authCall(auth => auth.resetPasswordForEmail(email));
}

/** New password for the signed-in account (after the recovery code). */
export function updatePassword(password) {
  return authCall(auth => auth.updateUser({ password }));
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
