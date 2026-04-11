import { load } from './utils/storage.js';

export const G = {
  // --- Persisted ---
  xp: 0,
  levelStars: {},           // { levelNum: starCount }
  unlockedAircraft: ['f22', 't6'],
  activeAircraft: 't6',

  // --- Session ---
  currentLevel: 1,
  practiceMode: false,

  // --- In-game (reset each level) ---
  lives: 3,
  questionsAnswered: 0,
  correctAnswers: 0,
  streak: 0,
  timeLeft: 10,
  timerInterval: null,
  animFrame: null,
  answerLocked: false,

  // --- Entities ---
  player: { x: 0, y: 0 },
  enemies: [],
  missiles: [],
  enemyMissiles: [],
  particles: [],
};

export function loadSave() {
  G.xp                = load('xp', 0);
  G.levelStars        = load('levelStars', {});
  G.unlockedAircraft  = load('unlockedAircraft', ['t6']);
  G.activeAircraft    = load('activeAircraft', 't6');
}

export function resetLevel() {
  G.lives           = 3;
  G.questionsAnswered = 0;
  G.correctAnswers  = 0;
  G.streak          = 0;
  G.timeLeft        = 10;
  G.answerLocked    = false;
  G.enemies         = [];
  G.missiles        = [];
  G.enemyMissiles   = [];
  G.particles       = [];
  if (G.timerInterval) { clearInterval(G.timerInterval); G.timerInterval = null; }
  if (G.animFrame)     { cancelAnimationFrame(G.animFrame); G.animFrame = null; }
}
