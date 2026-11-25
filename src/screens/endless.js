// ENDLESS MODE ("Mode Infini" / "Endless Mode"): the lobby button, the screen
// before a game (the player's exercises, plane hearts, record), the counter in
// the game, the "+10 !" steps, the end screen and the Endless leaderboard (its
// own board: systems/endless-board.js; the TOP 20 and the multiplayer board
// are not touched). The game itself: game.js (_endless), numbers:
// data/endless.js.
import { G } from '../state.js';
import { getLang } from '../i18n.js';
import { SFX } from '../audio/sound.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { endlessHearts, ENDLESS_STEP_COINS, ENDLESS_STEP_XP } from '../data/endless.js';
import { decimalSettings } from '../game/decimals.js';
import { coinIcon, expIcon, uiIcon } from '../utils/icons.js';
import { getSupabaseSession } from '../systems/supabase-client.js';
import {
  endlessRecord, saveEndlessRecord, finishEndlessRun, fetchEndlessBoard, fetchEndlessMyBest,
} from '../systems/endless-board.js';

const fr = () => getLang() === 'fr';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const planeShort = id => (AIRCRAFT[id]?.name || String(id || '').toUpperCase()).split(' ')[0];

// The player's exercises in a short label that reads the same in French and
// English (for the leaderboard): "+ − × ÷ · ≤100", "1/2 % 3,5"...
export function endlessExercisesLabel() {
  const topics = (G.focusTopics?.length ? G.focusTopics : (G.focusOperations || []));
  const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷', fractions: '1/2', percentages: '%', exponent: 'x²', algebra: 'x=?', decimals: '0,5' };
  const parts = topics.map(t => SYM[t]).filter(Boolean);
  if (topics.includes('decimals')) {
    const d = decimalSettings(G.decimalSettings);
    parts[parts.indexOf('0,5')] = `0,5 (${d.ops.map(o => SYM[o]).join('')})`;
  }
  const range = Number(G.numberRangeMax) > 0 ? ` · ≤${G.numberRangeMax}` : '';
  return parts.length ? `${parts.join(' ')}${range}` : (fr() ? `Mon niveau${range}` : `My level${range}`);
}

// Same, in words, for the player.
function exercisesInWords() {
  const topics = (G.focusTopics?.length ? G.focusTopics : (G.focusOperations || []));
  const F = fr();
  const NAMES = {
    '+': F ? 'Addition' : 'Addition', '-': F ? 'Soustraction' : 'Subtraction',
    '*': F ? 'Multiplication' : 'Multiplication', '/': F ? 'Division' : 'Division',
    fractions: 'Fractions', percentages: F ? 'Pourcentages' : 'Percentages',
    exponent: F ? 'Exposant' : 'Exponent', algebra: F ? 'Algèbre' : 'Algebra',
    decimals: F ? 'Nombres à virgule' : 'Decimals',
  };
  const list = topics.map(t => NAMES[t]).filter(Boolean);
  const range = Number(G.numberRangeMax) > 0 ? (F ? `Nombres de 0 à ${G.numberRangeMax}` : `Numbers from 0 to ${G.numberRangeMax}`) : '';
  return { list: list.length ? list : [F ? 'Les exercices de ton niveau' : 'Your level’s exercises'], range };
}

// ── Lobby button ────────────────────────────────────────────────────────────
export function initEndless(nav) {
  document.getElementById('btn-lobby-endless')?.addEventListener('click', () => { SFX.click?.(); openEndlessIntro(nav); });
}
export function updateEndlessButton() {
  const label = document.getElementById('jx-endless-label');
  if (label) label.textContent = fr() ? 'INFINI' : 'ENDLESS';
}

function overlay(id, cls) {
  document.getElementById(id)?.remove();
  const el = document.createElement('div');
  el.id = id;
  el.className = `endless-overlay ${cls || ''}`;
  document.body.appendChild(el);
  return el;
}

// ── Before a game ──────────────────────────────────────────────────────────
export function openEndlessIntro(nav) {
  const F = fr();
  const el = overlay('endless-intro', 'is-intro');
  const ex = exercisesInWords();
  const hearts = endlessHearts(G.activeAircraft);
  const heart = '<img src="/assets/fx/Iteam/heart-full.png" alt="">';
  el.innerHTML = `
    <div class="endless-card">
      <button class="endless-x" type="button" aria-label="${F ? 'Fermer' : 'Close'}">${uiIcon('x')}</button>
      <div class="endless-logo">∞</div>
      <h2 class="endless-title">${F ? 'MODE INFINI' : 'ENDLESS MODE'}</h2>
      <p class="endless-goal">${F ? 'Réponds juste au plus de questions possible. Chaque vague est plus dure !' : 'Answer as many questions right as you can. Every wave is harder!'}</p>
      <div class="endless-box">
        <small>${F ? 'TES EXERCICES' : 'YOUR EXERCISES'}</small>
        <b>${esc(ex.list.join(' · '))}</b>
        ${ex.range ? `<span>${esc(ex.range)}</span>` : ''}
        <button class="endless-link" type="button" data-change>${F ? 'Changer mes exercices' : 'Change my exercises'}</button>
      </div>
      <div class="endless-row">
        <div class="endless-box is-small"><small>${esc(planeShort(G.activeAircraft))}</small><b class="endless-hearts">${heart.repeat(hearts)}</b></div>
        <div class="endless-box is-small"><small>${F ? 'TON RECORD' : 'YOUR RECORD'}</small><b>${endlessRecord()}</b></div>
      </div>
      ${G.playerRegistered ? '' : `<p class="endless-guest">${F ? 'Crée ton compte pour entrer au classement' : 'Create your account to enter the leaderboard'}</p>`}
      <div class="endless-actions">
        <button class="endless-btn is-alt" type="button" data-board>${F ? 'CLASSEMENT' : 'LEADERBOARD'}</button>
        <button class="endless-btn is-go" type="button" data-play>${F ? 'JOUER' : 'PLAY'}</button>
      </div>
    </div>`;
  el.querySelector('.endless-x').onclick = () => el.remove();
  el.querySelector('[data-play]').onclick = () => { el.remove(); nav.toEndless(); };
  el.querySelector('[data-board]').onclick = () => { el.remove(); openEndlessTab(); };
  el.querySelector('[data-change]').onclick = () => {
    el.remove();
    window._editLevelAndExercises?.(() => openEndlessIntro(nav));
  };
}

// ── In the game ────────────────────────────────────────────────────────────
function hud() {
  let el = document.getElementById('endless-hud');
  if (el) return el;
  const host = document.getElementById('s-game');
  if (!host) return null;
  el = document.createElement('div');
  el.id = 'endless-hud';
  el.className = 'endless-hud hidden';
  el.innerHTML = '<b class="eh-correct">0</b><span class="eh-sub"></span>';
  host.appendChild(el);
  return el;
}
export function showEndlessHud(state) {
  const el = hud();
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.toggle('is-gentle', !!state.gentle);
  document.getElementById('s-game')?.classList.add('is-endless');
  updateEndlessHud(state);
}
export function updateEndlessHud({ correct = 0, errors = 0, wave = 1 }) {
  const el = document.getElementById('endless-hud');
  if (!el) return;
  const F = fr();
  const b = el.querySelector('.eh-correct');
  if (b.textContent !== String(correct)) {
    b.textContent = String(correct);
    b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump');
  }
  el.querySelector('.eh-sub').textContent = `${F ? 'VAGUE' : 'WAVE'} ${wave} · ✕ ${errors}`;
  el.setAttribute('aria-label', F ? `${correct} bonnes réponses, ${errors} erreurs, vague ${wave}` : `${correct} correct, ${errors} errors, wave ${wave}`);
}
export function hideEndlessHud() {
  document.getElementById('endless-hud')?.classList.add('hidden');
  document.getElementById('s-game')?.classList.remove('is-endless');
}

// Every 10 correct answers: "+10 !", the coins and EXP, the new wave.
export function endlessStepFx({ coins, xp, wave, gentle }) {
  const host = document.getElementById('s-game');
  if (!host) return;
  SFX.shotStep?.();
  const F = fr();
  const el = document.createElement('div');
  el.className = `endless-step${gentle ? ' is-gentle' : ''}`;
  el.innerHTML = `<b>+10 !</b><span>${coinIcon()} +${coins} · ${expIcon()} +${xp}</span><em>${F ? 'VAGUE' : 'WAVE'} ${wave}</em>`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

// ── End of a game ──────────────────────────────────────────────────────────
export function showEndlessResult(result, nav) {
  if (!result) return;
  const F = fr();
  const newRecord = saveEndlessRecord(result.correct);
  const el = overlay('endless-result', 'is-result');
  el.innerHTML = `
    <div class="endless-card">
      <h2 class="endless-title">${F ? 'MODE INFINI' : 'ENDLESS MODE'}</h2>
      ${newRecord && result.correct > 0 ? `<div class="endless-record">${F ? 'NOUVEAU RECORD !' : 'NEW RECORD!'}</div>` : ''}
      <div class="endless-score"><b>${result.correct}</b><small>${F ? 'BONNES RÉPONSES' : 'CORRECT ANSWERS'}</small></div>
      <div class="endless-row is-three">
        <div class="endless-box is-small"><small>${F ? 'ERREURS' : 'ERRORS'}</small><b>${result.errors}</b></div>
        <div class="endless-box is-small"><small>${F ? 'MEILLEURE SÉRIE' : 'BEST STREAK'}</small><b>${result.bestStreak}</b></div>
        <div class="endless-box is-small"><small>${F ? 'VAGUE' : 'WAVE'}</small><b>${result.wave}</b></div>
      </div>
      <div class="endless-box"><small>${F ? 'EXERCICES TRAVAILLÉS' : 'EXERCISES PRACTISED'}</small><b>${esc(exercisesInWords().list.join(' · '))}</b></div>
      <p class="endless-status" data-status>${G.playerRegistered ? (F ? 'Envoi au classement…' : 'Sending to the leaderboard…')
        : (F ? 'Crée ton compte pour entrer au classement' : 'Create your account to enter the leaderboard')}</p>
      <div class="endless-actions">
        <button class="endless-btn is-alt" type="button" data-menu>${F ? 'MENU' : 'MENU'}</button>
        <button class="endless-btn is-alt" type="button" data-board>${F ? 'CLASSEMENT' : 'LEADERBOARD'}</button>
        <button class="endless-btn is-go" type="button" data-again>${F ? 'REJOUER' : 'PLAY AGAIN'}</button>
      </div>
    </div>`;
  el.querySelector('[data-menu]').onclick = () => el.remove();
  el.querySelector('[data-board]').onclick = () => { el.remove(); openEndlessTab(); };
  el.querySelector('[data-again]').onclick = () => { el.remove(); nav.toEndless(); };
  if (G.playerRegistered) {
    finishEndlessRun(result).then(status => {
      const p = el.querySelector('[data-status]');
      if (!p) return;
      p.textContent = status === 'ok' ? (F ? 'Score envoyé au classement !' : 'Score sent to the leaderboard!')
        : status === 'refused' ? (F ? 'Score non retenu par le serveur.' : 'Score not accepted by the server.')
        : (F ? 'Classement indisponible pour l’instant.' : 'Leaderboard not available right now.');
    });
  }
}

// CLASSEMENT: the TOP 20 MONDIAL page, on its INFINI tab (leaderboard.js).
function openEndlessTab() {
  if (window._openTop20) window._openTop20('endless');
  else openEndlessBoard();
}

// ── Leaderboard (own page: fallback when the TOP 20 page is not there) ─────
export async function openEndlessBoard() {
  const F = fr();
  const el = overlay('endless-board', 'is-board');
  el.innerHTML = `
    <div class="endless-card is-wide">
      <button class="endless-x" type="button" aria-label="${F ? 'Fermer' : 'Close'}">${uiIcon('x')}</button>
      <h2 class="endless-title">${F ? 'CLASSEMENT INFINI' : 'ENDLESS LEADERBOARD'}</h2>
      <p class="endless-goal">${F ? 'Le plus de bonnes réponses ; à égalité, le moins d’erreurs ; puis le premier arrivé.' : 'Most correct answers; on a tie, fewest errors; then whoever got there first.'}</p>
      <div class="endless-list" data-list><p class="endless-status">${F ? 'Chargement…' : 'Loading…'}</p></div>
      ${G.playerRegistered ? '<p class="endless-status" data-me></p>' : `<p class="endless-guest">${F ? 'Crée ton compte pour entrer au classement' : 'Create your account to enter the leaderboard'}</p>`}
    </div>`;
  el.querySelector('.endless-x').onclick = () => el.remove();
  const [rows, session] = await Promise.all([fetchEndlessBoard(20), getSupabaseSession().catch(() => null)]);
  const list = el.querySelector('[data-list]');
  if (!list) return;
  if (!rows) { list.innerHTML = `<p class="endless-status">${F ? 'Classement indisponible pour l’instant.' : 'Leaderboard not available right now.'}</p>`; return; }
  if (!rows.length) { list.innerHTML = `<p class="endless-status">${F ? 'Personne encore. Sois le premier !' : 'Nobody yet. Be the first!'}</p>`; return; }
  const myId = session?.user?.id || null;
  list.innerHTML = `
    <div class="eb-row eb-head"><span>#</span><span>${F ? 'PILOTE' : 'PILOT'}</span><span>${F ? 'AVION' : 'PLANE'}</span><span>${F ? 'EXERCICES' : 'EXERCISES'}</span><span>✓</span><span>✕</span></div>
    ${rows.map(r => `
      <div class="eb-row${r.id && r.id === myId ? ' is-me' : ''}">
        <span class="eb-rank">${r.rank}</span><span class="eb-name">${esc(r.name)}</span>
        <span class="eb-plane">${esc(planeShort(r.aircraft))}</span><span class="eb-ex">${esc(r.exercises)}</span>
        <b class="eb-correct">${r.correct}</b><span class="eb-errors">${r.errors}</span>
      </div>`).join('')}`;
  const me = el.querySelector('[data-me]');
  if (me && !rows.some(r => r.id === myId)) {
    const best = await fetchEndlessMyBest();
    if (best && el.isConnected) me.textContent = F ? `Ta place : ${best.rank}e · ${best.correct} bonnes réponses, ${best.errors} erreurs` : `Your place: #${best.rank} · ${best.correct} correct, ${best.errors} errors`;
  }
}

// Shown in the steps of the reward (data used by the end screen too).
export const ENDLESS_STEP = { coins: ENDLESS_STEP_COINS, xp: ENDLESS_STEP_XP };
