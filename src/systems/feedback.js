import { API_URL } from './cloud-save.js';

const NEW_PLAYER_KEY = 'jexongo_new_player_emailjs_v4';
const FEEDBACK_SENT_KEY = 'jexongo_feedback_date';
const EMAILJS_PUBLIC_KEY = 'tKhT13eitJ6j1EdHo';
const EMAILJS_FEEDBACK_SERVICE_ID = 'service_se9vi2q';
const EMAILJS_FEEDBACK_TEMPLATE_ID = 'template_icrozxf';
const EMAILJS_NEW_PLAYER_SERVICE_ID = 'service_mdhv776';
const EMAILJS_NEW_PLAYER_TEMPLATE_ID = 'template_gl9depi';

function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function _newPlayerKey(email) {
  const id = String(email || 'guest').toLowerCase().trim();
  return `${NEW_PLAYER_KEY}:${id || 'guest'}`;
}

async function _sendEmail(payload) {
  try {
    return await _sendEmailJsDirect(payload);
  } catch (directErr) {
    console.warn('[EmailJS] Browser send failed, trying API fallback:', directErr);
  }

  const res = await fetch(`${API_URL}/api/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Email failed (${res.status})`);
  return data;
}

function _feedbackParams(body) {
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

function _newPlayerParams(body) {
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
    to: playerEmail,
    toEmail: playerEmail,
    recipient: playerEmail,
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

function _emailJsConfig(type) {
  return type === 'new-player'
    ? {
        serviceId: EMAILJS_NEW_PLAYER_SERVICE_ID,
        templateId: EMAILJS_NEW_PLAYER_TEMPLATE_ID,
        params: _newPlayerParams,
      }
    : {
        serviceId: EMAILJS_FEEDBACK_SERVICE_ID,
        templateId: EMAILJS_FEEDBACK_TEMPLATE_ID,
        params: _feedbackParams,
      };
}

async function _sendEmailJsDirect(payload) {
  const type = payload.type === 'new-player' ? 'new-player' : 'feedback';
  const config = _emailJsConfig(type);
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: config.serviceId,
      template_id: config.templateId,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: config.params(payload),
    }),
  });
  if (!res.ok) {
    const details = await res.text().catch(() => '');
    throw new Error(details || `EmailJS failed (${res.status})`);
  }
  return { ok: true, direct: true };
}

export function canSendFeedback() {
  return localStorage.getItem(FEEDBACK_SENT_KEY) !== _todayStr();
}

export function markFeedbackSent() {
  localStorage.setItem(FEEDBACK_SENT_KEY, _todayStr());
}

export function sendNewPlayerNotification({ playerName, playerEmail, playerGrade }) {
  const sentKey = _newPlayerKey(playerEmail);
  if (localStorage.getItem(sentKey)) return;

  const now = new Date();
  const payload = {
    type: 'new-player',
    playerName: playerName || 'PILOT',
    playerEmail: playerEmail || '',
    playerGrade: String(playerGrade || 0),
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
    language: navigator.language.startsWith('fr') ? 'french' : 'english',
  };

  _sendEmail(payload)
    .then(() => {
      console.log('[Email] New player template sent');
      localStorage.setItem(sentKey, 'true');
    })
    .catch(err => console.warn('[Email] New player template failed:', err));
}

export function _resetNewPlayer() {
  localStorage.removeItem(NEW_PLAYER_KEY);
  Object.keys(localStorage)
    .filter(key => key.startsWith(`${NEW_PLAYER_KEY}:`))
    .forEach(key => localStorage.removeItem(key));
  console.log('[Email] New player flags cleared');
}

export function _testEmailNow(name = 'TEST PILOT', email = 'test@test.com', grade = '3') {
  const now = new Date();
  const payload = {
    type: 'new-player',
    playerName: name,
    playerEmail: email,
    playerGrade: grade,
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
    language: navigator.language.startsWith('fr') ? 'french' : 'english',
  };
  console.log('[Email] Test new-player request...', payload);
  return _sendEmail(payload)
    .then(result => console.log('[Email] Test new-player result', result))
    .catch(err => console.error('[Email] Test new-player failed:', err));
}

export function sendFeedback({
  playerName, playerEmail, grade,
  rating, comment,
  level, xp, aircraft, playtime,
}) {
  const payload = {
    type: 'feedback',
    playerName: playerName || 'PILOT',
    playerEmail: playerEmail || '(no email)',
    grade: String(grade || 0),
    date: new Date().toLocaleDateString(),
    rating: String(rating || 0),
    comment: comment || '(no comment)',
    level: String(level || 0),
    xp: String(xp || 0),
    aircraft: Array.isArray(aircraft) ? aircraft.join(', ') : String(aircraft || ''),
    playtime: playtime || '0 min',
  };

  console.log('[Email] Sending feedback request...', payload);
  return _sendEmail(payload);
}
