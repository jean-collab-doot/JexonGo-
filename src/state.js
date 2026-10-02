import { load, save } from './utils/storage.js';
import { AIRCRAFT } from './data/aircraft.js';
import { TEST_UNLOCK } from './utils/test-mode.js';

// Test values (every aircraft, max coins and EXP) only on the local dev
// server (`npm run dev`, import.meta.env.DEV). Players of the published game
// start from zero with the T-6.
const DEV_TEST = !!import.meta.env?.DEV;

// Every aircraft on the dev server and the Vercel preview (utils/test-mode.js).
const DEFAULT_UNLOCKED_AIRCRAFT = TEST_UNLOCK
  ? ['t6', 'pc21', 'c130', 'a10', 'f16', 'f18', 'f22', 'f35', 'b2', 'sr71', 'f117']
  : ['t6'];

function withDefaultUnlockedAircraft(list) {
  const unlocked = Array.isArray(list) ? [...list] : [];
  for (const id of DEFAULT_UNLOCKED_AIRCRAFT) {
    if (!unlocked.includes(id)) unlocked.push(id);
  }
  return unlocked;
}

export const MAX_COINS = 99999;
const MAX_XP = 999999;
const STARTING_COINS = DEV_TEST ? MAX_COINS : 0;
const STARTING_XP = DEV_TEST ? MAX_XP : 0;

export function clampCoins(value) {
  const n = Number(value) || 0;
  return Math.max(0, Math.min(MAX_COINS, Math.floor(n)));
}

// Most coins / XP a single game can earn in total (pickups during the level
// plus the end-of-level bonus).
export const MAX_GAME_COINS = 100;
export const MAX_GAME_XP = 150;

// Every XP gain also counts toward the "Fortune de Guerre" badge.
// Also feeds the TOP 20 leaderboard: the EXP of a game WON with a real
// teammate (MULTI, any real player, not the bot) counts for the MULTIJOUEUR
// board too - pickups, end-of-level bonus and that level's chest. G.coopWinXp
// is set by game.js finishLevel and cleared when another game starts or the
// player goes back to the lobby, so nothing else (daily rewards, a solo game
// right after) is counted.
export function addLifetimeXp(amount) {
  const gained = Math.max(0, Number(amount) || 0);
  G.lifetimeXpEarned = (G.lifetimeXpEarned || 0) + gained;
  save('lifetimeXpEarned', G.lifetimeXpEarned);
  if (gained > 0 && G.coopWinXp) {
    G.multiXpEarned = (G.multiXpEarned || 0) + gained;
    save('multiXpEarned', G.multiXpEarned);
  }
  if (gained > 0) window.dispatchEvent(new Event('jexongo:xp'));
}

export function addSessionCoins(amount) {
  G.airdropSessionCoins = Math.min(MAX_GAME_COINS, (G.airdropSessionCoins || 0) + Math.max(0, amount || 0));
}

// Hangar UPGRADE "XP bonus" of the active aircraft: +10 / +25 / +50 % XP,
// and the per-game XP cap grows by the same amount.
const XP_UPGRADE_BONUS = [0, 0.10, 0.25, 0.50];
export function xpUpgradeMultiplier() {
  const level = Math.max(0, Math.min(3, G.planeUpgrades?.[G.activeAircraft]?.xp | 0));
  return 1 + XP_UPGRADE_BONUS[level];
}
export function maxGameXp() {
  return Math.round(MAX_GAME_XP * xpUpgradeMultiplier());
}

export function addSessionXp(amount) {
  const gained = Math.round(Math.max(0, amount || 0) * xpUpgradeMultiplier());
  G.airdropSessionXP = Math.min(maxGameXp(), (G.airdropSessionXP || 0) + gained);
}

export const G = {
  // --- Persisted ---
  xp: STARTING_XP,
  totalXpEarned: STARTING_XP, // cumulative XP earned (never decremented — used for pilot grade)
  coins: STARTING_COINS,
  blueprints: {},
  chestsWithoutEpic: 0,
  levelStars: {},
  unlockedAircraft: [...DEFAULT_UNLOCKED_AIRCRAFT],
  acquiredAircraft: [],
  activeAircraft: 't6',
  unlockedBadges: [], activeBadge: null, totalCorrectAnswers: 0, bestAnswerStreak: 0, flawlessLevels: 0,
  lifetimeXpEarned: 0,       // XP really earned since the player started (Fortune de Guerre badge)
  multiXpEarned: 0,
  coopWinXp: false,          // the game just won was with a real teammate (not saved)          // part of it earned in MULTI games with a real teammate (TOP 20 board)
  comboAcePermanent: false, secretAircraftUnlocked: false,
  ownedShootingPlans: ['default'],
  activeShootingPlan: 'default',
  ownedMissileTypes: [],
  activeMissileType: 'default',
  planeUpgrades: {},         // hangar UPGRADE, per aircraft: { lives, shots, homing, xp, weapons, weapon }
  botUpgrades: { aircraft: 't6', planes: ['t6'], fire: 1, hp: 3 }, // MULTI bot teammate: plane (bought planes), fire power 1-5, lives 3-6
  playerGrade: 0,      // 0 = not selected, 1-6 = school grade
  highestLevel: 0,      // highest level beaten (drives pilot grade)
  sr71Earned: false,         // true once all 30 levels completed with zero wrong answers
  sr71MissionClaimed: false, // true once the SR-71 challenge mission reward is claimed
  sr71WrongAnswers: 0,       // cumulative wrong answers during a level-1→30 run
  sr71MissileHits: 0,        // cumulative missile hits during a level-1→30 run
  sr71CleanLevels: [],       // levels 1-30 completed with no wrong answers & no hits

  // --- Daily economy ---
  dailyLastLogin:   null,
  dailyStreak:      0,        // 7-day rewards: days claimed (0-7)
  dailyLastClaimAt: 0,        // ms timestamp of the last claim (next one 24 h later)
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
  pilotNameChosen:  false,   // nickname typed by the player (not the Google name)
  playerEmail:      '',
  playerAuthType:   '',
  playerPhoto:      '',
  playerAge:        0,
  playerRegistered: false,
  pilotEmblem:      'plane',
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
  focusTopics: [],       // onboarding topics incl. exponent / trigonometry / pythagoras
  schoolLevel: '',       // 'prim1'..'prim6' or 'sec1'..'sec5'
  playerCountry: '',     // 'quebec' | 'france' | 'usa' | 'other'
  numberRangeMax: 0,     // onboarding "which numbers": 10, 20, 50, 100 or custom; 0 = level default
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
  practiceDifficulty: 'normal', // 'easy' | 'normal' | 'hard'
  practiceNumberMax: 0,         // typed "numbers from 1 to N" in practice; 0 = difficulty default
  practiceBiome:     'ocean',
  practiceWeather:   null,  // weather id; null = the level's own weather
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
  G.pilotNameChosen   = !!load('pilotNameChosen', false);
  G.playerEmail       = load('playerEmail', '');
  G.playerAuthType    = load('playerAuthType', '');
  G.playerPhoto       = load('playerPhoto', '');
  G.playerAge         = load('playerAge', 0);
  G.playerGrade       = load('playerGrade', 0);
  G.pilotEmblem       = load('pilotEmblem', 'plane');
  G.pilotMotto        = load('pilotMotto', '');
  G.profileTheme      = load('profileTheme', 'default');
  G.practiceTimeLimit = load('practiceTimeLimit', 10);
  G.practiceDifficulty = load('practiceDifficulty', 'normal');
  G.practiceNumberMax = Number(load('practiceNumberMax', 0)) || 0;
  G.practiceBiome     = load('practiceBiome', 'ocean');
  G.practiceWeather   = load('practiceWeather', null);
  G.hasSeenOnboarding = load('hasSeenOnboarding', false);
  G.hasSeenBriefing   = load('hasSeenBriefing', false);
  G.likesMath         = load('likesMath', true);
  G.onboardingAgeGroup = load('onboardingAgeGroup', 0);
  G.onboardingGrade   = load('onboardingGrade', 1);
  G.focusOperation    = load('focusOperation', '') || null;
  G.focusOperations   = load('focusOperations', []);
  G.focusTopics       = load('focusTopics', []);
  G.schoolLevel       = load('schoolLevel', '');
  G.playerCountry     = load('playerCountry', '');
  G.numberRangeMax    = Number(load('numberRangeMax', 0)) || 0;
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
    G.xp = STARTING_XP; G.totalXpEarned = STARTING_XP; G.coins = STARTING_COINS;
    G.blueprints = {}; G.chestsWithoutEpic = 0; G.levelStars = {};
    G.unlockedAircraft = withDefaultUnlockedAircraft(['t6']); G.activeAircraft = 't6';
    G.acquiredAircraft = [];
    G.unlockedBadges = []; G.activeBadge = null; G.flawlessLevels = 0; G.lifetimeXpEarned = 0; G.multiXpEarned = 0;
    G.ownedShootingPlans = ['default']; G.activeShootingPlan = 'default'; G.ownedMissileTypes = []; G.activeMissileType = 'default';
    G.planeUpgrades = {};
    G.botUpgrades = { aircraft: 't6', planes: ['t6'], fire: 1, hp: 3 };
    G.highestLevel = 0;
    G.sr71Earned = false; G.sr71MissionClaimed = false;
    G.sr71WrongAnswers = 0; G.sr71MissileHits = 0; G.sr71CleanLevels = [];
    G.dailyLastLogin = null; G.dailyStreak = 0; G.dailyLastClaimAt = 0; G.dailyStarterPlanComplete = false;
    G.dailyMissions = null; G.dailyMissionDate = null; G.claimedRanks = [];
    G.rankedLP = 0; G.rankedWins = 0; G.rankedLosses = 0;
    G.rankedWinStreak = 0; G.rankedGamesPlayed = 0;
    G.rankedSeasonStart = null; G.rankedFirstWinToday = null;
    return;
  }

  G.xp                = Math.max(load('xp', 0), STARTING_XP);
  G.totalXpEarned     = Math.max(load('totalXpEarned', G.xp), STARTING_XP);
  G.coins             = clampCoins(Math.max(load('coins', STARTING_COINS), STARTING_COINS));
  G.blueprints        = load('blueprints', {});
  G.chestsWithoutEpic = load('chestsWithoutEpic', 0);
  G.levelStars        = load('levelStars', {});
  G.unlockedAircraft  = withDefaultUnlockedAircraft(load('unlockedAircraft', DEFAULT_UNLOCKED_AIRCRAFT));
  G.acquiredAircraft = load('acquiredAircraft', []);
  if (!Array.isArray(G.acquiredAircraft)) G.acquiredAircraft = [];
  G.activeAircraft    = load('activeAircraft', 't6');
  G.unlockedBadges = load('unlockedBadges', []);
  // "Tireur d'Élite" and "Maître du Combo" were removed from the game.
  G.unlockedBadges = G.unlockedBadges.filter(id => id !== 'elite_shooter' && id !== 'combo_master');
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
  // B-2 was briefly marked as a starter aircraft. Remove that accidental
  // unlock unless the player actually purchased or earned it.
  if (load('aircraftProgressionVersion', 1) < 3) {
    if (!G.acquiredAircraft.includes('b2')) {
      G.unlockedAircraft = G.unlockedAircraft.filter(id => id !== 'b2');
    }
    if (!G.unlockedAircraft.includes(G.activeAircraft)) G.activeAircraft = 't6';
    save('unlockedAircraft', G.unlockedAircraft);
    save('activeAircraft', G.activeAircraft);
    save('aircraftProgressionVersion', 3);
  }
  if (!G.unlockedAircraft.includes(G.activeAircraft)) {
    G.activeAircraft = 't6';
    save('activeAircraft', G.activeAircraft);
  }
  // The F-117 stays the player's for good once earned, whether the "Chasseur
  // de Boss" badge is equipped or not.
  if ((G.unlockedBadges.includes('boss_hunter') || G.acquiredAircraft.includes('f117'))
    && !G.unlockedAircraft.includes('f117')) {
    G.unlockedAircraft.push('f117');
    save('unlockedAircraft', G.unlockedAircraft);
  }
  G.activeBadge = load('activeBadge', null);
  if (!G.unlockedBadges.includes(G.activeBadge)) G.activeBadge = null;
  G.totalCorrectAnswers = load('totalCorrectAnswers', 0);
  G.bestAnswerStreak = load('bestAnswerStreak', 0);
  G.flawlessLevels = Number(load('flawlessLevels', 0)) || 0;
  // First load after this counter was added: start from the XP already
  // earned (the saved total, unless it is the MAX_XP test value).
  const savedLifetimeXp = load('lifetimeXpEarned', null);
  if (savedLifetimeXp === null) {
    const savedTotal = Number(load('totalXpEarned', 0)) || 0;
    G.lifetimeXpEarned = savedTotal < MAX_XP ? savedTotal : 0;
    save('lifetimeXpEarned', G.lifetimeXpEarned);
  } else {
    G.lifetimeXpEarned = Number(savedLifetimeXp) || 0;
  }
  G.multiXpEarned = Number(load('multiXpEarned', 0)) || 0;
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
  G.planeUpgrades = load('planeUpgrades', {});
  if (!G.planeUpgrades || typeof G.planeUpgrades !== 'object' || Array.isArray(G.planeUpgrades)) G.planeUpgrades = {};
  const bot = load('botUpgrades', null) || {};
  const botPlanes = Array.isArray(bot.planes) ? bot.planes.filter(id => AIRCRAFT[id]) : [];
  if (!botPlanes.includes('t6')) botPlanes.unshift('t6');
  G.botUpgrades = {
    aircraft: botPlanes.includes(bot.aircraft) ? bot.aircraft : 't6',
    planes: botPlanes,
    fire: Math.max(1, Math.min(5, bot.fire | 0 || 1)),
    hp: Math.max(3, Math.min(6, bot.hp | 0 || 3)),
  };
  // One-time reset: every aircraft goes back to firing missiles by default.
  // Bought weapons stay owned and can be re-equipped in the UPGRADE tab.
  if (load('weaponDefaultVersion', 1) < 2) {
    for (const record of Object.values(G.planeUpgrades)) {
      if (record && typeof record === 'object') record.weapon = 'missile';
    }
    save('planeUpgrades', G.planeUpgrades);
    save('weaponDefaultVersion', 2);
  }
  G.sr71Earned           = load('sr71Earned', false);
  G.sr71MissionClaimed   = load('sr71MissionClaimed', false);
  G.sr71WrongAnswers     = load('sr71WrongAnswers', 0);
  G.sr71MissileHits      = load('sr71MissileHits', 0);
  G.sr71CleanLevels      = load('sr71CleanLevels', []);
  G.highestLevel         = load('highestLevel', 0);
  G.dailyLastLogin    = load('dailyLastLogin', null);
  G.dailyStreak       = load('dailyStreak', 0);
  G.dailyLastClaimAt  = Number(load('dailyLastClaimAt', 0)) || 0;
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
  ['unlockedBadges','activeBadge','totalCorrectAnswers','bestAnswerStreak','flawlessLevels','lifetimeXpEarned','comboAcePermanent','secretAircraftUnlocked'].forEach(k=>save(k,G[k]));
  save('ownedShootingPlans', G.ownedShootingPlans);
  save('activeShootingPlan', G.activeShootingPlan);
  save('ownedMissileTypes', G.ownedMissileTypes);
  save('activeMissileType', G.activeMissileType);
  save('planeUpgrades',     G.planeUpgrades);
  save('botUpgrades',       G.botUpgrades);
  save('sr71Earned',        G.sr71Earned);
  save('playerName',        G.playerName);
  save('pilotNameChosen',   !!G.pilotNameChosen);
  save('playerEmail',       G.playerEmail);
  save('playerAuthType',    G.playerAuthType);
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
  save('focusTopics',       G.focusTopics || []);
  save('schoolLevel',       G.schoolLevel || '');
  save('playerCountry',     G.playerCountry || '');
  save('numberRangeMax',    G.numberRangeMax || 0);
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
  save('practiceDifficulty', G.practiceDifficulty);
  save('practiceNumberMax', G.practiceNumberMax || 0);
  save('practiceBiome',     G.practiceBiome);
  save('practiceWeather',   G.practiceWeather);
  save('dailyLastLogin',    G.dailyLastLogin);
  save('dailyStreak',       G.dailyStreak);
  save('dailyLastClaimAt',  G.dailyLastClaimAt);
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
  save('planeUpgrades',   G.planeUpgrades);
  save('botUpgrades',     G.botUpgrades);
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

// Hearts at the start of a level (badge, plane ability, hangar UPGRADE).
export function startingLives() {
  return 3 + (G.activeBadge === 'steady_recruit' ? 1 : 0) + (AIRCRAFT[G.activeAircraft]?.ability?.extraLives || 0)
    + Math.max(0, Math.min(3, G.planeUpgrades?.[G.activeAircraft]?.lives | 0)); // hangar UPGRADE (per aircraft)
}

export function resetLevel() {
  G.lives              = startingLives();
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
