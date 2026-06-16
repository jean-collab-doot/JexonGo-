import { $, showScreen } from '../utils/dom.js';
import { G, IS_AIR_CUP_ACTIVE } from '../state.js';
import { SFX } from '../audio/sound.js';
import { wsConnect, wsSend, wsOn, wsOffAll, wsDisconnect, WS_URL } from '../online/ws-client.js';
import { enterArenaTournament } from './arena.js';

let _nav = null;
let _bound = false;
let _latestBracket = null;

const AIR_CUP_EVENTS = [
  'tournament_joined',
  'bracket_update',
  'matched',
  'tournament_end',
  'error',
  '_disconnect',
];

export function initAirCup(nav) {
  _nav = nav;
  $('btn-aircup-back')?.addEventListener('click', _leaveAirCup);
  $('btn-aircup-join')?.addEventListener('click', joinAirCup);
}

export function renderAirCup() {
  _bindHandlers();
  SFX.playMusic('menu');
  $('aircup-status').textContent = IS_AIR_CUP_ACTIVE
    ? 'READY FOR TAKEOFF'
    : 'EVENT CLOSED';
  $('btn-aircup-join').disabled = !IS_AIR_CUP_ACTIVE;
  _renderBracket(_latestBracket);
}

async function joinAirCup() {
  if (!IS_AIR_CUP_ACTIVE) return;
  $('aircup-status').textContent = 'CONNECTING...';
  $('btn-aircup-join').disabled = true;

  try {
    await wsConnect(WS_URL);
    _bindHandlers();
    wsSend({
      type: 'join_tournament',
      name: (G.playerName || 'PILOT').toUpperCase(),
      lp: G.rankedLP || 0,
    });
  } catch (_) {
    $('aircup-status').textContent = 'SERVER OFFLINE';
    $('btn-aircup-join').disabled = false;
  }
}

function _bindHandlers() {
  if (_bound) return;
  _bound = true;

  AIR_CUP_EVENTS.forEach(event => wsOffAll(event));

  wsOn('tournament_joined', () => {
    $('aircup-status').textContent = 'BRACKET LOCKED';
  });

  wsOn('bracket_update', msg => {
    _latestBracket = msg.bracket;
    $('aircup-status').textContent = `ROUND ${msg.round || 1}`;
    _renderBracket(msg.bracket);
  });

  wsOn('matched', msg => {
    if (!msg.tournament) return;
    showScreen('s-arena');
    enterArenaTournament(msg);
  });

  wsOn('tournament_end', msg => {
    showScreen('s-aircup');
    $('aircup-status').textContent = msg.won
      ? 'AIR CUP CHAMPION'
      : `${msg.winner || 'ACE'} WINS`;
    $('btn-aircup-join').disabled = !IS_AIR_CUP_ACTIVE;
    SFX.playMusic('menu');
    if (msg.won) SFX.levelWin?.();
  });

  wsOn('error', msg => {
    $('aircup-status').textContent = msg.message || 'AIR CUP ERROR';
    $('btn-aircup-join').disabled = !IS_AIR_CUP_ACTIVE;
  });

  wsOn('_disconnect', () => {
    $('aircup-status').textContent = 'DISCONNECTED';
    $('btn-aircup-join').disabled = !IS_AIR_CUP_ACTIVE;
  });
}

function _renderBracket(bracket) {
  const root = $('aircup-bracket');
  if (!root) return;

  const rounds = bracket || [
    [
      { a: 'YOU', b: 'ACE-7' },
      { a: 'VIPER', b: 'GHOST' },
      { a: 'NOVA', b: 'STORM' },
      { a: 'BLAZE', b: 'RAVEN' },
    ],
    [{ a: 'TBD', b: 'TBD' }, { a: 'TBD', b: 'TBD' }],
    [{ a: 'TBD', b: 'TBD' }],
  ];

  root.innerHTML = '';
  rounds.forEach((round, idx) => {
    const col = document.createElement('div');
    col.className = 'aircup-round';
    const title = document.createElement('div');
    title.className = 'aircup-round-title';
    title.textContent = idx === 0 ? 'QUARTERS' : idx === 1 ? 'SEMIS' : 'FINAL';
    col.appendChild(title);

    round.forEach(match => {
      const node = document.createElement('div');
      node.className = 'aircup-match';
      node.appendChild(_slot(match.a, match.winner === match.a));
      node.appendChild(_slot(match.b, match.winner === match.b));
      col.appendChild(node);
    });

    root.appendChild(col);
  });
}

function _slot(name, won) {
  const el = document.createElement('div');
  el.className = `aircup-slot${won ? ' aircup-slot-win' : ''}`;
  el.textContent = name || 'TBD';
  return el;
}

function _leaveAirCup() {
  wsSend({ type: 'leave' });
  wsDisconnect();
  _latestBracket = null;
  _nav.toMenu();
}
