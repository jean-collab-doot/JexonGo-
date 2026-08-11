import { G, clampCoins } from '../state.js';
import { save } from '../utils/storage.js';
import { unlockEligibleBadges } from '../data/badges.js';


function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthStr(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function daysInCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function dateToStr(date) {
  return date.toISOString().slice(0, 10);
}

function dateOffset(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return dateToStr(d);
}

function weekStartMonday(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

const WEEKDAY_LABELS = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  fr: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
};

function configuredOpsLabel() {
  const ops = Array.isArray(G.focusOperations) && G.focusOperations.length
    ? G.focusOperations
    : G.focusOperation ? [G.focusOperation] : ['+', '-', '*', '/'];
  return ops.map(op => ({ '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV' })[op] || op).join(' + ');
}

function configuredOpsLabelFr() {
  const ops = Array.isArray(G.focusOperations) && G.focusOperations.length
    ? G.focusOperations
    : G.focusOperation ? [G.focusOperation] : ['+', '-', '*', '/'];
  return ops.map(op => ({ '+': 'ADD', '-': 'SOU', '*': 'MUL', '/': 'DIV' })[op] || op).join(' + ');
}

function prunePlayMinutes() {
  const data = G.playMinutesByDay || {};
  const keep = new Set(Array.from({ length: 45 }, (_, i) => dateOffset(i)));
  for (const day of Object.keys(data)) {
    if (!keep.has(day)) delete data[day];
  }
  G.playMinutesByDay = data;
}

// ── 7-DAY LOGIN REWARD CYCLE ──────────────────────────────────────────────────
export const LOGIN_REWARDS = [
  { day: 1, coins: 150,  xp: 0,    icon: 'coin', desc: '150 COINS' },
  { day: 2, coins: 300,  xp: 50,   icon: 'coin', desc: '300 COINS + 50 XP' },
  { day: 3, coins: 500,  xp: 0,    icon: 'coin', desc: '500 COINS' },
  { day: 4, coins: 500,  xp: 200,  icon: '<img class="jg-exp-icon" src="/assets/fx/Caisse/JexonGo_EXP_frame_01.png" alt="EXP">', desc: '500 COINS + 200 XP' },
  { day: 5, coins: 800,  xp: 0,    icon: 'coin', desc: '800 COINS' },
  { day: 6, coins: 1000, xp: 300,  icon: '<img class="jg-exp-icon" src="/assets/fx/Caisse/JexonGo_EXP_frame_01.png" alt="EXP">', desc: '1000 COINS + 300 XP' },
  { day: 7, coins: 2000, xp: 500, badgeId: 'steady_recruit',
    icon: '<img class="jg-exp-icon" src="/assets/Badges/03_Recrue_Assidue_Commun.png" alt="Recrue Assidue">',
    desc: '2000 COINS + 500 XP + BADGE' },
];

// ── XP RANK TABLE ─────────────────────────────────────────────────────────────
export const XP_RANKS = [
  { rank: 1,  name: 'CADET',      minXp: 0,      reward: null },
  { rank: 2,  name: 'PILOT',      minXp: 500,    reward: { coins: 100 } },
  { rank: 3,  name: 'LIEUTENANT', minXp: 1500,   reward: { coins: 200 } },
  { rank: 4,  name: 'CAPTAIN',    minXp: 3500,   reward: { coins: 400 } },
  { rank: 5,  name: 'MAJOR',      minXp: 7000,   reward: { coins: 600 } },
  { rank: 6,  name: 'COLONEL',    minXp: 12000,  reward: { coins: 1000 } },
  { rank: 7,  name: 'GENERAL',    minXp: 20000,  reward: { coins: 1500 } },
  { rank: 8,  name: 'ACE',        minXp: 32000,  reward: { coins: 2500 } },
  { rank: 9,  name: 'LEGEND',     minXp: 50000,  reward: { coins: 4000 } },
  { rank: 10, name: 'MYTH',       minXp: 75000,  reward: null },
];

export function getPlayerRank(xp) {
  let current = XP_RANKS[0];
  for (const r of XP_RANKS) {
    if (xp >= r.minXp) current = r;
    else break;
  }
  const next = XP_RANKS.find(r => r.minXp > xp) || null;
  return { current, next };
}

// ── DAILY MISSION POOL ────────────────────────────────────────────────────────
const MISSION_POOL = [
  { id: 'correct5',  label: 'Answer 5 questions correctly',  labelFr: 'Répondre correctement à 5 questions',  type: 'correct_answers', target: 5,  coins: 100, xp: 50  },
  { id: 'correct15', label: 'Answer 15 questions correctly', labelFr: 'Répondre correctement à 15 questions', type: 'correct_answers', target: 15, coins: 200, xp: 100 },
  { id: 'correct30', label: 'Answer 30 questions correctly', labelFr: 'Répondre correctement à 30 questions', type: 'correct_answers', target: 30, coins: 350, xp: 200 },
  { id: 'win2',      label: 'Win 2 levels',                  labelFr: 'Gagner 2 niveaux',                     type: 'levels_won',      target: 2,  coins: 200, xp: 80  },
  { id: 'win3',      label: 'Win 3 levels',                  labelFr: 'Gagner 3 niveaux',                     type: 'levels_won',      target: 3,  coins: 350, xp: 150 },
  { id: 'play3',     label: 'Play 3 games',                  labelFr: 'Jouer 3 parties',                      type: 'games_played',    target: 3,  coins: 150, xp: 60  },
  { id: 'streak3',   label: 'Get a 3-answer streak',         labelFr: 'Obtenir une série de 3 bonnes réponses', type: 'max_streak',    target: 3,  coins: 100, xp: 80  },
  { id: 'streak5',   label: 'Get a 5-answer streak',         labelFr: 'Obtenir une série de 5 bonnes réponses', type: 'max_streak',      target: 5,  coins: 200, xp: 150 },
  { id: 'open_chest1', label: 'Open 1 chest',               labelFr: 'Ouvrir 1 coffre',                        type: 'open_chest',      target: 1,  coins: 200, xp: 100 },
  { id: 'open_chest3', label: 'Open 3 chests',              labelFr: 'Ouvrir 3 coffres',                       type: 'open_chest',      target: 3,  coins: 500, xp: 300 },
];

function seededPick(dateStr) {
  const seed = dateStr.replace(/-/g, '') | 0;
  const pool = [...MISSION_POOL];
  const out  = [];
  let s = seed;
  while (out.length < 3 && pool.length) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const idx = s % pool.length;
    out.push({ ...pool.splice(idx, 1)[0], progress: 0, claimed: false });
  }
  return out;
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

export function checkDailyLogin() {
  if (!G.playerRegistered) return { isNewDay: false };
  // New pilots must finish the complete playable tutorial before rewards begin.
  if (!G.tutorialCompleted) return { isNewDay: false, waitingForTutorial: true };
  if (G.dailyStarterPlanComplete) return { isNewDay: false, completed: true };
  const today     = todayStr();
  const lastLogin = G.dailyLastLogin;
  if (lastLogin === today) return { isNewDay: false };

  // Consecutive day? Increment streak, else reset
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  if (lastLogin === yStr) {
    G.dailyStreak = Math.min(7, (G.dailyStreak || 0) + 1);
  } else {
    G.dailyStreak = 1;
  }

  const reward = LOGIN_REWARDS[(G.dailyStreak - 1) % 7];

  // Fresh missions for the new day
  G.dailyMissions    = seededPick(today);
  G.dailyMissionDate = today;

  save('dailyStreak',      G.dailyStreak);
  save('dailyMissions',    G.dailyMissions);
  save('dailyMissionDate', today);
  // NOTE: dailyLastLogin is saved only when the player claims, to re-show on reload

  return { isNewDay: true, reward, streak: G.dailyStreak };
}

export function claimDailyReward(reward) {
  if (!G.playerRegistered || !G.tutorialCompleted || G.dailyLastLogin === todayStr() || G.dailyStarterPlanComplete) {
    return { claimed: false, badges: [] };
  }
  G.coins           = clampCoins((G.coins || 0) + (reward.coins || 0));
  G.xp             += reward.xp    || 0;
  G.totalXpEarned  += reward.xp    || 0;
  G.dailyLastLogin  = todayStr();
  if (G.dailyStreak >= 7) G.dailyStarterPlanComplete = true;
  const badges = reward.badgeId ? unlockEligibleBadges({ source: 'daily-welcome' }) : [];
  save('coins',          G.coins);
  save('xp',             G.xp);
  save('totalXpEarned',  G.totalXpEarned);
  save('dailyLastLogin', G.dailyLastLogin);
  save('dailyStarterPlanComplete', G.dailyStarterPlanComplete);
  return { claimed: true, badges };
}

export function getMissions() {
  const today = todayStr();
  if (!G.dailyMissions || G.dailyMissionDate !== today) {
    G.dailyMissions    = seededPick(today);
    G.dailyMissionDate = today;
    save('dailyMissions',    G.dailyMissions);
    save('dailyMissionDate', today);
  }
  return G.dailyMissions;
}

export function recordPlayMinute(amount = 1) {
  const n = Math.max(1, Math.round(amount || 1));
  const today = todayStr();
  G.playMinutesByDay = G.playMinutesByDay || {};
  G.playMinutesByDay[today] = Math.max(0, (G.playMinutesByDay[today] || 0) + n);
  prunePlayMinutes();
  save('playMinutesByDay', G.playMinutesByDay);
}

export function getPlayMinuteStats(lang = 'en') {
  prunePlayMinutes();
  const goal = Math.max(1, Number(G.dailyGoalMinutes || 5));
  const weekStart = weekStartMonday();
  const labels = WEEKDAY_LABELS[lang === 'fr' ? 'fr' : 'en'];
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = dateToStr(addDays(weekStart, i));
    const minutes = Math.max(0, Math.round((G.playMinutesByDay || {})[date] || 0));
    return {
      date,
      label: labels[i],
      minutes,
      pct: Math.min(100, Math.round((minutes / goal) * 100)),
      isToday: date === todayStr(),
    };
  });
  const weekTotal = days.reduce((sum, day) => sum + day.minutes, 0);
  const currentMonth = monthStr();
  const monthTotal = Object.entries(G.playMinutesByDay || {})
    .filter(([date]) => date.startsWith(currentMonth))
    .reduce((sum, [, minutes]) => sum + Math.max(0, Number(minutes || 0)), 0);
  const monthTarget = Math.max(goal * daysInCurrentMonth(), goal * 7);
  return {
    goal,
    days,
    weekStart: dateToStr(weekStart),
    weekTotal: Math.round(weekTotal),
    monthTotal: Math.round(monthTotal),
    monthTarget,
    monthPct: Math.min(100, Math.round((monthTotal / Math.max(1, monthTarget)) * 100)),
  };
}

export function getMonthlyConfigChallenge(lang = 'en') {
  const stats = getPlayMinuteStats(lang);
  const isFr = lang === 'fr';
  const grade = G.onboardingGrade || G.playerGrade || 1;
  const ops = isFr ? configuredOpsLabelFr() : configuredOpsLabel();
  const length = G.onboardingLevelLength || 'normal';
  return {
    title: isFr ? 'DÉFI DU MOIS' : 'MONTH CHALLENGE',
    subtitle: isFr
      ? `Objectif: ${stats.monthTarget} min ce mois-ci`
      : `Goal: ${stats.monthTarget} min this month`,
    config: isFr
      ? `Config: année ${grade}, ${ops}, ${length}`
      : `Config: grade ${grade}, ${ops}, ${length}`,
    progress: stats.monthTotal,
    target: stats.monthTarget,
    pct: stats.monthPct,
  };
}

export function trackMission(type, amount = 1) {
  const today = todayStr();
  if (!G.dailyMissions || G.dailyMissionDate !== today) return;
  let changed = false;
  for (const m of G.dailyMissions) {
    if (m.claimed || m.type !== type) continue;
    if (type === 'max_streak') {
      if (amount > m.progress) { m.progress = Math.min(amount, m.target); changed = true; }
    } else {
      if (m.progress < m.target) { m.progress = Math.min(m.progress + amount, m.target); changed = true; }
    }
  }
  if (changed) save('dailyMissions', G.dailyMissions);
}

export function claimMission(missionId) {
  const m = (G.dailyMissions || []).find(x => x.id === missionId);
  if (!m || m.claimed || m.progress < m.target) return false;
  if (!G.playerRegistered) return false;
  m.claimed  = true;
  G.coins    = clampCoins((G.coins || 0) + (m.coins || 0));
  G.xp      += m.xp    || 0;
  save('dailyMissions', G.dailyMissions);
  save('coins', G.coins);
  save('xp',    G.xp);
  return true;
}

export function hasPendingMissionClaim() {
  const dailyPending = (G.dailyMissions || []).some(m => !m.claimed && m.progress >= m.target);
  const sr71Pending  = G.sr71Earned && !G.sr71MissionClaimed && !G.unlockedAircraft.includes('sr71');
  return dailyPending || sr71Pending;
}

// ── PERMANENT SR-71 CHALLENGE ─────────────────────────────────────────────────
export const SR71_MISSION = {
  id:       'sr71_challenge',
  label:    'Beat all 30 levels with a perfect score on every level',
  labelFr:  'Compléter les 30 niveaux avec un score parfait à chaque niveau',
  coins:    1000,
  xp:       500,
};

export function getSr71MissionState() {
  return {
    ...SR71_MISSION,
    target:      1,
    progress:    G.sr71Earned ? 1 : 0,
    claimed:     G.sr71MissionClaimed || false,
    cleanLevels: G.sr71CleanLevels || [],
  };
}

export function claimSr71Mission() {
  if (!G.sr71Earned || G.sr71MissionClaimed) return false;
  if (!G.playerRegistered) return false;
  G.sr71MissionClaimed = true;
  G.coins          = clampCoins((G.coins || 0) + SR71_MISSION.coins);
  G.xp            += SR71_MISSION.xp;
  G.totalXpEarned  = (G.totalXpEarned || 0) + SR71_MISSION.xp;
  save('sr71MissionClaimed', true);
  save('coins',        G.coins);
  save('xp',           G.xp);
  save('totalXpEarned', G.totalXpEarned);
  return true;
}
