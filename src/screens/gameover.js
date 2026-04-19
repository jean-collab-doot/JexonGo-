import { $ } from '../utils/dom.js';
import { G } from '../state.js';

export function initGameover(nav) {
  $('btn-retry').onclick         = () => { G.continueState = null; nav.toGame(G.currentLevel, G.practiceMode); };
  $('btn-go-map').onclick        = () => nav.toMenu();
}

const POSITIVE_MSGS = [
  'KEEP GOING!',
  'YOU CAN DO IT!',
  'ALMOST THERE!',
  'NEVER GIVE UP!',
  'TRY AGAIN!',
  'BELIEVE IN YOURSELF!',
];

export function showGameover() {
  const msg = POSITIVE_MSGS[Math.floor(Math.random() * POSITIVE_MSGS.length)];
  $('gameover-title').textContent = msg;
  $('gameover-score').textContent = `${G.correctAnswers} correct — keep practising!`;

}
