let _worldCupIntroTimer = null;
let _windTimer = null;
let _flashTimer = null;
let _shakeFrame = null;
let _confettiTimer = null;
let _confettiCleanupTimer = null;

export function playWorldCupIntro(onDone) {
  const menu = document.getElementById('s-menu');
  if (!menu) {
    onDone?.();
    return;
  }

  let intro = document.getElementById('world-cup-intro');
  if (!intro) {
    intro = document.createElement('div');
    intro.id = 'world-cup-intro';
    intro.className = 'world-cup-intro hidden';
    intro.setAttribute('aria-hidden', 'true');
    intro.innerHTML = `
      <div class="wc-color-layers">
        <span class="wc-layer wc-layer-blue"></span>
        <span class="wc-layer wc-layer-green"></span>
        <span class="wc-layer wc-layer-red"></span>
      </div>
      <div class="wc-wind-lines" aria-hidden="true"></div>
      <div class="wc-air-panels" aria-hidden="true">
        <span class="wc-air-card wc-air-left">
          <b>JET</b>
          <i>TAKEOFF</i>
        </span>
        <span class="wc-air-card wc-air-right">
          <b>V2</b>
          <i>SPEED</i>
        </span>
      </div>
      <div class="wc-energy-layer" aria-hidden="true">
        <span class="wc-energy-orb"></span>
      </div>
      <div class="wc-aero-emblem" aria-hidden="true">
        <span></span>
      </div>
      <div class="wc-flash" aria-hidden="true"></div>
      <div class="wc-plane-wrap">
        <span class="wc-engine-smoke wc-engine-smoke-left"></span>
        <span class="wc-engine-smoke wc-engine-smoke-right"></span>
        <span class="wc-engine-fire wc-engine-fire-left"></span>
        <span class="wc-engine-fire wc-engine-fire-right"></span>
        <span class="wc-wing-glow wc-wing-left"></span>
        <span class="wc-wing-glow wc-wing-right"></span>
        <img class="wc-plane" src="/assets/planes/14.png" alt="">
      </div>
    `;

    const canvas = document.getElementById('menu-canvas');
    if (canvas?.parentNode) canvas.parentNode.insertBefore(intro, canvas.nextSibling);
    else menu.prepend(intro);
  }

  menu.classList.add('wc-intro-only');
  intro.classList.remove('hidden', 'wc-active');
  void intro.offsetWidth;
  intro.classList.add('wc-active');
  _startRandomWind(intro.querySelector('.wc-wind-lines'));

  clearTimeout(_flashTimer);
  _flashTimer = setTimeout(() => {
    intro.classList.add('wc-flash-active');
  }, 9000);

  clearTimeout(_worldCupIntroTimer);
  _worldCupIntroTimer = setTimeout(() => {
    clearInterval(_windTimer);
    intro.classList.remove('wc-active', 'wc-flash-active');
    intro.classList.add('wc-lobby-reveal');
    menu.classList.remove('wc-intro-only');
    _startConfetti(menu, 10000);
    _shakeScreen(menu, 5000, onDone);

    setTimeout(() => {
      intro.classList.add('hidden');
      intro.classList.remove('wc-lobby-reveal');
    }, 4000);
  }, 9600);
}

export function stopWorldCupIntro() {
  clearTimeout(_worldCupIntroTimer);
  clearInterval(_windTimer);
  clearTimeout(_flashTimer);
  cancelAnimationFrame(_shakeFrame);
  clearTimeout(_confettiTimer);
  clearTimeout(_confettiCleanupTimer);
  _worldCupIntroTimer = null;
  _windTimer = null;
  _flashTimer = null;
  _shakeFrame = null;
  _confettiTimer = null;
  _confettiCleanupTimer = null;

  document.getElementById('world-cup-intro')?.remove();
  document.getElementById('wc-confetti-layer')?.remove();
  const menu = document.getElementById('s-menu');
  if (menu) {
    menu.classList.remove('wc-intro-only');
    menu.style.transform = '';
  }
}

function _startConfetti(root, durationMs) {
  if (!root) return;
  clearTimeout(_confettiTimer);
  clearTimeout(_confettiCleanupTimer);

  let layer = document.getElementById('wc-confetti-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'wc-confetti-layer';
    layer.className = 'wc-confetti-layer';
    layer.setAttribute('aria-hidden', 'true');
    root.appendChild(layer);
  }
  layer.innerHTML = '';

  const colors = ['#4fd8ff', '#0ea5e9', '#2563eb', '#93c5fd', '#dbeafe', '#ffffff'];
  const start = performance.now();

  const spawn = () => {
    const elapsed = performance.now() - start;
    const progress = Math.min(1, elapsed / durationMs);
    const strength = Math.pow(1 - progress, 0.7);
    const count = Math.max(1, Math.ceil(5 * strength));

    for (let i = 0; i < count; i++) {
      const piece = document.createElement('span');
      const size = 6 + Math.random() * 9;
      const duration = 3.8 + Math.random() * 3.8;
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.width = `${size}px`;
      piece.style.height = `${size * (0.45 + Math.random() * 0.8)}px`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = `${duration}s`;
      piece.style.animationDelay = `${Math.random() * 0.18}s`;
      piece.style.setProperty('--wc-confetti-drift', `${-70 + Math.random() * 140}px`);
      piece.style.setProperty('--wc-confetti-spin', `${180 + Math.random() * 720}deg`);
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), duration * 1000 + 500);
    }

    if (progress < 1) {
      _confettiTimer = setTimeout(spawn, 90 + progress * 260);
      return;
    }

    _confettiCleanupTimer = setTimeout(() => {
      layer.remove();
    }, 4500);
  };

  spawn();
}

function _startRandomWind(root) {
  if (!root) return;
  root.innerHTML = '';
  clearInterval(_windTimer);

  const spawn = () => {
    const line = document.createElement('span');
    const left = Math.random() * 100;
    const top = -18 + Math.random() * 92;
    const height = 46 + Math.random() * 58;
    const duration = 0.28 + Math.random() * 0.36;
    const width = Math.random() < 0.45 ? 6 : 3;
    const drift = -34 + Math.random() * 68;
    const tilt = -14 + Math.random() * 10;
    line.style.left = `${left}%`;
    line.style.setProperty('--wc-wind-top', `${top}%`);
    line.style.setProperty('--wc-wind-drift', `${drift}px`);
    line.style.setProperty('--wc-wind-tilt', `${tilt}deg`);
    line.style.height = `${height}vh`;
    line.style.width = `${width}px`;
    line.style.animationDuration = `${duration}s`;
    root.appendChild(line);
    setTimeout(() => line.remove(), duration * 1000 + 80);
  };

  for (let i = 0; i < 42; i++) setTimeout(spawn, Math.random() * 320);
  _windTimer = setInterval(() => {
    const count = 8 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) setTimeout(spawn, Math.random() * 70);
  }, 90);
}

function _shakeScreen(target, durationMs, onDone) {
  cancelAnimationFrame(_shakeFrame);
  const start = performance.now();

  const frame = now => {
    const elapsed = now - start;
    const p = Math.min(1, elapsed / durationMs);
    const fade = Math.pow(1 - p, 1.8);
    const amp = 8 * fade;
    const x = Math.sin(elapsed * 0.055) * amp;
    const y = Math.cos(elapsed * 0.067) * amp * 0.62;
    const r = Math.sin(elapsed * 0.035) * amp * 0.045;

    target.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${r}deg)`;
    if (p < 1) {
      _shakeFrame = requestAnimationFrame(frame);
      return;
    }

    target.style.transform = '';
    onDone?.();
  };

  _shakeFrame = requestAnimationFrame(frame);
}
