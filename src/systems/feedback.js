import { API_URL } from './cloud-save.js';

const NEW_PLAYER_KEY = 'jexongo_new_player';
const FEEDBACK_SENT_KEY = 'jexongo_feedback_date';
const EMAILJS_SERVICE_ID = 'service_se9vi2q';
const EMAILJS_TEMPLATE_ID = 'template_icrozxf';
const EMAILJS_PUBLIC_KEY = 'tKhT13eitJ6j1EdHo';

function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function _newPlayerKey(email) {
  const id = String(email || 'guest').toLowerCase().trim();
  return `${NEW_PLAYER_KEY}:${id || 'guest'}`;
}

async function _sendEmail(payload) {
  const res = await fetch(`${API_URL}/api/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Email failed (${res.status})`);
  return data;
}

async function _sendFeedbackWithEmailJs(payload) {
  const templateParams = {
    type: payload.type,
    player_name: payload.playerName,
    player_email: payload.playerEmail,
    grade: payload.grade,
    date: payload.date,
    rating: payload.rating,
    comment: payload.comment,
    level: payload.level,
    xp: payload.xp,
    aircraft: payload.aircraft,
    playtime: payload.playtime,
    message: [
      `Player: ${payload.playerName}`,
      `Email: ${payload.playerEmail}`,
      `Grade: ${payload.grade}`,
      `Stars: ${payload.rating}`,
      `Comment: ${payload.comment}`,
      `Level: ${payload.level}`,
      `XP: ${payload.xp}`,
      `Aircraft: ${payload.aircraft}`,
      `Playtime: ${payload.playtime}`,
      `Date: ${payload.date}`,
    ].join('\n'),
  };

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: templateParams,
    }),
  });

  if (!res.ok) {
    const details = await res.text().catch(() => '');
    throw new Error(details || `EmailJS failed (${res.status})`);
  }
  return { ok: true };
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
  console.log('[Resend] Sending test email...', payload);
  return _sendEmail(payload)
    .then(result => console.log('[Resend] Test sent', result))
    .catch(err => console.error('[Resend] Test failed:', err));
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

  console.log('[EmailJS] Sending feedback...', payload);
  return _sendFeedbackWithEmailJs(payload);
}
