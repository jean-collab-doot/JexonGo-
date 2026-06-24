# Codex Prompt — Football Math v2: Dribble & Shoot

## Concept

Real-time 1v1 soccer game on a top-down pitch. Both players control a full player (not just a goalkeeper) and can dribble the ball freely. When a player wants to shoot, a math question pops up. If they answer correctly, the shot fires. If wrong, they lose possession. Matches last 5 minutes with halftime at 2:30. Bracket: QF → SF → Final. Replaces the Air Cup button in the menu.

---

## Canvas layout (portrait, 390×700px)

```
┌─────────────────────────┐
│  P2 name    ❤️❤️❤️  2  │  ← P2 HUD (score, lives)
│         [P2 sprite]     │
│   ┌─────────────────┐   │
│   │   TOP GOAL      │   │
│   └─────────────────┘   │
│                         │
│      [PITCH]            │
│                         │
│   ┌─────────────────┐   │
│   │  BOTTOM GOAL    │   │
│   └─────────────────┘   │
│         [P1 sprite]     │
│  P1 name    ❤️❤️❤️  1  │  ← P1 HUD
│                         │
│  [QUESTION if shooting] │
│  [ A ][ B ][ C ][ D ]   │
└─────────────────────────┘
```

---

## Game objects

### Players
```js
const players = {
  p1: {
    x: CANVAS_W / 2, y: CANVAS_H * 0.75,
    vx: 0, vy: 0,
    speed: 200,       // px/s
    radius: 14,
    hasBall: false,
    isShooting: false,  // true = question is displayed, movement locked
    lives: 3,
    score: 0,
    color: '#c8a84b',
  },
  p2: {
    x: CANVAS_W / 2, y: CANVAS_H * 0.25,
    vx: 0, vy: 0,
    speed: 200,
    radius: 14,
    hasBall: false,
    isShooting: false,
    lives: 3,
    score: 0,
    color: '#e63946',
  },
};
```

### Ball
```js
const ball = {
  x: CANVAS_W / 2,
  y: CANVAS_H / 2,
  vx: 0, vy: 0,
  radius: 10,
  isLoose: true,    // not carried by anyone
  isFlying: false,  // shot in progress
  owner: null,      // 'p1' | 'p2' | null
};
```

---

## Controls

### Mobile
Joystick (left thumb zone, bottom-left 120×120px area): drag to move player in any direction.
Shoot button (bottom-right corner, large round button ⚽): tap to attempt a shot — triggers the math question.

```js
// Virtual joystick
const joystick = { active: false, originX: 0, originY: 0, dx: 0, dy: 0 };

canvas.addEventListener('touchstart', e => {
  const t = e.touches[0];
  if (t.clientX < CANVAS_W * 0.4 && t.clientY > CANVAS_H * 0.6) {
    joystick.active  = true;
    joystick.originX = t.clientX;
    joystick.originY = t.clientY;
  }
});
canvas.addEventListener('touchmove', e => {
  if (!joystick.active) return;
  const t = e.touches[0];
  const maxR = 40;
  joystick.dx = clamp(t.clientX - joystick.originX, -maxR, maxR) / maxR;
  joystick.dy = clamp(t.clientY - joystick.originY, -maxR, maxR) / maxR;
});
canvas.addEventListener('touchend', () => {
  joystick.active = false;
  joystick.dx = 0;
  joystick.dy = 0;
});
```

### Desktop
WASD or arrow keys to move. SPACE to attempt a shot.

```js
const keys = {};
document.addEventListener('keydown', e => { keys[e.key] = true;  });
document.addEventListener('keyup',   e => { keys[e.key] = false; });

// In game loop:
if (keys['ArrowLeft']  || keys['a']) p1.vx = -p1.speed;
if (keys['ArrowRight'] || keys['d']) p1.vx =  p1.speed;
if (keys['ArrowUp']    || keys['w']) p1.vy = -p1.speed;
if (keys['ArrowDown']  || keys['s']) p1.vy =  p1.speed;
if (!keys['ArrowLeft'] && !keys['a'] && !keys['ArrowRight'] && !keys['d']) p1.vx = 0;
if (!keys['ArrowUp']   && !keys['w'] && !keys['ArrowDown']  && !keys['s']) p1.vy = 0;
```

---

## Ball possession

### Picking up the ball
Each frame, check distance between each player and the ball. If close enough and ball is loose:
```js
function checkPickup() {
  if (!ball.isLoose || ball.isFlying) return;
  for (const seat of ['p1', 'p2']) {
    const p    = players[seat];
    const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
    if (dist < p.radius + ball.radius + 4) {
      ball.owner    = seat;
      ball.isLoose  = false;
      p.hasBall     = true;
      break;
    }
  }
}
```

### Carrying the ball
When a player has the ball, ball position follows the player slightly ahead in the direction of movement:
```js
if (ball.owner) {
  const p    = players[ball.owner];
  const angle = Math.atan2(p.vy, p.vx) || 0;
  ball.x = p.x + Math.cos(angle) * (p.radius + ball.radius + 2);
  ball.y = p.y + Math.sin(angle) * (p.radius + ball.radius + 2);
}
```

### Tackling / taking the ball
If a player WITHOUT the ball collides with the player WITH the ball (distance < sum of radii + 6px), the ball becomes loose:
```js
function checkTackle() {
  if (!ball.owner) return;
  const carrier  = players[ball.owner];
  const tackler  = players[ball.owner === 'p1' ? 'p2' : 'p1'];
  const dist     = Math.hypot(carrier.x - tackler.x, carrier.y - tackler.y);
  if (dist < carrier.radius + tackler.radius + 6) {
    looseBall(tackler); // give slight momentum away from tackler
  }
}

function looseBall(fromPlayer) {
  ball.owner       = null;
  ball.isLoose     = true;
  players.p1.hasBall = false;
  players.p2.hasBall = false;
  // Ball bounces away
  const angle = Math.atan2(ball.y - fromPlayer.y, ball.x - fromPlayer.x);
  ball.vx = Math.cos(angle) * 150;
  ball.vy = Math.sin(angle) * 150;
}
```

---

## Shooting mechanic

### Triggering a shot
Only the player who has the ball can attempt a shot (SPACE / shoot button).
If the player does NOT have the ball, pressing shoot does nothing.

```js
function attemptShot(seat) {
  const p = players[seat];
  if (!p.hasBall)       return; // must have ball
  if (p.isShooting)     return; // already answering
  if (match.paused)     return;

  p.isShooting = true;
  showQuestionFor(seat); // display math question + answer buttons
  // Player movement is locked while question is shown
}
```

### Answering correctly → shot fires
```js
function onCorrectAnswer(seat) {
  const p       = players[seat];
  p.isShooting  = false;
  hideQuestion();

  // Determine target goal
  const targetGoal = seat === 'p1' ? goals.top : goals.bottom;
  const aimX = targetGoal.x + Math.random() * targetGoal.w;
  const aimY = targetGoal.y + targetGoal.h / 2;

  // Fire ball
  p.hasBall    = false;
  ball.owner   = null;
  ball.isLoose = false;
  ball.isFlying = true;

  const dx   = aimX - ball.x;
  const dy   = aimY - ball.y;
  const dist = Math.hypot(dx, dy);
  ball.vx    = (dx / dist) * 700; // px/s
  ball.vy    = (dy / dist) * 700;
}
```

### Answering wrong → lose possession + lose a life
```js
function onWrongAnswer(seat) {
  const p      = players[seat];
  p.isShooting = false;
  p.lives      = Math.max(0, p.lives - 1);
  hideQuestion();
  looseBall(p); // ball bounces away
  shakeHUD(seat);

  if (p.lives <= 0) triggerFullTime(); // no lives = forfeit
}
```

---

## Goal detection

```js
function checkGoal() {
  if (!ball.isFlying) return;

  for (const [goalSide, goal] of Object.entries(goals)) {
    if (
      ball.x > goal.x && ball.x < goal.x + goal.w &&
      ball.y > goal.y && ball.y < goal.y + goal.h
    ) {
      const scorer = goalSide === 'top' ? 'p1' : 'p2';
      triggerGoal(scorer);
      return;
    }
  }

  // Ball out of pitch bounds → loose ball at center
  if (ball.x < 0 || ball.x > CANVAS_W || ball.y < 0 || ball.y > CANVAS_H) {
    resetBallToCenter();
  }
}
```

---

## Bot (P2 AI)

When playing vs a bot, replace all P2 WebSocket messages with AI logic:

```js
function updateBot(dt) {
  const bot  = players.p2;
  const dist = Math.hypot(ball.x - bot.x, ball.y - bot.y);

  if (!bot.hasBall) {
    // Chase the ball
    const angle = Math.atan2(ball.y - bot.y, ball.x - bot.x);
    bot.vx = Math.cos(angle) * bot.speed * 0.85; // slightly slower than human
    bot.vy = Math.sin(angle) * bot.speed * 0.85;
  } else {
    // Move toward P1 goal (bottom goal)
    const goalCenterX = goals.bottom.x + goals.bottom.w / 2;
    const goalCenterY = goals.bottom.y;
    const angle = Math.atan2(goalCenterY - bot.y, goalCenterX - bot.x);
    bot.vx = Math.cos(angle) * bot.speed;
    bot.vy = Math.sin(angle) * bot.speed;

    // Attempt shot when close enough to goal
    if (Math.hypot(bot.x - goalCenterX, bot.y - goalCenterY) < 120) {
      attemptBotShot();
    }
  }
}

function attemptBotShot() {
  if (players.p2.isShooting) return;
  players.p2.isShooting = true;

  const BOT_ACCURACY  = 0.72;
  const BOT_DELAY_MS  = 1500 + Math.random() * 2000;

  setTimeout(() => {
    if (Math.random() < BOT_ACCURACY) {
      onCorrectAnswer('p2');
    } else {
      onWrongAnswer('p2');
    }
  }, BOT_DELAY_MS);
}
```

---

## Pitch rendering

```js
function renderPitch(ctx) {
  // Green field with alternating stripes
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1a4a1a' : '#1e521e';
    ctx.fillRect(0, i * (CANVAS_H / 8), CANVAS_W, CANVAS_H / 8);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth   = 1.5;

  // Boundary
  ctx.strokeRect(10, 10, CANVAS_W - 20, CANVAS_H - 20);

  // Center line
  ctx.beginPath();
  ctx.moveTo(10, CANVAS_H / 2);
  ctx.lineTo(CANVAS_W - 10, CANVAS_H / 2);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, CANVAS_H / 2, 45, 0, Math.PI * 2);
  ctx.stroke();

  // Goals
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  for (const g of Object.values(goals)) {
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.strokeRect(g.x, g.y, g.w, g.h);
  }

  // Penalty areas
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(CANVAS_W/2 - 70, 10,             140, 50);
  ctx.strokeRect(CANVAS_W/2 - 70, CANVAS_H - 60,  140, 50);
}
```

### Player sprite
```js
function renderPlayer(ctx, p, label) {
  // Body circle
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();

  // White ring if has ball
  if (p.hasBall) {
    ctx.strokeStyle = 'white';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Question mark if in shooting mode
  if (p.isShooting) {
    ctx.fillStyle   = 'white';
    ctx.font        = 'bold 14px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('?', p.x, p.y - p.radius - 6);
  }

  // Name label
  ctx.fillStyle   = 'white';
  ctx.font        = '9px monospace';
  ctx.textAlign   = 'center';
  ctx.fillText(label, p.x, p.y + p.radius + 12);
}
```

### Ball sprite
```js
function renderBall(ctx) {
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  // Black patches
  ctx.fillStyle = '#111';
  [[0,-5],[4,3],[-4,3]].forEach(([px,py]) => {
    ctx.beginPath();
    ctx.arc(ball.x+px, ball.y+py, 2.5, 0, Math.PI*2);
    ctx.fill();
  });

  // Motion trail when flying
  if (ball.isFlying) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(ball.x - ball.vx * 0.04, ball.y - ball.vy * 0.04);
    ctx.lineTo(ball.x, ball.y);
    ctx.stroke();
  }
}
```

---

## Timer, halftime, full time

```js
// Halftime at 150s, full time at 300s — same as v1
// On halftime: pause 10s, show score overlay
// On full time: show result, send to server, advance bracket

// Timer display top-center of canvas:
function renderTimer(ctx) {
  const remaining = Math.max(0, 300 - match.elapsed);
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  const isHalf = remaining <= 150 && !match.halftimeDone;

  ctx.fillStyle   = isHalf ? '#e63946' : 'white';
  ctx.font        = 'bold 16px monospace';
  ctx.textAlign   = 'center';
  ctx.fillText(`${mins}:${String(secs).padStart(2,'0')}`, CANVAS_W/2, 28);
}
```

---

## Question display

Show the question as a DOM overlay (not canvas) so answer buttons are large tap targets:

```html
<div id="football-question" style="display:none">
  <p id="fq-text"></p>
  <div id="fq-choices"></div>
</div>
```

```css
#football-question {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: rgba(6,14,31,0.97);
  border-top: 2px solid #c8a84b;
  padding: 12px 16px 20px;
  z-index: 200;
}
#fq-text {
  font-family: 'retropix', monospace; font-size: 26px;
  color: white; text-align: center; margin-bottom: 12px;
}
#fq-choices {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px;
}
#fq-choices button {
  background: rgba(200,168,75,0.12); border: 1.5px solid rgba(200,168,75,0.35);
  border-radius: 8px; color: #c8a84b; font-family: 'retropix', monospace;
  font-size: 20px; padding: 14px 0; cursor: pointer;
}
#fq-choices button:active { background: rgba(200,168,75,0.3); }
```

On correct answer: green flash on button, hide overlay.
On wrong answer: red shake on button, hide overlay, ball bounces away.

---

## server.js additions

Add to existing `ws.on('message')` switch (do not touch existing `join`, `answer`, `rematch`, `leave`, `ping`):

```js
case 'football_move': {
  // Relay P1 position to P2 for smooth remote rendering
  const room = rooms.get(ws._rid);
  if (!room) break;
  const opp = ws._seat === 'p1' ? 'p2' : 'p1';
  send(room[opp], { type: 'opponent_move', x: msg.x, y: msg.y, hasBall: msg.hasBall });
  break;
}

case 'football_shot': {
  const room = rooms.get(ws._rid);
  if (!room) break;
  const opp = ws._seat === 'p1' ? 'p2' : 'p1';
  send(room[opp], { type: 'opponent_shot', aimX: msg.aimX, aimY: msg.aimY });
  break;
}

case 'football_goal': {
  const room = rooms.get(ws._rid);
  if (!room) break;
  room[`${ws._seat}Score`] = (room[`${ws._seat}Score`] ?? 0) + 1;
  sendBoth(room, {
    type: 'goal_scored',
    scorer: ws._seat,
    p1Score: room.p1Score ?? 0,
    p2Score: room.p2Score ?? 0,
  });
  break;
}

case 'football_result': {
  const room = rooms.get(ws._rid);
  if (!room) break;
  room[`${ws._seat}ResultSent`] = true;
  room[`${ws._seat}FinalResult`] = msg.winner;
  if (room.p1ResultSent && room.p2ResultSent) {
    _advanceTournament(/* existing bracket logic */);
    rooms.delete(ws._rid);
  }
  break;
}
```

Broadcast player position every 50ms (20fps) from the client to keep remote player smooth:
```js
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'football_move',
      x: players.p1.x,
      y: players.p1.y,
      hasBall: players.p1.hasBall,
    }));
  }
}, 50);
```

---

## Menu button

```js
if (IS_AIR_CUP_ACTIVE) {
  btn.innerHTML = `⚽ WORLD CUP <span class="menu-btn-sub">DRIBBLE & SHOOT · 1V1</span>`;
  btn.addEventListener('click', () => {
    showScreen('football-lobby');
    import('./screens/football-lobby.js').then(m => m.initFootballLobby());
  });
}
```

---

## Validation checklist

1. Player can dribble the ball freely across the pitch
2. Ball automatically attaches to player on contact when loose
3. Tackling (body contact) causes ball to become loose and bounce away
4. Shoot button / SPACE only works when player has the ball
5. Math question appears, movement is locked during question
6. Correct answer fires ball at 700px/s toward opponent goal
7. Wrong answer loses a life and ball bounces away — question disappears
8. Goal triggers score increment, 1.5s pause, ball returns to center
9. Halftime fires at 2:30, pauses 10s, resumes
10. Full time at 5:00, result sent to server, bracket advances
11. Bot chases ball, attempts shot when near goal, answers at 72% accuracy
12. Remote player position updates smoothly via `football_move` relay
13. World Cup button hidden when `IS_AIR_CUP_ACTIVE === false`
