const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'JexonGo <onboarding@resend.dev>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jeanlouisahyee72@gmail.com';
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_se9vi2q';
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_FEEDBACK_TEMPLATE_ID || 'template_icrozxf';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'tKhT13eitJ6j1EdHo';

function send(res, status, body) {
  res.status(status).json(body);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendResendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) throw new Error('missing RESEND_API_KEY');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Resend failed (${response.status})`);
  }
  return payload;
}

async function sendFeedbackWithEmailJs(body) {
  const templateParams = {
    type: 'feedback',
    player_name: body.playerName || 'PILOT',
    player_email: body.playerEmail || '(no email)',
    grade: String(body.grade || '0'),
    date: body.date || new Date().toLocaleDateString(),
    rating: String(body.rating || '0'),
    comment: body.comment || '(no comment)',
    level: String(body.level || '0'),
    xp: String(body.xp || '0'),
    aircraft: Array.isArray(body.aircraft) ? body.aircraft.join(', ') : String(body.aircraft || ''),
    playtime: body.playtime || '0 min',
  };
  templateParams.message = [
    `Player: ${templateParams.player_name}`,
    `Email: ${templateParams.player_email}`,
    `Grade: ${templateParams.grade}`,
    `Stars: ${templateParams.rating}`,
    `Comment: ${templateParams.comment}`,
    `Level: ${templateParams.level}`,
    `XP: ${templateParams.xp}`,
    `Aircraft: ${templateParams.aircraft}`,
    `Playtime: ${templateParams.playtime}`,
    `Date: ${templateParams.date}`,
  ].join('\n');

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: templateParams,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(details || `EmailJS failed (${response.status})`);
  }
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

  try {
    const body = req.body || {};
    const type = body.type || 'feedback';
    const now = new Date();

    if (type === 'new-player') {
      const playerName = escapeHtml(body.playerName || 'PILOT');
      const playerEmail = escapeHtml(body.playerEmail || '(no email)');
      const playerGrade = escapeHtml(body.playerGrade || '0');
      const language = escapeHtml(body.language || 'unknown');
      const adminHtml = `
        <h2>New JexonGo pilot</h2>
        <p><strong>Name:</strong> ${playerName}</p>
        <p><strong>Email:</strong> ${playerEmail}</p>
        <p><strong>Grade:</strong> ${playerGrade}</p>
        <p><strong>Language:</strong> ${language}</p>
        <p><strong>Date:</strong> ${now.toLocaleString()}</p>
      `;

      await sendResendEmail({
        to: ADMIN_EMAIL,
        subject: `New JexonGo pilot: ${playerName}`,
        html: adminHtml,
      });

      let playerTemplateSent = false;
      if (body.playerEmail && String(body.playerEmail).includes('@')) {
        await sendResendEmail({
          to: body.playerEmail,
          subject: 'Bienvenue sur JexonGo',
          html: `
            <h2>Bienvenue, ${playerName}!</h2>
            <p>Ton compte JexonGo est pret. Bon vol, pilote.</p>
            <p><strong>Nom:</strong> ${playerName}</p>
            <p><strong>Niveau:</strong> ${playerGrade}</p>
          `,
        });
        playerTemplateSent = true;
      }

      return send(res, 200, { ok: true, playerTemplateSent });
    }

    if (type === 'feedback') {
      await sendFeedbackWithEmailJs({ ...body, date: body.date || now.toLocaleDateString() });
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: 'unknown email type' });
  } catch (err) {
    console.error('[Email] failed:', err);
    return send(res, 500, { error: err?.message || 'email failed' });
  }
}
