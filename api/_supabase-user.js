// Shared by the API routes: who is calling? Reads the Supabase session token
// from the Authorization header and asks Supabase which user it belongs to.
// Files starting with "_" are not exposed as routes by Vercel.

const DEFAULT_SUPABASE_PROJECT_URL = 'https://sndpzdqijuxaagjdcgfx.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ibmq3oSAhc_xGYYXXH9qsw_GSPjth8K';

const SUPABASE_PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || DEFAULT_SUPABASE_PROJECT_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export function bearerFrom(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  return String(header).startsWith('Bearer ') ? String(header).slice(7).trim() : '';
}

/** The signed-in Supabase user ({ id, email }), or null for a missing/bad token. */
export async function getSupabaseUser(req) {
  const token = bearerFrom(req);
  if (!token) return null;
  try {
    const response = await fetch(`${SUPABASE_PROJECT_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const user = await response.json().catch(() => null);
    return user?.id && user?.email ? { id: user.id, email: String(user.email).toLowerCase() } : null;
  } catch (_) {
    return null;
  }
}
