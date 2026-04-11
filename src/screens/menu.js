import { $ } from '../utils/dom.js';
import { G } from '../state.js';

export function initMenu(nav) {
  $('btn-play').onclick     = () => nav.toMap();
  $('btn-hangar').onclick   = () => nav.toHangar();
  $('btn-practice').onclick = () => nav.toGame(1, true);
}

export function renderMenu() {
  $('menu-xp').textContent     = G.xp.toLocaleString();
  $('menu-levels').textContent = Object.keys(G.levelStars).length;
  const totalStars             = Object.values(G.levelStars).reduce((s, v) => s + v, 0);
  $('menu-stars').textContent  = totalStars;
}
