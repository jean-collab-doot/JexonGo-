// Tanker banner (game/tanker.js, game.js): a message under the top bar with
// the seconds left to connect, the wait for the teammate, or the refuel
// progress. Rainbow letters for the youngest players.
import { getLang } from '../i18n.js';
import { gentleFx } from '../game/glitter.js';

const isFr = () => getLang() === 'fr';

function banner() {
  let el = document.getElementById('tanker-banner');
  if (el) return el;
  const host = document.getElementById('s-game');
  if (!host) return null;
  el = document.createElement('div');
  el.id = 'tanker-banner';
  el.className = 'tanker-banner';
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<b class="tb-title"></b><span class="tb-value"></span>';
  host.appendChild(el);
  return el;
}

let _last = '';
// state: { mode: 'connect' | 'mate' | 'refuel', seconds, pct } or null.
export function setTankerBanner(state) {
  const el = state ? banner() : document.getElementById('tanker-banner');
  if (!el) return;
  if (!state) { el.classList.remove('is-on'); _last = ''; return; }
  const fr = isFr();
  const title = state.mode === 'connect' ? (fr ? 'ACCROCHE-TOI AU PANIER !' : 'CONNECT TO THE BASKET!')
    : state.mode === 'mate' ? (fr ? 'EN ATTENTE DU COÉQUIPIER' : 'WAITING FOR TEAMMATE')
      : (fr ? 'RAVITAILLEMENT…' : 'REFUELING…');
  const value = state.mode === 'refuel' ? `${Math.round(state.pct)}${fr ? ' %' : '%'}` : `${Math.max(0, Math.ceil(state.seconds))}`;
  const key = `${state.mode}|${title}|${value}`;
  el.classList.add('is-on');
  el.classList.toggle('is-gentle', gentleFx());
  el.dataset.mode = state.mode;
  if (key === _last) return;
  const prev = _last.split('|')[2];
  _last = key;
  el.querySelector('.tb-title').textContent = title;
  const v = el.querySelector('.tb-value');
  v.textContent = value;
  if (state.mode !== 'refuel' && prev !== value) { v.classList.remove('is-tick'); void v.offsetWidth; v.classList.add('is-tick'); }
}
