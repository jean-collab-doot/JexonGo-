// ── EMAILJS FEEDBACK SYSTEM ───────────────────────────────────────────────────
const EMAILJS_PUBLIC_KEY  = 'tKhT13eitJ6j1EdHo';
const EMAILJS_SERVICE_ID  = 'service_mdhv776';
const EMAILJS_TEMPLATE_ID = 'template_icrozxf';

const FEEDBACK_SENT_KEY = 'jexongo_feedback_date';

let _initialized = false;

function init() {
  if (_initialized || typeof emailjs === 'undefined') return;
  emailjs.init(EMAILJS_PUBLIC_KEY);
  _initialized = true;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function canSendFeedback() {
  return localStorage.getItem(FEEDBACK_SENT_KEY) !== todayStr();
}

export function markFeedbackSent() {
  localStorage.setItem(FEEDBACK_SENT_KEY, todayStr());
}

export function sendFeedback({
  playerName, playerEmail, grade,
  rating, comment,
  level, xp, aircraft, playtime,
}) {
  init();
  if (typeof emailjs === 'undefined') {
    console.warn('EmailJS not loaded — feedback not sent');
    return Promise.resolve();
  }
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    player_name:  playerName  || 'PILOT',
    player_email: playerEmail || '(no email)',
    grade:        String(grade    || 0),
    date:         new Date().toLocaleDateString(),
    stars:        String(rating   || 0),
    comment:      comment         || '(no comment)',
    level:        String(level    || 0),
    xp:           String(xp       || 0),
    aircraft:     Array.isArray(aircraft) ? aircraft.join(', ') : String(aircraft || ''),
    playtime:     playtime        || '0 min',
  });
}
