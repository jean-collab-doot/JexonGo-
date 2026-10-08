// Age check before a Google sign-in creates or opens an account. Under 13, a
// parent or guardian must agree first (privacy policy, section 9). Asked once
// per device: the answer (and the date a parent agreed) is saved with the
// player's data and synced to their cloud save. Kept apart from playerAge,
// which tunes the game difficulty (age-modifiers.js): this answer must not
// change how the game plays.
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { t } from '../i18n.js';
import { showScreen } from '../utils/dom.js';

export const PARENT_CONSENT_AGE = 13;

function alreadyAnswered() {
  const age = Number(G.consentAge) || 0;
  return age > 0 && (age >= PARENT_CONSENT_AGE || !!G.parentConsentAt);
}

/** Resolves true to go on with the Google sign-in, false if cancelled. */
export function askAgeBeforeSignIn() {
  if (alreadyAnswered()) return Promise.resolve(true);
  const modal = document.getElementById('age-gate-modal');
  if (!modal) return Promise.resolve(true);

  const ageSelect = document.getElementById('age-gate-age');
  const parentRow = document.getElementById('age-gate-parent-row');
  const parentBox = document.getElementById('age-gate-parent');
  const error = document.getElementById('age-gate-error');

  ageSelect.value = G.consentAge ? String(Math.min(18, G.consentAge)) : '';
  parentBox.checked = false;
  error.textContent = '';
  const syncParentRow = () => {
    const age = parseInt(ageSelect.value, 10);
    parentRow.classList.toggle('hidden', !(age && age < PARENT_CONSENT_AGE));
  };
  syncParentRow();
  ageSelect.onchange = syncParentRow;
  modal.classList.remove('hidden');

  return new Promise(resolve => {
    const close = result => {
      modal.classList.add('hidden');
      resolve(result);
    };
    document.getElementById('btn-age-gate-cancel').onclick = () => close(false);
    // The policy opens on its own screen; the player signs in again after.
    document.getElementById('btn-age-gate-policy').onclick = () => {
      close(false);
      showScreen('s-privacy');
    };
    document.getElementById('btn-age-gate-continue').onclick = () => {
      const age = parseInt(ageSelect.value, 10);
      if (!age) { error.textContent = t('ageGateErrAge'); return; }
      if (age < PARENT_CONSENT_AGE && !parentBox.checked) {
        error.textContent = t('ageGateErrParent');
        return;
      }
      G.consentAge = age;
      save('consentAge', age);
      if (age < PARENT_CONSENT_AGE) {
        G.parentConsentAt = new Date().toISOString();
        save('parentConsentAt', G.parentConsentAt);
      }
      close(true);
    };
  });
}
