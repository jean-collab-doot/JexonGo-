import { SFX } from '../audio/sound.js';

const KEY = 'jexongo_settings';

export const settings = {
  volume:  80,   // 0-100
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
function _apply() { SFX.setVolume(settings.volume / 100); }

function _refresh() {
  const slider = document.getElementById('sett-volume-slider');
  const label  = document.getElementById('sett-volume-val');
  if (slider) {
    slider.value = settings.volume;
    slider.style.setProperty('--pct', settings.volume + '%');
  }
  if (label) label.textContent = settings.volume + '%';
  const icon = document.getElementById('sett-vol-icon');
  if (icon) icon.textContent = settings.volume === 0 ? '🔇' : settings.volume < 50 ? '🔉' : '🔊';

  const eff = document.getElementById('sett-effects');
  if (eff) {
    eff.textContent = settings.effects ? 'ON' : 'OFF';
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

  // Volume slider — live update
  document.getElementById('sett-volume-slider').addEventListener('input', e => {
    settings.volume = Number(e.target.value);
    document.getElementById('sett-volume-val').textContent = settings.volume + '%';
    e.target.style.setProperty('--pct', settings.volume + '%');
    // Update speaker icon
    const icon = document.getElementById('sett-vol-icon');
    if (icon) icon.textContent = settings.volume === 0 ? '🔇' : settings.volume < 50 ? '🔉' : '🔊';
    _save(); _apply();
  });

  // Effects toggle
  document.getElementById('sett-effects').addEventListener('click', () => {
    settings.effects = !settings.effects;
    _save(); _refresh();
  });
}
