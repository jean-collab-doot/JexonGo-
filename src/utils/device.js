// Touch device detection — phone & tablet only; desktop is never flagged.
// Results are cached: isPhone/isTablet/isTouchMobile are called from
// per-frame hot paths (particle/missile draw, aircraft draw), and re-running
// UA regexes every call for a value that only changes on resize/orientation
// is wasted work. invalidateDeviceFlagsCache() is called from
// applyDeviceClasses() on those events to keep the cache correct.

const _ua = () => navigator.userAgent;

let _cachedFlags = null;

function _computeFlags() {
  const ua = _ua();
  const tablet = (
    /iPad/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua)) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth >= 768 && window.innerWidth <= 1400)
  );
  let phone = false;
  if (!tablet) {
    if (/iPhone|iPod/i.test(ua)) phone = true;
    else if (/Android/i.test(ua) && /Mobile/i.test(ua)) phone = true;
    else phone = ('ontouchstart' in window) && window.innerWidth <= 768;
  }
  return { tablet, phone };
}

function _flags() {
  if (!_cachedFlags) _cachedFlags = _computeFlags();
  return _cachedFlags;
}

export function invalidateDeviceFlagsCache() {
  _cachedFlags = null;
}

export function isTablet() {
  return _flags().tablet;
}

export function isPhone() {
  return _flags().phone;
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

export const GAME_FPS_TOUCH = 60;

export function maxParticlesTouch() {
  return isPhone() ? 1 : 2;
}

export const MAX_ENEMY_MISSILES_TOUCH = 2;

/** Apply .touch-mobile / .touch-tablet on <html> for CSS. */
export function applyDeviceClasses() {
  invalidateDeviceFlagsCache();
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;

  root.style.setProperty('--app-width', `${Math.round(width)}px`);
  root.style.setProperty('--app-height', `${Math.round(height)}px`);
  root.classList.toggle('touch-mobile', isTouchMobile());
  root.classList.toggle('touch-phone', isPhone());
  root.classList.toggle('touch-tablet', isTablet() && !isPhone());
  root.classList.toggle('viewport-portrait', height >= width);
  root.classList.toggle('viewport-landscape', width > height);
  root.classList.toggle('compact-height', height <= 560);

  const phone = isPhone();
  const tablet = isTablet() && !phone;
  root.dataset.deviceSize = phone
    ? (Math.min(width, height) <= 380 ? 'phone-small' : 'phone')
    : tablet
      ? 'tablet'
      : width >= 1600
        ? 'desktop-wide'
        : 'desktop';
}
