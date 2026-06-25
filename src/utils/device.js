// Touch device detection — phone & tablet only; desktop is never flagged.
// Use functions (not module-load constants) so rotation/resize stay correct.

const _ua = () => navigator.userAgent;

export function isTablet() {
  const ua = _ua();
  return (
    /iPad/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua)) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth >= 768 && window.innerWidth <= 1400)
  );
}

export function isPhone() {
  if (isTablet()) return false;
  const ua = _ua();
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
  return ('ontouchstart' in window) && window.innerWidth <= 768;
}

export function isTouchMobile() {
  return isPhone() || isTablet();
}

export function gameCanvasDpr() {
  if (isPhone()) return Math.min(window.devicePixelRatio || 1, 1);
  if (isTablet()) return Math.min(window.devicePixelRatio || 1, 1);
  return Math.min(window.devicePixelRatio || 1, 1);
}

export function touchMenuCanvasDpr() {
  return isTouchMobile() ? Math.min(window.devicePixelRatio || 1, 1) : 1;
}

export const GAME_FPS_TOUCH = 30;

export function maxParticlesTouch() {
  return isPhone() ? 1 : 2;
}

export const MAX_ENEMY_MISSILES_TOUCH = 3;

/** Apply .touch-mobile / .touch-tablet on <html> for CSS. */
export function applyDeviceClasses() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;

  root.style.setProperty('--app-width', `${Math.round(width)}px`);
  root.style.setProperty('--app-height', `${Math.round(height)}px`);
  root.classList.toggle('touch-mobile', isTouchMobile());
  root.classList.toggle('touch-phone', isPhone());
  root.classList.toggle('touch-tablet', isTablet() && !isPhone());
}
