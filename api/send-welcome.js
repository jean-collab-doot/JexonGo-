import { createHash, timingSafeEqual } from 'node:crypto';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM = 'JexonGO <bienvenue@jexongo.app>';
const SUBJECT = 'Bienvenue dans JexonGO ✈️';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(body));
}

function headerValue(req, name) {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] : String(value || '');
}

function secretsMatch(received, expected) {
  if (!received || !expected) return false;
  const receivedHash = createHash('sha256').update(received).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(receivedHash, expectedHash);
}

function requestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); }
    catch { return {}; }
  }
  return req.body;
}

function isEmail(value) {
  return typeof value === 'string'
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function welcomeHtml() {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#06101f;color:#f8fafc;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:40px 24px;text-align:center;">
      <h1 style="margin:0 0 18px;color:#67e8f9;">Bienvenue dans JexonGO ✈️</h1>
      <p style="margin:0 0 14px;font-size:17px;line-height:1.6;">
        Ton aventure aérienne commence maintenant. Prépare ton avion, relève les défis de mathématiques
        et progresse à travers les missions de JexonGO.
      </p>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.6;">
        Nous sommes heureux de t’accueillir parmi nos pilotes.
      </p>
      <a href="https://jexongo.app" style="display:inline-block;padding:14px 24px;border-radius:8px;background:#fbbf24;color:#07111f;font-weight:700;text-decoration:none;">
        JOUER À JEXONGO
      </a>
      <p style="margin:30px 0 0;color:#94a3b8;font-size:13px;">À bientôt dans le ciel — l’équipe JexonGO</p>
    </div>
  </body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Allow', 'POST');
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!webhookSecret || !resendApiKey) {
    console.error('[send-welcome] Required server environment variables are missing.');
    return json(res, 500, { ok: false, error: 'server_not_configured' });
  }

  if (!secretsMatch(headerValue(req, 'x-webhook-secret'), webhookSecret)) {
    return json(res, 401, { ok: false, error: 'unauthorized' });
  }

  const email = String(requestBody(req)?.record?.email || '').trim().toLowerCase();
  if (!isEmail(email)) {
    return json(res, 400, { ok: false, error: 'invalid_email' });
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: SUBJECT,
        html: welcomeHtml(),
      }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('[send-welcome] Resend rejected the email.', {
        status: response.status,
        message: result?.message || result?.name || 'unknown_error',
      });
      return json(res, 502, { ok: false, error: 'email_delivery_failed' });
    }

    return json(res, 200, { ok: true, id: result?.id || null });
  } catch (error) {
    console.error('[send-welcome] Unexpected delivery error.', error);
    return json(res, 500, { ok: false, error: 'internal_error' });
  }
}
