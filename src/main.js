import { G, loadSave } from './state.js';
import { showScreen } from './utils/dom.js';
import { SFX } from './audio/sound.js';
import { initMenu, renderMenu } from './screens/menu.js';
import { initLevelMap, renderLevelMap } from './screens/levelmap.js';
import { initHangar, renderHangar } from './screens/hangar.js';
import { initGame } from './screens/game.js';
import { initResult, showResult } from './screens/result.js';
import { initChest, showChest } from './screens/chest.js';
import { initGameover, showGameover } from './screens/gameover.js';
import { initShop, renderShop } from './screens/shop.js';
import { initSettings, loadSettings } from './screens/settings.js';
import { initRanked, renderRankedLobby } from './screens/ranked.js';
import { initBriefing, showBriefing } from './screens/briefing.js';
import { initClassroom, renderClassroom } from './screens/classroom.js';
import { initArena, enterArena } from './screens/arena.js';
import { preloadShips } from './game/sprites.js';
import { checkDailyLogin } from './systems/daily.js';
import { showDailyReward } from './screens/menu.js';

// ── NAVIGATION ──────────────────────────────────────────────────────────────
let _cleanup = null;

const nav = {
  toMenu() {
    cleanup();
    renderMenu();
    showScreen('s-menu');
    SFX.playMusic('menu');
  },
  toMap() {
    cleanup();
    renderLevelMap();
    showScreen('s-levelmap');
    SFX.playMusic('menu');
  },
  toGame(levelNum, practiceMode = false) {
    cleanup();
    G.practiceMode = practiceMode;
    showScreen('s-game');
    SFX.playMusic('game');
    _cleanup = initGame(levelNum, (won) => {
      cleanup();                         // stop game loop and all timers immediately
      if (won) {
        showResult(true);
        showScreen('s-result');
        SFX.stopMusic();
      } else {
        showGameover();
        showScreen('s-gameover');
        SFX.stopMusic();
        SFX.gameOver();
      }
    });
  },
  toHangar() {
    cleanup();
    renderHangar();
    showScreen('s-hangar');
    SFX.playMusic('menu');
  },
  toChest(reward) {
    cleanup();
    showChest(reward);
    showScreen('s-chest');
    SFX.playMusic('menu');
  },
  toShop() {
    cleanup();
    renderShop();
    showScreen('s-shop');
    SFX.playMusic('menu');
  },
  toRanked() {
    cleanup();
    renderRankedLobby();
    showScreen('s-ranked');
    SFX.playMusic('menu');
  },
  toBriefing(levelNum) {
    cleanup();
    showBriefing(levelNum);
    showScreen('s-briefing');
    SFX.playMusic('menu');
  },
  toClassroom() {
    cleanup();
    renderClassroom();
    showScreen('s-classroom');
    SFX.playMusic('menu');
  },
  toArena() {
    cleanup();
    showScreen('s-arena');
    enterArena();   // handles music internally via SFX.playMusic('arena')
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
initShop(nav);
initSettings();
initRanked(nav);
initBriefing(nav);
initClassroom(nav);
initArena(nav);

// ── GLOBAL BUTTON CLICK SOUND ─────────────────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (btn && btn.id !== 'btn-audio-start') SFX.click();
}, true);

// ── BOOT ──────────────────────────────────────────────────────────────────────
loadSave();
loadSettings();
preloadShips();

// Audio splash — must be clicked first to satisfy browser autoplay policy
document.getElementById('btn-audio-start').addEventListener('click', () => {
  SFX.unlock();                          // warm up AudioContext inside gesture
  SFX.playMusic('menu');                 // start music NOW — still inside gesture
  document.getElementById('audio-splash').classList.add('hidden');
  renderMenu();
  showScreen('s-menu');
  const _daily = checkDailyLogin();
  if (_daily.isNewDay) {
    setTimeout(() => showDailyReward(_daily.reward, _daily.streak), 600);
  }
});
