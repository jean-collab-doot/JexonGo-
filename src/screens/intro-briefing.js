// "How to play" briefing, shown before level 1 (and again from Settings).
// Yellow full-screen design matching the new-player intro and questionnaire:
// one illustrated card per topic, slide transitions, dots, back / next,
// SKIP, swipe on touch and arrow keys / Enter on keyboard.
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { getLang } from '../i18n.js';
import { SFX } from '../audio/sound.js';

const IMG = {
  heart: '/assets/Image intro/05_Coeur.png',
  star: '/assets/Image intro/04_Etoile.png',
  coin: '/assets/fx/Caisse/JexonGo_Coin_frame_01.png',
  crate: '/assets/fx/Parachut%20anime/JexonGo_Parachute_Crate_12_Frames/frames/plan_01.png',
};

// Each page: illustration kind, title, and short tips (icon + text).
function pages(fr) {
  return [
    {
      art: 'mission',
      title: fr ? 'TA MISSION' : 'YOUR MISSION',
      tips: fr ? [
        ['?', 'Une question de maths apparaît.'],
        ['⏱', 'Réponds avant la fin du temps : il dépend du niveau.'],
        ['✓', 'Bonne réponse : ton avion tire sur les ennemis.'],
        ['✈', 'Détruis les avions ennemis!'],
      ] : [
        ['?', 'A math question appears.'],
        ['⏱', 'Answer before time runs out: it depends on the level.'],
        ['✓', 'Right answer: your plane fires at the enemies.'],
        ['✈', 'Destroy the enemy planes!'],
      ],
    },
    {
      art: 'controls',
      title: fr ? 'DÉPLACEMENT' : 'MOVING',
      tips: fr ? [
        ['⌨', 'Ordinateur : flèches du clavier ou W A S D.'],
        ['☝', 'Téléphone : glisse ton doigt sur l’écran.'],
        ['↔', 'Bouge pour éviter les tirs ennemis.'],
      ] : [
        ['⌨', 'Computer: arrow keys or W A S D.'],
        ['☝', 'Phone: slide your finger on the screen.'],
        ['↔', 'Move to dodge enemy fire.'],
      ],
    },
    {
      art: 'lives',
      title: fr ? 'TES VIES' : 'YOUR LIVES',
      tips: fr ? [
        ['♥', 'Tu commences avec 3 vies.'],
        ['✗', 'Mauvaise réponse ou tir ennemi : -1 vie.'],
        ['!', 'Plus de vies = mission ratée.'],
      ] : [
        ['♥', 'You start with 3 lives.'],
        ['✗', 'Wrong answer or enemy hit: -1 life.'],
        ['!', 'No lives left = mission failed.'],
      ],
    },
    {
      art: 'bonus',
      title: fr ? 'PIÈCES ET BONUS' : 'COINS & BONUSES',
      tips: fr ? [
        ['●', 'Les bonnes réponses font tomber des pièces : ramasse-les!'],
        ['▣', 'Attrape les caisses airdrop pour des bonus surprises.'],
        ['$', 'Tes pièces achètent des avions et des améliorations.'],
      ] : [
        ['●', 'Right answers drop coins: collect them!'],
        ['▣', 'Catch airdrop crates for surprise bonuses.'],
        ['$', 'Coins buy new planes and upgrades.'],
      ],
    },
    {
      art: 'stars',
      title: fr ? 'LES ÉTOILES' : 'STARS',
      tips: fr ? [
        ['★', '3 étoiles : tout bon sans te faire toucher.'],
        ['★', '2 étoiles : au moins 70 % de bonnes réponses.'],
        ['▲', 'Gagne de l’XP pour monter de niveau. Bonne chance, pilote!'],
      ] : [
        ['★', '3 stars: all right and never hit.'],
        ['★', '2 stars: at least 70% right answers.'],
        ['▲', 'Earn XP to level up. Good luck, pilot!'],
      ],
    },
  ];
}

function artHtml(kind) {
  switch (kind) {
    case 'mission':
      // Animated scene: the T-6 fires a rocket at an F-15, which explodes (loop).
      return `<div class="ht-scene">
        <div class="ht-f15"></div>
        <div class="ht-boom"></div>
        <div class="ht-rocket"></div>
        <div class="ht-t6"></div>
      </div>`;
    case 'controls':
      // Two animated panels: arrow keys lighting up as the T-6 slides left /
      // right, and a finger dragging the T-6 on a phone screen (same path).
      return `<div class="ht-ctrl">
        <div class="ht-pc">
          <div class="ht-pc-sky"><div class="ht-mini-t6"></div></div>
          <div class="ht-keys">
            <span class="ht-key ht-key-up">▲</span>
            <span class="ht-key ht-key-left">◀</span><span class="ht-key">▼</span><span class="ht-key ht-key-right">▶</span>
          </div>
          <div class="ht-keys-alt">W A S D</div>
        </div>
        <div class="ht-phone">
          <div class="ht-phone-screen">
            <div class="ht-mini-t6"></div>
            <div class="ht-finger"></div>
          </div>
        </div>
      </div>`;
    case 'lives':
      return `<div class="ht-art-row">${[0, 1, 2].map(i => `<img class="ht-bounce" style="--i:${i}" src="${IMG.heart}" alt="">`).join('')}</div>`;
    case 'bonus':
      return `<div class="ht-art-row"><img class="ht-bounce ht-coin" style="--i:0" src="${IMG.coin}" alt=""><div class="ht-bounce ht-crate" style="--i:1;background-image:url('${IMG.crate}')"></div><img class="ht-bounce ht-coin" style="--i:2" src="${IMG.coin}" alt=""></div>`;
    default:
      return `<div class="ht-art-row">${[0, 1, 2].map(i => `<img class="ht-bounce ht-star" style="--i:${i}" src="${IMG.star}" alt="">`).join('')}</div>`;
  }
}

let briefingSessionId = 0;

export function shouldShowIntroBriefing(levelNum) {
  return levelNum === 1 && !G.hasSeenBriefing;
}

export function resetIntroBriefing() {
  G.hasSeenBriefing = false;
  save('hasSeenBriefing', false);
}

export function showIntroBriefing(onDone) {
  const sessionId = ++briefingSessionId;
  const fr = getLang() === 'fr';
  const list = pages(fr);
  document.getElementById('brief-overlay')?.remove();
  SFX.stopMusic();   // no music during the briefing; the level brings its own

  const overlay = document.createElement('div');
  overlay.id = 'brief-overlay';
  overlay.className = 'ht';
  overlay.innerHTML = `
    <div class="ht-head">
      <div class="ht-heading">${fr ? 'COMMENT JOUER' : 'HOW TO PLAY'}</div>
      <button class="ht-skip" type="button">${fr ? 'PASSER' : 'SKIP'}</button>
    </div>
    <div class="ht-stage"></div>
    <div class="ht-foot">
      <button class="ht-nav ht-back" type="button" aria-label="${fr ? 'Précédent' : 'Back'}">◀</button>
      <div class="ht-dots">${list.map(() => '<span></span>').join('')}</div>
      <button class="ht-nav ht-next" type="button"></button>
    </div>`;
  document.body.appendChild(overlay);

  const stage = overlay.querySelector('.ht-stage');
  const back = overlay.querySelector('.ht-back');
  const nextBtn = overlay.querySelector('.ht-next');
  const dots = [...overlay.querySelectorAll('.ht-dots span')];
  let index = -1;
  let finished = false;

  const render = (to, direction) => {
    const page = list[to];
    const card = document.createElement('div');
    card.className = `ht-card ht-in-${direction}`;
    card.innerHTML = `
      <div class="ht-art ht-art-${page.art}">${artHtml(page.art)}</div>
      <h2 class="ht-title">${page.title}</h2>
      <ul class="ht-tips">
        ${page.tips.map(([icon, text], i) => `<li style="--i:${i}"><span class="ht-icon">${icon}</span><span>${text}</span></li>`).join('')}
      </ul>`;
    const old = stage.querySelector('.ht-card:not(.ht-leaving)');
    if (old) {
      old.classList.add('ht-leaving', `ht-out-${direction}`);
      setTimeout(() => old.remove(), 380);
    }
    stage.appendChild(card);
    index = to;
    dots.forEach((dot, i) => dot.classList.toggle('on', i === index));
    back.disabled = index === 0;
    const last = index === list.length - 1;
    nextBtn.textContent = last ? (fr ? 'DÉCOLLER!' : 'TAKE OFF!') : (fr ? 'SUIVANT ▶' : 'NEXT ▶');
    nextBtn.classList.toggle('ht-go', last);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    window.removeEventListener('keydown', onKey);
    G.hasSeenBriefing = true;
    save('hasSeenBriefing', true);
    // The card fades but the yellow stays on top while the level loads
    // underneath; it disappears the moment the 3-2-1 countdown starts
    // (game.js fires 'jexongo:countdown'), so DÉCOLLER leads straight to it.
    overlay.classList.add('ht-leaving-cards');
    const remove = () => overlay.remove();
    window.addEventListener('jexongo:countdown', remove, { once: true });
    setTimeout(remove, 12000);   // safety: never stay stuck on top
    setTimeout(() => {
      if (sessionId !== briefingSessionId) { remove(); return; }
      onDone?.();
    }, 260);
  };
  const goNext = () => (index >= list.length - 1 ? finish() : render(index + 1, 'next'));
  const goBack = () => { if (index > 0) render(index - 1, 'back'); };
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
  };

  nextBtn.addEventListener('click', goNext);
  back.addEventListener('click', goBack);
  overlay.querySelector('.ht-skip').addEventListener('click', finish);
  window.addEventListener('keydown', onKey);

  // Swipe left / right on touch screens.
  let touchX = null;
  stage.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (dx < -50) goNext();
    else if (dx > 50) goBack();
  });

  render(0, 'next');
}
