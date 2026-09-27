// "Sign in with Google" invitation shown after the beginner practice (yellow
// design like the new-player intro): the T-6 loops in, a card pops with
// "BRAVO PILOTE!", the Google logo spins in, the benefits slide in one by one,
// and a glowing Google button (or "later") ends it.
import { getLang, t } from '../i18n.js';

import { uiIcon } from '../utils/icons.js';
const GOOGLE_G = `<svg viewBox="0 0 48 48" aria-hidden="true">
  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/>
  <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/>
  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/>
</svg>`;

export function showConnectPrompt({ onGoogle, onLater, onLegal } = {}) {
  document.getElementById('connect-prompt')?.remove();
  const fr = getLang() === 'fr';
  const perks = fr
    ? [['save', 'Ta progression est sauvegardée'], ['coin', 'Garde tes pièces et tes avions'], ['phone', 'Joue sur tous tes appareils']]
    : [['save', 'Your progress is saved'], ['coin', 'Keep your coins and planes'], ['phone', 'Play on all your devices']];
  const overlay = document.createElement('div');
  overlay.id = 'connect-prompt';
  overlay.className = 'cp';
  overlay.innerHTML = `
    <div class="cp-plane"></div>
    <div class="cp-card">
      <div class="cp-title">${fr ? 'BRAVO PILOTE!' : 'GREAT JOB, PILOT!'}</div>
      <div class="cp-sub">${fr ? 'Tu as fini ta première pratique!' : 'You finished your first practice!'}</div>
      <div class="cp-google">${GOOGLE_G}</div>
      <div class="cp-ask">${fr ? 'Connecte-toi avec ton compte Google' : 'Sign in with your Google account'}</div>
      <ul class="cp-perks">
        ${perks.map(([icon, text], i) => `<li style="--i:${i}"><span>${uiIcon(icon)}</span>${text}</li>`).join('')}
      </ul>
      <button class="cp-btn" type="button">${GOOGLE_G}<span>${fr ? 'SE CONNECTER AVEC GOOGLE' : 'SIGN IN WITH GOOGLE'}</span></button>
      <button class="cp-later" type="button">${fr ? 'Plus tard' : 'Later'}</button>
    </div>
    <div class="cp-legal">
      <button type="button" data-legal="terms">${t('jxTermsOfService')}</button>
      <button type="button" data-legal="privacy">${t('jxPolicyUser')}</button>
    </div>`;
  document.body.appendChild(overlay);

  const close = (then) => {
    overlay.classList.add('cp-leave');
    setTimeout(() => { overlay.remove(); then?.(); }, 350);
  };
  overlay.querySelector('.cp-btn').addEventListener('click', () => close(onGoogle), { once: true });
  overlay.querySelector('.cp-later').addEventListener('click', () => close(onLater), { once: true });
  // Terms of use / privacy policy (main.js reopens this invitation on "back").
  overlay.querySelectorAll('[data-legal]').forEach(btn => btn.addEventListener('click', () => {
    close(() => onLegal?.(btn.dataset.legal));
  }, { once: true }));
}
