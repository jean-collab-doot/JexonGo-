import { SFX } from '../audio/sound.js';
import { t, getLang, setLang, applyI18n } from '../i18n.js';
import { resetIntroBriefing } from './intro-briefing.js';
import { showEquationConfig } from './onboarding.js';
import { updateDrawerProfile } from './menu.js';
import { renderBadges } from './hangar.js';

const KEY = 'jexongo_settings';

export const settings = {
  volume:  80,   // 0-100 SFX
  music:   45,   // 0-100 music
  effects: true,
};

export function loadSettings() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) Object.assign(settings, JSON.parse(s));
  } catch (_) {}
  _apply();
}

function _save()  { localStorage.setItem(KEY, JSON.stringify(settings)); }
function _apply() {
  SFX.setVolume(settings.effects ? settings.volume / 100 : 0);
  SFX.setMusicVolume(settings.music / 100);
}

function _refresh() {
  const sfxSlider = document.getElementById('sett-volume-slider');
  if (sfxSlider) {
    sfxSlider.value = settings.volume;
    sfxSlider.style.setProperty('--pct', settings.volume + '%');
  }
  const sfxVal = document.getElementById('sett-volume-val');
  if (sfxVal) sfxVal.textContent = settings.volume + '%';

  const musicSlider = document.getElementById('sett-music-slider');
  if (musicSlider) {
    musicSlider.value = settings.music;
    musicSlider.style.setProperty('--pct', settings.music + '%');
  }
  const musicVal = document.getElementById('sett-music-val');
  if (musicVal) musicVal.textContent = settings.music + '%';

  const eff = document.getElementById('sett-effects');
  if (eff) {
    eff.textContent = settings.effects ? t('on') : t('off');
    eff.classList.toggle('sett-on',  settings.effects);
    eff.classList.toggle('sett-off', !settings.effects);
  }

  const langBtn = document.getElementById('btn-jx-lang');
  if (langBtn) langBtn.textContent = t('jxLangName');
}

function _openDrawer() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  _refresh();
  updateDrawerProfile();
  panel.classList.remove('hidden');
}
function _closeDrawer() {
  const panel = document.getElementById('settings-panel');
  const drawer = panel?.querySelector('.jx-drawer');
  if (drawer) {
    drawer.classList.remove('is-swiping');
    drawer.classList.add('is-closing');
    drawer.style.transform = '';
    setTimeout(() => {
      panel.classList.add('hidden');
      drawer.classList.remove('is-closing');
    }, 200);
  } else {
    panel?.classList.add('hidden');
  }
}

// Swipe the drawer to the right to dismiss it.
function _bindSwipeToClose(drawer) {
  let startX = 0, startY = 0, dx = 0, active = false;
  const REST = 'rotate(-4deg) translateX(6%)';

  drawer.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('input, textarea, select, .jx-sub')) return;   // don't fight sliders
    startX = e.clientX; startY = e.clientY; dx = 0; active = true;
  });
  drawer.addEventListener('pointermove', e => {
    if (!active) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;
    if (!drawer.classList.contains('is-swiping')) {
      if (Math.abs(mx) < 8 || Math.abs(my) > Math.abs(mx)) return;   // let vertical scroll win
      drawer.classList.add('is-swiping');
    }
    dx = Math.max(0, mx);
    drawer.style.transform = `${REST} translateX(${dx}px)`;
  });
  const end = () => {
    if (!active) return;
    active = false;
    drawer.classList.remove('is-swiping');
    if (dx > 90) { _closeDrawer(); return; }
    drawer.style.transition = 'transform .18s ease-out';
    drawer.style.transform = REST;
    setTimeout(() => { drawer.style.transition = ''; drawer.style.transform = ''; }, 200);
  };
  drawer.addEventListener('pointerup', end);
  drawer.addEventListener('pointercancel', end);
}

export function initSettings() {
  const panel = document.getElementById('settings-panel');

  document.querySelectorAll('.jx-burger').forEach(btn => btn.addEventListener('click', _openDrawer));
  document.getElementById('btn-settings-close')?.addEventListener('click', _closeDrawer);
  panel?.addEventListener('click', e => { if (e.target === panel) _closeDrawer(); });

  const drawer = panel?.querySelector('.jx-drawer');
  if (drawer) _bindSwipeToClose(drawer);

  // Collapsible sub-sections (VOLUME, PROFIL)
  document.querySelectorAll('#settings-panel [data-jx-sub]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sub = document.getElementById(btn.dataset.jxSub);
      sub?.classList.toggle('is-open');
    });
  });

  // Language
  document.getElementById('btn-jx-lang')?.addEventListener('click', () => {
    setLang(getLang() === 'en' ? 'fr' : 'en');   // setLang calls applyI18n()
    _refresh();
    _refreshVisibleScreen();
  });

  // SFX volume slider
  document.getElementById('sett-volume-slider')?.addEventListener('input', e => {
    settings.volume = Number(e.target.value);
    document.getElementById('sett-volume-val').textContent = settings.volume + '%';
    e.target.style.setProperty('--pct', settings.volume + '%');
    _save(); _apply();
  });
  // Music volume slider
  document.getElementById('sett-music-slider')?.addEventListener('input', e => {
    settings.music = Number(e.target.value);
    document.getElementById('sett-music-val').textContent = settings.music + '%';
    e.target.style.setProperty('--pct', settings.music + '%');
    _save(); _apply();
  });
  document.getElementById('sett-volume-slider')?.addEventListener('change', () => { _save(); _apply(); _refresh(); });
  document.getElementById('sett-music-slider')?.addEventListener('change', () => { _save(); _apply(); _refresh(); });

  // Effects toggle
  document.getElementById('sett-effects')?.addEventListener('click', () => {
    settings.effects = !settings.effects;
    _save(); _refresh(); _apply();
  });

  // BRIFING button: the "how to play" briefing right away, then the same
  // beginner practice as new players (main.js window._startBriefingPractice).
  document.getElementById('btn-replay-briefing')?.addEventListener('click', () => {
    _closeDrawer();
    if (window._startBriefingPractice) window._startBriefingPractice();
    else {
      resetIntroBriefing();
      window._showToast?.('Briefing will replay on Level 1.');
    }
  });

  document.getElementById('btn-change-equations')?.addEventListener('click', () => {
    _closeDrawer();
    showEquationConfig(() => {
      SFX.playMusic('menu');   // back to the lobby after the (silent) questionnaire
      window._showToast?.('Configuration des equations sauvegardee.');
    });
  });

  document.getElementById('btn-feedback-menu')?.addEventListener('click', () => {
    _closeDrawer();
    window._showFeedbackPopup?.();
  });

  // Privacy / terms — main.js switches the screen; just close the drawer here.
  document.getElementById('btn-menu-privacy')?.addEventListener('click', _closeDrawer);
  document.getElementById('btn-menu-terms')?.addEventListener('click', _closeDrawer);

  // Badges overlay
  const badgesOverlay = document.getElementById('badges-overlay');
  document.getElementById('btn-jx-badges')?.addEventListener('click', () => {
    _closeDrawer();
    renderBadges(document.getElementById('hangar-badges'));
    badgesOverlay?.classList.remove('hidden');
  });
  document.getElementById('btn-badges-close')?.addEventListener('click', () => badgesOverlay?.classList.add('hidden'));
  badgesOverlay?.addEventListener('click', e => { if (e.target === badgesOverlay) badgesOverlay.classList.add('hidden'); });

  applyI18n();
}

function _refreshVisibleScreen() {
  const visible = id => document.getElementById(id) && !document.getElementById(id).classList.contains('hidden');
  import('./menu.js').then(m => { if (visible('s-menu')) m.renderMenu(); });
  import('./shop.js').then(m => { if (visible('s-shop')) m.renderShop(); });
  import('./hangar.js').then(m => { if (visible('s-hangar')) m.renderHangar(); });
  import('./training.js').then(m => { if (visible('s-training')) m.renderTraining(); });
}
