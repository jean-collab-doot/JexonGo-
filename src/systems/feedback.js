// ── EMAILJS FEEDBACK SYSTEM ───────────────────────────────────────────────────
const EMAILJS_PUBLIC_KEY  = 'tKhT13eitJ6j1EdHo';
const EMAILJS_SERVICE_ID  = 'service_mdhv776';
const EMAILJS_TEMPLATE_ID = 'template_icrozxf';

const FEEDBACK_SENT_KEY = 'jexongo_feedback_date';
let _initialized = false;

function _init() {
  if (_initialized) return true;
  if (typeof emailjs === 'undefined') {
    console.warn('[EmailJS] ❌ Library not loaded — CDN script missing or blocked');
    return false;
  }
  emailjs.init(EMAILJS_PUBLIC_KEY);
  _initialized = true;
  console.log('[EmailJS] ✅ Initialized — key:', EMAILJS_PUBLIC_KEY);
  return true;
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
  if (!_init()) {
    return Promise.reject(new Error('EmailJS not loaded'));
  }

  const params = {
    player_name:  playerName  || 'PILOT',
    player_email: playerEmail || '(no email)',
    grade:        String(grade   || 0),
    date:         new Date().toLocaleDateString(),
    stars:        String(rating  || 0),
    comment:      comment        || '(no comment)',
    level:        String(level   || 0),
    xp:           String(xp      || 0),
    aircraft:     Array.isArray(aircraft) ? aircraft.join(', ') : String(aircraft || ''),
    playtime:     playtime       || '0 min',
  };

  console.log('[EmailJS] 📤 Sending...');
  console.log('[EmailJS] Service:', EMAILJS_SERVICE_ID, '| Template:', EMAILJS_TEMPLATE_ID);
  console.log('[EmailJS] Params:', params);

  return emailjs
    .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
    .then(result => {
      console.log('[EmailJS] ✅ SUCCESS — status:', result.status, '|', result.text);
      return result;
    })
    .catch(err => {
      console.error('[EmailJS] ❌ FAILED:', err);
      throw err;
    });
}
