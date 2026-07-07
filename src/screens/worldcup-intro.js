let _blueLayerTimer = null;

export function playWorldCupIntro(onDone) {
  stopWorldCupIntro();

  const overlay = document.createElement('div');
  overlay.id = 'world-cup-intro';
  overlay.className = 'world-cup-intro blue-layer-intro';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="wc-color-layers">
      <span class="wc-layer wc-layer-blue"></span>
      <span class="wc-layer wc-layer-green"></span>
      <span class="wc-layer wc-layer-red"></span>
    </div>
    <div class="wc-wind-lines" aria-hidden="true"></div>
    <div class="wc-plane-wrap" aria-hidden="true">
      <img class="wc-plane" src="/assets/planes/14-intro-cutout.png" alt="" decoding="async" fetchpriority="high">
    </div>
  `;

  document.body.appendChild(overlay);
  addRandomWind(overlay.querySelector('.wc-wind-lines'));
  requestAnimationFrame(() => overlay.classList.add('wc-active'));

  _blueLayerTimer = setTimeout(() => {
    overlay.remove();
    _blueLayerTimer = null;
    onDone?.();
  }, 3200);
}

export function stopWorldCupIntro() {
  clearTimeout(_blueLayerTimer);
  _blueLayerTimer = null;
  document.getElementById('world-cup-intro')?.remove();
  const menu = document.getElementById('s-menu');
  if (menu) {
    menu.classList.remove('wc-intro-only');
    menu.style.transform = '';
  }
}

function addRandomWind(root) {
  if (!root) return;
  root.innerHTML = '';

  const isMobile = window.matchMedia?.('(max-width: 768px)').matches;
  const lineCount = isMobile ? 18 : 26;

  for (let i = 0; i < lineCount; i++) {
    const line = document.createElement('span');
    const left = Math.random() * 100;
    const top = Math.random() * 100;
    const delay = Math.random() * 2.3;
    const duration = 0.48 + Math.random() * 0.52;
    const height = 16 + Math.random() * 30;
    const opacity = 0.34 + Math.random() * 0.46;

    line.style.left = `${left}%`;
    line.style.top = `${top}%`;
    line.style.height = `${height}vh`;
    line.style.opacity = String(opacity);
    line.style.animationDelay = `${delay}s`;
    line.style.animationDuration = `${duration}s`;
    root.appendChild(line);
  }
}
