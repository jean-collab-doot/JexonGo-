// ── EMAILJS CREDENTIALS ───────────────────────────────────────────────────────
const PUBLIC_KEY     = 'tKhT13eitJ6j1EdHo';
const FEEDBACK_SVC   = 'service_mdhv776';
const FEEDBACK_TMPL  = 'template_icrozxf';
const NOTIFY_SVC     = 'service_mdhv776';
const NOTIFY_TMPL    = 'template_gl9depi';
const ADMIN_EMAIL    = 'jeanlouisahyee72@gmail.com';

// localStorage keys
const NEW_PLAYER_KEY    = 'jexongo_new_player';
const FEEDBACK_SENT_KEY = 'jexongo_feedback_date';

let _initialized = false;

function _init() {
  if (_initialized) return true;
  if (typeof emailjs === 'undefined') {
    console.warn('[EmailJS] ❌ Library not loaded');
    return false;
  }
  emailjs.init(PUBLIC_KEY);
  _initialized = true;
  console.log('[EmailJS] ✅ Ready');
  return true;
}

function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── FEEDBACK HELPERS ──────────────────────────────────────────────────────────
export function canSendFeedback() {
  return localStorage.getItem(FEEDBACK_SENT_KEY) !== _todayStr();
}

export function markFeedbackSent() {
  localStorage.setItem(FEEDBACK_SENT_KEY, _todayStr());
}

// ── NEW PLAYER NOTIFICATION — sends 2 emails on first login only ───────────────
export function sendNewPlayerNotification({ playerName, playerEmail, playerGrade }) {
  // Guard: already sent → returning player, do nothing
  if (localStorage.getItem(NEW_PLAYER_KEY)) return;
  if (!_init()) return;

  const now      = new Date();
  const language = navigator.language.startsWith('fr') ? 'french' : 'english';

  const base = {
    player_name:  playerName  || 'PILOT',
    player_email: playerEmail || '(no email)',
    player_grade: String(playerGrade || 0),
    date:         now.toLocaleDateString(),
    time:         now.toLocaleTimeString(),
    language,
  };

  // Email 1 — Admin notification
  emailjs.send(NOTIFY_SVC, NOTIFY_TMPL, { ...base, to_email: ADMIN_EMAIL })
    .then(() => console.log('[EmailJS] ✅ Admin email sent'))
    .catch(e  => console.warn('[EmailJS] ⚠️ Admin email failed:', e));

  // Email 2 — Player welcome (only if player has a valid email)
  if (playerEmail && playerEmail.includes('@')) {
    emailjs.send(NOTIFY_SVC, NOTIFY_TMPL, { ...base, to_email: playerEmail })
      .then(() => console.log('[EmailJS] ✅ Player welcome sent to', playerEmail))
      .catch(e  => console.warn('[EmailJS] ⚠️ Player welcome failed:', e));
  }

  // Lock flag so this never fires again for this player
  localStorage.setItem(NEW_PLAYER_KEY, 'true');
}

// ── DEBUG HELPERS (window._resetNewPlayer / window._testEmailNow) ─────────────
export function _resetNewPlayer() {
  localStorage.removeItem(NEW_PLAYER_KEY);
  console.log('[EmailJS] 🔄 Flag cleared — next login will trigger notifications');
}

export function _testEmailNow(name = 'TEST PILOT', email = 'test@test.com', grade = '3') {
  if (!_init()) return;
  const now = new Date();
  const params = {
    to_email:     ADMIN_EMAIL,
    player_name:  name,
    player_email: email,
    player_grade: grade,
    date:         now.toLocaleDateString(),
    time:         now.toLocaleTimeString(),
    language:     navigator.language.startsWith('fr') ? 'french' : 'english',
  };
  console.log('[EmailJS] 🧪 Sending test email...', params);
  emailjs.send(NOTIFY_SVC, NOTIFY_TMPL, params)
    .then(r => console.log('[EmailJS] ✅ Test sent! Status:', r.status, r.text))
    .catch(e => console.error('[EmailJS] ❌ Test failed:', e));
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
  console.log('[EmailJS] Service:', FEEDBACK_SVC, '| Template:', FEEDBACK_TMPL);
  console.log('[EmailJS] Params:', params);

  return emailjs
    .send(FEEDBACK_SVC, FEEDBACK_TMPL, params)
    .then(result => {
      console.log('[EmailJS] ✅ SUCCESS — status:', result.status, '|', result.text);
      return result;
    })
    .catch(err => {
      console.error('[EmailJS] ❌ FAILED:', err);
      throw err;
    });
}
