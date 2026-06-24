# Codex Prompt — Football Math: World Cup Mode

## Overview

Replace the Air Cup tournament screen with a new game mode called **Football Math**.
It is a real-time 1v1 math soccer game played over WebSocket.
Each player controls a goalkeeper and answers independent math questions to earn shots on the opponent's goal.
Matches last 5 minutes with a halftime at 2:30.
The bracket structure (QF → SF → Final) from the removed Air Cup is kept but now uses Football Math matches.

This mode is gated behind `IS_AIR_CUP_ACTIVE` from `src/state.js` — same date window as before.

---

## 1. Game concept in one paragraph

Both players see their own independent math question at all times. When a player answers correctly, they **earn a shot** — the ball animates toward the opponent's goal. The opponent controls their goalkeeper in real time and tries to block it. If the goalkeeper doesn't reach the ball in time, it's a goal. Wrong answers lose a life (3 lives per player). The player with the most goals after 5 minutes wins. Halftime at 2:30 shows the score and pauses for 10 seconds.

---

## 2. New file: `src/screens/football.js`

This file owns the entire Football Math game screen. It uses **HTML5 Canvas** (reuse the existing canvas already in the project).

### Canvas layout (portrait mobile, ~390×700px)

```
┌─────────────────────────┐
│  P2 name   Score  Lives │  ← top HUD
│  [GOALKEEPER P2]        │
│                         │
│      ⚽ (ball)          │  ← pitch (center area)
│                         │
│  [GOALKEEPER P1]        │
│  P1 name   Score  Lives │  ← bottom HUD
│                         │
│  [ Question: 3 + 4 = ? ]│  ← question bar
│  [A]  [B]  [C]  [D]     │  ← answer buttons (DOM)
└─────────────────────────┘
```

---

## 3. Game objects

### Ball
```js
const ball = {
  x: CANVAS_W / 2,
  y: CANVAS_H / 2,
  radius: 14,
  vx: 0,
  vy: 0,
  isMoving: false,
  targetGoal: null, // 'top' | 'bottom'
  aimX: 0,          // random aim point within goal mouth
};
```

Ball travels at **600px/second** toward the goal when a shot is fired.
After a goal or save, ball returns to center over 0.8 seconds (lerp).

### Goalkeepers
```js
const gk = {
  p1: { x: CANVAS_W / 2, y: CANVAS_H * 0.82, width: 40, height: 14, speed: 320 },
  p2: { x: CANVAS_W / 2, y: CANVAS_H * 0.18, width: 40, height: 14, speed: 320 },
};
```

Goalkeepers move **only horizontally** within their goal mouth (clamp to goal width).
Goal mouth width: 120px, centered horizontally.

### Goals
```js
const goals = {
  top:    { x: CANVAS_W/2 - 60, y: 40,              w: 120, h: 16 },
  bottom: { x: CANVAS_W/2 - 60, y: CANVAS_H - 56,   w: 120, h: 16 },
};
```

---

## 4. Controls

### Mobile (touch) — thumb zones

Split the screen into two horizontal halves for left/right movement.
Each half of the screen is a touch zone:

```js
canvas.addEventListener('touchstart', e => {
  const touch = e.touches[0];
  const halfW = CANVAS_W / 2;
  if (touch.clientX < halfW) {
    G.input.left = true;
  } else {
    G.input.right = true;
  }
}, { passive: true });

canvas.addEventListener('touchend', () => {
  G.input.left = false;
  G.input.right = false;
}, { passive: true });
```

Show two large semi-transparent arrow buttons `◀` and `▶` in the bottom corners of the canvas as visual hints.

### Desktop (keyboard)

```js
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a') G.input.left  = true;
  if (e.key === 'ArrowRight' || e.key === 'd') G.input.right = true;
});
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a') G.input.left  = false;
  if (e.key === 'ArrowRight' || e.key === 'd') G.input.right = false;
});
```

---

## 5. Game loop (`requestAnimationFrame`)

```js
function gameLoop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min((ts - lastTs) / 1000, 0.05); // seconds, capped at 50ms
  lastTs = ts;

  if (!match.paused) {
    updateTimer(dt);
    moveGoalkeeper(dt);
    moveBall(dt);
    checkGoal();
    checkSave();
  }

  render();
  requestAnimationFrame(gameLoop);
}
```

### `updateTimer(dt)`
```js
function updateTimer(dt) {
  match.elapsed += dt;

  if (match.elapsed >= 150 && !match.halftimeDone) {
    triggerHalftime();
  }

  if (match.elapsed >= 300) {
    triggerFullTime();
  }
}
```

### `moveGoalkeeper(dt)`
```js
function moveGoalkeeper(dt) {
  const gkP1   = gk.p1;
  const goal   = goals.bottom;
  const minX   = goal.x + gkP1.width / 2;
  const maxX   = goal.x + goal.w - gkP1.width / 2;

  if (G.input.left)  gkP1.x = Math.max(minX, gkP1.x - gkP1.speed * dt);
  if (G.input.right) gkP1.x = Math.min(maxX, gkP1.x + gkP1.speed * dt);
}
```

Bot goalkeeper (P2 in single-player): moves toward ball.x with a reaction delay and max speed:
```js
function moveBotGK(dt) {
  const BOT_SPEED = 200; // slower than human max (320) — beatable
  const BOT_REACTION_DELAY_S = 0.4; // bot starts moving 400ms after shot fires

  if (ball.isMoving && match.elapsed - ball.firedAt > BOT_REACTION_DELAY_S) {
    const dir = Math.sign(ball.aimX - gk.p2.x);
    gk.p2.x = clamp(
      gk.p2.x + dir * BOT_SPEED * dt,
      goals.top.x + gk.p2.width / 2,
      goals.top.x + goals.top.w - gk.p2.width / 2
    );
  }
}
```

### `moveBall(dt)`
```js
function moveBall(dt) {
  if (!ball.isMoving) return;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
}
```

### `checkGoal()`
```js
function checkGoal() {
  if (!ball.isMoving) return;

  // Ball reached top goal line
  if (ball.y - ball.radius <= goals.top.y + goals.top.h) {
    if (ball.x >= goals.top.x && ball.x <= goals.top.x + goals.top.w) {
      // Check if goalkeeper blocks
      const gkLeft  = gk.p2.x - gk.p2.width / 2;
      const gkRight = gk.p2.x + gk.p2.width / 2;
      if (ball.x >= gkLeft && ball.x <= gkRight) {
        triggerSave('p2');
      } else {
        triggerGoal('p1'); // P1 scored
      }
    }
  }

  // Ball reached bottom goal line (mirror logic for P2 scoring)
  if (ball.y + ball.radius >= goals.bottom.y) {
    // ... mirror of above
  }
}
```

---

## 6. Actions triggered by correct math answer

When the local player answers correctly, send to server:
```js
ws.send(JSON.stringify({ type: 'football_shot', aimX: randomAimX() }));
```

`randomAimX()` picks a random X within the goal mouth ±40px from center — adds unpredictability.

Immediately fire the ball animation locally (don't wait for server confirmation — lag compensation):
```js
function fireShot(targetGoal, aimX) {
  ball.isMoving    = true;
  ball.targetGoal  = targetGoal;
  ball.aimX        = aimX;
  ball.firedAt     = match.elapsed;

  const targetY = targetGoal === 'top' ? goals.top.y : goals.bottom.y;
  const dx      = aimX - ball.x;
  const dy      = targetY - ball.y;
  const dist    = Math.hypot(dx, dy);
  const speed   = 600; // px/s
  ball.vx = (dx / dist) * speed;
  ball.vy = (dy / dist) * speed;
}
```

After a correct answer, immediately serve the player a new question (don't wait for goal resolution).

---

## 7. Goal celebration

```js
function triggerGoal(scorer) {
  ball.isMoving = false;
  match[`${scorer}Score`]++;
  match.paused = true;

  // Show goal celebration overlay for 1.5 seconds
  showGoalOverlay(scorer); // "GOAL! ⚽" with scorer name

  // Screen shake
  shake(canvas, 6, 400);

  // After 1.5s: reset ball to center, unpause
  setTimeout(() => {
    resetBallToCenter();
    match.paused = false;
    hideGoalOverlay();
  }, 1500);
}
```

---

## 8. Halftime

```js
function triggerHalftime() {
  match.halftimeDone = true;
  match.paused       = true;

  showHalftimeOverlay(match.p1Score, match.p2Score);
  // "HALF TIME — 2 : 1" large text, auto-dismiss after 10 seconds
  setTimeout(() => {
    hideHalftimeOverlay();
    match.paused = false;
  }, 10_000);
}
```

---

## 9. Full time & bracket advancement

```js
function triggerFullTime() {
  match.paused = true;
  const winner = match.p1Score > match.p2Score ? 'p1'
               : match.p2Score > match.p1Score ? 'p2'
               : 'draw';

  // Penalty shootout on draw (3 questions each, sudden death)
  if (winner === 'draw') {
    startPenaltyShootout();
    return;
  }

  showResultOverlay(winner, match.p1Score, match.p2Score);
  ws.send(JSON.stringify({ type: 'football_result', winner }));
}
```

Bracket advancement logic in `server.js` is identical to the removed Air Cup — reuse `_advanceTournament`.

---

## 10. Penalty shootout (tiebreaker)

3 questions per player, alternating. Each correct answer = penalty kick animation (auto-aim center, bot GK has 50% save rate). Most penalties scored wins. If still tied after 3: sudden death (one question at a time until someone scores).

---

## 11. Canvas rendering

### Pitch

```js
function renderPitch(ctx) {
  // Green field
  ctx.fillStyle = '#1a4a1a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Field lines
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;

  // Center line
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H / 2);
  ctx.lineTo(CANVAS_W, CANVAS_H / 2);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, CANVAS_H / 2, 50, 0, Math.PI * 2);
  ctx.stroke();

  // Goals (white rectangles)
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(goals.top.x,    goals.top.y,    goals.top.w,    goals.top.h);
  ctx.fillRect(goals.bottom.x, goals.bottom.y, goals.bottom.w, goals.bottom.h);
  ctx.strokeRect(goals.top.x,    goals.top.y,    goals.top.w,    goals.top.h);
  ctx.strokeRect(goals.bottom.x, goals.bottom.y, goals.bottom.w, goals.bottom.h);
}
```

### Ball

```js
function renderBall(ctx) {
  ctx.save();
  ctx.translate(ball.x, ball.y);

  // White circle
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  // Black pentagon patches (simplified soccer ball pattern)
  ctx.fillStyle = '#222';
  const patches = [
    [0, 0], [0, -8], [7, 5], [-7, 5], [4, -6], [-4, -6]
  ];
  patches.forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}
```

### Goalkeeper

```js
function renderGK(ctx, gkObj, color) {
  ctx.fillStyle = color; // P1 = '#c8a84b', P2 = '#e63946'
  ctx.beginPath();
  ctx.roundRect(
    gkObj.x - gkObj.width / 2,
    gkObj.y - gkObj.height / 2,
    gkObj.width,
    gkObj.height,
    4
  );
  ctx.fill();

  // Glove dots
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(gkObj.x - 14, gkObj.y, 5, 0, Math.PI * 2);
  ctx.arc(gkObj.x + 14, gkObj.y, 5, 0, Math.PI * 2);
  ctx.fill();
}
```

---

## 12. `server.js` changes

### New message types

Add to the existing `ws.on('message')` switch:

```js
case 'football_shot': {
  const room = rooms.get(ws._rid);
  if (!room || !ws._seat) break;
  const opp = ws._seat === 'p1' ? 'p2' : 'p1';
  // Relay shot to opponent so their canvas shows the ball moving
  send(room[opp], {
    type:   'opponent_shot',
    aimX:   msg.aimX,
    firedAt: Date.now(),
  });
  break;
}

case 'football_result': {
  const room = rooms.get(ws._rid);
  if (!room) break;
  room[`${ws._seat}Result`] = msg.winner;
  // When both players report, resolve the match
  if (room.p1Result && room.p2Result) {
    _advanceTournament(/* existing logic */);
    rooms.delete(ws._rid);
  }
  break;
}
```

### Questions — each player gets their own

In `_createRoom` (or `_createTournamentRoom`), generate **two separate question arrays**, one per player:

```js
room.p1Questions = Array.from({ length: 50 }, () => generateQuestion(diff));
room.p2Questions = Array.from({ length: 50 }, () => generateQuestion(diff));
room.p1QIdx = 0;
room.p2QIdx = 0;
```

Send each player only their own question:
```js
send(room.p1, { type: 'question', ...room.p1Questions[room.p1QIdx] });
send(room.p2, { type: 'question', ...room.p2Questions[room.p2QIdx] });
```

On correct answer: advance that player's question index and send the next one immediately.
On wrong answer: lose a life, same question stays (no penalty beyond the life loss).

---

## 13. Menu integration

Replace the Air Cup / Escadrille button with:

```js
if (IS_AIR_CUP_ACTIVE) {
  // Button label
  btn.innerHTML = `⚽ WORLD CUP <span class="menu-btn-sub">FOOTBALL MATH · 1V1</span>`;
  btn.addEventListener('click', () => {
    showScreen('football-lobby');
    import('./screens/football-lobby.js').then(m => m.initFootballLobby());
  });
}
```

### Football lobby screen (`src/screens/football-lobby.js`)

Simple screen with:
- Match countdown and bracket position
- "FIND MATCH" button — sends `join_tournament` to server
- While waiting: "Searching for opponent... 🔍" with bot fallback after 10 seconds

---

## 14. CSS additions

```css
/* ── FOOTBALL MATH ── */
#goal-overlay {
  position: absolute; inset: 0; display: flex;
  align-items: center; justify-content: center;
  background: rgba(0,0,0,0.4); z-index: 100;
  font-family: 'retropix', monospace; color: white;
  font-size: 48px; letter-spacing: 4px;
  pointer-events: none;
}
#halftime-overlay {
  position: absolute; inset: 0;
  background: rgba(0,20,0,0.85);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  z-index: 100;
}
#halftime-overlay h2 {
  font-family: 'retropix', monospace; color: #c8a84b;
  font-size: 28px; letter-spacing: 4px; margin-bottom: 16px;
}
#halftime-score {
  font-family: 'retropix', monospace; color: white;
  font-size: 52px; letter-spacing: 8px;
}

/* Mobile goalkeeper controls */
.gk-control-btn {
  position: absolute; bottom: 180px;
  width: 64px; height: 64px; border-radius: 50%;
  background: rgba(255,255,255,0.1);
  border: 2px solid rgba(255,255,255,0.2);
  color: white; font-size: 24px;
  display: flex; align-items: center; justify-content: center;
  user-select: none; -webkit-user-select: none;
}
.gk-control-btn.left  { left: 16px; }
.gk-control-btn.right { right: 16px; }
```

---

## 15. Validation checklist

1. Ball fires toward correct goal when player answers correctly
2. Goalkeeper moves left/right with arrow keys on desktop
3. Goalkeeper moves with left/right screen halves on mobile
4. Bot goalkeeper reacts 400ms after shot fires, moves at 200px/s max
5. Goal triggers score increment + 1.5s pause + ball reset to center
6. Halftime fires exactly at 2:30, pauses 10 seconds, then resumes
7. Full time fires at 5:00, shows result, advances bracket
8. Draw triggers penalty shootout (3 questions each)
9. Each player receives independent math questions — never the same sequence
10. Wrong answer loses a life, question stays on screen
11. World Cup button only appears when `IS_AIR_CUP_ACTIVE === true`
12. Bracket (QF → SF → Final) works identically to removed Air Cup logic
