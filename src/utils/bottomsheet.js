// Pull-up bottom sheet: drag the grip up to open, drag down to close.
// Tapping the grip also toggles. Works with mouse + touch via pointer events.

export function makeBottomSheet(sheet, { onOpen, onClose } = {}) {
  if (!sheet || sheet._jxSheetBound) return sheet && sheet._jxSheet;
  const grip = sheet.querySelector('.jx-sheet-grip');
  if (!grip) return;
  const PEEK = 56;                // matches .jx-bottomsheet.is-collapsed's peek amount in CSS
  let startY = 0, dragging = false, moved = false, sheetH = 0, suppressClick = false;

  const isOpen = () => sheet.classList.contains('is-open');
  const open = () => {
    sheet.style.transform = '';
    sheet.classList.remove('is-collapsed');
    sheet.classList.add('is-open');
    onOpen?.();
  };
  const close = () => {
    sheet.style.transform = '';
    sheet.classList.add('is-collapsed');
    sheet.classList.remove('is-open');
    onClose?.();
  };
  const toggle = () => (isOpen() ? close() : open());

  grip.addEventListener('pointerdown', e => {
    dragging = true; moved = false;
    startY = e.clientY;
    sheetH = sheet.getBoundingClientRect().height || sheet.offsetHeight;
    sheet.classList.add('is-dragging');
    grip.setPointerCapture?.(e.pointerId);
  });
  grip.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 5) moved = true;
    const base = isOpen() ? 0 : Math.max(0, sheetH - PEEK);
    const y = Math.min(Math.max(0, sheetH - PEEK), Math.max(0, base + dy));
    sheet.style.transform = `translateY(${y}px)`;
  });
  const end = e => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('is-dragging');
    if (!moved) { sheet.style.transform = ''; return; }   // let the click handler toggle
    suppressClick = true;
    const dy = e.clientY - startY;
    if (dy < -50) open();
    else if (dy > 50) close();
    else (isOpen() ? open() : close());
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);

  grip.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    toggle();
  });

  sheet._jxSheetBound = true;
  sheet._jxSheet = { open, close, isOpen };
  return sheet._jxSheet;
}
