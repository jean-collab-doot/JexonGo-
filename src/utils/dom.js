export const $ = id => document.getElementById(id);

const SCREEN_IDS = [
  's-menu', 's-levelmap', 's-game',
  's-hangar', 's-shop', 's-training', 's-result', 's-chest', 's-gameover',
  's-ranked', 's-ranked-find', 's-ranked-intro', 's-ranked-duel', 's-ranked-result',
  's-briefing', 's-classroom',
  's-arena', 's-grade', 's-register', 's-profile', 's-privacy', 's-terms',
];

// Screens still using the old 4-icon bottom nav. 's-menu', 's-hangar' and
// 's-shop' have all been redesigned with their own single-tab/arrow
// navigation (see style.css .jg-lobby-tab-bar / .jg-lobby-arrow /
// .jg-hangar-page-arrow / .jg-shop-page-arrow) and no longer need this bar.
const GLOBAL_NAV_SCREENS = new Set([]);

const SWIPE_MS = 320;

// dir: omit for the old instant cut (every existing caller). Pass 'next' or
// 'prev' to slide the new screen in over the old one instead — 'next' enters
// from the right (as if the carousel moved forward, matching a ▶ tap),
// 'prev' enters from the left (◀ tap). Used by the lobby/shop/training/hangar
// carousel arrows; everything else (game start, results, settings, …) keeps
// the plain cut.
export function showScreen(id, dir) {
  const targetEl = document.getElementById(id);
  const currentId = dir && SCREEN_IDS.find(s => s !== id && !document.getElementById(s)?.classList.contains('hidden'));
  const currentEl = currentId && document.getElementById(currentId);

  if (!dir || !targetEl || !currentEl) {
    SCREEN_IDS.forEach(s => {
      const el = document.getElementById(s);
      if (el) el.classList.toggle('hidden', s !== id);
    });
  } else {
    const enterFrom = dir === 'next' ? '100%' : '-100%';
    const exitTo    = dir === 'next' ? '-100%' : '100%';
    targetEl.classList.remove('hidden');
    targetEl.style.transition = 'none';
    targetEl.style.transform = `translateX(${enterFrom})`;
    targetEl.style.zIndex = '2';
    currentEl.style.zIndex = '1';
    void targetEl.offsetWidth; // flush the "no transition" jump before animating in
    requestAnimationFrame(() => {
      targetEl.style.transition = `transform ${SWIPE_MS}ms ease`;
      currentEl.style.transition = `transform ${SWIPE_MS}ms ease`;
      targetEl.style.transform = 'translateX(0)';
      currentEl.style.transform = `translateX(${exitTo})`;
    });
    let done = false;
    const finish = e => {
      if (e && e.target !== targetEl) return; // ignore a child's own transition bubbling up
      if (done) return;
      done = true;
      SCREEN_IDS.forEach(s => {
        const el = document.getElementById(s);
        if (!el) return;
        el.classList.toggle('hidden', s !== id);
        el.style.transition = '';
        el.style.transform = '';
        el.style.zIndex = '';
      });
      targetEl.removeEventListener('transitionend', finish);
    };
    targetEl.addEventListener('transitionend', finish);
    setTimeout(finish, SWIPE_MS + 120); // safety net if transitionend never fires
  }

  const globalNav = document.getElementById('global-lobby-nav');
  if (globalNav) {
    globalNav.classList.toggle('hidden', !GLOBAL_NAV_SCREENS.has(id));
    globalNav.classList.toggle('above-shop-tabbar', id === 's-shop');
  }

  swingPlates(targetEl);
}

// Replays the .jx-plate "hanging sign" swing (see .jx-plate.jx-swing in
// lobby-redesign.css) every time a screen holding one becomes visible -
// remove+reflow+re-add is required since a CSS animation won't restart just
// because the class is already present.
export function swingPlates(root) {
  root?.querySelectorAll('.jx-plate').forEach(el => {
    el.classList.remove('jx-swing');
    void el.offsetWidth;
    el.classList.add('jx-swing');
  });
}
