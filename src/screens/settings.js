import { SFX } from '../audio/sound.js';
import { t } from '../i18n.js';

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
  SFX.setVolume(settings.volume / 100);
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
  const sfxIcon = document.getElementById('sett-vol-icon');
  if (sfxIcon) sfxIcon.textContent = settings.volume === 0 ? '🔇' : settings.volume < 50 ? '🔉' : '🔊';

  const musicSlider = document.getElementById('sett-music-slider');
  if (musicSlider) {
    musicSlider.value = settings.music;
    musicSlider.style.setProperty('--pct', settings.music + '%');
  }
  const musicVal = document.getElementById('sett-music-val');
  if (musicVal) musicVal.textContent = settings.music + '%';
  const musicIcon = document.getElementById('sett-music-icon');
  if (musicIcon) musicIcon.textContent = settings.music === 0 ? '🔇' : '🎵';

  const eff = document.getElementById('sett-effects');
  if (eff) {
    eff.textContent = settings.effects ? t('on') : t('off');
    eff.classList.toggle('sett-on',  settings.effects);
    eff.classList.toggle('sett-off', !settings.effects);
  }
}

export function initSettings() {
  const btn   = document.getElementById('btn-settings');
  const panel = document.getElementById('settings-panel');
  const close = document.getElementById('btn-settings-close');

  const hide = () => panel.classList.add('hidden');

  btn.addEventListener('click', () => {
    _refresh();
    panel.classList.remove('hidden');
  });
  close.addEventListener('click', hide);
  panel.addEventListener('click', e => { if (e.target === panel) hide(); });

  // SFX volume slider
  document.getElementById('sett-volume-slider').addEventListener('input', e => {
    settings.volume = Number(e.target.value);
    document.getElementById('sett-volume-val').textContent = settings.volume + '%';
    e.target.style.setProperty('--pct', settings.volume + '%');
    const icon = document.getElementById('sett-vol-icon');
    if (icon) icon.textContent = settings.volume === 0 ? '🔇' : settings.volume < 50 ? '🔉' : '🔊';
    _save(); _apply();
  });

  // Music volume slider
  document.getElementById('sett-music-slider').addEventListener('input', e => {
    settings.music = Number(e.target.value);
    document.getElementById('sett-music-val').textContent = settings.music + '%';
    e.target.style.setProperty('--pct', settings.music + '%');
    const icon = document.getElementById('sett-music-icon');
    if (icon) icon.textContent = settings.music === 0 ? '🔇' : '🎵';
    _save(); _apply();
  });

  // Effects toggle
  document.getElementById('sett-effects').addEventListener('click', () => {
    settings.effects = !settings.effects;
    _save(); _refresh();
  });
}
