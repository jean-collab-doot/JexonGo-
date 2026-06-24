import { API_URL } from './cloud-save.js';

const NEW_PLAYER_KEY = 'jexongo_new_player_emailjs_v4';
const FEEDBACK_SENT_KEY = 'jexongo_feedback_date';

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
