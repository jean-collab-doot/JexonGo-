// Lobby ERREURS button: a practice game (outside the levels, no rewards)
// whose questions are the player's old mistakes (systems/session-report.js
// notebook). The badge shows how many are waiting; with none, a tap says so.
import { $ } from '../utils/dom.js';
import { getLang } from '../i18n.js';
import { SFX } from '../audio/sound.js';
import { notebookSize } from '../systems/session-report.js';

// startReview: main.js starts the practice game with G.mistakesReview set.
export function initMistakesLobby(startReview) {
  $('btn-lobby-mistakes')?.addEventListener('click', () => {
    if (!notebookSize()) {
      SFX.noMoney?.();
      const fr = getLang() === 'fr';
      window._showToast?.(fr ? 'Aucune erreur à revoir pour l’instant. Joue une partie !' : 'No mistakes to review yet. Play a game!');
      return;
    }
    SFX.click?.();
    startReview();
  });
}

// Lobby shown (menu.js renderMenu): the number of mistakes on the badge.
export function updateMistakesButton() {
  const btn = $('btn-lobby-mistakes');
  if (!btn) return;
  const count = notebookSize();
  const fr = getLang() === 'fr';
  const label = $('jx-mistakes-label');
  if (label) label.textContent = fr ? 'ERREURS' : 'MISTAKES';
  btn.setAttribute('aria-label', fr ? `Revoir mes erreurs (${count})` : `Review my mistakes (${count})`);
  btn.classList.toggle('is-empty', !count);
  const badge = $('jx-mistakes-count');
  if (badge) {
    badge.textContent = String(count);
    badge.classList.toggle('hidden', !count);
  }
}
