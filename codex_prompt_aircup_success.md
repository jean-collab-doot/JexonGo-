# Codex Prompt — Air Cup 80/20 Success System

## Context

JexonGo is an educational aerial math combat game (HTML5 Canvas + Vanilla JS + Vite + WebSocket server).
The Air Cup is a 1-month World Cup 2026 event (June 11 – July 15) with a single-elimination bracket tournament.
Everything below must be gated behind `IS_AIR_CUP_ACTIVE` from `src/state.js`.

This prompt implements the 4 features that drive 80% of retention:
1. Live bracket visible at all times
2. Exclusive disappearing reward visible to non-owners
3. Push notifications before each round
4. Retention logging (J+1, J+3, J+7)

Nothing else. Do not add nation systems, jet points economy, or leaderboards.

---

## Feature 1 — Live Bracket Always Visible

### Goal
Players open the app to CHECK the bracket, not just to play. Make the bracket the first thing they see when they return.

### Implementation

#### `src/screens/menu.js` — bracket preview widget

Below the PLAY button, always render a compact bracket preview when `IS_AIR_CUP_ACTIVE`:

```js
import { IS_AIR_CUP_ACTIVE } from '../state.js';
import { getStoredBracket }  from '../systems/aircup-storage.js';

function renderMenuBracketPreview() {
  if (!IS_AIR_CUP_ACTIVE) return;

  const bracket = getStoredBracket(); // last known bracket from localStorage
  if (!bracket) return;

  const wrap = document.createElement('div');
  wrap.id = 'menu-bracket-preview';
  wrap.innerHTML = `
    <p class="bracket-preview-label">AIR CUP — LIVE BRACKET</p>
    <div class="bracket-preview-rounds">
      ${bracket.map((round, i) => `
        <div class="bp-round">
          <p class="bp-round-name">${['QF','SF','FINAL'][i] ?? `R${i+1}`}</p>
          ${round.map(m => `
            <div class="bp-match">
              <span class="bp-slot ${m.winner === m.p1.name ? 'bp-won' : ''} ${m.p1.name === G.pilotName ? 'bp-me' : ''}">
                ${m.p1.name}
              </span>
              <span class="bp-vs">v</span>
              <span class="bp-slot ${m.winner === m.p2.name ? 'bp-won' : ''} ${m.p2.name === G.pilotName ? 'bp-me' : ''}">
                ${m.p2.name}
              </span>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
    <button id="btn-view-full-bracket" class="btn-event-small">VIEW FULL BRACKET →</button>
  `;

  document.getElementById('menu-container').appendChild(wrap);

  document.getElementById('btn-view-full-bracket')
    ?.addEventListener('click', () => showScreen('aircup'));
}
```

#### `src/systems/aircup-storage.js` — new file

```js
const KEY_BRACKET   = 'aircup_bracket';
const KEY_ROUND     = 'aircup_current_round';
const KEY_STATUS    = 'aircup_status';

export function storeBracket(bracket)    { localStorage.setItem(KEY_BRACKET, JSON.stringify(bracket)); }
export function getStoredBracket()       { try { return JSON.parse(localStorage.getItem(KEY_BRACKET)); } catch { return null; } }
export function storeRound(round)        { localStorage.setItem(KEY_ROUND, round); }
export function getStoredRound()         { return Number(localStorage.getItem(KEY_ROUND) ?? 0); }
export function storeTournamentStatus(s) { localStorage.setItem(KEY_STATUS, s); }
export function getTournamentStatus()    { return localStorage.getItem(KEY_STATUS); }
```

#### `src/screens/aircup.js` — save bracket on every update

In the `bracket_update` WebSocket handler:

```js
import { storeBracket, storeRound } from '../systems/aircup-storage.js';

case 'bracket_update':
  storeBracket(msg.bracket);
  storeRound(msg.bracket.findIndex(r => r.some(m => m.winner === null)));
  renderBracket(msg.bracket);
  break;
```

#### CSS for bracket preview (add to `style.css`)

```css
/* ── MENU BRACKET PREVIEW ── */
#menu-bracket-preview {
  margin: 12px 0;
  background: rgba(200,168,75,0.07);
  border: 1px solid rgba(200,168,75,0.25);
  border-radius: 10px;
  padding: 10px 12px;
}
.bracket-preview-label {
  font-family: monospace; font-size: 8px; color: #5a8abf;
  letter-spacing: 3px; margin-bottom: 8px;
}
.bp-round { margin-bottom: 6px; }
.bp-round-name { font-family: monospace; font-size: 7px; color: #3a5a7a; letter-spacing: 2px; margin-bottom: 3px; }
.bp-match { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
.bp-slot {
  font-family: monospace; font-size: 9px; color: rgba(200,168,75,0.5);
  background: rgba(0,0,0,0.2); border-radius: 4px; padding: 2px 6px; flex: 1;
}
.bp-slot.bp-won { color: #c8a84b; border: 1px solid rgba(200,168,75,0.4); }
.bp-slot.bp-me  { color: #b5d4f4; border: 1px solid rgba(90,138,191,0.4); }
.bp-vs { font-size: 7px; color: #3a5a7a; font-family: monospace; }
.btn-event-small {
  margin-top: 8px; background: transparent;
  border: 1px solid rgba(200,168,75,0.35); border-radius: 5px;
  color: #c8a84b; font-family: monospace; font-size: 9px;
  letter-spacing: 2px; padding: 5px 12px; cursor: pointer; width: 100%;
}
```

---

## Feature 2 — Exclusive Disappearing Reward Visible to Non-Owners

### Goal
Players who don't have the champion livery must SEE it locked in the hangar with the deadline. FOMO drives return visits.

### Implementation

#### `src/screens/hangar.js` — locked champion livery card

At the top of the hangar grid, when `IS_AIR_CUP_ACTIVE`, inject a special locked card if the player has not yet earned `aircup_champion_livery`:

```js
import { IS_AIR_CUP_ACTIVE, AIR_CUP_END } from '../state.js';

function renderChampionLiveryCard() {
  if (!IS_AIR_CUP_ACTIVE) return;
  if (G.unlockedSkins?.includes('aircup_champion_livery')) return; // already owned, don't show locked

  const daysLeft = Math.ceil((AIR_CUP_END - Date.now()) / 86_400_000);

  const card = document.createElement('div');
  card.className = 'hangar-card hangar-card-event locked';
  card.innerHTML = `
    <div class="event-card-glow"></div>
    <div class="event-card-plane">
      <!-- Reuse the existing aircraft silhouette draw function for F-22 -->
    </div>
    <p class="event-card-name">AIR CUP CHAMPION</p>
    <p class="event-card-skin-name">Champion Livery</p>
    <div class="event-card-lock">
      <span class="lock-icon">🔒</span>
      <span class="lock-label">WIN THE TOURNAMENT</span>
    </div>
    <div class="event-card-deadline">
      <span class="deadline-dot"></span>
      GONE IN ${daysLeft} DAY${daysLeft !== 1 ? 'S' : ''}
    </div>
    <button class="btn-event-enter" onclick="showScreen('aircup')">
      ENTER AIR CUP →
    </button>
  `;

  // Insert as first child of hangar grid
  const grid = document.getElementById('hangar-grid');
  grid.insertBefore(card, grid.firstChild);
}
```

#### CSS (add to `style.css`)

```css
/* ── EVENT LIVERY CARD ── */
.hangar-card-event {
  position: relative; overflow: hidden;
  border: 1.5px solid #c8a84b;
  border-radius: 12px; padding: 14px;
  background: rgba(10, 20, 40, 0.9);
}
.event-card-glow {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 30%, rgba(200,168,75,0.12), transparent 70%);
  pointer-events: none;
}
.event-card-name {
  font-family: monospace; font-size: 8px; color: #c8a84b;
  letter-spacing: 3px; margin-bottom: 2px;
}
.event-card-skin-name {
  font-family: 'retropix', monospace; font-size: 14px; color: #faeeda;
  margin-bottom: 8px;
}
.event-card-lock {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 6px;
}
.lock-label { font-family: monospace; font-size: 8px; color: rgba(200,168,75,0.6); letter-spacing: 1px; }
.event-card-deadline {
  display: flex; align-items: center; gap: 5px;
  font-family: monospace; font-size: 9px; color: #e63946;
  letter-spacing: 1px; margin-bottom: 10px;
}
.deadline-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #e63946;
  animation: pulse-dot 1s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
.btn-event-enter {
  width: 100%; background: #c8a84b; border: none; border-radius: 6px;
  color: #1a0a00; font-family: monospace; font-size: 10px;
  font-weight: 700; letter-spacing: 2px; padding: 8px 0; cursor: pointer;
}
.btn-event-enter:hover { background: #e8c96a; }
```

---

## Feature 3 — Push Notifications Before Each Round

### Goal
Bring back inactive players the day of their match. This single feature recovers the most churned users.

### Implementation

#### `src/systems/notifications.js` — new file

```js
/**
 * Request push permission and schedule round notifications.
 * Called once when the player joins the Air Cup.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Schedule a local notification for the next round.
 * Uses the Web Notifications API (no service worker required for basic support).
 * For production, replace with a proper service worker + Push API.
 *
 * @param {number} roundIndex - 0 = QF, 1 = SF, 2 = Final
 * @param {number} fireAtTimestamp - Unix ms when to show the notification
 */
export function scheduleRoundNotification(roundIndex, fireAtTimestamp) {
  if (Notification.permission !== 'granted') return;

  const labels  = ['Quarterfinals', 'Semifinals', 'Grand Final'];
  const label   = labels[roundIndex] ?? `Round ${roundIndex + 1}`;
  const delayMs = fireAtTimestamp - Date.now();

  if (delayMs <= 0) return; // already past

  setTimeout(() => {
    new Notification('Air Cup — JexonGo', {
      body: `Your ${label} match starts now. Get to the cockpit!`,
      icon: '/assets/menu/jexongo-icon.png',
      tag:  `aircup-round-${roundIndex}`, // prevents duplicate notifications
    });
  }, delayMs);
}

/**
 * Call this when the server sends a bracket_update with a new round starting.
 * Schedules a notification 1 hour before and another at match time.
 *
 * @param {number} roundIndex
 * @param {number} matchStartTimestamp - Unix ms of match start
 */
export function scheduleRoundAlerts(roundIndex, matchStartTimestamp) {
  scheduleRoundNotification(roundIndex, matchStartTimestamp - 60 * 60 * 1000); // 1h before
  scheduleRoundNotification(roundIndex, matchStartTimestamp);                   // at start
}
```

#### `server.js` — include `nextRoundAt` in bracket_update

In `_broadcastBracketUpdate`, add `nextRoundAt` to the payload:

```js
// In _advanceTournament, before calling startTournamentRound:
const nextRoundAt = Date.now() + 5000; // 5s delay already in code
tournament.nextRoundAt = nextRoundAt;

// In _broadcastBracketUpdate payload, add:
nextRoundAt: tournament.nextRoundAt ?? null,
```

#### `src/screens/aircup.js` — hook notifications into bracket_update

```js
import { scheduleRoundAlerts, requestNotificationPermission } from '../systems/notifications.js';

// When player joins tournament, request permission:
case 'tournament_created':
  await requestNotificationPermission();
  break;

// On each bracket update, schedule next round alerts:
case 'bracket_update':
  storeBracket(msg.bracket);
  renderBracket(msg.bracket);
  if (msg.nextRoundAt) {
    const currentRound = msg.bracket.findIndex(r => r.some(m => m.winner === null));
    scheduleRoundAlerts(currentRound, msg.nextRoundAt);
  }
  break;
```

---

## Feature 4 — Retention Logging (J+1, J+3, J+7)

### Goal
Measure what is actually working. Log two events only: `air_cup_join` and `session_start`. Everything else is noise.

### Implementation

#### `server.js` — append-only log file

```js
import fs   from 'fs';
import path from 'path';

const LOG_FILE = path.join(__dirname, 'data', 'retention.ndjson');

/**
 * Appends one JSON line to the retention log.
 * Format: { event, userId, timestamp }
 */
function logRetention(event, userId) {
  const line = JSON.stringify({ event, userId, timestamp: Date.now() }) + '\n';
  fs.appendFile(LOG_FILE, line, () => {}); // fire-and-forget, never blocks
}
```

Call `logRetention` in two places:

```js
// 1. When player joins Air Cup:
case 'join_tournament':
  logRetention('air_cup_join', hashEmail(msg.email ?? ws._addr ?? 'anon'));
  // ... rest of handler

// 2. On every WebSocket connection open:
wss.on('connection', (ws, req) => {
  ws._addr = req.socket.remoteAddress;
  logRetention('session_start', ws._addr);
  // ... rest of existing connection handler
```

#### `src/analytics/retention-report.js` — new file (run with `node`)

A simple script to compute J+1, J+3, J+7 retention from the log. Run manually anytime:

```js
// Usage: node src/analytics/retention-report.js
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(__dirname, '../../data/retention.ndjson');

const lines  = fs.readFileSync(LOG, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const joins  = lines.filter(l => l.event === 'air_cup_join');
const starts = lines.filter(l => l.event === 'session_start');

const DAY = 86_400_000;

function retentionRate(joinedUsers, daysAfter) {
  let returned = 0;
  for (const j of joinedUsers) {
    const windowStart = j.timestamp + daysAfter * DAY;
    const windowEnd   = windowStart + DAY;
    const didReturn   = starts.some(s =>
      s.userId === j.userId &&
      s.timestamp >= windowStart &&
      s.timestamp <= windowEnd
    );
    if (didReturn) returned++;
  }
  return joinedUsers.length ? ((returned / joinedUsers.length) * 100).toFixed(1) : 'N/A';
}

console.log(`Air Cup joins : ${joins.length}`);
console.log(`J+1 retention : ${retentionRate(joins, 1)}%`);
console.log(`J+3 retention : ${retentionRate(joins, 3)}%`);
console.log(`J+7 retention : ${retentionRate(joins, 7)}%`);
```

---

## Integration checklist for Codex

Complete these in order:

1. Create `src/systems/aircup-storage.js` — bracket persistence helpers
2. Create `src/systems/notifications.js` — permission request + scheduling
3. Create `src/analytics/retention-report.js` — retention script
4. Modify `src/screens/menu.js` — add bracket preview widget below PLAY button
5. Modify `src/screens/hangar.js` — add locked champion livery card at top of grid
6. Modify `src/screens/aircup.js` — call `storeBracket`, `scheduleRoundAlerts`, `requestNotificationPermission`
7. Modify `server.js` — add `logRetention`, `nextRoundAt` in broadcast payload
8. Add all CSS blocks to `style.css` under `/* ── AIR CUP SUCCESS ── */`

---

## Rules

- Every new function, DOM element, and CSS class must be unreachable when `IS_AIR_CUP_ACTIVE === false`
- `logRetention` is the only analytics call — no third-party SDK
- Notifications use the native Web Notifications API only — no service worker required
- Do not add nation systems, jet points economy, global leaderboards, or any other feature not listed here
- The default game must be 100% unchanged when the event is inactive

---

## Validation checklist

1. Bracket preview appears on the menu between PLAY and HANGAR buttons during the event
2. Bracket preview is absent from the DOM when `IS_AIR_CUP_ACTIVE === false`
3. Locked champion livery card is first item in hangar grid during event, gone after
4. Deadline countdown on the card updates correctly (days remaining)
5. Notification permission prompt fires once when player joins their first tournament
6. `data/retention.ndjson` grows by one line per session start and one per Air Cup join
7. `node src/analytics/retention-report.js` prints J+1, J+3, J+7 rates without errors
8. No regressions in normal 1v1 matchmaking or solo gameplay
