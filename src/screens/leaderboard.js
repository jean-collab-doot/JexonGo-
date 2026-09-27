// TOP 20 MONDIAL (lobby TOP 20 button): real players only, from the public
// Supabase table "leaderboard" (supabase/migrations/005). Two boards:
//   EXP TOTAL    EXP earned since the start of the game
//   MULTIJOUEUR  EXP earned in multiplayer games with a real teammate
// Podium for the top 3, then one orange row per player; the player's own row
// is blue. While the panel is open it follows the table live (Supabase
// Realtime), with a slow refresh as a fallback.
import { G } from '../state.js';
import { getLang } from '../i18n.js';
import { getSupabaseClient, getSupabaseSession } from '../systems/supabase-client.js';
import { pushLeaderboardScore } from '../systems/leaderboard-sync.js';

const TOP_COUNT = 20;
const REFRESH_MS = 20000;
const XP_IMG = '/assets/fx/Caisse/JexonGo_EXP_frame_01.png';
const BOARDS = { solo: 'xp', multi: 'multi_xp' };

let _board = 'solo';
let _myId = null;
let _channel = null;
let _refreshTimer = null;
let _reloadQueued = null;
let _open = false;
// The "leaderboard" table doesn't exist yet (migration 005 not run): stop
// asking for it until the page is reloaded, instead of a 404 every refresh.
let _tableMissing = false;

function isMissingTable(error) {
  return error?.code === 'PGRST205' || error?.code === '42P01' || error?.status === 404;
}

const $ = id => document.getElementById(id);
const fr = () => getLang() === 'fr';

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function fetchTop(board) {
  if (_tableMissing) throw Object.assign(new Error('missing'), { missing: true });
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('offline');
  const column = BOARDS[board];
  const { data, error } = await supabase
    .from('leaderboard')
    .select(`user_id, name, ${column}`)
    .gt(column, 0)
    .order(column, { ascending: false })
    .order('name', { ascending: true })
    .limit(TOP_COUNT);
  if (error) {
    if (isMissingTable(error)) {
      _tableMissing = true;
      stopUpdates();
      throw Object.assign(new Error('missing'), { missing: true });
    }
    throw error;
  }
  return (data || []).map((r, i) => ({ rank: i + 1, id: r.user_id, name: r.name, score: Number(r[column]) || 0 }));
}

function render(rows, note = '') {
  const f = fr();
  const body = $('top20-body');
  if (!body) return;
  const slot = (row, place) => `
    <div class="top20-podium-col top20-place-${place}${row && row.id === _myId ? ' is-me' : ''}">
      <b class="top20-podium-num">${place}</b>
      <span class="top20-podium-name">${row ? escapeHtml(row.name) : '—'}</span>
      ${row ? `<span class="top20-podium-xp">${row.score.toLocaleString()}</span>` : ''}
    </div>`;
  const list = rows.map(row => `
    <div class="top20-row${row.id === _myId ? ' is-me' : ''}">
      <span class="top20-rank">${row.rank}</span>
      <span class="top20-name">${escapeHtml(row.name)}</span>
      <span class="top20-xp">${row.score.toLocaleString()} <img src="${XP_IMG}" alt="EXP"></span>
    </div>`).join('');
  body.innerHTML = `
    <div class="top20-head">
      <small>SCORE</small>
      <strong>${f ? 'TOP 20 MONDIAL' : 'WORLD TOP 20'}</strong>
    </div>
    <div class="top20-tabs" role="tablist">
      <button class="top20-tab${_board === 'solo' ? ' is-active' : ''}" type="button" data-board="solo">${f ? 'EXP TOTAL' : 'TOTAL EXP'}</button>
      <button class="top20-tab${_board === 'multi' ? ' is-active' : ''}" type="button" data-board="multi">${f ? 'MULTIJOUEUR' : 'MULTIPLAYER'}</button>
    </div>
    <div class="top20-podium">${slot(rows[1], 2)}${slot(rows[0], 1)}${slot(rows[2], 3)}</div>
    ${note ? `<p class="top20-note">${note}</p>` : ''}
    <div class="top20-list">${list}</div>
    ${_board === 'multi' ? `<p class="top20-note">${f
      ? 'EXP gagnée en jouant avec un vrai coéquipier (pas avec le bot).'
      : 'EXP earned playing with a real teammate (not the bot).'}</p>` : ''}
    ${G.playerRegistered ? '' : `<p class="top20-note">${f
      ? 'Connecte-toi avec ton compte pour apparaître dans le classement.'
      : 'Sign in with your account to appear in the leaderboard.'}</p>`}`;
  body.querySelectorAll('[data-board]').forEach(btn => {
    btn.onclick = () => {
      if (_board === btn.dataset.board) return;
      _board = btn.dataset.board;
      load(true);
    };
  });
}

async function load(showLoading = false) {
  const f = fr();
  if (showLoading) render([], f ? 'Chargement du classement…' : 'Loading the leaderboard…');
  try {
    const rows = await fetchTop(_board);
    if (!_open) return;
    render(rows, rows.length ? '' : (f ? 'Personne n’a encore de score ici.' : 'Nobody has a score here yet.'));
  } catch (error) {
    if (!_open) return;
    render([], error?.missing
      ? (f ? 'Le classement en ligne n’est pas encore activé.' : 'The online leaderboard is not set up yet.')
      : (f ? 'Classement en ligne indisponible pour le moment.' : 'Online leaderboard unavailable right now.'));
  }
}

function stopUpdates() {
  clearInterval(_refreshTimer);
  _refreshTimer = null;
  unsubscribeLive();
}

// Several score changes can arrive together: reload once.
function queueReload() {
  if (_reloadQueued) return;
  _reloadQueued = setTimeout(() => { _reloadQueued = null; if (_open) load(); }, 400);
}

async function subscribeLive() {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase || !_open || _channel) return;
    _channel = supabase
      .channel('top20-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, queueReload)
      .subscribe();
  } catch (_) { /* the periodic refresh still keeps it current */ }
}

async function unsubscribeLive() {
  const channel = _channel;
  _channel = null;
  if (!channel) return;
  try { (await getSupabaseClient())?.removeChannel(channel); } catch (_) {}
}

export async function openLeaderboard() {
  const panel = $('lobby-top20');
  if (!panel) return;
  panel.classList.remove('hidden');
  _open = true;
  pushLeaderboardScore();   // our latest EXP goes up first
  try { _myId = (await getSupabaseSession())?.user?.id || null; } catch (_) { _myId = null; }
  await load(true);
  if (_tableMissing || !_open) return;
  subscribeLive();
  clearInterval(_refreshTimer);
  _refreshTimer = setInterval(() => { if (_open) load(); }, REFRESH_MS);
}

export function closeLeaderboard() {
  $('lobby-top20')?.classList.add('hidden');
  _open = false;
  stopUpdates();
}

export function initLeaderboard() {
  $('btn-lobby-top20')?.addEventListener('click', openLeaderboard);
  $('btn-top20-close')?.addEventListener('click', closeLeaderboard);
  // A signed-in player's score is published at start-up too.
  pushLeaderboardScore();
}
