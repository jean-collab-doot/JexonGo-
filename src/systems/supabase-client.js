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
    _supabaseClientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
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

export async function signInWithEmail(email, password) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Supabase unavailable');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email, password, metadata = {}) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Supabase unavailable');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
  if (error) throw error;
  if (!data?.session) {
    const signedIn = await signInWithEmail(email, password).catch(() => null);
    if (signedIn?.session) return signedIn;
  }
  return data;
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
    await supabase?.auth.signOut();
  } finally {
    clearSupabaseBrowserSession();
  }
}
