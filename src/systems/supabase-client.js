import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  || import.meta.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://sndpzdqijuxaagjdcgfx.supabase.co';

const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || 'sb_publishable_ibmq3oSAhc_xGYYXXH9qsw_GSPjth8K';

const SUPABASE_REF = (() => {
  try { return new URL(SUPABASE_URL).hostname.split('.')[0]; }
  catch (_) { return ''; }
})();

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function getSupabaseSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data?.session || null;
}

export async function getSupabaseAccessToken() {
  const session = await getSupabaseSession();
  return session?.access_token || '';
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email, password, metadata = {}) {
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
    await supabase.auth.signOut();
  } finally {
    clearSupabaseBrowserSession();
  }
}
