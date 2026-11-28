// Lobby left column (MULTI, TOP 20, ERREURS, GRADES) and ∞ INFINI on the
// right: placed from the real screen instead of fixed numbers, so on every
// phone and tablet (upright, sideways, with the browser bar) the column
// starts under the coins / EXP bar and ends above the big orange ◀ arrow
// (missions), never touching either. When there is not enough room, the
// buttons get a bit smaller (down to 60 %) and closer. INFINI stays level
// with MULTI, at the same size.
const COLUMN = ['btn-lobby-multi', 'btn-lobby-top20', 'btn-lobby-mistakes', 'btn-lobby-grades'];
const RIGHT = 'btn-lobby-endless';
const TAG_HANG = 12;        // the lock tag ("COMPTE", "NIV 3") hangs under a button
const MARGIN_TOP = 14;      // under the coins bar
const MARGIN_BOTTOM = 14;   // above the arrow
const GAP_MAX = 22, GAP_MIN = 12;
const SCALE_MIN = 0.6;

const $ = id => document.getElementById(id);
const overlapsX = (a, b) => a.left < b.right && b.left < a.right;

function shown(el) {
  if (!el) return false;
  const st = getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden';
}

export function fitLobbyColumn() {
  const menu = $('s-menu');
  if (!menu || menu.classList.contains('hidden')) return;
  const btns = COLUMN.map($).filter(shown);
  if (!btns.length) return;
  // Measure at full size first.
  btns.forEach(b => { b.classList.remove('col-fit'); b.style.removeProperty('--col-scale'); b.style.top = ''; b.style.left = ''; });
  const right = $(RIGHT);
  if (right) { right.classList.remove('col-fit'); right.style.removeProperty('--col-scale'); right.style.top = ''; }
  const first = btns[0].getBoundingClientRect();
  if (first.width < 4) return;
  const h = btns[0].offsetHeight;
  const colBox = { left: first.left, right: first.left + btns[0].offsetWidth };
  const menuTop = (btns[0].offsetParent || menu).getBoundingClientRect().top;

  // Top: under the coins / EXP bar. Phones and tablets: always under it
  // (beside it, the buttons touched it); computers: only if the bar crosses
  // the column (otherwise the free corner beside it, as before).
  const underBar = window.innerWidth < 700 || window.matchMedia('(pointer: coarse)').matches;
  let top = 8;
  for (const sel of ['#s-menu .jx-hud', '#s-menu .jx-hud-main', '#btn-jx-menu']) {
    const el = document.querySelector(sel);
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 4 && (underBar || overlapsX(r, colBox))) top = Math.max(top, r.bottom + MARGIN_TOP);
  }
  // INFINI must also clear the bar on its side.
  if (right && shown(right)) {
    const rb = right.getBoundingClientRect();
    const rBox = { left: rb.left, right: rb.left + right.offsetWidth };
    for (const sel of ['#s-menu .jx-hud', '#s-menu .jx-hud-main', '#btn-jx-menu']) {
      const el = document.querySelector(sel);
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 4 && overlapsX(r, rBox)) top = Math.max(top, r.bottom + MARGIN_TOP);
    }
  }
  // Bottom: above the big ◀ arrow (or the day-time tab) under the column.
  let bottom = window.innerHeight - 8;
  for (const sel of ['#btn-jx-nav-prev', '#s-menu .jx-daytab']) {
    const el = document.querySelector(sel);
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 4 && overlapsX(r, colBox) && r.top > top) bottom = Math.min(bottom, r.top - MARGIN_BOTTOM);
  }

  // Biggest size (and gap) that fits: n buttons + gaps + the last tag.
  const n = btns.length;
  const room = bottom - top - TAG_HANG;
  let scale = 1, gap = GAP_MAX;
  const need = (s, g) => n * h * s + (n - 1) * g;
  if (need(1, GAP_MAX) > room) {
    gap = Math.max(GAP_MIN, Math.min(GAP_MAX, (room - n * h) / Math.max(1, n - 1)));
    if (need(1, gap) > room) {
      gap = GAP_MIN;
      scale = Math.max(SCALE_MIN, (room - (n - 1) * gap) / (n * h));
    }
  }
  // Same size as the CSS gave on small phones: never bigger than before.
  const cssScale = new DOMMatrixReadOnly(getComputedStyle(btns[0]).transform === 'none' ? undefined : getComputedStyle(btns[0]).transform).a || 1;
  scale = Math.min(scale, cssScale);

  btns.forEach((b, i) => {
    b.classList.add('col-fit');
    b.style.setProperty('--col-scale', scale.toFixed(3));
    b.style.top = `${Math.round(top - menuTop + i * (h * scale + gap))}px`;
  });
  if (right) {
    right.classList.add('col-fit');
    right.style.setProperty('--col-scale', scale.toFixed(3));
    right.style.top = `${Math.round(top - menuTop)}px`;
  }
}

let _raf = 0;
function schedule() {
  cancelAnimationFrame(_raf);
  _raf = requestAnimationFrame(() => { _raf = requestAnimationFrame(fitLobbyColumn); });
}

export function initLobbyColumn() {
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => setTimeout(schedule, 250));
  window.visualViewport?.addEventListener('resize', schedule);
  // Fonts / images can change the bar's size after the first paint.
  document.fonts?.ready?.then(schedule).catch(() => {});
  window.addEventListener('load', schedule);
  schedule();
}
export { schedule as scheduleLobbyColumn };
