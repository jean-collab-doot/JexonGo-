import { load } from './utils/storage.js';

export const G = {
  // --- Persisted ---
  xp: 0,
  totalXpEarned: 0, // cumulative XP earned (never decremented — used for pilot grade)
  coins: 500,
  blueprints: {},
  chestsWithoutEpic: 0,
  levelStars: {},
  unlockedAircraft: ['t6'],
  activeAircraft: 't6',
  ownedSkins: [],
  activeSkin: null,
  playerGrade: 0,       // 0 = not selected, 1-6 = school grade
  highestLevel: 0,      // highest level beaten (drives pilot grade)

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
  playerName:       'PILOT',
  playerEmail:      '',
  playerPhoto:      '',
  playerAge:        0,
  playerRegistered: false,
  currentWeather: null,

  // --- Session ---
  currentLevel: 1,
  practiceMode: false,
  practiceOps:       ['+', '-', '*', '/'],
  practiceHearts:    true,
  practiceTimeLimit: 10,   // seconds per question; null = unlimited
  continueState: null,

  // --- In-game (reset each level) ---
  lives: 3,
  questionsAnswered: 0,
  correctAnswers: 0,
  streak: 0,
  timeLeft: 10,
  timerInterval: null,
  animFrame: null,
  answerLocked: false,
  missileHitsReceived: 0,   // counts enemy missile hits this level (for 3-star)

  // --- Entities ---
  player: { x: 0, y: 0 },
  enemies: [],
  missiles: [],
  enemyMissiles: [],
  particles: [],
};

export function loadSave() {
  G.xp                = load('xp', 0);
  G.totalXpEarned     = load('totalXpEarned', G.xp); // fallback to current xp for existing saves
  G.coins             = load('coins', 0);
  G.blueprints        = load('blueprints', {});
  G.chestsWithoutEpic = load('chestsWithoutEpic', 0);
  G.levelStars        = load('levelStars', {});
  G.unlockedAircraft  = load('unlockedAircraft', ['t6']);
  G.activeAircraft    = load('activeAircraft', 't6');
  G.ownedSkins        = load('ownedSkins', []);
  G.activeSkin        = load('activeSkin', null);
  G.playerName        = load('playerName', 'PILOT');
  G.playerEmail       = load('playerEmail', '');
  G.playerPhoto       = load('playerPhoto', '');
  G.playerAge         = load('playerAge', 0);
  G.playerRegistered  = load('playerRegistered', false);
  G.playerGrade       = load('playerGrade', 0);
  G.highestLevel      = load('highestLevel', 0);
  G.practiceTimeLimit = load('practiceTimeLimit', 10);
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
  G.lives              = 3;
  G.questionsAnswered  = 0;
  G.correctAnswers     = 0;
  G.streak             = 0;
  G.timeLeft           = 10;
  G.answerLocked       = false;
  G.missileHitsReceived = 0;
  G.enemies            = [];
  G.missiles           = [];
  G.enemyMissiles      = [];
  G.particles          = [];
  if (G.timerInterval) { clearInterval(G.timerInterval); G.timerInterval = null; }
  if (G.animFrame)     { cancelAnimationFrame(G.animFrame); G.animFrame = null; }
}
