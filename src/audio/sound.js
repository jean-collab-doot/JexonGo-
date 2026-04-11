let _ctx = null;
function ac() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function tone(freq, type, dur, vol = 0.28, sweep = null) {
  try {
    const c = ac();
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.connect(g); g.connect(c.destination);
    osc.type = type;
    const now = c.currentTime;
    osc.frequency.setValueAtTime(sweep ?? freq, now);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(freq, now + dur);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.start(now); osc.stop(now + dur);
  } catch (_) {}
}

function noise(dur, vol = 0.35) {
  try {
    const c   = ac();
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    const g   = c.createGain();
    src.buffer = buf; src.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.start();
  } catch (_) {}
}

export const SFX = {
  correct() {
    tone(660, 'sine', 0.12, 0.28);
    setTimeout(() => tone(880, 'sine', 0.15, 0.24), 80);
  },
  wrong() {
    tone(200, 'sawtooth', 0.3, 0.3);
  },
  missile() {
    tone(700, 'square', 0.09, 0.14, 1000);
  },
  explode() {
    noise(0.28, 0.45);
    tone(120, 'sawtooth', 0.2, 0.2);
  },
  streak() {
    [550, 770, 1050].forEach((f, i) => setTimeout(() => tone(f, 'sine', 0.15, 0.3), i * 90));
  },
  chest() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 'sine', 0.28, 0.3), i * 110));
  },
  levelWin() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 'triangle', 0.22, 0.28), i * 75));
  },
  timerWarn() {
    tone(440, 'sine', 0.06, 0.12);
  },
};
