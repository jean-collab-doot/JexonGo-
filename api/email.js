function env(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return '';
}

const DEFAULT_EMAILJS_PUBLIC_KEY = 'tKhT13eitJ6j1EdHo';
const DEFAULT_EMAILJS_FEEDBACK_SERVICE_ID = 'service_se9vi2q';
const DEFAULT_EMAILJS_FEEDBACK_TEMPLATE_ID = 'template_icrozxf';
const DEFAULT_EMAILJS_NEW_PLAYER_SERVICE_ID = 'service_mdhv776';
const DEFAULT_EMAILJS_NEW_PLAYER_TEMPLATE_ID = 'template_gl9depi';

const EMAILJS_PUBLIC_KEY = env(
  'EMAILJS_PUBLIC_KEY',
  'EMAILJS_USER_ID',
  'NEXT_PUBLIC_EMAILJS_PUBLIC_KEY',
  'VITE_EMAILJS_PUBLIC_KEY',
) || DEFAULT_EMAILJS_PUBLIC_KEY;
const EMAILJS_FEEDBACK_PUBLIC_KEY = env(
  'EMAILJS_FEEDBACK_PUBLIC_KEY',
  'NEXT_PUBLIC_EMAILJS_FEEDBACK_PUBLIC_KEY',
  'VITE_EMAILJS_FEEDBACK_PUBLIC_KEY',
) || EMAILJS_PUBLIC_KEY;
const EMAILJS_FEEDBACK_SERVICE_ID = env(
  'EMAILJS_FEEDBACK_SERVICE_ID',
  'NEXT_PUBLIC_EMAILJS_FEEDBACK_SERVICE_ID',
  'VITE_EMAILJS_FEEDBACK_SERVICE_ID',
) || DEFAULT_EMAILJS_FEEDBACK_SERVICE_ID;
const EMAILJS_FEEDBACK_TEMPLATE_ID = env(
  'EMAILJS_FEEDBACK_TEMPLATE_ID',
  'NEXT_PUBLIC_EMAILJS_FEEDBACK_TEMPLATE_ID',
  'VITE_EMAILJS_FEEDBACK_TEMPLATE_ID',
) || DEFAULT_EMAILJS_FEEDBACK_TEMPLATE_ID;
const EMAILJS_NEW_PLAYER_PUBLIC_KEY = env(
  'EMAILJS_NEW_PLAYER_PUBLIC_KEY',
  'NEXT_PUBLIC_EMAILJS_NEW_PLAYER_PUBLIC_KEY',
  'VITE_EMAILJS_NEW_PLAYER_PUBLIC_KEY',
) || EMAILJS_PUBLIC_KEY;
const EMAILJS_NEW_PLAYER_SERVICE_ID = env(
  'EMAILJS_NEW_PLAYER_SERVICE_ID',
  'NEXT_PUBLIC_EMAILJS_NEW_PLAYER_SERVICE_ID',
  'VITE_EMAILJS_NEW_PLAYER_SERVICE_ID',
) || DEFAULT_EMAILJS_NEW_PLAYER_SERVICE_ID;
const EMAILJS_NEW_PLAYER_TEMPLATE_ID = env(
  'EMAILJS_NEW_PLAYER_TEMPLATE_ID',
  'NEXT_PUBLIC_EMAILJS_NEW_PLAYER_TEMPLATE_ID',
  'VITE_EMAILJS_NEW_PLAYER_TEMPLATE_ID',
) || DEFAULT_EMAILJS_NEW_PLAYER_TEMPLATE_ID;

function send(res, status, body) {
  res.status(status).json(body);
}

function requestBody(req) {
  const body = req.body || {};
  if (typeof body === 'string') {
    if (!body.trim()) return {};
    return JSON.parse(body);
  }
  if (body instanceof Uint8Array) {
    const text = new TextDecoder().decode(body);
    return text.trim() ? JSON.parse(text) : {};
  }
  return body;
}

function requireEmailJsConfig(type) {
  if (type === 'new-player') {
    if (!EMAILJS_NEW_PLAYER_PUBLIC_KEY) return 'missing EMAILJS_NEW_PLAYER_PUBLIC_KEY';
    if (!EMAILJS_NEW_PLAYER_SERVICE_ID) return 'missing EMAILJS_NEW_PLAYER_SERVICE_ID';
    if (!EMAILJS_NEW_PLAYER_TEMPLATE_ID) return 'missing EMAILJS_NEW_PLAYER_TEMPLATE_ID';
    return '';
  }
  if (!EMAILJS_FEEDBACK_PUBLIC_KEY) return 'missing EMAILJS_FEEDBACK_PUBLIC_KEY';
  if (!EMAILJS_FEEDBACK_SERVICE_ID) return 'missing EMAILJS_FEEDBACK_SERVICE_ID';
  if (!EMAILJS_FEEDBACK_TEMPLATE_ID) return 'missing EMAILJS_FEEDBACK_TEMPLATE_ID';
  return '';
}

function emailHealth() {
  return {
    ok: true,
    feedback: {
      configured: Boolean(
        EMAILJS_FEEDBACK_PUBLIC_KEY
        && EMAILJS_FEEDBACK_SERVICE_ID
        && EMAILJS_FEEDBACK_TEMPLATE_ID
      ),
      serviceId: EMAILJS_FEEDBACK_SERVICE_ID,
      templateId: EMAILJS_FEEDBACK_TEMPLATE_ID,
      hasPublicKey: Boolean(EMAILJS_FEEDBACK_PUBLIC_KEY),
    },
    newPlayer: {
      configured: Boolean(
        EMAILJS_NEW_PLAYER_PUBLIC_KEY
        && EMAILJS_NEW_PLAYER_SERVICE_ID
        && EMAILJS_NEW_PLAYER_TEMPLATE_ID
      ),
      serviceId: EMAILJS_NEW_PLAYER_SERVICE_ID,
      templateId: EMAILJS_NEW_PLAYER_TEMPLATE_ID,
      hasPublicKey: Boolean(EMAILJS_NEW_PLAYER_PUBLIC_KEY),
      recipientField: 'to_email',
    },
  };
}

function feedbackParams(body) {
  const params = {
    type: 'feedback',
    player_name: body.playerName || 'PILOT',
    player_email: body.playerEmail || '(no email)',
    email: body.playerEmail || '(no email)',
    reply_to: body.playerEmail || '',
    grade: String(body.grade || '0'),
    date: body.date || new Date().toLocaleDateString(),
    rating: String(body.rating || '0'),
    comment: body.comment || '(no comment)',
    level: String(body.level || '0'),
    xp: String(body.xp || '0'),
    aircraft: Array.isArray(body.aircraft) ? body.aircraft.join(', ') : String(body.aircraft || ''),
    playtime: body.playtime || '0 min',
  };
  params.message = [
    `Player: ${params.player_name}`,
    `Email: ${params.player_email}`,
    `Grade: ${params.grade}`,
    `Stars: ${params.rating}`,
    `Comment: ${params.comment}`,
    `Level: ${params.level}`,
    `XP: ${params.xp}`,
    `Aircraft: ${params.aircraft}`,
    `Playtime: ${params.playtime}`,
    `Date: ${params.date}`,
  ].join('\n');
  return params;
}

function newPlayerParams(body) {
  const playerEmail = String(body.playerEmail || '').trim();
  if (!playerEmail || !playerEmail.includes('@')) {
    throw new Error('missing player email');
  }

  const params = {
    type: 'new-player',
    player_name: body.playerName || 'PILOT',
    player_email: playerEmail,
    email: playerEmail,
    to_email: playerEmail,
    recipient_email: playerEmail,
    user_email: playerEmail,
    to_name: body.playerName || 'PILOT',
    reply_to: playerEmail,
    player_grade: String(body.playerGrade || '0'),
    language: body.language || 'unknown',
    date: body.date || new Date().toLocaleDateString(),
    time: body.time || new Date().toLocaleTimeString(),
  };
  params.message = [
    'New JexonGo pilot',
    `Name: ${params.player_name}`,
    `Email: ${params.player_email}`,
    `Grade: ${params.player_grade}`,
    `Language: ${params.language}`,
    `Date: ${params.date}`,
    `Time: ${params.time}`,
  ].join('\n');
  return params;
}

async function sendEmailJs({ serviceId, templateId, publicKey, params }) {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: params,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(details || `EmailJS failed (${response.status})`);
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET') return send(res, 200, emailHealth());
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

  try {
    const body = requestBody(req);
    const type = body.type === 'new-player' ? 'new-player' : 'feedback';
    const configError = requireEmailJsConfig(type);
    if (configError) return send(res, 503, { ok: false, error: configError });

    if (type === 'new-player') {
      await sendEmailJs({
        serviceId: EMAILJS_NEW_PLAYER_SERVICE_ID,
        templateId: EMAILJS_NEW_PLAYER_TEMPLATE_ID,
        publicKey: EMAILJS_NEW_PLAYER_PUBLIC_KEY,
        params: newPlayerParams(body),
      });
      return send(res, 200, { ok: true, playerTemplateSent: true });
    }

    await sendEmailJs({
      serviceId: EMAILJS_FEEDBACK_SERVICE_ID,
      templateId: EMAILJS_FEEDBACK_TEMPLATE_ID,
      publicKey: EMAILJS_FEEDBACK_PUBLIC_KEY,
      params: feedbackParams(body),
    });
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('[Email] failed:', err);
    return send(res, 500, { ok: false, error: err?.message || 'email failed' });
  }
}
