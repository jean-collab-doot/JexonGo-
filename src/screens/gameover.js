import { $ } from '../utils/dom.js';
import { G } from '../state.js';

export function initGameover(nav) {
  $('btn-retry').onclick  = () => nav.toGame(G.currentLevel, G.practiceMode);
  $('btn-go-map').onclick = () => G.practiceMode ? nav.toMenu() : nav.toMap();
}

export function showGameover() {
  $('gameover-title').textContent = 'GAME OVER';
  $('gameover-score').textContent = `${G.correctAnswers} / 10 correct`;
}
