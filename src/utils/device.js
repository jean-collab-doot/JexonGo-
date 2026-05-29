// Touch device detection — phone & tablet only; desktop is never flagged.
const _ua = navigator.userAgent;

export const isTablet =
  /iPad/i.test(_ua) ||
  (/Macintosh/i.test(_ua) && navigator.maxTouchPoints > 1) ||
  (/Android/i.test(_ua) && !/Mobile/i.test(_ua)) ||
  (navigator.maxTouchPoints > 1 && window.innerWidth >= 768 && window.innerWidth <= 1400);

export const isPhone =
  !isTablet &&
  (window.innerWidth <= 480 || (('ontouchstart' in window) && window.innerWidth <= 768));

/** Phone or tablet — use for perf caps; never true on desktop. */
export const isTouchMobile = isPhone || isTablet;

/** Internal canvas scale (CSS upscales). Lower = fewer pixels drawn. */
export function gameCanvasDpr() {
  if (isPhone) return 0.55;
  if (isTablet) return 0.5;
  return Math.min(window.devicePixelRatio || 1, 1);
}

export const GAME_FPS_TOUCH = 30;
export const MAX_PARTICLES_TOUCH = isPhone ? 3 : 4;
export const MAX_ENEMY_MISSILES_TOUCH = 8;
