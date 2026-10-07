import { getSupabaseUser } from './_supabase-user.js';
import { publicPilotName } from '../src/utils/pilot-name.js';

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

// EmailJS private key (Account > Security). Once "Use Private Key" is turned
// on in EmailJS, only this server can send: the public key alone is refused.
const EMAILJS_PRIVATE_KEY = env('EMAILJS_PRIVATE_KEY', 'EMAILJS_ACCESS_TOKEN');

// Feedback can be sent without an account, so it is limited per address:
// at most FEEDBACK_MAX messages per FEEDBACK_WINDOW_MS. Kept in memory, so it
// is a best-effort brake per server instance, not a hard global limit.
const FEEDBACK_MAX = 5;
const FEEDBACK_WINDOW_MS = 10 * 60 * 1000;
const _feedbackHits = new Map();

function clientIp(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

function feedbackAllowed(req) {
  const now = Date.now();
  const ip = clientIp(req);
  const hits = (_feedbackHits.get(ip) || []).filter(at => now - at < FEEDBACK_WINDOW_MS);
  if (hits.length >= FEEDBACK_MAX) return false;
  hits.push(now);
  _feedbackHits.set(ip, hits);
  if (_feedbackHits.size > 5000) _feedbackHits.clear();
  return true;
}

function clip(value, max) {
  return String(value ?? '').slice(0, max);
}

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
      recipientFields: ['to_email', 'email', 'player_email', 'recipient_email', 'user_email', 'to', 'toEmail', 'recipient'],
      templateRequirement: 'Set the EmailJS template "To Email" field to {{to_email}} so the welcome email goes to the new player.',
    },
  };
}

function feedbackParams(body) {
  const params = {
    type: 'feedback',
    player_name: publicPilotName(body.playerName || 'PILOT', 20),
    player_email: clip(body.playerEmail || '(no email)', 120),
    email: clip(body.playerEmail || '(no email)', 120),
    reply_to: clip(body.playerEmail || '', 120),
    grade: clip(body.grade || '0', 4),
    date: clip(body.date || new Date().toLocaleDateString(), 40),
    rating: clip(body.rating || '0', 2),
    comment: clip(body.comment || '(no comment)', 2000),
    level: clip(body.level || '0', 4),
    xp: clip(body.xp || '0', 12),
    aircraft: clip(Array.isArray(body.aircraft) ? body.aircraft.join(', ') : String(body.aircraft || ''), 200),
    playtime: clip(body.playtime || '0 min', 40),
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
    player_name: publicPilotName(body.playerName || 'PILOT', 20),
    player_email: playerEmail,
    email: playerEmail,
    to_email: playerEmail,
    recipient_email: playerEmail,
    user_email: playerEmail,
    to: playerEmail,
    toEmail: playerEmail,
    recipient: playerEmail,
    to_name: publicPilotName(body.playerName || 'PILOT', 20),
    reply_to: playerEmail,
    player_grade: clip(body.playerGrade || '0', 4),
    language: clip(body.language || 'unknown', 20),
    date: clip(body.date || new Date().toLocaleDateString(), 40),
    time: clip(body.time || new Date().toLocaleTimeString(), 40),
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
      ...(EMAILJS_PRIVATE_KEY ? { accessToken: EMAILJS_PRIVATE_KEY } : {}),
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
      // Only a signed-in player, and only to their own account address:
      // nobody can use JexonGo to send the welcome email to strangers.
      const user = await getSupabaseUser(req);
      if (!user) return send(res, 401, { ok: false, error: 'sign in required' });
      await sendEmailJs({
        serviceId: EMAILJS_NEW_PLAYER_SERVICE_ID,
        templateId: EMAILJS_NEW_PLAYER_TEMPLATE_ID,
        publicKey: EMAILJS_NEW_PLAYER_PUBLIC_KEY,
        params: newPlayerParams({ ...body, playerEmail: user.email }),
      });
      return send(res, 200, { ok: true, playerTemplateSent: true });
    }

    if (!feedbackAllowed(req)) return send(res, 429, { ok: false, error: 'too many messages, try again later' });

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
