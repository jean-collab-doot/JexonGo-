// ENDLESS MODE leaderboard (its own board, supabase/migrations/
// 011_endless_leaderboard.sql). It never touches the TOP 20 or the
// multiplayer board. Signed-in players only; guests play without a score.
// The server notes the start time and refuses impossible scores.
import { getSupabaseClient } from './supabase-client.js';
import { G } from '../state.js';
import { load, save } from '../utils/storage.js';

let _runId = null;

// Personal record on this device (also the record of a guest).
export function endlessRecord() {
  return Number(load('endlessRecord', 0)) || 0;
}
export function saveEndlessRecord(correct) {
  if (correct > endlessRecord()) { save('endlessRecord', correct); return true; }
  return false;
}

async function client() {
  if (!G.playerRegistered) return null;
  try { return await getSupabaseClient(); } catch { return null; }
}

// At the start of a game (signed in): the server notes the time.
export async function startEndlessRun(aircraft) {
  _runId = null;
  const sb = await client();
  if (!sb) return null;
  const { data, error } = await sb.rpc('start_endless_run', { p_aircraft: aircraft });
  if (error) { console.warn('[endless] start', error.message); return null; }
  _runId = data;
  return data;
}

// At the end: 'ok', 'refused', 'guest', 'offline' or another reason.
export async function finishEndlessRun({ correct, errors, bestStreak, exercises }) {
  if (!G.playerRegistered) return 'guest';
  const id = _runId;
  _runId = null;
  const sb = await client();
  if (!sb || !id) return 'offline';
  const { data, error } = await sb.rpc('finish_endless_run', {
    p_run: id, p_correct: correct, p_errors: errors, p_best_streak: bestStreak, p_exercises: exercises,
  });
  if (error) { console.warn('[endless] finish', error.message); return 'offline'; }
  return data || 'offline';
}

// [{ rank, id, name, aircraft, exercises, correct, errors }] or null when the
// board is not reachable (offline, or the migration not applied yet).
export async function fetchEndlessBoard(limit = 20) {
  let sb = null;
  try { sb = await getSupabaseClient(); } catch { return null; }
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_endless_leaderboard', { p_limit: limit });
  if (error) { console.warn('[endless] board', error.message); return null; }
  return (data || []).map(r => ({
    rank: Number(r.rank), id: r.user_id, name: r.name, aircraft: r.aircraft,
    exercises: r.exercises || '', correct: Number(r.correct) || 0, errors: Number(r.errors) || 0,
  }));
}

export async function fetchEndlessMyBest() {
  const sb = await client();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_endless_my_best');
  if (error || !data?.length) return null;
  return { rank: Number(data[0].rank), correct: Number(data[0].correct) || 0, errors: Number(data[0].errors) || 0 };
}

// Same order as the server (for the local check of a tie).
export function compareEndless(a, b) {
  return (b.correct - a.correct) || (a.errors - b.errors) || (a.at - b.at);
}
