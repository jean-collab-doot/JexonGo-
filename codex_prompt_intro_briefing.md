# Codex Prompt — Captain Jexongo Intro Briefing Animation

## Overview

Before the countdown starts on level launch, play a full-screen briefing animation.
Captain Jexongo (the jet mascot) flies in from the left, a blue triangle sweeps across the screen,
and the captain delivers mission instructions word by word, one section at a time.
The player taps "NEXT" to advance through each section, then the countdown begins.

Only plays on Level 1 first launch, or can be replayed from settings.
Gated by `G.hasSeenBriefing` in localStorage.

---

## Phase 1 — Jet entrance + triangle sweep

### Background
The game background stays visible but overlaid with a **semi-transparent blue** panel:
```css
background: rgba(10, 30, 80, 0.72);
backdrop-filter: blur(2px);
```
This keeps the sky/clouds visible behind the briefing while making the text pop.

### Blue triangle
A large right triangle appears on screen:
- **Bottom-left corner** anchored at the bottom-left of the viewport
- **Top-right corner** reaches the top-right of the viewport
- Color: `rgba(30, 100, 220, 0.55)` — blue, semi-transparent
- The triangle slides in from the right: starts fully off-screen right, sweeps left to its final position
- Entrance easing: `easeOutExpo`, duration **600ms**
- The triangle is a fixed SVG polygon layered behind the text content

```js
// Triangle SVG — inject into briefing overlay
// Points: bottom-left (0, vh), top-right (vw, 0), bottom-right (vw, vh)
// This creates a right triangle that fills the right portion of the screen
const tri = `
  <svg id="brief-triangle" viewBox="0 0 ${W} ${H}" 
       style="position:absolute;inset:0;pointer-events:none;">
    <polygon points="0,${H} ${W},0 ${W},${H}" 
             fill="rgba(30,100,220,0.55)"/>
  </svg>
`;
```

Animate triangle entrance:
```js
// Start: translateX(+W) — off screen right
// End:   translateX(0)
// Duration: 600ms, easeOutExpo
```

### Jet entrance
Simultaneously with the triangle:
- Jet sprite (Captain Jexongo) enters from the **left**, off-screen
- Travels right and **upward** in a smooth arc — not straight horizontal
- Final resting position: **left side of screen**, vertically centered, slight upward tilt (`rotate(-8deg)`)
- Movement path: start at `(-200px, 60%)`, end at `(5%, 35%)` — curves upward
- Use cubic bezier for the arc: control points simulate a climbing trajectory
- Duration: **900ms**, easing `cubic-bezier(0.22, 1, 0.36, 1)`
- Jet is slightly larger than the menu mascot — `width: 200px`

```js
// Animate using requestAnimationFrame
// X: -200 → targetX via easeOutExpo
// Y: 60% → 35% via easeOutCubic (reaches target slightly after X — feels like a climb)
// Rotation: -3deg → -8deg linear (nose tilts up as it climbs)
```

### Speech bubble appears
After jet lands (900ms), speech bubble fades in over **300ms**:
- Same white oval style as onboarding
- Positioned to the right of the jet
- Contains: **"MISSION BRIEFING"** in retropix font
- Then immediately transitions to Section 1

---

## Phase 2 — Briefing sections (word-by-word text)

### Layout
```
┌─────────────────────────────────┐
│  [semi-transparent blue BG]     │
│  [blue triangle SVG]            │
│                                 │
│  [JET — left side, climbing]    │
│         [SPEECH BUBBLE]         │
│                                 │
│  ┌─────────────────────────┐    │
│  │  SECTION TITLE          │    │
│  │                         │    │
│  │  Instruction text       │    │
│  │  appears word by word   │    │
│  │                         │    │
│  │  [icon placeholder]     │    │  ← image slot (future prompt)
│  └─────────────────────────┘    │
│                                 │
│                    [ NEXT → ]   │
└─────────────────────────────────┘
```

### Briefing sections — 4 sections total

```js
const SECTIONS = [
  {
    title: 'YOUR MISSION',
    lines: [
      'Enemies are flying toward you.',
      'Answer math questions correctly.',
      'Each right answer fires a missile.',
      'Destroy all enemies to win!',
    ],
    imageSlot: 'mission', // placeholder for future image
  },
  {
    title: 'LIVES',
    lines: [
      'You start with 3 lives.',
      'A wrong answer costs 1 life.',
      'Lose all lives — mission failed.',
      'First wrong answer is a warning!',
    ],
    imageSlot: 'lives',
  },
  {
    title: 'CONTROLS',
    lines: [
      'Tap an answer button to shoot.',
      '',
      'On keyboard:',
      'Press  [1]  [2]  [3]  [4]  to answer.',
    ],
    imageSlot: 'controls',
    showKeyboardHints: true,
  },
  {
    title: 'SCORE',
    lines: [
      'Answer all 10 questions to win.',
      '10 correct answers = 3 stars.',
      'Earn XP to unlock new aircraft.',
      'Good luck, pilot!',
    ],
    imageSlot: 'score',
  },
];
```

### Word-by-word animation

Each line of text appears word by word with a **short delay between words**:

```js
async function animateLine(containerEl, text, msPerWord = 80) {
  if (!text) return;
  const words = text.split(' ');
  for (const word of words) {
    const span = document.createElement('span');
    span.textContent = word + ' ';
    span.style.opacity = '0';
    span.style.display = 'inline';
    containerEl.appendChild(span);
    // Fade each word in
    span.style.transition = 'opacity 0.12s ease';
    requestAnimationFrame(() => { span.style.opacity = '1'; });
    await delay(msPerWord);
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
```

Lines appear one after another — start next line only after previous line finishes.
Title appears all at once before the lines start, with a **scale-in** animation:
```css
.brief-title {
  animation: title-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes title-pop {
  from { transform: scale(0.7); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
```

### Keyboard key display (Section 3)

For the controls section, show visual keyboard keys inline:

```js
function renderKeyboardKeys() {
  const keys = ['1', '2', '3', '4'];
  const container = document.createElement('div');
  container.className = 'brief-keys';
  keys.forEach(k => {
    const key = document.createElement('div');
    key.className = 'brief-key';
    key.textContent = k;
    container.appendChild(key);
  });
  return container;
}
```

```css
.brief-keys { display: flex; gap: 8px; margin-top: 8px; }
.brief-key {
  width: 44px; height: 44px;
  background: rgba(255,255,255,0.15);
  border: 2px solid rgba(255,255,255,0.5);
  border-radius: 6px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  font-family: monospace; font-size: 20px; font-weight: 700;
  color: white;
}
```

### Image slot placeholder

Each section has an empty container for future images:
```html
<div class="brief-image-slot" data-slot="mission">
  <!-- Images will be added in a future prompt -->
</div>
```
```css
.brief-image-slot {
  width: 100%; height: 80px;
  background: rgba(255,255,255,0.05);
  border: 1px dashed rgba(255,255,255,0.2);
  border-radius: 8px;
  margin: 12px 0;
  display: flex; align-items: center; justify-content: center;
}
.brief-image-slot::after {
  content: attr(data-slot);
  font-family: monospace; font-size: 10px;
  color: rgba(255,255,255,0.2); letter-spacing: 2px; text-transform: uppercase;
}
```

---

## Phase 3 — NEXT button behavior

```js
function showNextButton(onClick) {
  const btn = document.getElementById('brief-next');
  btn.style.opacity = '1';
  btn.style.pointerEvents = 'all';
  btn.onclick = () => {
    btn.style.opacity = '0';
    btn.style.pointerEvents = 'none';
    onClick();
  };
}
```

NEXT button only becomes active after **all words of the current section have appeared**.
While text is animating, button is visible but dimmed (`opacity: 0.3`).

On the **last section**, button label changes to **"FLY! ▶"** and triggers the countdown.

---

## Phase 4 — Exit animation into countdown

When player taps "FLY!":
1. Briefing content fades out over **300ms**
2. Jet zooms off-screen to the right — `translateX(+150%) rotate(0deg)` over **500ms**, `easeInExpo`
3. Triangle sweeps back off to the right over **400ms**
4. Semi-transparent overlay fades out over **300ms**
5. Countdown begins

```js
async function exitBriefing() {
  // 1. Fade text
  briefContent.style.transition = 'opacity 0.3s';
  briefContent.style.opacity = '0';
  await delay(300);

  // 2. Jet zooms out
  jetEl.style.transition = 'transform 0.5s cubic-bezier(0.55, 0, 1, 0.45)';
  jetEl.style.transform = 'translateX(150vw) rotate(0deg)';

  // 3. Triangle sweeps out
  triEl.style.transition = 'transform 0.4s ease-in';
  triEl.style.transform = 'translateX(100vw)';

  await delay(500);

  // 4. Overlay fades
  overlay.style.transition = 'opacity 0.3s';
  overlay.style.opacity = '0';
  await delay(300);

  overlay.remove();
  startCountdown(); // existing countdown function
}
```

---

## Full overlay structure

```html
<div id="brief-overlay">

  <!-- Semi-transparent blue background -->
  <div id="brief-bg"></div>

  <!-- Blue triangle -->
  <svg id="brief-triangle" ...></svg>

  <!-- Jet mascot -->
  <div id="brief-jet">
    <img src="assets/planes/captain.png" alt="Captain Jexongo" />
  </div>

  <!-- Speech bubble on jet -->
  <div id="brief-bubble">MISSION BRIEFING</div>

  <!-- Section content card -->
  <div id="brief-card">
    <h2 id="brief-title" class="brief-title"></h2>
    <div id="brief-image-slot" class="brief-image-slot"></div>
    <div id="brief-lines"></div>
  </div>

  <!-- NEXT button -->
  <button id="brief-next" class="brief-next-btn">NEXT →</button>

</div>
```

---

## CSS

```css
/* ── BRIEFING OVERLAY ── */
#brief-overlay {
  position: fixed; inset: 0; z-index: 8500;
  overflow: hidden; pointer-events: all;
}

#brief-bg {
  position: absolute; inset: 0;
  background: rgba(10, 30, 80, 0.72);
  backdrop-filter: blur(2px);
}

#brief-triangle {
  position: absolute; inset: 0;
  pointer-events: none;
  transform: translateX(100vw); /* starts off-screen right */
}

#brief-jet {
  position: absolute;
  left: 5%; top: 35%;
  transform: translateX(-200px) translateY(20%) rotate(-3deg);
  will-change: transform;
}
#brief-jet img { width: 200px; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5)); }

#brief-bubble {
  position: absolute;
  left: calc(5% + 180px); top: 28%;
  background: white; border: 3px solid #111;
  border-radius: 50%; width: 130px; height: 80px;
  display: flex; align-items: center; justify-content: center;
  text-align: center;
  font-family: 'retropix', monospace; font-size: 11px; color: #111;
  opacity: 0;
}

#brief-card {
  position: absolute;
  left: 50%; top: 50%; transform: translate(-50%, -40%);
  width: min(85%, 420px);
  background: rgba(5, 15, 40, 0.65);
  border: 1px solid rgba(100, 160, 255, 0.3);
  border-radius: 14px;
  padding: 20px 22px;
}

.brief-title {
  font-family: 'retropix', monospace;
  font-size: 20px; color: #c8a84b;
  letter-spacing: 3px; margin-bottom: 14px;
}

#brief-lines {
  font-family: monospace; font-size: 15px;
  color: white; line-height: 1.8;
  min-height: 80px;
}

.brief-next-btn {
  position: fixed; bottom: 32px; right: 24px;
  background: #c8a84b; border: none; border-radius: 8px;
  color: #1a0a00; font-family: 'retropix', monospace;
  font-size: 16px; font-weight: 700; letter-spacing: 2px;
  padding: 14px 28px; cursor: pointer;
  opacity: 0.3; pointer-events: none;
  transition: opacity 0.3s;
  box-shadow: 0 4px 0 rgba(0,0,0,0.3);
}
```

---

## Easing functions (reuse from intro animation)

```js
const easeOutExpo  = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const easeInExpo   = t => t === 0 ? 0 : Math.pow(2, 10 * t - 10);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
```

---

## Integration in `src/screens/game.js`

```js
import { showBriefing } from './briefing.js';

export function launchLevel() {
  if (!G.hasSeenBriefing) {
    showBriefing(() => {
      G.hasSeenBriefing = true;
      storage.set('hasSeenBriefing', 'true');
      startCountdown();
    });
  } else {
    startCountdown();
  }
}
```

---

## Validation checklist

1. Triangle sweeps in from right, anchored bottom-left to top-right of viewport
2. Jet enters from left and climbs — not a straight horizontal line
3. Background shows game scene through the semi-transparent overlay
4. Each section title pops in with scale animation before lines start
5. Words appear one by one at ~80ms per word — fast but readable
6. NEXT button is dimmed until all words are done, then goes full opacity
7. Last section button says "FLY! ▶" not "NEXT →"
8. Exit: jet zooms right, triangle sweeps right, overlay fades — then countdown
9. `G.hasSeenBriefing` saved — briefing never replays unless reset
10. Image slot placeholders are visible with dashed border and label
