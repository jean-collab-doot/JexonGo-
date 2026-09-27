// Every sound of the game. Files live in assets/music/<folder>/ — one folder
// per use, so swapping a sound is just replacing the file in its folder and
// its name here. Sounds without a file are short synthesized tones.
// Use .mp3 (or .wav): iPhone / Safari can't always play .ogg.
const _m = path => encodeURI(`/assets/music/${path}`);
const MUSIC = {
  menu:     _m('Lobby Music/8_bit_ooame_lofi.mp3'),
  game:     _m('Game Music/movingrightalong.wav'),
  // Boss levels: the dialogue theme while the boss talks, then the fight
  // theme of the boss's world (levels 10, 20, 30, 40, 50).
  dialogue:   _m('Boss music/Dialogue/alex_besss-a-dramatic-war-film-score-402028.mp3'),
  bossOcean:  _m('Boss music/Océan/bombinsound-stomp-drum-percussion-version-1-power-up-577425.mp3'),
  bossDesert: _m('Boss music/Desert/bearstockmusic-dramatic-588584.mp3'),
  bossCity:   _m('Boss music/USA/331music-teaser-dramatic-music-600498.mp3'),
  bossArctic: _m('Boss music/Artic/emmraan-dark-and-sad-epic-dramatic-cinematic-254261.mp3'),
  bossSpace:  _m('Boss music/Space/prettyjohn1-dramatic-491632.mp3'),
};
const SOUND = {
  click:     _m('Click sound boutons/drop_002.mp3'),
  takeoff:   _m('Click takeoff/confirmation_002.mp3'),
  explosion: _m('Explosion/explosionCrunch_000.mp3'),
  purchase:  _m('Purchase/freesound_gamestudio-purchase-success-384963.mp3'),
  refuse:    _m('Refuse/universfield-error-notification-04-199275.mp3'),
  laser:     _m('Shot/Lazer/laserLarge_003.mp3'),
  missile:   _m('Shot/Missile/laserSmall_004.mp3'),
  gun:       _m('Shot/Mitraiette/impactMetal_004.mp3'),
};

// ── VOLUME ────────────────────────────────────────────────────────────────────
let _sfxVol   = 1;
let _musicVol = 0.45;

function _clamp01(v) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

// ── WEB AUDIO CONTEXT ─────────────────────────────────────────────────────────
let _actx = null;
function _ac() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  // Only ask the browser to resume once the player has actually interacted with
  // the page — resuming before that just triggers a harmless-but-noisy console
  // warning. _resumeAll() (bound to taps/clicks/keys) resumes it for real.
  if (_actx.state === 'suspended' && navigator.userActivation?.hasBeenActive !== false) _actx.resume();
  return _actx;
}

// ── BUFFER CACHE ──────────────────────────────────────────────────────────────
const _bufs    = {};
const _offsets = {};

function _loadBuf(url) {
  if (_bufs[url]) return;
  fetch(url)
    .then(r => r.arrayBuffer())
    .then(ab => _ac().decodeAudioData(ab))
    .then(b  => {
      const data = b.getChannelData(0);
      let i = 0;
      while (i < data.length && Math.abs(data[i]) < 0.002) i++;
      _offsets[url] = i / b.sampleRate;
      _bufs[url] = b;
    })
    .catch(() => {});
}

// ── SFX CANCELLATION ──────────────────────────────────────────────────────────
const _timers  = [];
const _sources = [];
const _mediaShots = [];

function _after(ms, fn) {
  const id = setTimeout(() => { fn(); _timers.splice(_timers.indexOf(id), 1); }, ms);
  _timers.push(id);
}

function _stopAllSFX() {
  _nukeFlight = null;
  _adPlane = null;
  _timers.forEach(clearTimeout);
  _timers.length = 0;
  _sources.forEach(s => { try { s.stop(); } catch (_) {} });
  _sources.length = 0;
  _mediaShots.forEach(el => {
    try {
      el.pause();
      el.currentTime = 0;
    } catch (_) {}
  });
  _mediaShots.length = 0;
}

// ── PLAY HELPERS ──────────────────────────────────────────────────────────────
function _playBuf(url, vol, fallback, maxDur = Infinity) {
  if (_sfxVol === 0) return;
  const ctx = _ac();
  const buf = _bufs[url];
  if (buf) {
    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    gain.gain.value = Math.min(1, vol * _sfxVol);
    src.connect(gain); gain.connect(ctx.destination);
    _sources.push(src);
    src.onended = () => _sources.splice(_sources.indexOf(src), 1);
    const offset = _offsets[url] || 0;
    src.start(ctx.currentTime, offset);
    if (maxDur < Infinity) src.stop(ctx.currentTime + maxDur);
  } else {
    fallback(ctx);
    _loadBuf(url);
  }
}

function _tone(ctx, freq, type, dur, vol = 0.28, sweep = null) {
  try {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type;
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(sweep ?? freq, now);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(freq, now + dur);
    g.gain.setValueAtTime(vol * _sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.start(now); osc.stop(now + dur);
  } catch (_) {}
}

function _noise(ctx, dur, vol = 0.35) {
  try {
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    const g   = ctx.createGain();
    src.buffer = buf; src.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(vol * _sfxVol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.start();
  } catch (_) {}
}

// ── BACKGROUND MUSIC ─────────────────────────────────────────────────────────
const _bgEl = new Audio();
_bgEl.loop = true;
_bgEl.preload = 'auto';
let _bgCurrent = '';
const _positions = {};
let _fadeInterval = null;
let _bgSource = null;
let _bgGain = null;
let _bgOutputVol = _musicVol;

const GAME_PLAYBACK_RATE = 1.0;

function _ensureBgRoute() {
  try {
    const ctx = _ac();
    if (!_bgGain) {
      _bgGain = ctx.createGain();
      _bgGain.gain.value = _bgOutputVol;
      _bgGain.connect(ctx.destination);
    }
    if (!_bgSource) {
      _bgSource = ctx.createMediaElementSource(_bgEl);
      _bgSource.connect(_bgGain);
    }
    return true;
  } catch (_) {
    return false;
  }
}

function _setBgOutputVolume(vol) {
  _bgOutputVol = _clamp01(vol);
  if (_ensureBgRoute() && _bgGain) {
    _bgEl.volume = 1;
    _bgGain.gain.setTargetAtTime(_bgOutputVol, _ac().currentTime, 0.015);
  } else {
    _bgEl.volume = _bgOutputVol;
  }
  _bgEl.muted = _bgOutputVol === 0;
}

function _clearFade() {
  if (_fadeInterval) { clearInterval(_fadeInterval); _fadeInterval = null; }
}

function _fadeTo(targetVol, durationMs, onDone) {
  _clearFade();
  const startVol = _bgOutputVol;
  const steps    = 20;
  const stepMs   = durationMs / steps;
  const stepAmt  = (targetVol - startVol) / steps;
  let count = 0;
  _fadeInterval = setInterval(() => {
    count++;
    _setBgOutputVolume(startVol + stepAmt * count);
    if (count >= steps) {
      _setBgOutputVolume(targetVol);
      _clearFade();
      if (onDone) onDone();
    }
  }, stepMs);
}

function _startTrack(src) {
  const isGame = src === MUSIC.game;
  _bgCurrent    = src;
  _bgEl.src     = src;
  _setBgOutputVolume(0);
  _bgEl.loop    = true;
  _bgEl.playbackRate = isGame ? GAME_PLAYBACK_RATE : 1.0;
  _bgEl.load();
  const resume = _positions[src] || 0;
  if (resume > 0) {
    _bgEl.addEventListener('canplay', () => { _bgEl.currentTime = resume; }, { once: true });
  }
  _bgEl.play().catch(e => {
    console.warn('Music blocked:', e.message);
    setTimeout(_resumeAll, 120);
  });
  _fadeTo(_musicVol, 1500);
}

function _playMusic(src, restart = false) {
  // restart: from the very beginning (a level starts or is replayed).
  if (restart) {
    _positions[src] = 0;
    if (_bgCurrent === src) {
      _clearFade();
      _bgEl.currentTime = 0;
      _setBgOutputVolume(_musicVol);
      if (_bgEl.paused) _bgEl.play().catch(() => {});
      return;
    }
  }
  // Navigating between lobby sections must never reload the current track.
  // Resume the existing media element at its exact position if a browser or
  // screen transition temporarily paused it.
  if (_bgCurrent === src) {
    _bgEl.playbackRate = src === MUSIC.game ? GAME_PLAYBACK_RATE : 1;
    if (_bgEl.paused) _bgEl.play().catch(() => {});
    return;
  }
  if (_bgCurrent) _positions[_bgCurrent] = _bgEl.currentTime;

  if (!_bgEl.paused && _bgEl.src) {
    // Fade out current, then switch
    _fadeTo(0, 800, () => {
      _bgEl.pause();
      _startTrack(src);
    });
  } else {
    _startTrack(src);
  }
}

function _stopMusic() {
  _clearFade();
  if (_bgCurrent) _positions[_bgCurrent] = _bgEl.currentTime;
  _bgEl.pause();
  _bgEl.src    = '';
  _bgCurrent   = '';
}

// ── AUDIO RECOVERY ───────────────────────────────────────────────────────────
const _isMobileAudio = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function _resumeAll() {
  // Before the first tap/click/key the browser refuses audio and logs a warning
  // (focus / visibilitychange fire without a user gesture): wait for one.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  if (!_bgGain || !_bgSource) {
    _ensureBgRoute();
    _setBgOutputVolume(_musicVol);
  }
  if (_bgEl.src && _bgEl.paused && !_bgEl.ended) _bgEl.play().catch(() => {});
  if (_actx && _actx.state === 'suspended') _actx.resume();
}

// Resume on every tap/click (not { once } — AudioContext can suspend repeatedly)
document.addEventListener('touchstart', _resumeAll, { passive: true });
document.addEventListener('pointerdown', _resumeAll, { passive: true });
document.addEventListener('click',      _resumeAll);
document.addEventListener('keydown',    _resumeAll);

// Resume when tab comes back to foreground
window.addEventListener('focus', _resumeAll);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) setTimeout(_resumeAll, 300);
});

// On mobile: poll every 4 s while visible to catch silent audio drops
if (_isMobileAudio) {
  setInterval(() => {
    if (!document.hidden && ((_actx && _actx.state === 'suspended') || (_bgEl.src && _bgEl.paused))) {
      _resumeAll();
    }
  }, 4000);
}

// ── WEATHER AMBIENCE ─────────────────────────────────────────────────────────
// Each level's weather (data/weather.js) gets a looping background sound,
// synthesized here (no file to download): rain, wind that swells with the
// gusts, thunder on lightning, a volcano's rumble, the aurora's shimmer…
// It follows the SFX volume and fades in/out. game.js starts it with the
// level, stops it on pause / leaving, and reports lightning and gusts.
//   rain    hiss of falling rain (0 → none)      wind   howl (base level)
//   deep    lower wind (Jupiter / fog)           sand   fine high hiss
//   rumble  low volcanic rumble                  heat   buzzing heat shimmer
//   pad     soft chord (aurora)                  pings  glassy tinkles (rings)
//   booms   distant eruptions                    far    distant thunder
//   gust    extra wind at the peak of a gust
const WEATHER_AMBIENCE = {
  CLOUDY:      { wind: 0.12 },
  FOG:         { deep: 0.16 },
  RAIN:        { rain: 0.13 },
  STORM:       { rain: 0.18, wind: 0.12, gust: 0.25 },
  TYPHOON:     { rain: 0.17, wind: 0.2, gust: 0.28 },
  SNOW:        { wind: 0.15 },
  BLIZZARD:    { wind: 0.35, sand: 0.04, gust: 0.3 },
  SANDSTORM:   { wind: 0.28, sand: 0.07, gust: 0.25 },
  WINDY:       { wind: 0.22, gust: 0.3 },
  HEATWAVE:    { heat: 0.07, wind: 0.06 },
  VOLCANIC:    { rumble: 0.5, booms: true },
  JOVIAN:      { deep: 0.3, gust: 0.25, far: true },
  AURORA:      { pad: 0.015 },
  SUPERSONIC:  { wind: 0.3, gust: 0.3, high: true },
  RING_SHOWER: { pings: true, wind: 0.06 },
};
// Kept well under the music: a steady hiss (rain, wind) otherwise masks the
// music and the sound effects.
const WEATHER_BASE_VOL = 0.28;

let _wx = null;
let _noiseBuf = null;

function _noiseBuffer(ctx) {
  if (_noiseBuf) return _noiseBuf;
  const len = ctx.sampleRate * 3;
  _noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = _noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return _noiseBuf;
}

// Looping noise → filter → gain → the weather bus. Returns the gain node.
function _noiseLayer(ctx, bus, type, freq, q, vol) {
  const src = ctx.createBufferSource();
  src.buffer = _noiseBuffer(ctx);
  src.loop = true;
  src.loopStart = Math.random() * 2;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter); filter.connect(gain); gain.connect(bus);
  src.start(0, Math.random() * 2);
  _wx.nodes.push(src);
  return { filter, gain };
}

// Slow wobble of an AudioParam (wind rising and falling).
function _lfo(ctx, param, rate, depth) {
  const osc = ctx.createOscillator();
  const amt = ctx.createGain();
  osc.frequency.value = rate;
  amt.gain.value = depth;
  osc.connect(amt); amt.connect(param);
  osc.start();
  _wx.nodes.push(osc);
}

function _wxEvery(minMs, maxMs, fn) {
  const schedule = () => {
    _wx.timers.push(setTimeout(() => { if (_wx) { fn(); schedule(); } }, minMs + Math.random() * (maxMs - minMs)));
  };
  schedule();
}

// Distant/nearby thunder: a crack then a long low roll.
function _thunder(ctx, bus, loudness = 1) {
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = _noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(loudness > 0.6 ? 1800 : 500, now);
  filter.frequency.exponentialRampToValueAtTime(90, now + 2.6);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.9 * loudness, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.35 * loudness, now + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
  src.connect(filter); filter.connect(gain); gain.connect(bus);
  src.start(now, Math.random() * 2);
  src.stop(now + 3.3);
}

function _boom(ctx, bus) {
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = _noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 160;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.7, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
  src.connect(filter); filter.connect(gain); gain.connect(bus);
  src.start(now, Math.random() * 2);
  src.stop(now + 2.3);
}

function _ping(ctx, bus) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = [1568, 1760, 2093, 2349, 2637][Math.floor(Math.random() * 5)];
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  osc.connect(gain); gain.connect(bus);
  osc.start(now); osc.stop(now + 1);
}

function _weatherStop(fadeMs = 700) {
  if (!_wx) return;
  const wx = _wx;
  _wx = null;
  wx.timers.forEach(clearTimeout);
  try {
    const ctx = _ac();
    wx.bus.gain.setTargetAtTime(0.0001, ctx.currentTime, fadeMs / 4000);
    setTimeout(() => {
      wx.nodes.forEach(n => { try { n.stop(); } catch (_) {} });
      try { wx.bus.disconnect(); } catch (_) {}
    }, fadeMs + 100);
  } catch (_) {}
}

function _weatherStart(id) {
  _weatherStop(300);
  const cfg = WEATHER_AMBIENCE[id];
  if (!cfg) return;
  let ctx;
  try { ctx = _ac(); } catch (_) { return; }
  const bus = ctx.createGain();
  bus.gain.value = 0.0001;
  bus.connect(ctx.destination);
  _wx = { id, cfg, bus, nodes: [], timers: [], windGain: null, windBase: 0, lastGust: -1 };
  bus.gain.setTargetAtTime(WEATHER_BASE_VOL * _sfxVol, ctx.currentTime, 0.6);

  if (cfg.rain) {
    _noiseLayer(ctx, bus, 'highpass', 900, 0.5, cfg.rain);
    _noiseLayer(ctx, bus, 'lowpass', 400, 0.7, cfg.rain * 0.45);   // body of heavy rain
  }
  if (cfg.wind || cfg.gust) {
    const base = cfg.wind || 0.02;
    const w = _noiseLayer(ctx, bus, 'bandpass', cfg.high ? 750 : 420, 1.4, base);
    _lfo(ctx, w.filter.frequency, 0.12, cfg.high ? 260 : 170);
    _lfo(ctx, w.gain.gain, 0.07, base * 0.4);
    _wx.windGain = w.gain;
    _wx.windBase = base;
  }
  if (cfg.deep) {
    const d = _noiseLayer(ctx, bus, 'bandpass', 220, 1.1, cfg.deep);
    _lfo(ctx, d.filter.frequency, 0.08, 80);
    if (!_wx.windGain) { _wx.windGain = d.gain; _wx.windBase = cfg.deep; }
  }
  if (cfg.sand) _noiseLayer(ctx, bus, 'highpass', 3500, 0.6, cfg.sand);
  if (cfg.rumble) {
    const r = _noiseLayer(ctx, bus, 'lowpass', 180, 0.9, cfg.rumble);
    _lfo(ctx, r.gain.gain, 0.2, cfg.rumble * 0.35);
  }
  if (cfg.heat) {
    const h = _noiseLayer(ctx, bus, 'bandpass', 4800, 6, cfg.heat);
    _lfo(ctx, h.gain.gain, 17, cfg.heat * 0.8);   // cicada-like buzz
  }
  if (cfg.pad) {
    [220, 277.18, 329.63, 440].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.value = cfg.pad;
      osc.connect(g); g.connect(bus);
      osc.start();
      _wx.nodes.push(osc);
      _lfo(ctx, g.gain, 0.05 + i * 0.03, cfg.pad * 0.9);
    });
  }
  if (cfg.pings) _wxEvery(250, 900, () => _ping(_ac(), bus));
  if (cfg.booms) _wxEvery(6000, 13000, () => _boom(_ac(), bus));
  if (cfg.far) _wxEvery(7000, 15000, () => _thunder(_ac(), bus, 0.35));
}

// 0 → 1: how hard the wind is gusting right now (weather-fx.js).
function _weatherWind(level) {
  if (!_wx?.windGain || !_wx.cfg.gust) return;
  const k = Math.round(Math.max(0, Math.min(1, level)) * 20) / 20;
  if (k === _wx.lastGust) return;
  _wx.lastGust = k;
  _wx.windGain.gain.setTargetAtTime(_wx.windBase + _wx.cfg.gust * k, _ac().currentTime, 0.25);
}

// ── BANNER SOUNDS ────────────────────────────────────────────────────────────
// Sounds made for the animated texts of a level (countdown, START, BOSS ALERT,
// PRACTICE MODE, "5 good answers"). Their timings follow the CSS animations
// in style.css (.level-start-banner, .boss-alert-banner, .practice-banner).

// Filtered noise sweeping from one pitch to another: whooshes and swishes.
function _sweep(fromHz, toHz, dur, vol, q = 1.2) {
  if (_sfxVol === 0) return;
  try {
    const ctx = _ac();
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = _noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(fromHz, now);
    filter.frequency.exponentialRampToValueAtTime(toHz, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol * _sfxVol, now + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter); filter.connect(g); g.connect(ctx.destination);
    src.start(now, Math.random() * 2);
    src.stop(now + dur + 0.05);
    _sources.push(src);
    src.onended = () => { const i = _sources.indexOf(src); if (i >= 0) _sources.splice(i, 1); };
  } catch (_) {}
}

// A short, punchy hit: a pitch drop (the "body") plus a click of noise.
function _hit(freq, vol, dur = 0.12) {
  const ctx = _ac();
  _tone(ctx, freq * 0.5, 'sine', dur, vol, freq);
  _sweep(3000, 1200, 0.05, vol * 0.5, 0.8);
}

// ── NEW-PLAYER INTRO (yellow screen, T-6) ────────────────────────────────────
// Follows src/screens/new-player-intro.js + style.css (.np-intro):
//   rise 0 → 1.5 s, then hover while loading    → propeller engine drone
//   .np-go: exit 0.9 s, white wash 0.15 s        → engine roars away + whoosh
//   logo 1.3 s, JOUER button 1.8 s               → impact + sparkle, pop
// The rise and exit happen before any tap: browsers usually keep audio
// locked until then. These sounds only play when the audio is already
// running — never queued in a locked context, where they would all burst out
// at once on the first tap.
let _introEngine = null;

function _audioRunning() {
  try { return !!_actx && _actx.state === 'running' && _sfxVol > 0; } catch (_) { return false; }
}

// Can this page play sound before any tap? Asked by playing a tiny silent
// clip: a refusal is silent, whereas creating a locked AudioContext logs a
// warning in the console. Answered once per page.
let _autoplayProbe = null;
const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
function _canAutoplay() {
  if (navigator.userActivation?.hasBeenActive) return Promise.resolve(true);
  if (!_autoplayProbe) {
    _autoplayProbe = new Promise(resolve => {
      try {
        const el = new Audio(SILENT_WAV);
        el.volume = 0;   // not `muted`: muted clips may always autoplay
        const p = el.play();
        if (!p) { resolve(false); return; }
        p.then(() => { el.pause(); resolve(true); }, () => resolve(false));
      } catch (_) { resolve(false); }
    });
  }
  return _autoplayProbe;
}

function _introEngineStart(elapsedMs = 0) {
  if (_introEngine || !_audioRunning()) return;
  const ctx = _actx;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.connect(out);
  // Engine: two detuned saws; the propeller "chops" the sound (tremolo).
  const chop = ctx.createGain();
  chop.gain.value = 0.6;
  chop.connect(lp);
  const oscs = [0, 7].map(detune => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.detune.value = detune;
    o.connect(chop);
    return o;
  });
  const prop = ctx.createOscillator();
  const propAmt = ctx.createGain();
  prop.frequency.value = 24;
  propAmt.gain.value = 0.4;
  prop.connect(propAmt); propAmt.connect(chop.gain);
  // Wind rushing past.
  const wind = ctx.createBufferSource();
  wind.buffer = _noiseBuffer(ctx);
  wind.loop = true;
  const windF = ctx.createBiquadFilter();
  windF.type = 'bandpass';
  windF.frequency.value = 1400;
  windF.Q.value = 0.8;
  const windG = ctx.createGain();
  windG.gain.value = 0.12;
  wind.connect(windF); windF.connect(windG); windG.connect(out);

  // Rising from below: louder and higher until it reaches the middle.
  const riseLeft = Math.max(0, 1.5 - elapsedMs / 1000);
  const vol = 0.16 * _sfxVol;
  out.gain.setValueAtTime(riseLeft ? 0.0001 : vol, now);
  if (riseLeft) out.gain.exponentialRampToValueAtTime(vol, now + riseLeft);
  oscs.forEach(o => {
    o.frequency.setValueAtTime(riseLeft ? 62 : 84, now);
    if (riseLeft) o.frequency.exponentialRampToValueAtTime(84, now + riseLeft);
    o.start(now);
  });
  prop.start(now);
  wind.start(now);
  _introEngine = { ctx, out, oscs, prop, wind, windG, windF };
}

function _introEngineExit() {
  const e = _introEngine;
  _introEngine = null;
  if (!e) return;
  const now = e.ctx.currentTime;
  // Throttle up and away: pitch climbs, a loud swell, then it's gone.
  e.oscs.forEach(o => {
    o.frequency.setValueAtTime(o.frequency.value, now);
    o.frequency.exponentialRampToValueAtTime(190, now + 0.9);
  });
  e.prop.frequency.linearRampToValueAtTime(48, now + 0.9);
  e.windF.frequency.exponentialRampToValueAtTime(3200, now + 0.9);
  e.windG.gain.linearRampToValueAtTime(0.3, now + 0.35);
  e.out.gain.setValueAtTime(e.out.gain.value, now);
  e.out.gain.linearRampToValueAtTime(0.26 * _sfxVol, now + 0.3);
  e.out.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
  [...e.oscs, e.prop, e.wind].forEach(n => { try { n.stop(now + 1.1); } catch (_) {} });
}

// ── B-2 NUKE ─────────────────────────────────────────────────────────────────
// game.js: launchNuke() → the bomb flies to the blast point (nukeFlight(p),
// p 0 → 1 every frame: its length depends on the screen's frame rate) →
// detonateNuke() → flash, shockwave, the B-2 passes over.
//   release   bomb-bay clunk, latch click, rocket ignition, 2 alarm blasts
//   flight    rocket roar while it climbs, then the falling-bomb whistle
//   blast     crack, sub-bass drop, huge roar fading into a long rumble,
//             ringing ears, then the B-2 roaring overhead
let _nukeFlight = null;

function _nukeFlightStop() {
  const f = _nukeFlight;
  _nukeFlight = null;
  if (!f) return;
  const now = f.ctx.currentTime;
  f.out.gain.setTargetAtTime(0.0001, now, 0.03);
  [f.whistle, f.roar].forEach(n => { try { n.stop(now + 0.2); } catch (_) {} });
}

// A noise burst through a filter whose frequency glides from → to.
function _noiseBurst(ctx, type, fromHz, toHz, dur, vol, attack = 0.02, dest = ctx.destination) {
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = _noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(fromHz, now);
  f.frequency.exponentialRampToValueAtTime(toHz, now + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(now, Math.random() * 2);
  src.stop(now + dur + 0.05);
  _sources.push(src);
  src.onended = () => { const i = _sources.indexOf(src); if (i >= 0) _sources.splice(i, 1); };
}

// ── PLAYER ENGINE ────────────────────────────────────────────────────────────
// A quiet, steady engine loop for the player's aircraft while flying, one
// voice per kind of aircraft; it revs up a little while the plane moves.
//   prop     T-6, PC-21: propeller buzz (saw "chopped" by the blades)
//   heavy    C-130: four deep turboprops droning together
//   hog      A-10: the famous turbofan whistle over a roar
//   jet      F-16, F/A-18, F-117: turbine whine + jet roar
//   raptor   F-22, F-35: bigger roar, rumbling afterburner
//   stealth  B-2: deep, smooth, low roar
//   blackbird SR-71: loud deep roar with afterburner crackle
const ENGINE_KIND = {
  t6: 'prop', pc21: 'prop', c130: 'heavy', a10: 'hog',
  f16: 'jet', f18: 'jet', f117: 'jet', f22: 'raptor', f35: 'raptor',
  b2: 'stealth', sr71: 'blackbird',
};
const ENGINE_PROFILES = {
  //        motor: [wave, Hz, level]   chop: propeller Hz · whine: [Hz, level] · roar: [filter Hz, level]
  prop:      { motor: ['sawtooth', 88, 0.5], chop: 26, roar: [900, 0.12] },
  heavy:     { motor: ['sawtooth', 58, 0.22], chop: 17, roar: [500, 0.12], detune: 14 },
  hog:       { whine: [2600, 0.05], roar: [700, 0.35], motor: ['sine', 70, 0.25] },
  jet:       { whine: [1900, 0.035], roar: [650, 0.4], motor: ['sine', 60, 0.3] },
  raptor:    { whine: [1500, 0.03], roar: [520, 0.5], motor: ['sine', 50, 0.4] },
  stealth:   { whine: [900, 0.015], roar: [300, 0.5], motor: ['sine', 42, 0.45] },
  blackbird: { whine: [1200, 0.025], roar: [420, 0.6], motor: ['sine', 45, 0.5], crackle: true },
};
const ENGINE_BASE_VOL = 0.05;
let _engine = null;

function _engineStop() {
  const e = _engine;
  _engine = null;
  if (!e) return;
  try {
    const now = e.ctx.currentTime;
    e.out.gain.setTargetAtTime(0.0001, now, 0.15);
    e.nodes.forEach(n => { try { n.stop(now + 0.8); } catch (_) {} });
    e.timers.forEach(clearTimeout);
  } catch (_) {}
}

// ── A400M AIRDROP CARRIER ────────────────────────────────────────────────────
let _adPlane = null;
const AD_PLANE_VOL = 0.26;

function _adPlaneStop() {
  const p = _adPlane;
  _adPlane = null;
  if (!p) return;
  try {
    const now = p.ctx.currentTime;
    p.out.gain.cancelScheduledValues(now);
    p.out.gain.setTargetAtTime(0.0001, now, 0.12);
    p.nodes.forEach(n => { try { n.stop(now + 0.7); } catch (_) {} });
  } catch (_) {}
}

function _adPlaneStart() {
  _adPlaneStop();
  if (_sfxVol === 0) return;
  try {
    const ctx = _ac();
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.connect(ctx.destination);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.8;
    lp.connect(out);
    const chop = ctx.createGain();     // propeller beat
    chop.gain.value = 0.6;
    chop.connect(lp);
    const nodes = [];
    // Four engines, a little out of tune: 110 Hz and its octave.
    [-14, -5, 6, 15].forEach((d, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = i % 2 ? 220 : 110;
      o.detune.value = d;
      o.connect(chop);
      o.start(now);
      nodes.push(o);
    });
    const lfo = ctx.createOscillator();
    const amt = ctx.createGain();
    lfo.frequency.value = 22;
    amt.gain.value = 0.35;
    lfo.connect(amt); amt.connect(chop.gain);
    lfo.start(now);
    nodes.push(lfo);
    // Air rush, the part phone speakers carry best.
    const rush = ctx.createBufferSource();
    rush.buffer = _noiseBuffer(ctx);
    rush.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 0.9;
    const rushGain = ctx.createGain();
    rushGain.gain.value = 0.35;
    rush.connect(bp); bp.connect(rushGain); rushGain.connect(out);
    rush.start(now);
    nodes.push(rush);
    nodes.forEach(n => _sources.push(n));
    _adPlane = { ctx, out, lp, nodes };
  } catch (_) {}
}

// v: 0 (far / off screen) → 1 (plane in the middle of the screen).
function _adPlaneLevel(v) {
  const p = _adPlane;
  if (!p) return;
  const k = Math.max(0, Math.min(1, v));
  const now = p.ctx.currentTime;
  p.out.gain.setTargetAtTime(Math.max(0.0001, k * AD_PLANE_VOL * _sfxVol), now, 0.06);
  p.lp.frequency.setTargetAtTime(700 + k * 1600, now, 0.08);
}

function _engineStart(aircraftId) {
  _engineStop();
  if (_sfxVol === 0 || !_audioRunning()) return;
  const prof = ENGINE_PROFILES[ENGINE_KIND[aircraftId] || 'jet'];
  const ctx = _actx;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.setTargetAtTime(ENGINE_BASE_VOL * _sfxVol, now, 0.5);
  out.connect(ctx.destination);
  const e = { ctx, out, nodes: [], timers: [], motors: [], whine: null, roarF: null, prof };

  if (prof.motor) {
    const [wave, hz, level] = prof.motor;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.value = level;
    lp.connect(g); g.connect(out);
    const voices = prof.detune ? [-prof.detune, 0, prof.detune] : [0];
    voices.forEach(d => {
      const o = ctx.createOscillator();
      o.type = wave;
      o.frequency.value = hz;
      o.detune.value = d;
      o.connect(lp);
      o.start();
      e.nodes.push(o); e.motors.push(o);
    });
    if (prof.chop) {   // propeller blades chopping the sound
      const lfo = ctx.createOscillator();
      const amt = ctx.createGain();
      lfo.frequency.value = prof.chop;
      amt.gain.value = level * 0.6;
      lfo.connect(amt); amt.connect(g.gain);
      lfo.start();
      e.nodes.push(lfo);
      e.chop = lfo;
    }
  }
  if (prof.whine) {
    const [hz, level] = prof.whine;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = hz;
    g.gain.value = level;
    o.connect(g); g.connect(out);
    o.start();
    e.nodes.push(o); e.whine = o;
  }
  if (prof.roar) {
    const [hz, level] = prof.roar;
    const src = ctx.createBufferSource();
    src.buffer = _noiseBuffer(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = hz;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(f); f.connect(g); g.connect(out);
    src.start(0, Math.random() * 2);
    e.nodes.push(src); e.roarF = f; e.roarHz = hz;
  }
  if (prof.crackle) {   // afterburner pops
    const pop = () => {
      if (_engine !== e) return;
      const t = ctx.currentTime;
      const s = ctx.createBufferSource();
      s.buffer = _noiseBuffer(ctx);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(g); g.connect(out);
      s.start(t, Math.random() * 2); s.stop(t + 0.06);
      e.timers.push(setTimeout(pop, 60 + Math.random() * 260));
    };
    pop();
  }
  _engine = e;
}

// 0 → 1: how hard the plane is moving (revs the engine up a little).
function _engineThrottle(k) {
  const e = _engine;
  if (!e) return;
  const q = Math.round(Math.max(0, Math.min(1, k)) * 10) / 10;
  if (q === e.lastQ) return;
  e.lastQ = q;
  const now = e.ctx.currentTime;
  const rev = 1 + 0.12 * q;
  e.motors.forEach(o => o.frequency.setTargetAtTime(e.prof.motor[1] * rev, now, 0.2));
  if (e.whine) e.whine.frequency.setTargetAtTime(e.prof.whine[0] * rev, now, 0.2);
  if (e.roarF) e.roarF.frequency.setTargetAtTime(e.roarHz * (1 + 0.35 * q), now, 0.2);
  if (e.chop) e.chop.frequency.setTargetAtTime(e.prof.chop * rev, now, 0.2);
  e.out.gain.setTargetAtTime(ENGINE_BASE_VOL * _sfxVol * (1 + 0.5 * q), now, 0.2);
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
// A sound that can't restart faster than minGapMs (bursts, several enemies).
function _throttled(minGapMs, fn) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last < minGapMs) return;
    last = now;
    fn(...args);
  };
}

const BOSS_MUSIC = {
  ocean: MUSIC.bossOcean, desert: MUSIC.bossDesert, city: MUSIC.bossCity,
  arctic: MUSIC.bossArctic, space: MUSIC.bossSpace,
};

const _enemyShot = (url, vol) => _throttled(110, () =>
  _playBuf(url, vol, ctx => _tone(ctx, 180, 'sawtooth', 0.15, 0.12, 900)));
const ENEMY_SHOT = {
  missile: _enemyShot(SOUND.missile, 0.7),
  laser:   _enemyShot(SOUND.laser, 0.45),
  gun:     _enemyShot(SOUND.gun, 0.6),
};

export const SFX = {
  setVolume(v)      {
    _sfxVol = _clamp01(v);
    if (_sfxVol === 0) _stopAllSFX();
    if (_wx) _wx.bus.gain.setTargetAtTime(Math.max(0.0001, WEATHER_BASE_VOL * _sfxVol), _ac().currentTime, 0.05);
  },
  getVolume()       { return _sfxVol; },
  setMusicVolume(v) {
    _musicVol = _clamp01(v);
    _clearFade();
    _setBgOutputVolume(_musicVol);
    if (_musicVol > 0 && _bgEl.src && _bgEl.paused) _bgEl.play().catch(() => {});
  },
  getMusicVolume()  { return _musicVol; },

  unlock() {
    const ctx = _ac();
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    Object.values(SOUND).forEach(_loadBuf);
    _resumeAll();
  },

  // key: 'menu', 'game', 'arena', 'dialogue' (boss talking) or
  // 'boss-<biome>' (boss fight: ocean, desert, city, arctic, space).
  // { restart: true } plays it from the beginning instead of resuming.
  playMusic(key, { restart = false } = {}) {
    const src = key.startsWith('boss-') ? (BOSS_MUSIC[key.slice(5)] || MUSIC.bossOcean)
      : { menu: MUSIC.menu, ranked: MUSIC.menu, shop: MUSIC.menu, game: MUSIC.game,
          arena: MUSIC.game, dialogue: MUSIC.dialogue, boss: MUSIC.dialogue }[key];
    if (src) _playMusic(src, restart);
  },
  stopMusic() { _stopMusic(); },

  // Weather ambience (see WEATHER AMBIENCE above): id from data/weather.js.
  weatherStart(id) { _weatherStart(id); },
  weatherStop()    { _weatherStop(); },
  weatherWind(level) { _weatherWind(level); },
  // Lightning strike: a loud nearby thunderclap (its own volume, not the
  // quiet weather background's).
  thunder() {
    if (_sfxVol === 0) return;
    try {
      const ctx = _ac();
      _thunder(ctx, ctx.destination, 0.9 * _sfxVol);
    } catch (_) {}
  },
  stopSFX()   { _stopAllSFX(); },

  click() {
    _playBuf(SOUND.click, 0.8, ctx => _tone(ctx, 800, 'sine', 0.08, 0.35));
  },
  // Leaving for a mission (JOUER in the lobby, the level briefing).
  takeoff() {
    _playBuf(SOUND.takeoff, 0.9, ctx => {
      _tone(ctx, 520, 'triangle', 0.12, 0.28);
      _after(85, () => _tone(_ac(), 760, 'triangle', 0.16, 0.25));
    });
  },
  chooseLevel() {
    _tone(_ac(), 520, 'triangle', 0.12, 0.2);
    _after(85, () => _tone(_ac(), 760, 'triangle', 0.16, 0.18));
  },
  coinClaim() {
    _tone(_ac(), 880, 'triangle', 0.1, 0.3);
    _after(70, () => _tone(_ac(), 1320, 'triangle', 0.15, 0.28));
  },
  correct() {
    _tone(_ac(), 660, 'sine', 0.15, 0.35);
    _after(100, () => _tone(_ac(), 880, 'sine', 0.18, 0.3));
  },
  wrong() {
    _tone(_ac(), 200, 'sawtooth', 0.4, 0.3);
  },
  // Player shots, by weapon: 'laser', 'gun' (machine gun / GAU-8) or 'missile'.
  // The machine gun plays one bang per bullet of its 3-round burst.
  shot: _throttled(90, (kind = 'missile') => {
    const fallback = ctx => _tone(ctx, 180, 'sawtooth', 0.15, 0.2, 900);
    if (kind === 'gun') {
      [0, 70, 140].forEach(ms => _after(ms, () => _playBuf(SOUND.gun, 1, fallback)));
    } else {
      _playBuf(kind === 'laser' ? SOUND.laser : SOUND.missile, 1, fallback);
    }
  }),
  // Enemy shots, same sounds as the player's weapons ('laser', 'gun',
  // 'missile'), a bit quieter so the player's own shots stand out. Each kind
  // has its own rate limit: the F-5s' constant blue lasers must not swallow
  // the red missiles' sound.
  missile(kind = 'missile') {
    (ENEMY_SHOT[kind] || ENEMY_SHOT.missile)();
  },
  // A little under the shots, so a laser that hits at once is still heard.
  explode: _throttled(60, () => {
    _playBuf(SOUND.explosion, 0.75, ctx => {
      _noise(ctx, 0.55, 0.85);
      _tone(ctx, 82, 'sawtooth', 0.45, 0.48);
    });
  }),
  levelWin() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      _after(i * 75, () => _tone(_ac(), f, 'triangle', 0.25, 0.32)));
  },
  streak() {
    [550, 770, 1050].forEach((f, i) =>
      _after(i * 90, () => _tone(_ac(), f, 'sine', 0.2, 0.35)));
  },
  chest() {
    _playBuf(SOUND.purchase, 0.9, () => {
      [523, 659, 784, 1047].forEach((f, i) =>
        _after(i * 110, () => _tone(_ac(), f, 'sine', 0.3, 0.35)));
    });
  },
  gameOver() {
    if (_sfxVol === 0) return;
    _resumeAll();
    _tone(_ac(), 180, 'sawtooth', 0.55, 0.45);
    _after(260, () => _tone(_ac(), 92, 'square', 0.8, 0.38));
  },
  quitGame() {
    _stopMusic();
  },
  bonusHeart() {
    [523, 784, 1047, 1319].forEach((f, i) =>
      _after(i * 65, () => _tone(_ac(), f, 'sine', 0.22, 0.26)));
  },
  timerWarn() {
    _tone(_ac(), 880, 'triangle', 0.07, 0.18);
  },
  // New-player intro (see NEW-PLAYER INTRO above).
  introStart(pageStartMs = 0) {
    const t0 = performance.now() - pageStartMs;   // when the rise began
    _canAutoplay().then(ok => {
      if (!ok || _sfxVol === 0) return;
      try { _ac(); } catch (_) { return; }
      _introEngineStart(performance.now() - t0);
    });
  },
  // The T-6 shoots off the top, the white wash, then the logo and JOUER.
  introExit() {
    if (!_audioRunning()) return;
    _introEngineExit();
    _after(150, () => _sweep(400, 5200, 0.85, 0.3, 0.9));          // white wash
    _after(1300, () => {                                             // logo lands
      _hit(300, 0.3, 0.16);
      [1047, 1319, 1568, 2093].forEach((f, i) =>
        _after(i * 60, () => _tone(_ac(), f, 'sine', 0.35, 0.1)));
    });
    _after(1800, () => _tone(_ac(), 660, 'triangle', 0.12, 0.2, 440));  // JOUER pops in
  },
  // JOUER pressed: a bright whoosh into the questionnaire.
  introPlay() {
    _introEngineExit();
    _sweep(600, 4200, 0.45, 0.3);
    [784, 1175].forEach((f, i) => _after(i * 80, () => _tone(_ac(), f, 'triangle', 0.2, 0.2)));
  },
  // Player engine (see PLAYER ENGINE above).
  engineStart(aircraftId) { _engineStart(aircraftId); },
  engineStop() { _engineStop(); },
  engineThrottle(k) { _engineThrottle(k); },

  // ── Treasure chest ──
  // The chest rattles on each bounce of its opening animation (chest.js:
  // 80 / 220 / 360 / 470 ms), the lock snaps, then the lid bursts open.
  chestOpen() {
    [80, 220, 360].forEach((ms, i) => _after(ms, () => {
      _hit(140 + i * 25, 0.3, 0.1);                         // wood knock
      _sweep(1800, 900, 0.08, 0.12, 2);                      // rattle
    }));
    _after(470, () => _tone(_ac(), 2400, 'square', 0.025, 0.1));   // lock snaps
    _after(560, () => {
      _sweep(300, 2600, 0.35, 0.3);                           // lid bursts open
      [784, 1047, 1319, 1568, 2093].forEach((f, i) =>
        _after(i * 45, () => _tone(_ac(), f, 'triangle', 0.3, 0.14)));
    });
  },
  // Roulette strip: one tick per reward tile passing the pointer.
  rouletteTick(slow = 0) {
    _tone(_ac(), 1400 - 500 * slow, 'square', 0.03, 0.2);
  },
  // The roulette stops: the bigger the rarity (0 common → 4 aircraft), the
  // bigger the fanfare.
  rouletteWin(rarity = 0) {
    const notes = [523, 659, 784, 1047, 1319, 1568, 2093].slice(0, 3 + Math.min(4, rarity));
    notes.forEach((f, i) => _after(i * 70, () => _tone(_ac(), f, 'triangle', 0.28, 0.24)));
    if (rarity >= 2) _after(notes.length * 70, () => {
      _sweep(800, 6000, 0.6, 0.2);
      [2093, 2637, 3136].forEach((f, i) => _after(i * 60, () => _tone(_ac(), f, 'sine', 0.4, 0.08)));
    });
    if (rarity >= 4) _after(notes.length * 70 + 250, () => {
      _hit(90, 0.5, 0.4);
      [1047, 1319, 1568].forEach(f => _tone(_ac(), f, 'triangle', 0.9, 0.12));
    });
  },

  // ── Airdrop ──
  // The A400M carrier (four turboprops): a loop that airdrop.js drives every
  // frame from the plane's position on screen (airdropPlaneLevel), so the
  // sound is loudest exactly while the plane crosses and stops when it leaves.
  // Propeller buzz in the mid range so phone speakers play it too.
  airdropPlane()        { _adPlaneStart(); },
  airdropPlaneLevel(v)  { _adPlaneLevel(v); },
  airdropPlaneStop()    { _adPlaneStop(); },
  // The crate leaves the plane: latch clack, then the parachute snaps open.
  airdropRelease() {
    _tone(_ac(), 1500, 'square', 0.04, 0.16);                   // latch
    _after(40, () => _tone(_ac(), 700, 'triangle', 0.1, 0.3, 1100));
    _after(140, () => {
      _sweep(2400, 500, 0.35, 0.55, 1.2);                       // canopy snap
      _after(160, () => _sweep(1600, 900, 0.7, 0.22, 3));       // fabric flutter
    });
  },
  // The crate is shot or rammed open: a crunch, wood splinters, a sparkle.
  airdropBreak() {
    _playBuf(SOUND.explosion, 0.55, () => _sweep(1800, 300, 0.3, 0.5, 1));
    _tone(_ac(), 320, 'triangle', 0.14, 0.4, 620);              // wooden thunk
    _sweep(4200, 1200, 0.3, 0.5, 1.6);                          // splinters
    _after(80, () => _sweep(3000, 900, 0.22, 0.35, 2));
    _after(240, () => [1047, 1568, 2093].forEach((f, i) =>
      _after(i * 55, () => _tone(_ac(), f, 'sine', 0.25, 0.18))));
  },
  // The reward is picked up.
  airdropPickup() {
    [659, 880, 1175, 1568].forEach((f, i) =>
      _after(i * 50, () => _tone(_ac(), f, 'square', 0.1, 0.1)));
    _after(200, () => _sweep(900, 5000, 0.3, 0.18));
  },
  // B-2 nuke (see B-2 NUKE above).
  nukeLaunch() {
    if (_sfxVol === 0) return;
    const ctx = _ac();
    const v = _sfxVol;
    _nukeFlightStop();
    _hit(95, 0.55, 0.3);                                        // bomb bay clunk
    _after(90, () => _tone(_ac(), 1800, 'square', 0.03, 0.12));  // latch click
    _after(160, () => _noiseBurst(_ac(), 'bandpass', 300, 2600, 0.9, 0.45 * v, 0.08));  // ignition
    [250, 800].forEach(ms => _after(ms, () =>                   // nuclear alarm
      _tone(_ac(), 330, 'sawtooth', 0.42, 0.16, 520)));
    // Continuous flight layers, driven by nukeFlight(p).
    const out = ctx.createGain();
    out.gain.value = v;
    out.connect(ctx.destination);
    const roar = ctx.createBufferSource();
    roar.buffer = _noiseBuffer(ctx);
    roar.loop = true;
    const roarF = ctx.createBiquadFilter();
    roarF.type = 'bandpass';
    roarF.frequency.value = 700;
    roarF.Q.value = 0.9;
    const roarG = ctx.createGain();
    roarG.gain.value = 0.0001;
    roar.connect(roarF); roarF.connect(roarG); roarG.connect(out);
    const whistle = ctx.createOscillator();
    whistle.type = 'sine';
    whistle.frequency.value = 1700;
    const whistleG = ctx.createGain();
    whistleG.gain.value = 0.0001;
    whistle.connect(whistleG); whistleG.connect(out);
    roar.start(); whistle.start();
    _sources.push(roar, whistle);
    _nukeFlight = { ctx, out, roar, roarF, roarG, whistle, whistleG };
  },
  // p: 0 → 1 along the bomb's flight.
  nukeFlight(p) {
    const f = _nukeFlight;
    if (!f) return;
    const now = f.ctx.currentTime;
    const climb = Math.max(0, 1 - p / 0.5);                    // roar fades by mid-flight
    f.roarG.gain.setTargetAtTime(0.0001 + 0.3 * climb, now, 0.05);
    f.roarF.frequency.setTargetAtTime(500 + 900 * p, now, 0.05);
    const fall = Math.max(0, (p - 0.4) / 0.6);                 // whistle on the way down
    f.whistleG.gain.setTargetAtTime(fall > 0 ? 0.03 + 0.09 * fall : 0.0001, now, 0.05);
    f.whistle.frequency.setTargetAtTime(1700 - 1250 * fall, now, 0.05);
  },
  nukeBlast() {
    _nukeFlightStop();
    if (_sfxVol === 0) return;
    const ctx = _ac();
    const v = _sfxVol;
    const now = ctx.currentTime;
    _noiseBurst(ctx, 'highpass', 5000, 1500, 0.25, 0.7 * v, 0.004);       // the crack
    // Sub-bass drop you feel more than hear.
    const sub = ctx.createOscillator();
    const subG = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(80, now);
    sub.frequency.exponentialRampToValueAtTime(24, now + 2.6);
    subG.gain.setValueAtTime(0.0001, now);
    subG.gain.exponentialRampToValueAtTime(0.9 * v, now + 0.05);
    subG.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
    sub.connect(subG); subG.connect(ctx.destination);
    sub.start(now); sub.stop(now + 2.9);
    _sources.push(sub);
    _noiseBurst(ctx, 'lowpass', 6000, 90, 3.6, 0.85 * v, 0.03);           // the roar
    _after(600, () => _noiseBurst(_ac(), 'lowpass', 420, 70, 3.8, 1 * v, 0.35));   // rumble
    _after(120, () => _tone(_ac(), 3600, 'sine', 2.2, 0.035));             // ringing ears
    _after(450, () => _noiseBurst(_ac(), 'bandpass', 1400, 220, 0.9, 0.35 * v, 0.15));  // shockwave
    _after(200, () => _noiseBurst(_ac(), 'bandpass', 250, 1300, 0.6, 0.3 * v, 0.3));    // B-2 in...
    _after(800, () => _noiseBurst(_ac(), 'bandpass', 1300, 200, 0.7, 0.3 * v, 0.05));  // ...and away
  },
  // 3, 2, 1 before a level: a radar ping, higher on the last one.
  countNumber(n = 3) {
    const f = n <= 1 ? 1175 : 880;
    _tone(_ac(), f, 'sine', 0.18, 0.3);
    _tone(_ac(), f * 2, 'sine', 0.08, 0.08);
    _hit(160, 0.28, 0.14);
  },
  // DÉPART / START: a knock per falling letter, a whoosh with the speed
  // streaks, a sparkle with the light sweep, then the word zooms away.
  startBanner(letters = 6) {
    for (let i = 0; i < letters; i++) {
      _after(i * 60 + 200, () => _hit(420 + i * 55, 0.22, 0.09));
    }
    _after(300, () => _sweep(500, 4500, 0.55, 0.32));
    _after(520, () => [1568, 2093, 2637].forEach((f, i) =>
      _after(i * 45, () => _tone(_ac(), f, 'sine', 0.22, 0.09))));
    _after(1120, () => _sweep(3500, 300, 0.5, 0.3));
  },
  // Kamikaze F-5 locking on (two sharp beeps), then its dive (falling whoosh).
  kamikazeLock() {
    _tone(_ac(), 1320, 'square', 0.07, 0.07);
    _after(110, () => _tone(_ac(), 1320, 'square', 0.07, 0.07));
  },
  kamikazeDive() {
    _sweep(2600, 380, 0.7, 0.3, 1.4);
    _tone(_ac(), 900, 'sawtooth', 0.6, 0.05, 260);
  },
  // BOSS ALERT: a two-tone siren with the three red flashes, a heavy slam
  // when the name lands, typewriter ticks under the boss's tagline.
  bossAlert(nameLength = 6) {
    [0, 500, 1000].forEach(ms => _after(ms, () => {
      _tone(_ac(), 740, 'square', 0.22, 0.12, 560);
      _after(230, () => _tone(_ac(), 560, 'square', 0.22, 0.12, 740));
    }));
    _after(380, () => {
      _tone(_ac(), 45, 'sine', 0.6, 0.55, 140);
      _sweep(900, 120, 0.5, 0.35, 0.7);
    });
    for (let i = 1; i < Math.min(nameLength, 12); i++) {
      _after(380 + i * 50, () => _hit(220, 0.1, 0.06));
    }
    for (let i = 0; i < 14; i++) {
      _after(1080 + i * 48, () => _tone(_ac(), 2200 + Math.random() * 500, 'square', 0.018, 0.05));
    }
    _after(2480, () => _sweep(2800, 250, 0.4, 0.25));
  },
  // PRACTICE MODE: each word slides in with a swish, then a soft chime.
  practiceBanner() {
    _after(230, () => _sweep(600, 3200, 0.3, 0.26));
    _after(340, () => _sweep(3200, 700, 0.3, 0.26));
    _after(560, () => [784, 988, 1175].forEach((f, i) =>
      _after(i * 70, () => _tone(_ac(), f, 'triangle', 0.3, 0.14))));
  },
  // "5 GOOD ANSWERS": a sparkling rising arpeggio, the letters knocking in
  // and a whoosh as the banner leaves.
  streakBanner(letters = 12) {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
      _after(i * 55, () => _tone(_ac(), f, 'triangle', 0.2, 0.2)));
    for (let i = 0; i < Math.min(letters, 16); i++) {
      _after(i * 60 + 200, () => _hit(520 + i * 30, 0.12, 0.07));
    }
    _after(300, () => _sweep(700, 5000, 0.5, 0.24));
    _after(1500, () => _sweep(3500, 400, 0.45, 0.22));
  },
  countdownTick() {
    _tone(_ac(), 620, 'square', 0.11, 0.24);
    _after(60, () => _tone(_ac(), 930, 'triangle', 0.08, 0.18));
  },
  countdownGo() {
    _tone(_ac(), 780, 'square', 0.13, 0.28);
    _after(75, () => _tone(_ac(), 1170, 'triangle', 0.18, 0.24));
    _after(150, () => _tone(_ac(), 1560, 'sine', 0.18, 0.2));
  },
  buy() {
    _playBuf(SOUND.purchase, 0.9, ctx => _tone(ctx, 880, 'sine', 0.2, 0.4));
  },
  noMoney() {
    _playBuf(SOUND.refuse, 0.9, ctx => {
      _tone(ctx, 110, 'sawtooth', 0.35, 0.45);
      _after(80, () => _tone(_ac(), 90, 'sawtooth', 0.25, 0.3));
    });
  },
  promoted() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
      _after(i * 55, () => _tone(_ac(), f, 'triangle', 0.22, 0.36)));
  },
};
