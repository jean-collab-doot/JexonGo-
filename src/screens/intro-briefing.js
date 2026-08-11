import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { getLang } from '../i18n.js';

const BRIEFING_COPY = {
  en: {
    next: 'NEXT ->',
    fly: 'FLY! >',
    sections: [
      {
        title: 'YOUR MISSION',
        lines: [
          'Enemies are flying toward you.',
          'Answer math questions correctly.',
          'Each right answer fires a missile.',
          'Destroy all enemies to win!',
        ],
        imageSlot: 'mission',
      },
      {
        title: 'LIVES',
        lines: [
          'You start with 3 lives.',
          'A wrong answer costs 1 life.',
          'Lose all lives - mission failed.',
          'First wrong answer is a warning!',
        ],
        imageSlot: 'lives',
      },
      {
        title: 'CONTROLS',
        lines: [
          'Phone image: use your finger on the screen.',
          'Touch a circle to move the fighter.',
          'Tap the answer button to shoot.',
          '',
          'On PC: use the keyboard arrow keys.',
          'Up and down arrows move vertically.',
          'Left and right arrows move horizontally.',
          'You can also use W, A, S and D.',
        ],
        imageSlot: 'controls',
      },
      {
        title: 'SCORE',
        lines: [
          'Answer all 10 questions to win.',
          '10 correct answers = 3 stars.',
          'Earn XP to unlock new aircraft.',
          'Good luck, pilot!',
        ],
        imageSlot: 'score',
      },
    ],
  },
  fr: {
    next: 'SUIVANT ->',
    fly: 'DECOLLER! >',
    sections: [
      {
        title: 'TA MISSION',
        lines: [
          'Des avions ennemis foncent vers toi.',
          'Reponds correctement aux questions de math.',
          'Chaque bonne reponse lance un missile.',
          'Detruis tous les ennemis pour gagner!',
        ],
        imageSlot: 'mission',
      },
      {
        title: 'VIES',
        lines: [
          'Tu commences avec 3 vies.',
          'Une mauvaise reponse coute 1 vie.',
          'Si tu perds toutes tes vies, la mission echoue.',
          'La premiere mauvaise reponse est un avertissement!',
        ],
        imageSlot: 'lives',
      },
      {
        title: 'CONTROLES',
        lines: [
          "Sur telephone: utilise ton doigt sur l'ecran.",
          "Touche un cercle pour deplacer l'avion.",
          'Appuie sur une reponse pour tirer.',
          '',
          'Sur PC: utilise les fleches du clavier.',
          'Les fleches haut et bas deplacent verticalement.',
          'Les fleches gauche et droite deplacent horizontalement.',
          'Tu peux aussi utiliser W, A, S et D.',
        ],
        imageSlot: 'controls',
      },
      {
        title: 'SCORE',
        lines: [
          'Reponds aux 10 questions pour gagner.',
          '10 bonnes reponses = 3 etoiles.',
          "Gagne de l'XP pour debloquer de nouveaux avions.",
          'Bonne chance, pilote!',
        ],
        imageSlot: 'score',
      },
    ],
  },
};

function currentBriefingCopy() {
  return getLang() === 'fr' ? BRIEFING_COPY.fr : BRIEFING_COPY.en;
}

const INTRO_ASSETS = {
  mission: '/assets/Image intro/03_Combat_Helicoptere_Horizontal_F18.png',
  lives: '/assets/Image intro/05_Coeur.png',
  score: '/assets/Image intro/04_Etoile.png',
  controlsDesktop: '/assets/Image intro/01_Commandes_Ordinateur_WASD_Fleches.png',
  controlsPhone: '/assets/Image intro/02_Commandes_Telephone_Vertical.png',
};

const easeOutExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let briefingSessionId = 0;

export function shouldShowIntroBriefing(levelNum) {
  return levelNum === 1 && !G.hasSeenBriefing;
}

export function resetIntroBriefing() {
  G.hasSeenBriefing = false;
  save('hasSeenBriefing', false);
}

export async function showIntroBriefing(onDone) {
  const sessionId = ++briefingSessionId;
  const overlay = document.createElement('div');
  overlay.id = 'brief-overlay';
  overlay.innerHTML = `
    <div id="brief-bg"></div>
    <svg id="brief-triangle" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polygon points="0,100 100,0 100,100" fill="rgba(30,100,220,0.55)"></polygon>
    </svg>
    <div id="brief-card">
      <h2 id="brief-title" class="brief-title"></h2>
      <div id="brief-image-slot" class="brief-image-slot"></div>
      <div id="brief-lines"></div>
      <div id="brief-key-slot"></div>
    </div>
    <button id="brief-next" class="brief-next-btn" type="button"></button>
  `;
  document.body.appendChild(overlay);

  const tri = overlay.querySelector('#brief-triangle');
  const card = overlay.querySelector('#brief-card');
  const next = overlay.querySelector('#brief-next');

  animateTriangleIn(tri);
  await delay(260);
  card.classList.add('brief-card-show');
  await runSections(overlay, next);
  await exitBriefing(overlay, tri, card);
  if (sessionId !== briefingSessionId) return;

  G.hasSeenBriefing = true;
  save('hasSeenBriefing', true);
  onDone?.();
}

function animateTriangleIn(tri) {
  const start = performance.now();
  const duration = 600;
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const x = 100 * (1 - easeOutExpo(t));
    tri.style.transform = `translateX(${x}vw)`;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function animateJetIn(jet) {
  const start = performance.now();
  const duration = 900;
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const x = -220 + (window.innerWidth * 0.05 + 220) * easeOutExpo(t);
    const yStart = window.innerHeight * 0.6;
    const yEnd = window.innerHeight * 0.35;
    const y = yStart + (yEnd - yStart) * easeOutCubic(t);
    const rot = -3 + (-5 * t);
    jet.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function runSections(overlay, nextBtn) {
  const copy = currentBriefingCopy();
  for (let i = 0; i < copy.sections.length; i++) {
    const section = copy.sections[i];
    await renderSection(overlay, section, i === copy.sections.length - 1, copy);
    await waitForNext(nextBtn, i === copy.sections.length - 1);
  }
}

async function renderSection(overlay, section, isLast, copy) {
  const card = overlay.querySelector('#brief-card');
  const title = overlay.querySelector('#brief-title');
  const lines = overlay.querySelector('#brief-lines');
  const imageSlot = overlay.querySelector('#brief-image-slot');
  const keySlot = overlay.querySelector('#brief-key-slot');
  const next = overlay.querySelector('#brief-next');

  if (card.dataset.hasSection === 'true') {
    card.classList.remove('brief-section-in');
    card.classList.add('brief-section-out');
    await delay(220);
  }

  title.textContent = section.title;
  title.classList.remove('brief-title-pop');
  void title.offsetWidth;
  title.classList.add('brief-title-pop');
  lines.innerHTML = '';
  keySlot.innerHTML = '';
  imageSlot.dataset.slot = section.imageSlot;
  imageSlot.innerHTML = '';
  imageSlot.appendChild(renderBriefingMedia(section.imageSlot));
  next.textContent = isLast ? copy.fly : copy.next;
  next.style.opacity = '0.3';
  next.style.pointerEvents = 'none';

  card.classList.remove('brief-section-out');
  void card.offsetWidth;
  card.classList.add('brief-section-in');
  card.dataset.hasSection = 'true';

  for (const line of section.lines) {
    const lineEl = document.createElement('div');
    lineEl.className = 'brief-line';
    lines.appendChild(lineEl);
    await animateLine(lineEl, line, 80);
  }

  if (section.showKeyboardHints) keySlot.appendChild(renderKeyboardKeys());
  next.style.opacity = '1';
  next.style.pointerEvents = 'all';
}

function renderBriefingMedia(slot) {
  if (slot === 'controls') return renderControlsMedia();

  const wrap = document.createElement('div');
  wrap.className = `brief-media-frame brief-media-${slot}`;
  const imageCount = slot === 'lives' || slot === 'score' ? 3 : 1;
  for (let index = 0; index < imageCount; index++) {
    const img = document.createElement('img');
    img.src = INTRO_ASSETS[slot] || INTRO_ASSETS.mission;
    img.alt = '';
    img.decoding = 'async';
    wrap.appendChild(img);
  }
  return wrap;
}

function renderControlsMedia() {
  const wrap = document.createElement('div');
  wrap.className = 'brief-media-frame brief-media-controls brief-controls-pair';
  const controls = [
    [INTRO_ASSETS.controlsDesktop, 'WASD and arrow-key game controls', 'brief-controls-computer'],
    [INTRO_ASSETS.controlsPhone, 'Touchscreen game controls', 'brief-controls-phone'],
  ];
  for (const [src, alt, className] of controls) {
    const img = document.createElement('img');
    img.className = className;
    img.src = src;
    img.alt = alt;
    img.decoding = 'async';
    wrap.appendChild(img);
  }
  return wrap;
}

async function animateLine(containerEl, text, msPerWord = 80) {
  if (!text) {
    containerEl.innerHTML = '&nbsp;';
    await delay(msPerWord);
    return;
  }
  const words = text.split(' ');
  for (const word of words) {
    const span = document.createElement('span');
    span.textContent = word + ' ';
    span.style.opacity = '0';
    span.style.transition = 'opacity 0.12s ease';
    containerEl.appendChild(span);
    requestAnimationFrame(() => { span.style.opacity = '1'; });
    await delay(msPerWord);
  }
}

function renderKeyboardKeys() {
  const keys = ['1', '2', '3', '4'];
  const container = document.createElement('div');
  container.className = 'brief-keys';
  keys.forEach(k => {
    const key = document.createElement('div');
    key.className = 'brief-key';
    key.textContent = k;
    container.appendChild(key);
  });
  return container;
}

function waitForNext(btn, isLast) {
  return new Promise(resolve => {
    btn.onclick = () => {
      btn.style.opacity = '0.3';
      btn.style.pointerEvents = 'none';
      resolve(isLast);
    };
  });
}

async function exitBriefing(overlay, tri, card) {
  card.style.transition = 'opacity 0.3s';
  card.style.opacity = '0';
  await delay(300);

  tri.style.transition = 'transform 0.4s ease-in';
  tri.style.transform = 'translateX(100vw)';
  await delay(500);

  overlay.style.transition = 'opacity 0.3s';
  overlay.style.opacity = '0';
  await delay(300);
  overlay.remove();
}
