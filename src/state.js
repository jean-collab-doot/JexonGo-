import { load } from './utils/storage.js';

export const G = {
  // --- Persisted ---
  xp: 0,
  coins: 500,
  blueprints: {},
  chestsWithoutEpic: 0,
  levelStars: {},
  unlockedAircraft: ['t6'],
  activeAircraft: 't6',
  ownedSkins: [],
  activeSkin: null,

  // --- Daily economy ---
  dailyLastLogin:   null,
  dailyStreak:      0,
  dailyMissions:    null,
  dailyMissionDate: null,
  claimedRanks:     [],

  // --- Ranked ---
  rankedLP:            0,
  rankedWins:          0,
  rankedLosses:        0,
  rankedWinStreak:     0,
  rankedGamesPlayed:   0,
  rankedSeasonStart:   null,
  rankedFirstWinToday: null,

  // --- Profile ---
  playerName: 'PILOT',
  currentWeather: null,

  // --- Session ---
  currentLevel: 1,
  practiceMode: false,
  practiceOps:    ['+', '-', '*', '/'],
  practiceHearts: true,
  continueState: null,   // saved snapshot for the Continue button

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
  G.coins             = load('coins', 500);
  G.blueprints        = load('blueprints', {});
  G.chestsWithoutEpic = load('chestsWithoutEpic', 0);
  G.levelStars        = load('levelStars', {});
  G.unlockedAircraft  = load('unlockedAircraft', ['t6']);
  G.activeAircraft    = load('activeAircraft', 't6');
  G.ownedSkins        = load('ownedSkins', []);
  G.activeSkin        = load('activeSkin', null);
  G.playerName        = load('playerName', 'PILOT');
  G.dailyLastLogin    = load('dailyLastLogin', null);
  G.dailyStreak       = load('dailyStreak', 0);
  G.dailyMissions     = load('dailyMissions', null);
  G.dailyMissionDate  = load('dailyMissionDate', null);
  G.claimedRanks      = load('claimedRanks', []);
  G.rankedLP            = load('rankedLP', 0);
  G.rankedWins          = load('rankedWins', 0);
  G.rankedLosses        = load('rankedLosses', 0);
  G.rankedWinStreak     = load('rankedWinStreak', 0);
  G.rankedGamesPlayed   = load('rankedGamesPlayed', 0);
  G.rankedSeasonStart   = load('rankedSeasonStart', null);
  G.rankedFirstWinToday = load('rankedFirstWinToday', null);
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
