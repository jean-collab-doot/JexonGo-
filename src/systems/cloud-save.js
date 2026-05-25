// Cloud progression sync — keyed by player email (server: server.js /api/save)
import { G, saveAll } from '../state.js';
import { save, load } from '../utils/storage.js';

export const API_URL =
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? `http://${location.hostname}:8080`
    : `${location.protocol}//${location.hostname}`;

const PERSIST_KEYS = [
  'xp', 'totalXpEarned', 'coins', 'blueprints', 'chestsWithoutEpic', 'levelStars',
  'unlockedAircraft', 'activeAircraft', 'ownedSkins', 'activeSkin', 'activeLivery',
  'prestige', 'sr71Earned', 'sr71MissionClaimed', 'sr71WrongAnswers', 'sr71MissileHits',
  'sr71CleanLevels', 'highestLevel', 'dailyLastLogin', 'dailyStreak', 'dailyMissions',
  'dailyMissionDate', 'claimedRanks', 'rankedLP', 'rankedWins', 'rankedLosses',
  'rankedWinStreak', 'rankedGamesPlayed', 'rankedSeasonStart', 'rankedFirstWinToday',
  'playerName', 'playerEmail', 'playerPhoto', 'playerAge', 'playerGrade',
  'pilotEmblem', 'pilotMotto', 'profileTheme', 'practiceTimeLimit',
];

let _pushTimer = null;

export function exportSaveSnapshot() {
  const snap = {};
  for (const key of PERSIST_KEYS) snap[key] = G[key];
  return snap;
}

export function applySaveSnapshot(snap) {
  if (!snap) return;
  for (const key of PERSIST_KEYS) {
    if (snap[key] !== undefined) G[key] = snap[key];
  }
  for (const key of PERSIST_KEYS) {
    if (snap[key] !== undefined) save(key, snap[key]);
  }
}

function _union(a, b) {
  return [...new Set([...(a || []), ...(b || [])])];
}

export function mergeSaveSnapshots(local, remote) {
  if (!remote) return local || {};
  if (!local) return remote;
  const out = { ...local };

  out.xp            = Math.max(local.xp || 0, remote.xp || 0);
  out.totalXpEarned = Math.max(local.totalXpEarned || 0, remote.totalXpEarned || 0);
  out.coins         = Math.max(local.coins || 0, remote.coins || 0);
  out.highestLevel  = Math.max(local.highestLevel || 0, remote.highestLevel || 0);
  out.prestige      = Math.max(local.prestige || 0, remote.prestige || 0);
  out.chestsWithoutEpic = Math.max(local.chestsWithoutEpic || 0, remote.chestsWithoutEpic || 0);
  out.rankedLP      = Math.max(local.rankedLP || 0, remote.rankedLP || 0);

  out.levelStars = { ...(local.levelStars || {}) };
  for (const [k, v] of Object.entries(remote.levelStars || {})) {
    out.levelStars[k] = Math.max(out.levelStars[k] || 0, v);
  }

  out.blueprints = { ...(local.blueprints || {}) };
  for (const [k, v] of Object.entries(remote.blueprints || {})) {
    out.blueprints[k] = Math.max(out.blueprints[k] || 0, v);
  }

  out.unlockedAircraft = _union(local.unlockedAircraft, remote.unlockedAircraft);
  out.ownedSkins       = _union(local.ownedSkins, remote.ownedSkins);
  out.claimedRanks     = _union(local.claimedRanks, remote.claimedRanks);
  out.sr71CleanLevels  = _union(local.sr71CleanLevels, remote.sr71CleanLevels);

  out.sr71Earned         = !!(local.sr71Earned || remote.sr71Earned);
  out.sr71MissionClaimed = !!(local.sr71MissionClaimed || remote.sr71MissionClaimed);
  out.sr71WrongAnswers   = Math.min(local.sr71WrongAnswers ?? 999, remote.sr71WrongAnswers ?? 999);
  out.sr71MissileHits    = Math.min(local.sr71MissileHits ?? 999, remote.sr71MissileHits ?? 999);

  const lGames = local.rankedGamesPlayed || 0;
  const rGames = remote.rankedGamesPlayed || 0;
  if (rGames > lGames) {
    out.rankedWins        = remote.rankedWins;
    out.rankedLosses      = remote.rankedLosses;
    out.rankedWinStreak   = remote.rankedWinStreak;
    out.rankedGamesPlayed = remote.rankedGamesPlayed;
    out.rankedSeasonStart = remote.rankedSeasonStart;
    out.rankedFirstWinToday = remote.rankedFirstWinToday;
  }

  const lDay = local.dailyLastLogin || '';
  const rDay = remote.dailyLastLogin || '';
  if (rDay > lDay) {
    out.dailyLastLogin   = remote.dailyLastLogin;
    out.dailyStreak      = remote.dailyStreak;
    out.dailyMissions    = remote.dailyMissions;
    out.dailyMissionDate = remote.dailyMissionDate;
  }

  if ((remote.highestLevel || 0) >= (local.highestLevel || 0)) {
    out.activeAircraft = remote.activeAircraft ?? local.activeAircraft;
    out.activeSkin     = remote.activeSkin ?? local.activeSkin;
    out.activeLivery   = remote.activeLivery ?? local.activeLivery;
  }

  out.playerName  = local.playerName  || remote.playerName;
  out.playerPhoto = local.playerPhoto || remote.playerPhoto;
  out.playerGrade = Math.max(local.playerGrade || 0, remote.playerGrade || 0);
  out.playerAge   = Math.max(local.playerAge || 0, remote.playerAge || 0);

  return out;
}

function _authBody({ authType, password } = {}) {
  const email = (G.playerEmail || '').toLowerCase().trim();
  const body = { email, authType: authType || (password ? 'email' : 'google') };
  if (password) body.password = password;
  return body;
}

/** @returns {{ data?, updatedAt?, notFound?, forbidden?, offline? }} */
export async function fetchCloudSave(email, password, authType) {
  try {
    const params = new URLSearchParams({
      email: email.toLowerCase().trim(),
      authType: authType || (password ? 'email' : 'google'),
    });
    if (password) params.set('password', password);
    const res = await fetch(`${API_URL}/api/save?${params}`, { method: 'GET' });
    if (res.status === 404) return { notFound: true };
    if (res.status === 403) return { forbidden: true };
    if (!res.ok) return { error: true };
    const json = await res.json();
    return { data: json.data, updatedAt: json.updatedAt };
  } catch (_) {
    return { offline: true };
  }
}

export async function pushCloudSave(opts = {}) {
  const email = (G.playerEmail || '').toLowerCase().trim();
  if (!G.playerRegistered || !email) return false;

  const password = opts.password ?? load('playerPassword', '') ?? '';
  const authType = opts.authType || (password ? 'email' : 'google');

  try {
    const res = await fetch(`${API_URL}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ..._authBody({ authType, password }),
        data: exportSaveSnapshot(),
        updatedAt: Date.now(),
      }),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

export function scheduleCloudPush() {
  if (!G.playerRegistered || !G.playerEmail) return;
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => pushCloudSave(), 2500);
}

export async function flushCloudSave() {
  clearTimeout(_pushTimer);
  return pushCloudSave();
}

/** Pull cloud save, merge with local, apply, and push merged result. */
export async function syncAccountFromCloud(opts = {}) {
  const email = (G.playerEmail || '').toLowerCase().trim();
  if (!G.playerRegistered || !email) return false;

  const password = opts.password ?? load('playerPassword', '') ?? '';
  const authType = opts.authType || (password ? 'email' : 'google');
  const local = exportSaveSnapshot();
  const remote = await fetchCloudSave(email, password, authType);
  if (remote?.forbidden || remote?.offline) return false;

  if (remote?.data) {
    applySaveSnapshot(mergeSaveSnapshots(local, remote.data));
  }

  saveAll();
  await pushCloudSave({ authType, password });
  return !!remote?.data;
}
