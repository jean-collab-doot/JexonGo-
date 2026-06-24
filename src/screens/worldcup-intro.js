let _worldCupIntroTimer = null;
let _windTimer = null;
let _flashTimer = null;
let _shakeFrame = null;
let _flagTimer = null;
let _confettiTimer = null;
let _confettiCleanupTimer = null;

const WORLD_CUP_FLAGS = [
  'Afrique du Sud.svg',
  'Algeria.svg',
  'Allemagne.svg',
  'Angleterre.svg',
  'Argentine.svg',
  'Bélgique.svg',
  'Brésil.svg',
  'Cap Vert.svg',
  'Colombie.svg',
  'Corée du Sud.svg',
  'Côte d,ivoire.svg',
  'Curaçao.svg',
  'Danemark.svg',
  'Égypte.svg',
  'Espagne.svg',
  'France.svg',
  'Ghana.svg',
  'Haiti.svg',
  'Japon.svg',
  'Maroc.svg',
  'Mexique.svg',
  'Nouvelle-Écosse.svg',
  'Pays-bas.svg',
  'Portugal.svg',
  'Rdc.svg',
  'Sénégal.svg',
  'USA.jpg'
];

const FLAG_SIDES = ['left', 'right'];

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
      <div class="wc-wind-lines" aria-hidden="true">
      </div>
      <div class="wc-flag-corners" aria-hidden="true"></div>
      <div class="wc-flash" aria-hidden="true"></div>
      <img class="wc-trophy" src="/assets/World%20COPE/ChatGPT%20Image%2012%20juin%202026,%2021_35_52.png" alt="">
      <div class="wc-ball-layer" aria-hidden="true"></div>
      <div class="wc-plane-wrap">
        <span class="wc-engine-smoke wc-engine-smoke-left"></span>
        <span class="wc-engine-smoke wc-engine-smoke-right"></span>
        <span class="wc-engine-fire wc-engine-fire-left"></span>
        <span class="wc-engine-fire wc-engine-fire-right"></span>
        <span class="wc-wing-glow wc-wing-left"></span>
        <span class="wc-wing-glow wc-wing-right"></span>
        <img class="wc-plane" src="/assets/World%20COPE/F-18%20WC.png" alt="">
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
  _startRandomFlags(
    intro.querySelector('.wc-flag-corners'),
    intro.querySelector('.wc-ball-layer')
  );

  clearTimeout(_flashTimer);
  _flashTimer = setTimeout(() => {
    intro.classList.add('wc-flash-active');
  }, 9700);

  clearTimeout(_worldCupIntroTimer);
  _worldCupIntroTimer = setTimeout(() => {
    clearInterval(_windTimer);
    clearInterval(_flagTimer);
    intro.classList.remove('wc-active', 'wc-flash-active');
    intro.classList.add('wc-lobby-reveal');
    menu.classList.remove('wc-intro-only');
    _startConfetti(menu, 10000);
    _shakeScreen(menu, 5000, onDone);

    setTimeout(() => {
      intro.classList.add('hidden');
      intro.classList.remove('wc-lobby-reveal');
    }, 4000);
  }, 10300);
}

export function stopWorldCupIntro() {
  clearTimeout(_worldCupIntroTimer);
  clearInterval(_windTimer);
  clearTimeout(_flashTimer);
  cancelAnimationFrame(_shakeFrame);
  clearInterval(_flagTimer);
  clearTimeout(_confettiTimer);
  clearTimeout(_confettiCleanupTimer);
  _worldCupIntroTimer = null;
  _windTimer = null;
  _flashTimer = null;
  _shakeFrame = null;
  _flagTimer = null;
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

  const colors = ['#ff2d55', '#00d4ff', '#ffe04b', '#37ff8b', '#ff8a00', '#a855f7', '#ffffff'];
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

function _startRandomFlags(root, ballRoot) {
  if (!root) return;
  root.innerHTML = '';
  if (ballRoot) ballRoot.innerHTML = '';
  clearInterval(_flagTimer);

  const showPair = () => {
    const flags = _pickRandomItems(WORLD_CUP_FLAGS, 2);
    const sides = _pickRandomItems(FLAG_SIDES, 2);
    root.innerHTML = '';
    if (ballRoot) ballRoot.innerHTML = '';

    flags.forEach((flag, index) => {
      const card = document.createElement('span');
      card.className = `wc-flag-card wc-flag-${sides[index]}`;
      card.style.animationDelay = `${index * 0.12}s`;

      const image = document.createElement('img');
      image.src = `/assets/Country%20Flag/${encodeURIComponent(flag)}`;
      image.alt = '';

      card.appendChild(image);
      root.appendChild(card);
    });

    const ball = document.createElement('img');
    ball.className = 'wc-soccer-ball wc-ball-roll';
    ball.src = '/assets/Country%20Flag/Ballon%20de%20foot.png';
    ball.alt = '';
    (ballRoot || root).appendChild(ball);
  };

  showPair();
  _flagTimer = setInterval(showPair, 3000);
}

function _pickRandomItems(items, count) {
  const pool = [...items];
  const picked = [];
  while (picked.length < count && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function _startRandomWind(root) {
  if (!root) return;
  root.innerHTML = '';
  clearInterval(_windTimer);

  const spawn = () => {
    const line = document.createElement('span');
    const left = Math.random() * 100;
    const height = 22 + Math.random() * 34;
    const duration = 0.55 + Math.random() * 0.7;
    const width = Math.random() < 0.25 ? 4 : 2;
    line.style.left = `${left}%`;
    line.style.height = `${height}vh`;
    line.style.width = `${width}px`;
    line.style.animationDuration = `${duration}s`;
    root.appendChild(line);
    setTimeout(() => line.remove(), duration * 1000 + 80);
  };

  for (let i = 0; i < 12; i++) setTimeout(spawn, Math.random() * 450);
  _windTimer = setInterval(() => {
    const count = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) setTimeout(spawn, Math.random() * 180);
  }, 260);
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
