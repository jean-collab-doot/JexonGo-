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
