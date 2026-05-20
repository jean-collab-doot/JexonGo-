// ── VOLUME ────────────────────────────────────────────────────────────────────
let _sfxVol   = 1;
let _musicVol = 0.45;

// ── WEB AUDIO CONTEXT ─────────────────────────────────────────────────────────
let _actx = null;
function _ac() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  if (_actx.state === 'suspended') _actx.resume();
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

function _after(ms, fn) {
  const id = setTimeout(() => { fn(); _timers.splice(_timers.indexOf(id), 1); }, ms);
  _timers.push(id);
}

function _stopAllSFX() {
  _timers.forEach(clearTimeout);
  _timers.length = 0;
  _sources.forEach(s => { try { s.stop(); } catch (_) {} });
  _sources.length = 0;
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
let _bgCurrent = '';
const _positions = {};
let _fadeInterval = null;

const GAME_PLAYBACK_RATE = 0.72;  // ~30% slower for gameplay music

function _clearFade() {
  if (_fadeInterval) { clearInterval(_fadeInterval); _fadeInterval = null; }
}

function _fadeTo(targetVol, durationMs, onDone) {
  _clearFade();
  const startVol = _bgEl.volume;
  const steps    = 20;
  const stepMs   = durationMs / steps;
  const stepAmt  = (targetVol - startVol) / steps;
  let count = 0;
  _fadeInterval = setInterval(() => {
    count++;
    _bgEl.volume = Math.max(0, Math.min(1, startVol + stepAmt * count));
    if (count >= steps) {
      _bgEl.volume = targetVol;
      _clearFade();
      if (onDone) onDone();
    }
  }, stepMs);
}

function _startTrack(src) {
  const isGame = src.includes('music-play1');
  _bgCurrent    = src;
  _bgEl.src     = src;
  _bgEl.volume  = 0;
  _bgEl.loop    = true;
  _bgEl.playbackRate = isGame ? GAME_PLAYBACK_RATE : 1.0;
  _bgEl.load();
  const resume = _positions[src] || 0;
  if (resume > 0) {
    _bgEl.addEventListener('canplay', () => { _bgEl.currentTime = resume; }, { once: true });
  }
  _bgEl.play().catch(e => console.warn('Music blocked:', e.message));
  _fadeTo(_musicVol, 1500);
}

function _playMusic(src) {
  if (_bgEl.src.endsWith(src) && !_bgEl.paused) return;
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
  if (_bgEl.src && _bgEl.paused && !_bgEl.ended) _bgEl.play().catch(() => {});
  if (_actx && _actx.state === 'suspended') _actx.resume();
}

// Resume on every tap/click (not { once } — AudioContext can suspend repeatedly)
document.addEventListener('touchstart', _resumeAll, { passive: true });
document.addEventListener('click',      _resumeAll);

// Resume when tab comes back to foreground
window.addEventListener('focus', _resumeAll);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) setTimeout(_resumeAll, 300);
});

// On mobile: poll every 4 s while visible to catch silent audio drops
if (_isMobileAudio) {
  setInterval(() => { if (!document.hidden) _resumeAll(); }, 4000);
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
export const SFX = {
  setVolume(v)      { _sfxVol   = Math.max(0, Math.min(1, v)); },
  getVolume()       { return _sfxVol; },
  setMusicVolume(v) {
    _musicVol = Math.max(0, Math.min(1, v));
    if (!_fadeInterval) _bgEl.volume = _musicVol;
  },
  getMusicVolume()  { return _musicVol; },

  unlock() {
    const ctx = _ac();
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    [
      '/assets/music/click.mp3',
      '/assets/music/correct.mp3',
      '/assets/music/correct2.mp3',
      '/assets/music/wrong.mp3',
      '/assets/music/shot.mp3',
      '/assets/music/explosion.mp3',
      '/assets/music/purchase.mp3',
      '/assets/music/gameover.mp3',
      '/assets/music/Buy.mp3',
    ].forEach(_loadBuf);
  },

  playMusic(key) {
    const MAP = {
      menu:   '/assets/music/music-menu.mp3',
      ranked: '/assets/music/music-ranked.mp3',
      shop:   '/assets/music/music-shop.mp3',
      game:   '/assets/music/music-play1.mp3',
      arena:  '/assets/music/music-arena.mp3',
    };
    if (MAP[key]) _playMusic(MAP[key]);
  },
  stopMusic() { _stopMusic(); },
  stopSFX()   { _stopAllSFX(); },

  click() {
    _playBuf('/assets/music/click.mp3', 0.7,
      ctx => _tone(ctx, 800, 'sine', 0.08, 0.35));
  },
  correct() {
    _playBuf('/assets/music/correct.mp3', 0.9, ctx => {
      _tone(ctx, 660, 'sine', 0.15, 0.35);
      _after(100, () => _tone(_ac(), 880, 'sine', 0.18, 0.3));
    });
  },
  wrong() {
    _playBuf('/assets/music/wrong.mp3', 0.8,
      ctx => _tone(ctx, 200, 'sawtooth', 0.4, 0.4));
  },
  missile: (() => {
    let _last = 0;
    return function missile() {
      const now = Date.now();
      if (now - _last < 120) return;
      _last = now;
      _playBuf('/assets/music/shot.mp3', 0.5,
        ctx => _tone(ctx, 180, 'sawtooth', 0.15, 0.2, 900), 0.35);
    };
  })(),
  explode() {
    _playBuf('/assets/music/explosion.mp3', 0.8, ctx => {
      _noise(ctx, 0.4, 0.55);
      _tone(ctx, 120, 'sawtooth', 0.3, 0.3);
    });
  },
  levelWin() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      _after(i * 75, () => _tone(_ac(), f, 'triangle', 0.25, 0.32)));
  },
  streak() {
    [550, 770, 1050].forEach((f, i) =>
      _after(i * 90, () => _tone(_ac(), f, 'sine', 0.2, 0.35)));
  },
  chest() {
    _playBuf('/assets/music/purchase.mp3', 0.9, ctx => {
      [523, 659, 784, 1047].forEach((f, i) =>
        _after(i * 110, () => _tone(_ac(), f, 'sine', 0.3, 0.35)));
    });
  },
  rouletteWin() {
    // Rising arpeggio for roulette landing
    [440, 550, 660, 880, 1100].forEach((f, i) =>
      _after(i * 60, () => _tone(_ac(), f, 'sine', 0.2, 0.32)));
  },
  gameOver() {
    _playBuf('/assets/music/gameover.mp3', 0.9, ctx => {
      [400, 300, 200].forEach((f, i) =>
        _after(i * 200, () => _tone(_ac(), f, 'sawtooth', 0.35, 0.3)));
    });
  },
  quitGame() {
    _clearFade();
    if (_bgCurrent) _positions[_bgCurrent] = _bgEl.currentTime;
    _bgEl.pause();
    _bgCurrent        = '/assets/music/gameover2.mp3';
    _bgEl.src         = '/assets/music/gameover2.mp3';
    _bgEl.volume      = _musicVol;
    _bgEl.loop        = false;
    _bgEl.playbackRate = 1.0;
    _bgEl.load();
    _bgEl.play().catch(e => console.warn('Music blocked:', e.message));
  },
  bonusHeart() {
    _playBuf('/assets/music/correct2.mp3', 0.85, ctx => {
      [523, 784, 1047, 1319].forEach((f, i) =>
        _after(i * 65, () => _tone(_ac(), f, 'sine', 0.22, 0.26)));
    });
  },
  timerWarn() {
    _tone(_ac(), 880, 'triangle', 0.07, 0.18);
  },
  buy() {
    _playBuf('/assets/music/Buy.mp3', 0.9,
      ctx => _tone(ctx, 880, 'sine', 0.2, 0.4));
  },
  noMoney() {
    // Low thud + descending tones = "error / denied"
    _tone(_ac(), 110, 'sawtooth', 0.35, 0.45);
    _after(80,  () => _tone(_ac(), 90, 'sawtooth', 0.25, 0.3));
  },
  promoted() {
    // Fanfare for pilot grade promotion
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
      _after(i * 55, () => _tone(_ac(), f, 'triangle', 0.22, 0.36)));
  },
};
