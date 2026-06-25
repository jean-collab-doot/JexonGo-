import crypto from 'node:crypto';

const SUPABASE_PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_REST_URL = process.env.SUPABASE_REST_URL
  || (SUPABASE_PROJECT_URL ? `${SUPABASE_PROJECT_URL.replace(/\/$/, '')}/rest/v1/` : '');
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || '';
const SAVES_TABLE = process.env.SUPABASE_SAVES_TABLE || 'saves';

function send(res, status, body) {
  res.status(status).json(body);
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function authRecord(record, { authType, password }) {
  if (!record) return false;
  if (authType === 'google') return true;
  if (!record.password_hash) return true;
  return password && hashPassword(password) === record.password_hash;
}

function supabaseUrl(path) {
  return `${SUPABASE_REST_URL.replace(/\/$/, '')}/${path}`;
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ACCESS_TOKEN,
    Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_REST_URL && SUPABASE_ACCESS_TOKEN);
}

async function checkSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      configured: false,
      connected: false,
      table: SAVES_TABLE,
      message: 'Supabase environment variables are missing.',
    };
  }

  const url = supabaseUrl(`${SAVES_TABLE}?select=email&limit=1`);
  const response = await fetch(url, { headers: supabaseHeaders() });
  const data = await response.json().catch(() => null);
  return {
    ok: response.ok,
    configured: true,
    connected: response.ok,
    table: SAVES_TABLE,
    status: response.status,
    error: response.ok ? undefined : (data?.message || data?.error || 'Supabase connection failed.'),
  };
}

async function readAccount(email) {
  const url = supabaseUrl(`${SAVES_TABLE}?email=eq.${encodeURIComponent(email)}&select=*`);
  const response = await fetch(url, { headers: supabaseHeaders() });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Cloud save read failed (${response.status})`);
  }
  return Array.isArray(data) ? data[0] || null : null;
}

async function writeAccount(record) {
  const url = supabaseUrl(`${SAVES_TABLE}?on_conflict=email`);
  const response = await fetch(url, {
    method: 'POST',
    headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(record),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Cloud save write failed (${response.status})`);
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method === 'GET' && (req.query.health === '1' || req.query.status === '1')) {
    const health = await checkSupabaseConnection();
    return send(res, health.connected ? 200 : 503, health);
  }

  if (!isSupabaseConfigured()) {
    return send(res, 200, {
      ok: false,
      offline: true,
      disabled: true,
      message: 'Cloud save is not configured.',
    });
  }

  try {
    if (req.method === 'GET') {
      const email = String(req.query.email || '').toLowerCase().trim();
      const password = String(req.query.password || '');
      const authType = String(req.query.authType || 'email');
      if (!email || !email.includes('@')) return send(res, 400, { error: 'invalid email' });

      const record = await readAccount(email);
      if (!record) return send(res, 404, { error: 'not found' });
      if (!authRecord(record, { authType, password })) return send(res, 403, { error: 'unauthorized' });

      return send(res, 200, { data: record.data, updatedAt: record.updated_at });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const email = String(body.email || '').toLowerCase().trim();
      const password = String(body.password || '');
      const authType = String(body.authType || 'email');
      if (!email || !email.includes('@')) return send(res, 400, { error: 'invalid email' });
      if (!body.data || typeof body.data !== 'object') return send(res, 400, { error: 'missing data' });

      const existing = await readAccount(email);
      if (existing && !authRecord(existing, { authType, password })) {
        return send(res, 403, { error: 'unauthorized' });
      }

      const updatedAt = Math.max(Number(body.updatedAt) || 0, Number(existing?.updated_at) || 0, Date.now());
      const passwordHash = existing?.password_hash
        || (authType === 'email' && password ? hashPassword(password) : null);

      await writeAccount({
        email,
        password_hash: passwordHash,
        auth_type: existing?.auth_type || authType,
        data: body.data,
        updated_at: updatedAt,
      });

      return send(res, 200, { ok: true, updatedAt });
    }

    return send(res, 405, { error: 'method not allowed' });
  } catch (err) {
    console.error('[Save] failed:', err);
    return send(res, 500, { error: err?.message || 'save failed' });
  }
}
