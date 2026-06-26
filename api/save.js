const DEFAULT_SUPABASE_PROJECT_URL = 'https://sndpzdqijuxaagjdcgfx.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ibmq3oSAhc_xGYYXXH9qsw_GSPjth8K';

const SUPABASE_PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || DEFAULT_SUPABASE_PROJECT_URL;
const SUPABASE_REST_URL = process.env.SUPABASE_REST_URL
  || (SUPABASE_PROJECT_URL ? `${SUPABASE_PROJECT_URL.replace(/\/$/, '')}/rest/v1/` : '');
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || DEFAULT_SUPABASE_PUBLISHABLE_KEY
  || '';
const SAVES_TABLE = process.env.SUPABASE_SAVES_TABLE || 'saves';

function send(res, status, body) {
  res.status(status).json(body);
}

function supabaseUrl(path) {
  return `${SUPABASE_REST_URL.replace(/\/$/, '')}/${path}`;
}

function bearerFrom(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  return String(header).startsWith('Bearer ') ? String(header).slice(7).trim() : '';
}

function supabaseHeaders(token, extra = {}) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_REST_URL && SUPABASE_PUBLISHABLE_KEY);
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Supabase request failed (${response.status})`);
  }
  return data;
}

async function getAuthenticatedUser(token) {
  const data = await requestJson(`${SUPABASE_PROJECT_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!data?.id || !data?.email) throw new Error('invalid Supabase user');
  return data;
}

async function readSave(token, userId, email) {
  const encodedEmail = encodeURIComponent(String(email || '').toLowerCase());
  const url = supabaseUrl(`${SAVES_TABLE}?or=(user_id.eq.${encodeURIComponent(userId)},email.eq.${encodedEmail})&select=*&limit=1`);
  const data = await requestJson(url, { headers: supabaseHeaders(token) });
  return Array.isArray(data) ? data[0] || null : null;
}

async function insertSave(token, record) {
  const url = supabaseUrl(SAVES_TABLE);
  return requestJson(url, {
    method: 'POST',
    headers: supabaseHeaders(token, { Prefer: 'return=representation' }),
    body: JSON.stringify(record),
  });
}

async function updateSave(token, column, value, record) {
  const url = supabaseUrl(`${SAVES_TABLE}?${column}=eq.${encodeURIComponent(value)}`);
  return requestJson(url, {
    method: 'PATCH',
    headers: supabaseHeaders(token, { Prefer: 'return=representation' }),
    body: JSON.stringify(record),
  });
}

async function deleteSave(token, column, value) {
  const url = supabaseUrl(`${SAVES_TABLE}?${column}=eq.${encodeURIComponent(value)}`);
  return requestJson(url, {
    method: 'DELETE',
    headers: supabaseHeaders(token, { Prefer: 'return=representation' }),
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method === 'GET' && (req.query.health === '1' || req.query.status === '1')) {
    return send(res, isSupabaseConfigured() ? 200 : 503, {
      ok: isSupabaseConfigured(),
      configured: isSupabaseConfigured(),
      connected: isSupabaseConfigured(),
      table: SAVES_TABLE,
      auth: 'supabase',
      message: isSupabaseConfigured()
        ? 'Supabase is configured. Authenticated saves require a logged-in user token.'
        : 'Supabase environment variables are missing.',
    });
  }

  if (!isSupabaseConfigured()) {
    return send(res, 200, {
      ok: false,
      offline: true,
      disabled: true,
      message: 'Cloud save is not configured.',
    });
  }

  const token = bearerFrom(req);
  if (!token) return send(res, 401, { error: 'missing Supabase session' });

  try {
    const user = await getAuthenticatedUser(token);

    if (req.method === 'GET') {
      const record = await readSave(token, user.id, user.email);
      if (!record) return send(res, 404, { error: 'not found' });
      return send(res, 200, { data: record.data, updatedAt: record.updated_at });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.data || typeof body.data !== 'object') return send(res, 400, { error: 'missing data' });

      const existing = await readSave(token, user.id, user.email);
      const updatedAt = Math.max(Number(body.updatedAt) || 0, Number(existing?.updated_at) || 0, Date.now());
      const record = {
        email: String(user.email || '').toLowerCase(),
        user_id: user.id,
        auth_type: body.authType || 'supabase',
        data: body.data,
        updated_at: updatedAt,
      };

      if (existing) {
        await updateSave(token, existing.user_id ? 'user_id' : 'email', existing.user_id || existing.email, record);
      }
      else await insertSave(token, record);

      return send(res, 200, { ok: true, updatedAt });
    }

    if (req.method === 'DELETE') {
      const existing = await readSave(token, user.id, user.email);
      if (existing) {
        await deleteSave(token, existing.user_id ? 'user_id' : 'email', existing.user_id || existing.email);
      }
      console.log('[Save] account deletion requested', {
        deleted: !!existing,
        reason: req.body?.deletionReason?.reason || null,
      });
      return send(res, 200, { ok: true, deleted: !!existing });
    }

    return send(res, 405, { error: 'method not allowed' });
  } catch (err) {
    console.error('[Save] failed:', err);
    return send(res, 500, { error: err?.message || 'save failed' });
  }
}
