import { G, loadSave } from './state.js';
import { showScreen } from './utils/dom.js';
import { initMenu, renderMenu } from './screens/menu.js';
import { initLevelMap, renderLevelMap } from './screens/levelmap.js';
import { initHangar, renderHangar } from './screens/hangar.js';
import { initGame } from './screens/game.js';
import { initResult, showResult } from './screens/result.js';
import { initChest, showChest } from './screens/chest.js';
import { initGameover, showGameover } from './screens/gameover.js';
import { preloadShips } from './game/sprites.js';

// ── NAVIGATION ──────────────────────────────────────────────────────────────
let _cleanup = null;

const nav = {
  toMenu() {
    cleanup();
    renderMenu();
    showScreen('s-menu');
  },
  toMap() {
    cleanup();
    renderLevelMap();
    showScreen('s-levelmap');
  },
  toGame(levelNum, practiceMode = false) {
    cleanup();
    G.practiceMode = practiceMode;
    showScreen('s-game');
    _cleanup = initGame(levelNum, (won) => {
      if (won) {
        showResult(true);
        showScreen('s-result');
      } else {
        showGameover();
        showScreen('s-gameover');
      }
    });
  },
  toHangar() {
    cleanup();
    renderHangar();
    showScreen('s-hangar');
  },
  toChest(reward) {
    cleanup();
    showChest(reward);
    showScreen('s-chest');
  },
};

function cleanup() {
  if (_cleanup) { _cleanup(); _cleanup = null; }
}

// Expose nav globally for levelmap node clicks
window._nav = nav;

// ── INIT ALL SCREENS ─────────────────────────────────────────────────────────
initMenu(nav);
initLevelMap(nav);
initHangar(nav);
initResult(nav);
initChest(nav);
initGameover(nav);

// ── BOOT ──────────────────────────────────────────────────────────────────────
loadSave();

// Start loading ship sprites immediately so the hangar looks good right away
preloadShips();

renderMenu();
showScreen('s-menu');
