import { load, save } from './utils/storage.js';

export const G = {
  // --- Persisted ---
  xp: 0,
  totalXpEarned: 0, // cumulative XP earned (never decremented — used for pilot grade)
  coins: 500,
  blueprints: {},
  chestsWithoutEpic: 0,
  levelStars: {},
  unlockedAircraft: ['t6','pc21','c130','a10','f16','f18','f22','f35','b2','sr71'],
  activeAircraft: 't6',
  ownedSkins: [],
  activeSkin: null,    // shop image skin (FURTIF, SPACE, etc.)
  activeLivery: null,  // hangar filter livery (independent)
  playerGrade: 0,       // 0 = not selected, 1-6 = school grade
  highestLevel: 0,      // highest level beaten (drives pilot grade)
  prestige: 0,          // 0–5 prestige level
  sr71Earned: false,         // true once all 30 levels completed with zero wrong answers
  sr71MissionClaimed: false, // true once the SR-71 challenge mission reward is claimed
  sr71WrongAnswers: 0,       // cumulative wrong answers during a level-1→30 run
  sr71MissileHits: 0,        // cumulative missile hits during a level-1→30 run
  sr71CleanLevels: [],       // levels 1-30 completed with no wrong answers & no hits

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
  pilotEmblem:      '✈',
  pilotMotto:       '',
  profileTheme:     'default',
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
  sessionXP: 0,
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
  G.totalXpEarned     = load('totalXpEarned', G.xp);
  G.coins             = load('coins', 0);
  G.blueprints        = load('blueprints', {});
  G.chestsWithoutEpic = load('chestsWithoutEpic', 0);
  G.levelStars        = load('levelStars', {});
  G.unlockedAircraft  = ['t6','pc21','c130','a10','f16','f18','f22','f35','b2','sr71'];
  G.activeAircraft    = load('activeAircraft', 't6');
  G.ownedSkins        = load('ownedSkins', []);
  G.activeSkin        = load('activeSkin', null);
  G.activeLivery      = load('activeLivery', null);
  G.prestige          = load('prestige', 0);
  G.sr71Earned           = load('sr71Earned', false);
  G.sr71MissionClaimed   = load('sr71MissionClaimed', false);
  G.sr71WrongAnswers     = load('sr71WrongAnswers', 0);
  G.sr71MissileHits      = load('sr71MissileHits', 0);
  G.sr71CleanLevels      = load('sr71CleanLevels', []);
  G.playerName        = load('playerName', 'PILOT');
  G.playerEmail       = load('playerEmail', '');
  G.playerPhoto       = load('playerPhoto', '');
  G.playerAge         = load('playerAge', 0);
  G.playerRegistered  = load('playerRegistered', false);
  G.playerGrade       = load('playerGrade', 0);
  G.pilotEmblem       = load('pilotEmblem',  '✈');
  G.pilotMotto        = load('pilotMotto',   '');
  G.profileTheme      = load('profileTheme', 'default');
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

export function saveAll() {
  save('xp',                G.xp);
  save('totalXpEarned',     G.totalXpEarned);
  save('coins',             G.coins);
  save('blueprints',        G.blueprints);
  save('chestsWithoutEpic', G.chestsWithoutEpic);
  save('levelStars',        G.levelStars);
  save('unlockedAircraft',  G.unlockedAircraft);
  save('activeAircraft',    G.activeAircraft);
  save('ownedSkins',        G.ownedSkins);
  save('activeSkin',        G.activeSkin);
  save('activeLivery',      G.activeLivery);
  save('prestige',          G.prestige);
  save('sr71Earned',        G.sr71Earned);
  save('playerName',        G.playerName);
  save('playerEmail',       G.playerEmail);
  save('playerPhoto',       G.playerPhoto);
  save('playerAge',         G.playerAge);
  save('playerRegistered',  G.playerRegistered);
  save('playerGrade',       G.playerGrade);
  save('pilotEmblem',       G.pilotEmblem);
  save('pilotMotto',        G.pilotMotto);
  save('profileTheme',      G.profileTheme);
  save('highestLevel',      G.highestLevel);
  save('practiceTimeLimit', G.practiceTimeLimit);
  save('dailyLastLogin',    G.dailyLastLogin);
  save('dailyStreak',       G.dailyStreak);
  save('dailyMissions',     G.dailyMissions);
  save('dailyMissionDate',  G.dailyMissionDate);
  save('claimedRanks',      G.claimedRanks);
  save('rankedLP',          G.rankedLP);
  save('rankedWins',        G.rankedWins);
  save('rankedLosses',      G.rankedLosses);
  save('rankedWinStreak',   G.rankedWinStreak);
  save('rankedGamesPlayed', G.rankedGamesPlayed);
  save('rankedSeasonStart', G.rankedSeasonStart);
  save('rankedFirstWinToday', G.rankedFirstWinToday);
}

export function resetLevel() {
  G.lives              = 3;
  G.questionsAnswered  = 0;
  G.correctAnswers     = 0;
  G.sessionXP          = 0;
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
