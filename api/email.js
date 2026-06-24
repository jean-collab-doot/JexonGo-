const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'JexonGo <onboarding@resend.dev>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jeanlouisahyee72@gmail.com';

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
      const playerName = escapeHtml(body.playerName || 'PILOT');
      const playerEmail = escapeHtml(body.playerEmail || '(no email)');
      const html = `
        <h2>JexonGo feedback</h2>
        <p><strong>Player:</strong> ${playerName}</p>
        <p><strong>Email:</strong> ${playerEmail}</p>
        <p><strong>Grade:</strong> ${escapeHtml(body.grade || '0')}</p>
        <p><strong>Stars:</strong> ${escapeHtml(body.rating || '0')}</p>
        <p><strong>Comment:</strong> ${escapeHtml(body.comment || '(no comment)')}</p>
        <p><strong>Level:</strong> ${escapeHtml(body.level || '0')}</p>
        <p><strong>XP:</strong> ${escapeHtml(body.xp || '0')}</p>
        <p><strong>Aircraft:</strong> ${escapeHtml(body.aircraft || '')}</p>
        <p><strong>Playtime:</strong> ${escapeHtml(body.playtime || '0 min')}</p>
        <p><strong>Date:</strong> ${now.toLocaleString()}</p>
      `;

      await sendResendEmail({
        to: ADMIN_EMAIL,
        subject: `JexonGo feedback: ${body.rating || 0} stars`,
        html,
      });
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: 'unknown email type' });
  } catch (err) {
    console.error('[Email] failed:', err);
    return send(res, 500, { error: err?.message || 'email failed' });
  }
}
