const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || '';
const EMAILJS_FEEDBACK_SERVICE_ID = process.env.EMAILJS_FEEDBACK_SERVICE_ID || '';
const EMAILJS_FEEDBACK_TEMPLATE_ID = process.env.EMAILJS_FEEDBACK_TEMPLATE_ID || '';
const EMAILJS_NEW_PLAYER_SERVICE_ID = process.env.EMAILJS_NEW_PLAYER_SERVICE_ID || '';
const EMAILJS_NEW_PLAYER_TEMPLATE_ID = process.env.EMAILJS_NEW_PLAYER_TEMPLATE_ID || '';

function send(res, status, body) {
  res.status(status).json(body);
}

function requireEmailJsConfig(type) {
  if (!EMAILJS_PUBLIC_KEY) return 'missing EMAILJS_PUBLIC_KEY';
  if (type === 'new-player') {
    if (!EMAILJS_NEW_PLAYER_SERVICE_ID) return 'missing EMAILJS_NEW_PLAYER_SERVICE_ID';
    if (!EMAILJS_NEW_PLAYER_TEMPLATE_ID) return 'missing EMAILJS_NEW_PLAYER_TEMPLATE_ID';
    return '';
  }
  if (!EMAILJS_FEEDBACK_SERVICE_ID) return 'missing EMAILJS_FEEDBACK_SERVICE_ID';
  if (!EMAILJS_FEEDBACK_TEMPLATE_ID) return 'missing EMAILJS_FEEDBACK_TEMPLATE_ID';
  return '';
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

async function sendEmailJs({ serviceId, templateId, params }) {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: EMAILJS_PUBLIC_KEY,
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
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

  try {
    const body = req.body || {};
    const type = body.type === 'new-player' ? 'new-player' : 'feedback';
    const configError = requireEmailJsConfig(type);
    if (configError) return send(res, 503, { ok: false, error: configError });

    if (type === 'new-player') {
      await sendEmailJs({
        serviceId: EMAILJS_NEW_PLAYER_SERVICE_ID,
        templateId: EMAILJS_NEW_PLAYER_TEMPLATE_ID,
        params: newPlayerParams(body),
      });
      return send(res, 200, { ok: true, playerTemplateSent: true });
    }

    await sendEmailJs({
      serviceId: EMAILJS_FEEDBACK_SERVICE_ID,
      templateId: EMAILJS_FEEDBACK_TEMPLATE_ID,
      params: feedbackParams(body),
    });
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('[Email] failed:', err);
    return send(res, 500, { ok: false, error: err?.message || 'email failed' });
  }
}
