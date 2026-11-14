// Sign-in invitation shown after the beginner practice (yellow design like
// the new-player intro): the T-6 loops in, a card pops with "BRAVO PILOTE!",
// the benefits slide in one by one, then a glowing Google button and one of
// the same size to continue with an e-mail (screens/email-auth.js), the terms
// and privacy links right under them, and "later".
import { getLang, t } from '../i18n.js';

import { uiIcon } from '../utils/icons.js';
const GOOGLE_G = `<svg viewBox="0 0 48 48" aria-hidden="true">
  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/>
  <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/>
  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/>
</svg>`;

// reason 'multi' / 'top20': a player without an account tapped MULTI or
// TOP 20 in the lobby (menu.js). reason 'skin': tapped OBTENIR on an event
// skin chest (screens/chest.js).
// reason 'daily': a player without an account tapped the daily reward.
// reason 'signin': the SE CONNECTER button of the RÉGLAGE drawer.
const REASON_SUB = {
  multi: ['Connecte-toi pour jouer en multijoueur!', 'Sign in to play multiplayer!'],
  top20: ['Connecte-toi pour voir le TOP 20!', 'Sign in to see the TOP 20!'],
  daily: ['Connecte-toi pour récupérer ta récompense!', 'Sign in to claim your reward!'],
  skin: ['Connecte-toi pour obtenir ton skin Halloween 2026!', 'Sign in to get your Halloween 2026 skin!'],
  signin: ['Choisis comment te connecter.', 'Choose how to sign in.'],
};
const ACCOUNT_NEEDED = ['multi', 'top20', 'daily'];

// Envelope of the "continue with an e-mail" buttons (also menu.js).
export const EMAIL_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="#ff9d00"/><path d="M3.5 7l8.5 6 8.5-6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export function emailButtonLabel() {
  return getLang() === 'fr' ? 'CONTINUER AVEC UN COURRIEL' : 'CONTINUE WITH E-MAIL';
}

export function showConnectPrompt({ onGoogle, onEmail, onLater, onLegal, reason = '' } = {}) {
  document.getElementById('connect-prompt')?.remove();
  const fr = getLang() === 'fr';
  // What an account gives: everything else is open to every player.
  const perks = fr
    ? [['swords', 'Le multijoueur'], ['crown', 'Ton nom dans le TOP 20'], ['save', 'Ta progression, tes pièces et tes avions sauvegardés'], ['phone', 'Joue sur tous tes appareils']]
    : [['swords', 'Multiplayer'], ['crown', 'Your name in the TOP 20'], ['save', 'Your progress, coins and planes saved'], ['phone', 'Play on all your devices']];
  const overlay = document.createElement('div');
  overlay.id = 'connect-prompt';
  overlay.className = 'cp';
  overlay.innerHTML = `
    <div class="cp-plane"></div>
    <div class="cp-card">
      <div class="cp-title">${reason === 'signin' ? (fr ? 'SE CONNECTER' : 'SIGN IN') : ACCOUNT_NEEDED.includes(reason)
        ? (fr ? 'COMPTE REQUIS' : 'ACCOUNT NEEDED')
        : (fr ? 'BRAVO PILOTE!' : 'GREAT JOB, PILOT!')}</div>
      <div class="cp-sub">${REASON_SUB[reason]?.[fr ? 0 : 1]
        || (fr ? 'Tu as fini ta première pratique!' : 'You finished your first practice!')}</div>
      <div class="cp-ask">${onEmail
        ? (fr ? 'Connecte-toi avec Google ou avec un courriel. C’est gratuit !' : 'Sign in with Google or with an e-mail. It’s free!')
        : (fr ? 'Connecte-toi avec ton compte Google. C’est gratuit !' : 'Sign in with your Google account. It’s free!')}</div>
      <ul class="cp-perks">
        ${perks.map(([icon, text], i) => `<li style="--i:${i}"><span>${uiIcon(icon)}</span>${text}</li>`).join('')}
      </ul>
      <div class="cp-actions">
        <button class="cp-btn cp-google-btn" type="button">${GOOGLE_G}<span>${fr ? 'SE CONNECTER AVEC GOOGLE' : 'SIGN IN WITH GOOGLE'}</span></button>
        ${onEmail ? `<button class="cp-btn cp-email" type="button">${EMAIL_ICON}<span>${emailButtonLabel()}</span></button>` : ''}
      </div>
      <div class="cp-legal">
        <button type="button" data-legal="terms">${t('jxTermsOfService')}</button>
        <button type="button" data-legal="privacy">${t('jxPolicyUser')}</button>
      </div>
      <button class="cp-later" type="button">${reason === 'signin' ? (fr ? 'Retour' : 'Back') : (fr ? 'Plus tard' : 'Later')}</button>
    </div>`;
  document.body.appendChild(overlay);

  const close = (then) => {
    overlay.classList.add('cp-leave');
    setTimeout(() => { overlay.remove(); then?.(); }, 350);
  };
  overlay.querySelector('.cp-google-btn').addEventListener('click', () => close(onGoogle), { once: true });
  overlay.querySelector('.cp-email')?.addEventListener('click', () => close(onEmail), { once: true });
  overlay.querySelector('.cp-later').addEventListener('click', () => close(onLater), { once: true });
  // Terms of use / privacy policy (main.js reopens this invitation on "back").
  overlay.querySelectorAll('[data-legal]').forEach(btn => btn.addEventListener('click', () => {
    close(() => onLegal?.(btn.dataset.legal));
  }, { once: true }));
}
