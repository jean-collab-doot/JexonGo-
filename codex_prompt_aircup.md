# Codex Prompt — Air Cup: Tournament of Aces (JexonGo World Cup 2026 Event)

## Project Context

JexonGo is an educational aerial combat game (HTML5 Canvas + Vanilla JS + Vite). Players control an aircraft and must answer math questions correctly to fire missiles and destroy enemies. A multiplayer WebSocket server (`server.js`) is already in place with 1v1 matchmaking, rooms, server-side question generation, and LP calculation.

## Feature to Implement: "Air Cup" — Tournament of Aces

### Overview

A one-month limited-time tournament mode (World Cup 2026) using a single-elimination bracket. 8 pilots compete in 1v1 aerial math combat. Structure: Quarterfinals → Semifinals → Grand Final. The winner earns the "Ace Champion" title and exclusive rewards. Empty slots are filled by bots. **The entire feature is gated behind a date flag — the default game must remain 100% unchanged before and after the event.**

---

## 0. Date Flag — Single Source of Truth

This is the most important step. All event logic, UI, and server handlers must branch on this flag. Nothing event-related should ever run outside the active window.

### `src/state.js` — add alongside the existing `G` object

```js
// Air Cup event window — edit these two dates to reactivate for future events
export const AIR_CUP_START = new Date('2026-06-11T00:00:00Z').getTime();
export const AIR_CUP_END   = new Date('2026-07-15T23:59:59Z').getTime();

export const IS_AIR_CUP_ACTIVE =
  Date.now() >= AIR_CUP_START && Date.now() <= AIR_CUP_END;
```

### Usage pattern (apply everywhere below)

```js
import { IS_AIR_CUP_ACTIVE } from '../state.js';

if (IS_AIR_CUP_ACTIVE) {
  // show event UI, apply WC theme, enable tournament
} else {
  // default game, no trace of the event
}
```

**Rule:** every new function, button, CSS class, and WebSocket handler introduced in this feature must be unreachable when `IS_AIR_CUP_ACTIVE === false`. No exceptions.

---

## 1. `server.js` Changes

### New constants — add after existing constants at the top

```js
const AIR_CUP_START_SERVER = new Date('2026-06-11T00:00:00Z').getTime();
const AIR_CUP_END_SERVER   = new Date('2026-07-15T23:59:59Z').getTime();

const isAirCupActive = () => {
  const now = Date.now();
  return now >= AIR_CUP_START_SERVER && now <= AIR_CUP_END_SERVER;
};

// Active tournaments map: tournamentId → TournamentState
const tournaments = new Map();
let _tid = 0;
```

### Data shape (JSDoc — no runtime changes needed)

```js
/*
TournamentState = {
  id:        number,
  bracket: [
    // Round 0 = quarterfinals (4 matches)
    // Round 1 = semifinals   (2 matches)
    // Round 2 = grand final  (1 match)
    Array<{ p1: SlotInfo, p2: SlotInfo, roomId: number|null, winner: SlotInfo|null }>
  ],
  createdAt: number,
  status:    'in_progress' | 'done',
  champion:  SlotInfo | null
}

SlotInfo = {
  name:  string,          // pilot callsign, e.g. "F-22 HAWK"
  lp:    number,
  isBot: boolean,
  ws:    WebSocket | null // null for bots
}
*/
```

### New function: `createTournament(players)`

```js
/**
 * Creates an Air Cup tournament with up to 8 players.
 * Missing slots are filled with bots.
 * @param {Array<{ws, name, lp, isBot}>} players
 * @returns {TournamentState}
 */
function createTournament(players) {
  const BOT_NAMES = ['F-22 HAWK','SR-71 ACE','B-2 GHOST','F-35 VIPER',
                     'F-16 STORM','C-17 IRON','U-2 RECON','F/A-18 REX'];
  const BOT_LP    = [800, 600, 750, 500, 650, 400, 700, 550];

  const slots = [...players];
  while (slots.length < 8) {
    const i = slots.length;
    slots.push({ ws: null, name: BOT_NAMES[i], lp: BOT_LP[i], isBot: true });
  }

  // Shuffle seeds
  slots.sort(() => Math.random() - 0.5);

  // Build quarterfinal bracket (4 matches)
  const quarterfinals = [];
  for (let i = 0; i < 8; i += 2) {
    quarterfinals.push({ p1: slots[i], p2: slots[i + 1], roomId: null, winner: null });
  }

  const id = ++_tid;
  const state = {
    id,
    bracket: [quarterfinals, [], []],
    status: 'in_progress',
    champion: null,
    createdAt: Date.now(),
  };
  tournaments.set(id, state);
  return state;
}
```

### New function: `startTournamentRound(tournament, roundIdx)`

```js
/**
 * Kicks off all matches in a given bracket round.
 * Bot-vs-bot matches resolve instantly server-side (no room needed).
 * Human-vs-bot and human-vs-human matches use _createTournamentRoom.
 */
function startTournamentRound(tournament, roundIdx) {
  const round = tournament.bracket[roundIdx];

  round.forEach((match, matchIdx) => {
    // Both bots: resolve immediately, no WebSocket room needed
    if (match.p1.isBot && match.p2.isBot) {
      const winner = Math.random() < 0.5 ? match.p1 : match.p2;
      match.winner = winner;
      _advanceTournament(tournament, roundIdx, matchIdx);
      return;
    }

    _createTournamentRoom(match.p1, match.p2, (winnerSeat) => {
      match.winner = winnerSeat === 'p1' ? match.p1 : match.p2;
      _advanceTournament(tournament, roundIdx, matchIdx);
    });
  });
}
```

### New function: `_createTournamentRoom(slotA, slotB, onComplete)`

Copy the existing `_createRoom` logic exactly, then apply these two changes only:

1. Accept an `onComplete(winnerSeat: 'p1'|'p2')` callback and call it inside `_endGame` after LP is calculated.
2. If either slot `isBot`, call `_runBotInRoom(room, seat)` immediately after the room is created.

```js
function _createTournamentRoom(slotA, slotB, onComplete) {
  // ... identical to _createRoom setup (questions, hp, score, timeout) ...
  // room._onComplete = onComplete;

  // Attach bot to the correct seat
  if (slotA.isBot) _runBotInRoom(room, 'p1');
  if (slotB.isBot) _runBotInRoom(room, 'p2');

  // Send 'matched' only to real players
  if (!slotA.isBot) send(slotA.ws, { type:'matched', roomId:id, opponentName:slotB.name, opponentLP:slotB.lp, isP1:true });
  if (!slotB.isBot) send(slotB.ws, { type:'matched', roomId:id, opponentName:slotA.name, opponentLP:slotA.lp, isP1:false });

  setTimeout(() => { if (rooms.has(id)) _nextQ(room); }, 3200);
}
```

### New function: `_runBotInRoom(room, botSeat)`

```js
/**
 * Simulates a bot answering questions in a room.
 * Accuracy and delay are randomised to feel human.
 * Called once per room; fires on every new question via room._botCallback.
 */
function _runBotInRoom(room, botSeat) {
  const BOT_ACCURACY  = 0.72; // 72% correct answers
  const MIN_DELAY_MS  = 2000;
  const MAX_DELAY_MS  = 7000;

  room._botSeat = botSeat;
  room._botCallback = () => {
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    setTimeout(() => {
      if (!rooms.has(room.id)) return;
      const q = room.questions[room.qIdx];
      if (!q) return;
      const correct = Math.random() < BOT_ACCURACY;
      const answer  = correct
        ? q.answer
        : (q.choices.find(c => c !== q.answer) ?? q.answer + 1);
      _handleAnswer(room, botSeat, answer);
    }, delay);
  };
}
```

### Modify existing `_nextQ` — add one line after `sendBoth`

```js
function _nextQ(room) {
  // ... existing code unchanged ...

  sendBoth(room, { type:'question', qNum: room.qIdx + 1, total: TOTAL_Q, text: q.text, choices: q.choices });

  // NEW: trigger bot answer if a bot is attached to this room
  if (room._botCallback) room._botCallback();

  // ... existing timeout unchanged ...
}
```

### New function: `_advanceTournament(tournament, roundIdx, matchIdx)`

```js
/**
 * Called after each match ends.
 * If all matches in the round are done, builds and starts the next round.
 * If it was the final, crowns the champion.
 */
function _advanceTournament(tournament, roundIdx, matchIdx) {
  const round = tournament.bracket[roundIdx];

  // Wait until every match in this round has a winner
  if (!round.every(m => m.winner !== null)) return;

  const winners = round.map(m => m.winner);

  // Grand Final complete → crown champion
  if (roundIdx === 2) {
    tournament.status   = 'done';
    tournament.champion = winners[0];
    _broadcastTournamentResult(tournament);
    return;
  }

  // Build next round from winners
  const nextRound = [];
  for (let i = 0; i < winners.length; i += 2) {
    nextRound.push({ p1: winners[i], p2: winners[i + 1], roomId: null, winner: null });
  }
  tournament.bracket[roundIdx + 1] = nextRound;

  _broadcastBracketUpdate(tournament);

  // 5-second pause between rounds for suspense
  setTimeout(() => startTournamentRound(tournament, roundIdx + 1), 5000);
}
```

### New function: `_broadcastBracketUpdate(tournament)`

```js
function _broadcastBracketUpdate(tournament) {
  const payload = {
    type:         'bracket_update',
    tournamentId: tournament.id,
    status:       tournament.status,
    bracket: tournament.bracket.map(round =>
      round.map(match => ({
        p1:     { name: match.p1.name, lp: match.p1.lp, isBot: match.p1.isBot },
        p2:     { name: match.p2.name, lp: match.p2.lp, isBot: match.p2.isBot },
        winner: match.winner ? match.winner.name : null,
      }))
    ),
  };

  // Send only to real players in this tournament
  tournament.bracket.forEach(round => {
    round.forEach(match => {
      if (!match.p1.isBot && match.p1.ws) send(match.p1.ws, payload);
      if (!match.p2.isBot && match.p2.ws) send(match.p2.ws, payload);
    });
  });
}
```

### New function: `_broadcastTournamentResult(tournament)`

```js
function _broadcastTournamentResult(tournament) {
  _broadcastBracketUpdate(tournament); // final bracket state first
  const payload = {
    type:         'tournament_end',
    tournamentId: tournament.id,
    champion:     {
      name:  tournament.champion.name,
      lp:    tournament.champion.lp,
      isBot: tournament.champion.isBot,
    },
  };
  tournament.bracket[0].forEach(match => {
    if (!match.p1.isBot && match.p1.ws) send(match.p1.ws, payload);
    if (!match.p2.isBot && match.p2.ws) send(match.p2.ws, payload);
  });
}
```

### New WebSocket message handler: `join_tournament`

Add inside the existing `ws.on('message')` switch, **before** the `default` case. The existing `join` case for normal matchmaking is untouched.

```js
case 'join_tournament': {
  // Hard gate — reject outside the event window
  if (!isAirCupActive()) {
    send(ws, { type: 'error', code: 'AIR_CUP_INACTIVE', message: 'Air Cup event is not active.' });
    break;
  }

  // Prevent joining a second tournament
  if (ws._tournamentId) {
    send(ws, { type: 'error', code: 'ALREADY_IN_TOURNAMENT', message: 'You are already in a tournament.' });
    break;
  }

  const entry = {
    ws,
    name:  String(msg.name || 'PILOT').toUpperCase().slice(0, 14),
    lp:    Math.max(0, Number(msg.lp) || 0),
    isBot: false,
  };

  const tournament = createTournament([entry]);
  ws._tournamentId = tournament.id;

  send(ws, { type: 'tournament_created', tournamentId: tournament.id });
  _broadcastBracketUpdate(tournament);

  // Brief countdown before quarterfinals begin
  setTimeout(() => startTournamentRound(tournament, 0), 3000);
  break;
}
```

Also add cleanup in the existing `ws.on('close')` handler:

```js
// Inside ws.on('close'), after existing room cleanup:
if (ws._tournamentId) {
  // Player disconnected mid-tournament — their current match opponent_left
  // already handled by existing room close logic; just clear the reference
  ws._tournamentId = null;
}
```

---

## 2. New file: `src/screens/aircup.js`

```js
import { IS_AIR_CUP_ACTIVE } from '../state.js';
import { G } from '../state.js';
import { showScreen } from '../utils/dom.js';

let _ws = null;

export function initAirCup() {
  if (!IS_AIR_CUP_ACTIVE) {
    // Should never be reached because the button is hidden, but guard anyway
    showScreen('menu');
    return;
  }

  _ws = new WebSocket(`ws://${location.host}`);

  _ws.onopen = () => {
    _ws.send(JSON.stringify({
      type: 'join_tournament',
      name: G.pilotName,
      lp:   G.lp,
    }));
  };

  _ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    switch (msg.type) {
      case 'tournament_created':
        setStatus('Bracket ready — quarterfinals starting in 3 seconds...');
        break;
      case 'bracket_update':
        renderBracket(msg.bracket);
        break;
      case 'matched':
        // Hand off to the existing game screen in tournament mode
        setStatus('Your match is starting!');
        showScreen('game');
        // Pass tournament context so game screen can report result back
        import('./game.js').then(m => m.startTournamentMatch(msg));
        break;
      case 'tournament_end':
        if (msg.champion.name === G.pilotName) {
          renderChampionScreen(msg.champion);
        } else {
          setStatus(`Tournament over. Champion: ${msg.champion.name}`);
        }
        break;
      case 'error':
        setStatus(msg.message);
        break;
    }
  };

  _ws.onclose = () => setStatus('Connection lost.');

  document.getElementById('aircup-exit')?.addEventListener('click', () => {
    _ws?.close();
    showScreen('menu');
  });
}

export function renderBracket(bracketData) {
  const container = document.querySelector('.aircup-bracket');
  if (!container) return;
  container.innerHTML = '';

  const roundNames = ['Quarterfinals', 'Semifinals', 'Grand Final'];

  bracketData.forEach((round, roundIdx) => {
    const col = document.createElement('div');
    col.className = 'bracket-col';

    const label = document.createElement('p');
    label.className = 'bracket-round-label';
    label.textContent = roundNames[roundIdx] ?? `Round ${roundIdx + 1}`;
    col.appendChild(label);

    round.forEach(match => {
      const matchEl = document.createElement('div');
      matchEl.className = 'bracket-match';

      [match.p1, match.p2].forEach(player => {
        const slot = document.createElement('div');
        slot.className = 'bracket-slot';
        if (match.winner === player.name) slot.classList.add('slot-winner');
        if (player.isBot)                slot.classList.add('slot-bot');
        if (player.name === G.pilotName) slot.classList.add('slot-me');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = player.name;
        slot.appendChild(nameSpan);

        if (player.isBot) {
          const badge = document.createElement('span');
          badge.className = 'badge-bot';
          badge.textContent = 'BOT';
          slot.appendChild(badge);
        }
        matchEl.appendChild(slot);
      });

      col.appendChild(matchEl);
    });

    container.appendChild(col);
  });
}

function renderChampionScreen(champion) {
  const el = document.getElementById('screen-aircup');
  if (!el) return;
  el.innerHTML = `
    <div class="aircup-champion">
      <div class="trophy-icon"></div>
      <h2>Ace Champion</h2>
      <p>${champion.name}</p>
      <p class="champion-sub">Air Cup 2026 · Tournament of Aces</p>
      <p class="champion-reward">+1000 XP &nbsp;·&nbsp; +500 Jet Points &nbsp;·&nbsp; Air Cup Champion livery unlocked</p>
      <button id="aircup-exit" class="btn-primary">Return to base</button>
    </div>
  `;
  document.getElementById('aircup-exit')?.addEventListener('click', () => showScreen('menu'));
}

function setStatus(text) {
  const el = document.getElementById('aircup-status');
  if (el) el.textContent = text;
}
```

---

## 3. HTML — add to `index.html`

Add this screen div alongside the other `class="screen"` divs. It is hidden by default and only shown when the player clicks the Squadron button.

```html
<div id="screen-aircup" class="screen">
  <div class="aircup-header">
    <h1>Tournament of Aces</h1>
    <p class="aircup-subtitle">Air Cup · World Cup 2026</p>
  </div>

  <div class="aircup-bracket">
    <!-- Dynamically populated by renderBracket() -->
  </div>

  <div class="aircup-status" id="aircup-status">
    Connecting to server...
  </div>

  <button id="aircup-exit" class="btn-secondary">Leave tournament</button>
</div>
```

---

## 4. `src/screens/menu.js` — add the Squadron button

```js
import { IS_AIR_CUP_ACTIVE } from '../state.js';

// Inside the menu render function, after the HANGAR button:
if (IS_AIR_CUP_ACTIVE) {
  const btn = document.createElement('button');
  btn.id        = 'btn-aircup';
  btn.className = 'menu-btn menu-btn-event';
  btn.innerHTML = `SQUADRON <span class="menu-btn-sub">TOURNAMENT OF ACES · AIR CUP</span>`;
  menuContainer.appendChild(btn);

  btn.addEventListener('click', () => {
    showScreen('aircup');
    import('./aircup.js').then(m => m.initAirCup());
  });
}
// If IS_AIR_CUP_ACTIVE is false, the button simply never exists in the DOM
```

---

## 5. `style.css` — add Air Cup styles

These classes are only ever applied when `IS_AIR_CUP_ACTIVE` is true, but they are safe to include unconditionally in the stylesheet since unused classes have zero runtime cost.

```css
/* ── AIR CUP ── */
.menu-btn-event {
  border-color: #c8a84b;
  color: #c8a84b;
}

.aircup-header { text-align: center; padding: 1.5rem 0 1rem; }
.aircup-header h1 {
  font-family: 'retropix', monospace;
  color: #c8a84b;
  font-size: 2rem;
  margin: 0;
}
.aircup-subtitle {
  color: #5a8abf;
  font-family: monospace;
  font-size: 0.7rem;
  letter-spacing: 3px;
  margin: 0.25rem 0 0;
}

.aircup-bracket {
  display: flex;
  gap: 1rem;
  justify-content: center;
  align-items: flex-start;
  padding: 0 1rem;
  overflow-x: auto; /* mobile horizontal scroll */
}

.bracket-col      { display: flex; flex-direction: column; gap: 0.5rem; min-width: 110px; }
.bracket-round-label {
  font-family: monospace;
  font-size: 0.6rem;
  color: #5a8abf;
  text-align: center;
  letter-spacing: 2px;
  margin: 0 0 0.5rem;
  text-transform: uppercase;
}

.bracket-match    { display: flex; flex-direction: column; gap: 2px; margin-bottom: 1rem; }

.bracket-slot {
  background:    rgba(200,168,75,0.08);
  border:        1px solid rgba(200,168,75,0.3);
  border-radius: 6px;
  padding:       8px 10px;
  font-family:   monospace;
  font-size:     0.68rem;
  color:         #c8a84b;
  display:       flex;
  align-items:   center;
  justify-content: space-between;
  gap:           6px;
}
.bracket-slot.slot-winner {
  background:   rgba(200,168,75,0.25);
  border-color: #c8a84b;
  color:        #faeeda;
}
.bracket-slot.slot-me {
  border-color: #5a8abf;
  color:        #b5d4f4;
}
.bracket-slot.slot-bot { opacity: 0.55; }

.badge-bot {
  font-size:     0.55rem;
  background:    #1e3a5f;
  color:         #5a8abf;
  border-radius: 3px;
  padding:       1px 4px;
  flex-shrink:   0;
}

.aircup-status {
  text-align:   center;
  font-family:  monospace;
  font-size:    0.78rem;
  color:        #5a8abf;
  padding:      1rem;
  letter-spacing: 1px;
}

/* Champion screen */
.aircup-champion       { text-align: center; padding: 2rem 1rem; }
.aircup-champion h2    { font-family: 'retropix', monospace; color: #c8a84b; font-size: 1.6rem; margin: 0.5rem 0; }
.aircup-champion p     { color: #faeeda; font-family: monospace; margin: 0.25rem 0; }
.champion-sub          { color: #5a8abf; font-size: 0.7rem; letter-spacing: 2px; }
.champion-reward       { color: #c8a84b; font-size: 0.75rem; margin-top: 1rem; }

.trophy-icon {
  width:  64px;
  height: 64px;
  margin: 0 auto 1rem;
  background: #c8a84b;
  clip-path: polygon(30% 0%, 70% 0%, 70% 55%, 85% 55%, 80% 75%, 60% 75%, 60% 85%, 70% 85%, 70% 100%, 30% 100%, 30% 85%, 40% 85%, 40% 75%, 20% 75%, 15% 55%, 30% 55%);
}
```

---

## 6. `src/systems/xp.js` — tournament rewards

```js
/**
 * Returns XP, Jet Points, and unlocks for reaching a given tournament round.
 * Call this in the game result screen when a tournament match ends.
 * @param {number} round - 0 = quarterfinals, 1 = semifinals, 2 = champion
 * @returns {{ xp: number, jetPoints: number, title: string, skin?: string }}
 */
export function getTournamentReward(round) {
  const table = {
    0: { xp: 150,  jetPoints: 50,  title: 'Quarterfinalist' },
    1: { xp: 350,  jetPoints: 150, title: 'Semifinalist' },
    2: { xp: 1000, jetPoints: 500, title: 'Ace Champion · Air Cup 2026',
         skin: 'aircup_champion_livery' },
  };
  return table[round] ?? { xp: 50, jetPoints: 10, title: '' };
}
```

Apply the reward in `src/screens/result.js` when `G.tournamentRound` is set (set it before launching the game screen for tournament matches).

---

## Technical Constraints

- **Do not touch the existing `join` matchmaking flow.** Tournament uses a separate `join_tournament` message. Normal 1v1 is completely unaffected.
- **Bots have no WebSocket connection.** They are pure server-side `setTimeout` logic inside `_runBotInRoom`. Never pass a bot's `ws` to `send()`.
- **Bracket logic lives on the server only.** The client renders whatever `bracket_update` sends — no bracket computation client-side.
- **One tournament per player.** Guard with `ws._tournamentId` before creating a new tournament room.
- **Reuse the existing `generateQuestion` and `diffFromLP` functions** for tournament rooms — same math engine, same difficulty curve.
- **Mobile first.** The bracket must scroll horizontally on narrow screens (`overflow-x: auto` on `.aircup-bracket`).
- **The event window is the only switch.** When `IS_AIR_CUP_ACTIVE` is `false`, not a single line of Air Cup code runs, no button appears, and the server rejects `join_tournament` with a clean error. The default game is completely unchanged.

---

## Validation Checklist

Before marking this feature complete, verify all of the following:

1. Outside the event dates (`IS_AIR_CUP_ACTIVE === false`): the Squadron button does not exist in the DOM, and `join_tournament` returns `{ type: 'error', code: 'AIR_CUP_INACTIVE' }`.
2. A single real player can start a tournament — 7 bots fill the remaining slots automatically.
3. Bots answer with realistic delays (2–7 s) and win roughly 72% of their questions.
4. The bracket updates in real time on the client after each match resolves.
5. A player who loses in the quarterfinals can watch the rest of the bracket play out.
6. The Grand Final winner receives `{ xp: 1000, jetPoints: 500, skin: 'aircup_champion_livery' }`.
7. Normal 1v1 matchmaking (`join` message) works identically with no regressions.
8. The entire feature can be reactivated for a future event by changing only `AIR_CUP_START` and `AIR_CUP_END` in `src/state.js`.
