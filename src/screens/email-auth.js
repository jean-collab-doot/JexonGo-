// Sign-in with an e-mail and a password, beside Google (same yellow design
// as the sign-in invitation and the pilot name prompt):
//  - CRÉER UN COMPTE: player name (unique, checked while typing), e-mail,
//    password twice; then the 6-digit code of the e-mail confirms it
//  - SE CONNECTER: e-mail + password, "Mot de passe oublié ?" sends a code
//    to choose a new password
//  - an e-mail that already has an account (e.g. Google): sign in with
//    Google, with its password, or create a password for it (same account,
//    same progress)
// Supabase does the accounts (systems/supabase-client.js). Once signed in,
// onSignedIn({ email, playerName }) (main.js) does the same steps as Google.
import { getLang } from '../i18n.js';
import {
  signUpWithEmail, verifyEmailCode, resendSignupCode, signInWithEmail,
  sendPasswordResetCode, updatePassword,
} from '../systems/supabase-client.js';
import { isPlayerNameAvailable } from '../systems/player-names.js';
import {
  PILOT_NAME_MAX, pilotNameError, cleanPilotName, watchNameAvailability, nameTakenMessage,
} from './pilot-name-prompt.js';

const PASSWORD_MIN = 8;
const RESEND_WAIT_MS = 60000;
const GOOGLE_G = `<svg viewBox="0 0 48 48" aria-hidden="true">
  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/>
  <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/>
  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/>
</svg>`;

const tr = (frText, enText) => (getLang() === 'fr' ? frText : enText);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const cleanEmail = v => String(v || '').trim().toLowerCase();
const emailLocal = email => [String(email || '').split('@')[0]];

const EXISTING_EMAIL_CODES = ['user_already_exists', 'email_exists'];

// Supabase's answer -> a message for the player.
function errorMessage(error) {
  const code = error?.code || '';
  const msg = String(error?.message || '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return tr('Courriel ou mot de passe incorrect.', 'Wrong e-mail or password.');
  }
  if (code === 'otp_expired' || msg.includes('expired') || msg.includes('token')) {
    return tr('Code faux ou expiré. Vérifie-le ou demande un nouveau code.', 'Wrong or expired code. Check it or ask for a new one.');
  }
  if (code === 'weak_password') {
    return tr(`Mot de passe trop faible : ${PASSWORD_MIN} caractères minimum.`, `Password too weak: ${PASSWORD_MIN} characters minimum.`);
  }
  if (code === 'same_password') {
    return tr('Choisis un mot de passe différent de l’ancien.', 'Pick a password different from the old one.');
  }
  if (code.startsWith('over_') || msg.includes('rate limit')) {
    return tr('Trop d’essais. Attends quelques minutes puis réessaie.', 'Too many tries. Wait a few minutes, then try again.');
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') {
    return tr('Ce courriel n’est pas valide.', 'This e-mail is not valid.');
  }
  if (code === 'signup_disabled' || code === 'email_provider_disabled' || code === 'email_address_not_authorized') {
    return tr('La connexion par courriel n’est pas encore prête. Utilise Google pour l’instant.', 'E-mail sign-in is not ready yet. Use Google for now.');
  }
  if (code === 'network' || code === 'unavailable') {
    return tr('Pas de connexion Internet. Réessaie.', 'No Internet connection. Try again.');
  }
  console.warn('[email-auth]', error);
  return tr('Une erreur est survenue. Réessaie.', 'Something went wrong. Try again.');
}

function field(id, label, type, attrs = '', hint = '') {
  const eye = type === 'password'
    ? `<button type="button" class="ea-eye" data-eye="${id}" aria-pressed="false" aria-label="${tr('Afficher le mot de passe', 'Show password')}">👁</button>`
    : '';
  return `
    <label class="ea-field" for="${id}">
      <span class="ea-label">${label}</span>
      <span class="ea-input-wrap"><input id="${id}" class="pnp-input ea-input" type="${type}" ${attrs}>${eye}</span>
      ${hint ? `<span class="ea-hint">${hint}</span>` : ''}
    </label>`;
}

const passwordAttrs = kind => `autocomplete="${kind}" minlength="${PASSWORD_MIN}" maxlength="72"`;
const codeAttrs = 'inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456"';
const emailAttrs = 'autocomplete="email" inputmode="email" maxlength="254" autocapitalize="none" spellcheck="false"';

/**
 * Opens the window on a view: 'login', 'signup' (also 'code', 'forgot',
 * 'reset', 'exists' while it is open). onGoogle: the Google sign-in.
 */
export function openEmailAuth({ view = 'login', email = '', onSignedIn, onGoogle } = {}) {
  document.getElementById('email-auth')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'email-auth';
  overlay.className = 'cp pnp ea';
  overlay.innerHTML = '<div class="cp-card pnp-card ea-card" role="dialog" aria-modal="true"></div>';
  document.body.appendChild(overlay);
  const card = overlay.querySelector('.ea-card');
  const state = { email: cleanEmail(email), resendAt: 0, recoveryTitle: false };
  let resendTimer = null;
  let busy = false;

  const close = () => {
    clearInterval(resendTimer);
    overlay.classList.add('cp-leave');
    setTimeout(() => overlay.remove(), 350);
  };
  const signedIn = user => {
    close();
    onSignedIn?.({
      email: cleanEmail(user?.email || state.email),
      playerName: cleanPilotName(user?.user_metadata?.player_name || ''),
    });
  };
  const $ = sel => card.querySelector(sel);
  // Only the field with the current error turns red.
  const showError = (msg, input) => {
    const el = $('.pnp-error');
    if (el) el.textContent = msg;
    card.querySelectorAll('.pnp-shake').forEach(other => other.classList.remove('pnp-shake'));
    if (input) {
      input.classList.remove('pnp-shake'); void input.offsetWidth; input.classList.add('pnp-shake');
      input.focus({ preventScroll: true });
    }
  };
  // The main button shows that something is happening.
  const run = async (task) => {
    if (busy) return;
    busy = true;
    const btn = $('.ea-main');
    if (btn) btn.disabled = true;
    try { await task(); } finally {
      busy = false;
      if (btn?.isConnected) btn.disabled = false;
    }
  };

  // "Renvoyer le code": once a minute.
  const startResendCountdown = () => {
    clearInterval(resendTimer);
    const btn = $('[data-resend]');
    if (!btn) return;
    const tick = () => {
      const left = Math.ceil((state.resendAt - Date.now()) / 1000);
      btn.disabled = left > 0;
      btn.textContent = left > 0
        ? tr(`Renvoyer le code (${left} s)`, `Send the code again (${left} s)`)
        : tr('Renvoyer le code', 'Send the code again');
      if (left <= 0) clearInterval(resendTimer);
    };
    tick();
    resendTimer = setInterval(tick, 1000);
  };

  const VIEWS = {
    signup: () => `
      <div class="cp-title">${tr('CRÉER UN COMPTE', 'CREATE AN ACCOUNT')}</div>
      ${field('ea-name', tr('Nom de joueur', 'Player name'), 'text',
        `maxlength="${PILOT_NAME_MAX}" autocomplete="nickname" autocapitalize="characters" spellcheck="false" placeholder="${tr('EX. : FAUCON 27', 'E.G. FALCON 27')}"`,
        tr('3 à 20 caractères. Les autres joueurs le verront : pas ton vrai nom.', '3 to 20 characters. Other players see it: not your real name.'))}
      <div class="ea-status" aria-live="polite"></div>
      ${field('ea-email', tr('Courriel', 'E-mail'), 'email', emailAttrs)}
      ${field('ea-password', tr(`Mot de passe (${PASSWORD_MIN} caractères minimum)`, `Password (${PASSWORD_MIN} characters minimum)`), 'password', passwordAttrs('new-password'))}
      ${field('ea-password2', tr('Confirmer le mot de passe', 'Confirm the password'), 'password', passwordAttrs('new-password'))}
      <div class="pnp-error" role="alert"></div>
      <button class="cp-btn ea-main" type="button"><span>${tr('CRÉER MON COMPTE', 'CREATE MY ACCOUNT')}</span></button>
      <button class="cp-later ea-link" type="button" data-go="login">${tr('J’ai déjà un compte', 'I already have an account')}</button>
      <button class="cp-later ea-link" type="button" data-close>${tr('Annuler', 'Cancel')}</button>`,
    code: () => `
      <div class="cp-title">${tr('VÉRIFIE TES COURRIELS', 'CHECK YOUR E-MAIL')}</div>
      <div class="cp-sub">${tr(
        `On t’a envoyé un code à 6 chiffres à<br><b>${esc(state.email)}</b><br>Regarde aussi dans les courriels indésirables.`,
        `We sent a 6-digit code to<br><b>${esc(state.email)}</b><br>Also look in your spam folder.`)}</div>
      ${field('ea-code', tr('Code', 'Code'), 'text', codeAttrs)}
      <div class="pnp-error" role="alert"></div>
      <button class="cp-btn ea-main" type="button"><span>${tr('VALIDER', 'CONFIRM')}</span></button>
      <button class="cp-later ea-link" type="button" data-resend></button>
      <button class="cp-later ea-link" type="button" data-go="signup">${tr('Changer de courriel', 'Use another e-mail')}</button>`,
    login: () => `
      <div class="cp-title">${tr('SE CONNECTER', 'SIGN IN')}</div>
      ${field('ea-email', tr('Courriel', 'E-mail'), 'email', emailAttrs)}
      ${field('ea-password', tr('Mot de passe', 'Password'), 'password', passwordAttrs('current-password'))}
      <div class="pnp-error" role="alert"></div>
      <button class="cp-btn ea-main" type="button"><span>${tr('SE CONNECTER', 'SIGN IN')}</span></button>
      <button class="cp-later ea-link" type="button" data-go="forgot">${tr('Mot de passe oublié ?', 'Forgot your password?')}</button>
      <button class="cp-later ea-link" type="button" data-go="signup">${tr('Créer un compte', 'Create an account')}</button>
      <button class="cp-later ea-link" type="button" data-close>${tr('Annuler', 'Cancel')}</button>`,
    forgot: () => `
      <div class="cp-title">${tr('MOT DE PASSE OUBLIÉ', 'FORGOT PASSWORD')}</div>
      <div class="cp-sub">${tr('Entre ton courriel : on t’envoie un code pour choisir un nouveau mot de passe.', 'Enter your e-mail: we send you a code to choose a new password.')}</div>
      ${field('ea-email', tr('Courriel', 'E-mail'), 'email', emailAttrs)}
      <div class="pnp-error" role="alert"></div>
      <button class="cp-btn ea-main" type="button"><span>${tr('ENVOYER LE CODE', 'SEND THE CODE')}</span></button>
      <button class="cp-later ea-link" type="button" data-go="login">${tr('Retour', 'Back')}</button>`,
    reset: () => `
      <div class="cp-title">${state.recoveryTitle ? tr('CRÉER UN MOT DE PASSE', 'CREATE A PASSWORD') : tr('NOUVEAU MOT DE PASSE', 'NEW PASSWORD')}</div>
      <div class="cp-sub">${tr(`Code envoyé à <b>${esc(state.email)}</b>.<br>Regarde aussi dans les courriels indésirables.`, `Code sent to <b>${esc(state.email)}</b>.<br>Also look in your spam folder.`)}</div>
      ${field('ea-code', tr('Code', 'Code'), 'text', codeAttrs)}
      ${field('ea-password', tr(`Nouveau mot de passe (${PASSWORD_MIN} caractères minimum)`, `New password (${PASSWORD_MIN} characters minimum)`), 'password', passwordAttrs('new-password'))}
      ${field('ea-password2', tr('Confirmer le mot de passe', 'Confirm the password'), 'password', passwordAttrs('new-password'))}
      <div class="pnp-error" role="alert"></div>
      <button class="cp-btn ea-main" type="button"><span>${tr('ENREGISTRER LE MOT DE PASSE', 'SAVE THE PASSWORD')}</span></button>
      <button class="cp-later ea-link" type="button" data-resend></button>
      <button class="cp-later ea-link" type="button" data-go="login">${tr('Retour', 'Back')}</button>`,
    exists: () => `
      <div class="cp-title">${tr('COURRIEL DÉJÀ UTILISÉ', 'E-MAIL ALREADY USED')}</div>
      <div class="cp-sub">${tr(
        `<b>${esc(state.email)}</b> a déjà un compte JexonGo (par exemple avec Google).<br>Connecte-toi pour retrouver ta progression.`,
        `<b>${esc(state.email)}</b> already has a JexonGo account (for example with Google).<br>Sign in to get your progress back.`)}</div>
      <button class="cp-btn ea-google" type="button">${GOOGLE_G}<span>${tr('SE CONNECTER AVEC GOOGLE', 'SIGN IN WITH GOOGLE')}</span></button>
      <button class="cp-btn ea-main ea-second" type="button" data-go="login"><span>${tr('J’AI UN MOT DE PASSE', 'I HAVE A PASSWORD')}</span></button>
      <div class="pnp-error" role="alert"></div>
      <button class="cp-later ea-link" type="button" data-create-password>${tr('Créer un mot de passe pour ce compte', 'Create a password for this account')}</button>
      <button class="cp-later ea-link" type="button" data-close>${tr('Annuler', 'Cancel')}</button>`,
  };

  const value = id => card.querySelector(`#${id}`)?.value || '';

  // A code goes out for the account's e-mail: the password view next.
  const sendRecoveryCode = async (recoveryTitle) => {
    const { error } = await sendPasswordResetCode(state.email);
    if (error) { showError(errorMessage(error)); return; }
    state.recoveryTitle = recoveryTitle;
    state.resendAt = Date.now() + RESEND_WAIT_MS;
    render('reset');
  };

  const ACTIONS = {
    signup: () => run(async () => {
      const nameInput = $('#ea-name');
      const name = cleanPilotName(nameInput.value);
      const email = cleanEmail(value('ea-email'));
      const password = value('ea-password');
      const nameError = pilotNameError(name, emailLocal(email));
      if (nameError) { showError(nameError, nameInput); return; }
      if (!isEmail(email)) { showError(tr('Ce courriel n’est pas valide.', 'This e-mail is not valid.'), $('#ea-email')); return; }
      if (password.length < PASSWORD_MIN) {
        showError(tr(`Mot de passe trop court : ${PASSWORD_MIN} caractères minimum.`, `Password too short: ${PASSWORD_MIN} characters minimum.`), $('#ea-password'));
        return;
      }
      if (password !== value('ea-password2')) {
        showError(tr('Les mots de passe sont différents.', 'The passwords don’t match.'), $('#ea-password2'));
        return;
      }
      if (await isPlayerNameAvailable(name) === false) { showError(nameTakenMessage(), nameInput); return; }
      state.email = email;
      const { data, error } = await signUpWithEmail(email, password, name, getLang());
      if (error) {
        if (EXISTING_EMAIL_CODES.includes(error.code)) render('exists');
        else showError(errorMessage(error));
        return;
      }
      // With "Confirm email" on, an e-mail that already has an account
      // gets a masked answer (no identity, no e-mail sent).
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        render('exists');
        return;
      }
      if (data?.session) { signedIn(data.session.user); return; }   // "Confirm email" turned off
      state.resendAt = Date.now() + RESEND_WAIT_MS;
      render('code');
    }),
    code: () => run(async () => {
      const token = value('ea-code').replace(/\D/g, '');
      if (token.length < 6) { showError(tr('Entre les 6 chiffres du code.', 'Enter the 6 digits of the code.'), $('#ea-code')); return; }
      const { data, error } = await verifyEmailCode(state.email, token, 'email');
      if (error || !data?.session) { showError(errorMessage(error), $('#ea-code')); return; }
      signedIn(data.session.user);
    }),
    login: () => run(async () => {
      const email = cleanEmail(value('ea-email'));
      const password = value('ea-password');
      if (!isEmail(email)) { showError(tr('Ce courriel n’est pas valide.', 'This e-mail is not valid.'), $('#ea-email')); return; }
      if (!password) { showError(tr('Entre ton mot de passe.', 'Enter your password.'), $('#ea-password')); return; }
      state.email = email;
      const { data, error } = await signInWithEmail(email, password);
      if (error?.code === 'email_not_confirmed') {
        // Account made but never confirmed: a new code, then the code view.
        await resendSignupCode(email);
        state.resendAt = Date.now() + RESEND_WAIT_MS;
        render('code');
        showError(tr('Ton courriel n’est pas encore confirmé : entre le code qu’on vient de t’envoyer.', 'Your e-mail is not confirmed yet: enter the code we just sent you.'));
        return;
      }
      if (error || !data?.session) { showError(errorMessage(error), $('#ea-password')); return; }
      signedIn(data.session.user);
    }),
    forgot: () => run(async () => {
      const email = cleanEmail(value('ea-email'));
      if (!isEmail(email)) { showError(tr('Ce courriel n’est pas valide.', 'This e-mail is not valid.'), $('#ea-email')); return; }
      state.email = email;
      await sendRecoveryCode(false);
    }),
    reset: () => run(async () => {
      const token = value('ea-code').replace(/\D/g, '');
      const password = value('ea-password');
      if (token.length < 6) { showError(tr('Entre les 6 chiffres du code.', 'Enter the 6 digits of the code.'), $('#ea-code')); return; }
      if (password.length < PASSWORD_MIN) {
        showError(tr(`Mot de passe trop court : ${PASSWORD_MIN} caractères minimum.`, `Password too short: ${PASSWORD_MIN} characters minimum.`), $('#ea-password'));
        return;
      }
      if (password !== value('ea-password2')) {
        showError(tr('Les mots de passe sont différents.', 'The passwords don’t match.'), $('#ea-password2'));
        return;
      }
      const verified = await verifyEmailCode(state.email, token, 'recovery');
      if (verified.error || !verified.data?.session) { showError(errorMessage(verified.error), $('#ea-code')); return; }
      const { error } = await updatePassword(password);
      if (error) { showError(errorMessage(error), $('#ea-password')); return; }
      signedIn(verified.data.session.user);
    }),
  };

  function render(view) {
    clearInterval(resendTimer);
    card.innerHTML = VIEWS[view]();
    card.dataset.view = view;
    // Values already typed follow from one view to the next.
    const emailInput = $('#ea-email');
    if (emailInput) emailInput.value = state.email;

    card.querySelectorAll('[data-eye]').forEach(btn => btn.addEventListener('click', () => {
      const input = card.querySelector(`#${btn.dataset.eye}`);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? tr('Cacher le mot de passe', 'Hide password') : tr('Afficher le mot de passe', 'Show password'));
    }));
    card.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => {
      const typed = $('#ea-email');
      if (typed) state.email = cleanEmail(typed.value);
      render(btn.dataset.go);
    }));
    card.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', close));
    $('.ea-google')?.addEventListener('click', () => { close(); onGoogle?.(); });
    $('[data-create-password]')?.addEventListener('click', () => run(() => sendRecoveryCode(true)));
    $('[data-resend]')?.addEventListener('click', () => run(async () => {
      if (Date.now() < state.resendAt) return;
      const { error } = view === 'reset' ? await sendPasswordResetCode(state.email) : await resendSignupCode(state.email);
      if (error) { showError(errorMessage(error)); return; }
      state.resendAt = Date.now() + RESEND_WAIT_MS;
      startResendCountdown();
      showError(tr('Nouveau code envoyé.', 'New code sent.'));
    }));
    startResendCountdown();

    const nameInput = $('#ea-name');
    if (nameInput) {
      const check = watchNameAvailability($('.ea-status'), () => cleanPilotName(nameInput.value),
        name => !pilotNameError(name, emailLocal(value('ea-email'))));
      nameInput.addEventListener('input', () => {
        const upper = nameInput.value.toUpperCase();
        if (upper !== nameInput.value) nameInput.value = upper;
        check();
      });
    }
    card.querySelectorAll('input').forEach(input => input.addEventListener('input', () => {
      const el = $('.pnp-error');
      if (el) el.textContent = '';
      input.classList.remove('pnp-shake');
    }));
    const action = ACTIONS[view];
    $('.ea-main:not([data-go])')?.addEventListener('click', () => action?.());
    card.querySelectorAll('input').forEach(input => input.addEventListener('keydown', e => {
      if (e.key === 'Enter') action?.();
    }));
    setTimeout(() => card.querySelector('input:not([value])')?.focus({ preventScroll: true }), 400);
    if (view === 'login' && state.email) setTimeout(() => $('#ea-password')?.focus({ preventScroll: true }), 420);
  }

  render(VIEWS[view] ? view : 'login');
  return { close };
}
