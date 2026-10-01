const KEY = 'jexongo_';

export function save(key, value) {
  try { localStorage.setItem(KEY + key, JSON.stringify(value)); } catch (_) {}
}

export function load(key, fallback = null) {
  try {
    const v = localStorage.getItem(KEY + key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch (_) { return fallback; }
}

export function clearAll() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(KEY))
    .forEach(k => localStorage.removeItem(k));
}

// Kept on this device when the player signs out: language, settings, the
// device id of the session lock, and "intro already seen", so the game
// reopens on the lobby instead of the new-player questions and briefing.
const KEPT_ON_SIGN_OUT = ['lang', 'settings', 'sessionDeviceId', 'hasSeenOnboarding', 'hasSeenBriefing'];

/** Sign-out: forget the account and its progress, keep the device's own choices. */
export function clearAccountData() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(KEY) && !KEPT_ON_SIGN_OUT.includes(k.slice(KEY.length)))
    .forEach(k => localStorage.removeItem(k));
}
