import { load, save } from './utils/storage.js';
import { AIRCRAFT } from './data/aircraft.js';

// Tournament event window - edit these two dates to reactivate for future events.
export const AIR_CUP_START = new Date('2026-06-11T00:00:00Z').getTime();
export const AIR_CUP_END   = new Date('2026-07-15T23:59:59Z').getTime();

export const IS_AIR_CUP_ACTIVE =
  Date.now() >= AIR_CUP_START && Date.now() <= AIR_CUP_END;

const DEFAULT_UNLOCKED_AIRCRAFT = [
  't6',
];

function withDefaultUnlockedAircraft(list) {
  const unlocked = Array.isArray(list) ? [...list] : [];
  for (const id of DEFAULT_UNLOCKED_AIRCRAFT) {
    if (!unlocked.includes(id)) unlocked.push(id);
  }
  return unlocked;
}

export const MAX_COINS = 99999;
const STARTING_COINS = 0;

export function clampCoins(value) {
  const n = Number(value) || 0;
  return Math.max(0, Math.min(MAX_COINS, Math.floor(n)));
}

export const G = {
  // --- Persisted ---
  xp: 0,
  totalXpEarned: 0, // cumulative XP earned (never decremented — used for pilot grade)
  coins: STARTING_COINS,
  blueprints: {},
  chestsWithoutEpic: 0,
  levelStars: {},
  unlockedAircraft: [...DEFAULT_UNLOCKED_AIRCRAFT],
  acquiredAircraft: [],
  activeAircraft: 't6',
  unlockedBadges: [], activeBadge: null, totalCorrectAnswers: 0, bestAnswerStreak: 0,
  comboAcePermanent: false, secretAircraftUnlocked: false,
  ownedShootingPlans: ['default'],
  activeShootingPlan: 'default',
  ownedMissileTypes: [],
  activeMissileType: 'default',
  playerGrade: 0,       // 0 = not selected, 1-6 = school grade
  highestLevel: 0,      // highest level beaten (drives pilot grade)
  sr71Earned: false,         // true once all 30 levels completed with zero wrong answers
  sr71MissionClaimed: false, // true once the SR-71 challenge mission reward is claimed
  sr71WrongAnswers: 0,       // cumulative wrong answers during a level-1→30 run
  sr71MissileHits: 0,        // cumulative missile hits during a level-1→30 run
  sr71CleanLevels: [],       // levels 1-30 completed with no wrong answers & no hits

  // --- Daily economy ---
  dailyLastLogin:   null,
  dailyStreak:      0,
  dailyStarterPlanComplete: false,
  dailyMissions:    null,
  dailyMissionDate: null,
  playMinutesByDay: {},
  monthlyChallenge: null,
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
  hasSeenOnboarding: false,
  hasSeenBriefing: false,
  likesMath: true,
  onboardingAgeGroup: 0,
  onboardingGrade: 1,
  focusOperation: null,
  focusOperations: [],
  pendingPlacement: false,
  tutorialMode: false,
  onboardingStartMode: 'bases',
  onboardingLevelLength: 'normal',
  dailyGoalMinutes: 5,
  tutorialPlan: null,
  tutorialProgress: null,
  tutorialCompleted: false,
  postTutorialConnectPrompt: false,

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
  mobileLoop: null,
  pausedGameResume: null,
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
  // Always load identity first so login state is known
  G.playerRegistered  = load('playerRegistered', false);
  G.playerName        = load('playerName', 'PILOT');
  G.playerEmail       = load('playerEmail', '');
  G.playerPhoto       = load('playerPhoto', '');
  G.playerAge         = load('playerAge', 0);
  G.playerGrade       = load('playerGrade', 0);
  G.pilotEmblem       = load('pilotEmblem', '✈');
  G.pilotMotto        = load('pilotMotto', '');
  G.profileTheme      = load('profileTheme', 'default');
  G.practiceTimeLimit = load('practiceTimeLimit', 10);
  G.hasSeenOnboarding = load('hasSeenOnboarding', false);
  G.hasSeenBriefing   = load('hasSeenBriefing', false);
  G.likesMath         = load('likesMath', true);
  G.onboardingAgeGroup = load('onboardingAgeGroup', 0);
  G.onboardingGrade   = load('onboardingGrade', 1);
  G.focusOperation    = load('focusOperation', '') || null;
  G.focusOperations   = load('focusOperations', []);
  if (!G.focusOperations.length && G.focusOperation) G.focusOperations = [G.focusOperation];
  G.pendingPlacement  = load('pendingPlacement', false);
  G.tutorialMode      = load('tutorialMode', false);
  G.onboardingStartMode = load('onboardingStartMode', 'bases');
  G.onboardingLevelLength = load('onboardingLevelLength', 'normal');
  G.dailyGoalMinutes  = load('dailyGoalMinutes', 5);
  G.tutorialPlan      = load('tutorialPlan', null);
  G.tutorialProgress  = load('tutorialProgress', null);
  G.tutorialCompleted = load('tutorialCompleted', false);
  G.postTutorialConnectPrompt = load('postTutorialConnectPrompt', false);

  if (!G.playerRegistered) {
    // Guest — reset all progression to zero, never load saved progress
    G.xp = 0; G.totalXpEarned = 0; G.coins = STARTING_COINS;
    G.blueprints = {}; G.chestsWithoutEpic = 0; G.levelStars = {};
    G.unlockedAircraft = withDefaultUnlockedAircraft(['t6']); G.activeAircraft = 't6';
    G.acquiredAircraft = [];
    G.unlockedBadges = []; G.activeBadge = null;
    G.ownedShootingPlans = ['default']; G.activeShootingPlan = 'default'; G.ownedMissileTypes = []; G.activeMissileType = 'default';
    G.highestLevel = 0;
    G.sr71Earned = false; G.sr71MissionClaimed = false;
    G.sr71WrongAnswers = 0; G.sr71MissileHits = 0; G.sr71CleanLevels = [];
    G.dailyLastLogin = null; G.dailyStreak = 0; G.dailyStarterPlanComplete = false;
    G.dailyMissions = null; G.dailyMissionDate = null; G.claimedRanks = [];
    G.rankedLP = 0; G.rankedWins = 0; G.rankedLosses = 0;
    G.rankedWinStreak = 0; G.rankedGamesPlayed = 0;
    G.rankedSeasonStart = null; G.rankedFirstWinToday = null;
    return;
  }

  G.xp                = load('xp', 0);
  G.totalXpEarned     = load('totalXpEarned', G.xp);
  G.coins             = clampCoins(Math.max(load('coins', STARTING_COINS), STARTING_COINS));
  G.blueprints        = load('blueprints', {});
  G.chestsWithoutEpic = load('chestsWithoutEpic', 0);
  G.levelStars        = load('levelStars', {});
  G.unlockedAircraft  = withDefaultUnlockedAircraft(load('unlockedAircraft', DEFAULT_UNLOCKED_AIRCRAFT));
  G.acquiredAircraft = load('acquiredAircraft', []);
  if (!Array.isArray(G.acquiredAircraft)) G.acquiredAircraft = [];
  G.activeAircraft    = load('activeAircraft', 't6');
  G.unlockedBadges = load('unlockedBadges', []);
  if (load('aircraftProgressionVersion', 1) < 2) {
    const migratedAircraft = [...DEFAULT_UNLOCKED_AIRCRAFT];
    if (load('sr71Earned', false)) migratedAircraft.push('sr71');
    if (G.unlockedBadges.includes('boss_hunter')) migratedAircraft.push('f117');
    G.unlockedAircraft = withDefaultUnlockedAircraft(migratedAircraft);
    G.acquiredAircraft = migratedAircraft.filter(id => !DEFAULT_UNLOCKED_AIRCRAFT.includes(id));
    if (!G.unlockedAircraft.includes(G.activeAircraft)) G.activeAircraft = 't6';
    save('unlockedAircraft', G.unlockedAircraft);
    save('acquiredAircraft', G.acquiredAircraft);
    save('activeAircraft', G.activeAircraft);
    save('aircraftProgressionVersion', 2);
  }
  if (G.unlockedBadges.includes('boss_hunter') && !G.unlockedAircraft.includes('f117')) {
    G.unlockedAircraft.push('f117');
    save('unlockedAircraft', G.unlockedAircraft);
  }
  G.activeBadge = load('activeBadge', null);
  if (!G.unlockedBadges.includes(G.activeBadge)) G.activeBadge = null;
  G.totalCorrectAnswers = load('totalCorrectAnswers', 0);
  G.bestAnswerStreak = load('bestAnswerStreak', 0);
  G.comboAcePermanent = load('comboAcePermanent', false);
  G.secretAircraftUnlocked = load('secretAircraftUnlocked', false);
  G.ownedShootingPlans = load('ownedShootingPlans', ['default']);
  if (!Array.isArray(G.ownedShootingPlans) || !G.ownedShootingPlans.length) G.ownedShootingPlans = ['default'];
  if (!G.ownedShootingPlans.includes('default')) G.ownedShootingPlans.unshift('default');
  G.activeShootingPlan = load('activeShootingPlan', 'default');
  if (!G.ownedShootingPlans.includes(G.activeShootingPlan)) G.activeShootingPlan = 'default';
  const missileStoreVersion = load('missileStoreVersion', 1);
  G.ownedMissileTypes = load('ownedMissileTypes', []);
  if (!Array.isArray(G.ownedMissileTypes)) G.ownedMissileTypes = [];
  if (missileStoreVersion < 2) {
    G.ownedMissileTypes = G.ownedMissileTypes.filter(id => id !== 'fire');
    save('missileStoreVersion', 2);
  }
  G.activeMissileType = load('activeMissileType', 'default');
  if (G.activeMissileType !== 'default' && !G.ownedMissileTypes.includes(G.activeMissileType)) G.activeMissileType = 'default';
  G.sr71Earned           = load('sr71Earned', false);
  G.sr71MissionClaimed   = load('sr71MissionClaimed', false);
  G.sr71WrongAnswers     = load('sr71WrongAnswers', 0);
  G.sr71MissileHits      = load('sr71MissileHits', 0);
  G.sr71CleanLevels      = load('sr71CleanLevels', []);
  G.highestLevel         = load('highestLevel', 0);
  G.dailyLastLogin    = load('dailyLastLogin', null);
  G.dailyStreak       = load('dailyStreak', 0);
  G.dailyStarterPlanComplete = load('dailyStarterPlanComplete', G.dailyStreak >= 7);
  G.dailyMissions     = load('dailyMissions', null);
  G.dailyMissionDate  = load('dailyMissionDate', null);
  G.playMinutesByDay  = load('playMinutesByDay', {});
  G.monthlyChallenge  = load('monthlyChallenge', null);
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
  G.coins = clampCoins(G.coins);
  save('xp',                G.xp);
  save('totalXpEarned',     G.totalXpEarned);
  save('coins',             G.coins);
  save('blueprints',        G.blueprints);
  save('chestsWithoutEpic', G.chestsWithoutEpic);
  save('levelStars',        G.levelStars);
  save('unlockedAircraft',  G.unlockedAircraft);
  save('acquiredAircraft',  G.acquiredAircraft);
  save('activeAircraft',    G.activeAircraft);
  ['unlockedBadges','activeBadge','totalCorrectAnswers','bestAnswerStreak','comboAcePermanent','secretAircraftUnlocked'].forEach(k=>save(k,G[k]));
  save('ownedShootingPlans', G.ownedShootingPlans);
  save('activeShootingPlan', G.activeShootingPlan);
  save('ownedMissileTypes', G.ownedMissileTypes);
  save('activeMissileType', G.activeMissileType);
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
  save('hasSeenOnboarding', G.hasSeenOnboarding);
  save('hasSeenBriefing',   G.hasSeenBriefing);
  save('likesMath',         G.likesMath);
  save('onboardingAgeGroup', G.onboardingAgeGroup);
  save('onboardingGrade',   G.onboardingGrade);
  save('focusOperation',    G.focusOperation || '');
  save('focusOperations',   G.focusOperations || []);
  save('pendingPlacement',  G.pendingPlacement);
  save('tutorialMode',      G.tutorialMode);
  save('onboardingStartMode', G.onboardingStartMode);
  save('onboardingLevelLength', G.onboardingLevelLength);
  save('dailyGoalMinutes',  G.dailyGoalMinutes);
  save('tutorialPlan',      G.tutorialPlan);
  save('tutorialProgress',  G.tutorialProgress);
  save('tutorialCompleted', G.tutorialCompleted);
  save('postTutorialConnectPrompt', G.postTutorialConnectPrompt);
  save('practiceTimeLimit', G.practiceTimeLimit);
  save('dailyLastLogin',    G.dailyLastLogin);
  save('dailyStreak',       G.dailyStreak);
  save('dailyStarterPlanComplete', G.dailyStarterPlanComplete);
  save('dailyMissions',     G.dailyMissions);
  save('dailyMissionDate',  G.dailyMissionDate);
  save('playMinutesByDay',  G.playMinutesByDay);
  save('monthlyChallenge',  G.monthlyChallenge);
  save('claimedRanks',      G.claimedRanks);
  save('rankedLP',          G.rankedLP);
  save('rankedWins',        G.rankedWins);
  save('rankedLosses',      G.rankedLosses);
  save('rankedWinStreak',   G.rankedWinStreak);
  save('rankedGamesPlayed', G.rankedGamesPlayed);
  save('rankedSeasonStart', G.rankedSeasonStart);
  save('rankedFirstWinToday', G.rankedFirstWinToday);
  save('sr71MissionClaimed',   G.sr71MissionClaimed);
  save('sr71WrongAnswers',     G.sr71WrongAnswers);
  save('sr71MissileHits',      G.sr71MissileHits);
  save('sr71CleanLevels',      G.sr71CleanLevels);
  import('./systems/cloud-save.js').then(m => m.scheduleCloudPush()).catch(() => {});
}

export function autoSave() {
  if (!G.playerRegistered) return; // guests: no progress saved
  G.coins = clampCoins(G.coins);
  save('xp',              G.xp);
  save('totalXpEarned',   G.totalXpEarned);
  save('coins',           G.coins);
  save('levelStars',      G.levelStars);
  save('highestLevel',    G.highestLevel);
  save('activeAircraft',  G.activeAircraft);
  save('unlockedAircraft',G.unlockedAircraft);
  save('acquiredAircraft',G.acquiredAircraft);
  save('ownedShootingPlans', G.ownedShootingPlans);
  save('activeShootingPlan', G.activeShootingPlan);
  save('ownedMissileTypes', G.ownedMissileTypes);
  save('activeMissileType', G.activeMissileType);
  save('blueprints',      G.blueprints);
  save('hasSeenOnboarding', G.hasSeenOnboarding);
  save('hasSeenBriefing', G.hasSeenBriefing);
  save('likesMath',       G.likesMath);
  save('onboardingAgeGroup', G.onboardingAgeGroup);
  save('onboardingGrade', G.onboardingGrade);
  save('focusOperation',  G.focusOperation || '');
  save('focusOperations', G.focusOperations || []);
  save('pendingPlacement', G.pendingPlacement);
  save('tutorialMode',    G.tutorialMode);
  save('onboardingStartMode', G.onboardingStartMode);
  save('onboardingLevelLength', G.onboardingLevelLength);
  save('dailyGoalMinutes', G.dailyGoalMinutes);
  save('tutorialPlan',    G.tutorialPlan);
  save('tutorialProgress', G.tutorialProgress);
  save('tutorialCompleted', G.tutorialCompleted);
  save('postTutorialConnectPrompt', G.postTutorialConnectPrompt);
}

export function resetLevel() {
  G.lives              = 3 + (G.activeBadge === 'steady_recruit' ? 1 : 0) + (AIRCRAFT[G.activeAircraft]?.ability?.extraLives || 0);
  G.questionsAnswered  = 0;
  G.correctAnswers     = 0;
  G.sessionXP          = 0;
  G.sessionResponseTimeTotal = 0;
  G.sessionResponseCount = 0;
  G.streak             = 0;
  G.timeLeft           = 10;
  G.answerLocked       = false;
  G.question           = null;
  G.missileHitsReceived = 0;
  G.enemies            = [];
  G.missiles           = [];
  G.enemyMissiles      = [];
  G.particles          = [];
  if (G.timerInterval) { clearInterval(G.timerInterval); G.timerInterval = null; }
  if (G.animFrame)     { cancelAnimationFrame(G.animFrame); G.animFrame = null; }
}
