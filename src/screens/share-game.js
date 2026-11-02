// Settings > LIEN DU JEU: the game's address, to copy or share with someone
// who could like JexonGo. A plain link: it changes nothing in the game.
import { getLang } from '../i18n.js';

const GAME_URL = 'https://jexongo.app';

// Text copied: the clipboard, or the selected field on old browsers.
async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    input.select();
    try { return document.execCommand('copy'); } catch (__) { return false; }
  }
}

export function openShareGame() {
  const fr = getLang() === 'fr';
  const overlay = document.createElement('div');
  overlay.className = 'mr-overlay lm-overlay';
  overlay.innerHTML = `
    <div class="mr-card lm-card" role="dialog" aria-modal="true" aria-label="${fr ? 'Lien du jeu' : 'Game link'}">
      <div class="mr-head"><span>${fr ? 'LIEN DU JEU' : 'GAME LINK'}</span><button type="button" class="lm-close" aria-label="${fr ? 'Fermer' : 'Close'}">✕</button></div>
      <p class="lm-help">${fr
        ? 'Envoie ce lien à quelqu’un que JexonGo pourrait intéresser.'
        : 'Send this link to someone who might like JexonGo.'}</p>
      <input class="lm-link" type="text" readonly value="${GAME_URL}" aria-label="${fr ? 'Lien' : 'Link'}">
      <div class="lm-actions">
        <button type="button" class="mr-next lm-copy">${fr ? 'COPIER' : 'COPY'}</button>
        ${navigator.share ? `<button type="button" class="mr-next lm-share">${fr ? 'PARTAGER' : 'SHARE'}</button>` : ''}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 220);
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('.lm-close').addEventListener('click', close);

  const input = overlay.querySelector('.lm-link');
  input.addEventListener('focus', () => input.select());
  const copyBtn = overlay.querySelector('.lm-copy');
  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(GAME_URL, input);
    copyBtn.textContent = ok ? (fr ? 'COPIÉ !' : 'COPIED!') : (fr ? 'COPIE LE TEXTE' : 'COPY THE TEXT');
    setTimeout(() => { if (copyBtn.isConnected) copyBtn.textContent = fr ? 'COPIER' : 'COPY'; }, 1600);
  });
  overlay.querySelector('.lm-share')?.addEventListener('click', () => {
    navigator.share({
      title: 'JexonGo',
      text: fr ? 'Viens jouer à JexonGo, le jeu de calcul mental !' : 'Come and play JexonGo, the mental math game!',
      url: GAME_URL,
    }).catch(() => {});
  });
}
