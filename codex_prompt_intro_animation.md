# Codex Prompt — JexonGo Intro Animation

## What to build

On first menu load, play a cinematic intro: a fighter jet blasts in from off-screen left, brakes hard center-screen, then the JexonGo logo fades in. After that, remove the overlay and show the normal menu.

Only plays once — gated by `G.hasSeenIntro` saved to localStorage via existing `storage.js`.

---

## New file: `src/screens/intro.js`

Export one function: `playIntro(onComplete)`.

It injects a `#intro-stage` div into `<body>`, runs the animation, then removes it and calls `onComplete()`.

### Trigger in `src/screens/menu.js`

```js
import { playIntro } from './intro.js';

export function showMenu() {
  if (!G.hasSeenIntro) {
    playIntro(() => { G.hasSeenIntro = true; revealMenuButtons(); });
  } else {
    revealMenuButtons();
  }
}
```

---

## DOM structure (injected by `playIntro`)

```html
<div id="intro-stage">
  <div id="intro-sky"></div>
  <div id="intro-stars"></div>
  <div id="intro-streaks"></div>     <!-- speed lines -->
  <div id="intro-shockwaves"></div>  <!-- 3 rings on brake -->
  <div id="intro-plane-wrap">
    <div id="intro-afterburner">
      <div id="intro-ab-outer"></div>
      <div id="intro-ab-core"></div>
    </div>
    <svg id="intro-plane" viewBox="0 0 220 80"> <!-- see section below --> </svg>
  </div>
  <div id="intro-logo"> <!-- hidden until plane stops -->
    <p class="logo-title">JEXON<span>GO</span></p>
    <p class="logo-sub">AERIAL MATH COMBAT</p>
  </div>
  <button id="intro-skip">SKIP ▶</button>
</div>
```

---

## CSS (add to `style.css`)

```css
#intro-stage {
  position: fixed; inset: 0; z-index: 9999; overflow: hidden;
  background: linear-gradient(180deg, #060e1f 0%, #0d2040 40%, #1a3a6a 100%);
}
.intro-star { position: absolute; background: white; border-radius: 50%; }
.intro-streak {
  position: absolute; height: 1px; opacity: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
  will-change: transform;
}
.intro-shockwave {
  position: absolute; border: 1.5px solid rgba(100,180,255,0.5);
  border-radius: 50%; opacity: 0; transform: scale(0); pointer-events: none;
}
#intro-plane-wrap {
  position: absolute; top: 50%; will-change: transform;
  transform: translateX(-340px) translateY(-50%);
}
#intro-afterburner {
  position: absolute; right: 100%; top: 50%; transform: translateY(-50%);
  width: 120px; height: 18px; opacity: 0; pointer-events: none;
}
#intro-ab-outer {
  position: absolute; right: 0; top: 50%; transform: translateY(-50%);
  width: 110px; height: 16px;
  background: linear-gradient(90deg, transparent, rgba(255,80,0,0.35), rgba(255,160,0,0.25));
  clip-path: polygon(0 50%, 100% 0%, 100% 100%);
}
#intro-ab-core {
  position: absolute; right: 0; top: 50%; transform: translateY(-50%);
  width: 70px; height: 8px;
  background: linear-gradient(90deg, transparent, #ff6a00, #ffcc00, white);
  clip-path: polygon(0 50%, 100% 0%, 100% 100%);
}
#intro-logo {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%); text-align: center; opacity: 0;
}
.logo-title {
  font-family: 'retropix', monospace; font-size: 56px;
  font-weight: 900; color: #c8a84b; letter-spacing: 6px;
}
.logo-title span { color: #e63946; }
.logo-sub { font-family: monospace; font-size: 11px; color: #5a8abf; letter-spacing: 6px; }
#intro-skip {
  position: absolute; bottom: 24px; right: 24px;
  background: transparent; border: 1px solid rgba(200,168,75,0.4);
  border-radius: 6px; color: rgba(200,168,75,0.6);
  font-family: monospace; font-size: 11px; letter-spacing: 2px;
  padding: 6px 14px; cursor: pointer;
}
```

---

## Plane SVG

Inline SVG `viewBox="0 0 220 80"`, plane faces right. Build from these shapes:

- **Fuselage**: `<path>` elongated diamond, fill `#b0cce0`, stroke `#5a8aaa` 0.5px
- **Delta wings** (top + bottom): two symmetric triangle paths, fill `#7aaac8`
- **Cockpit**: small trapezoid near nose, fill `rgba(136,204,255,0.85)`
- **Nose cone**: sharp triangle extending right, fill `#c8dff0`
- **Exhaust nozzles**: two dark rectangles at tail
- **Wing stripe**: thin gold line `#c8a84b` on each wing
- **Roundel**: small `<circle>` red/white near nose
- **Panel lines**: `stroke-width="0.4"` lines, opacity 0.5

---

## Animation timeline (`requestAnimationFrame` only — no CSS animation for motion)

### Easing functions

```js
const easeOutExpo  = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const easeOutElastic = t => t === 0 ? 0 : t === 1 ? 1
  : Math.pow(2, -8 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 4.5)) + 1;
```

### targetX

```js
const targetX = window.innerWidth / 2 - 110; // center the 220px plane
```

### Phase 1 — Blast (0 → 1100ms)

| Property | Value |
|---|---|
| Plane X | `-340px` → `targetX + 80px` via `easeOutExpo` |
| Plane rotation | `-3deg` → `0deg` linear |
| Afterburner opacity | 0 → 1 (first 200ms), then flicker ±15% every frame |
| Speed streaks | fade in to 0.7, translate left by each streak's speed (8–14px/frame), wrap via modulo |
| Camera shake | `±2px` random on `#intro-stage`, 300ms duration |

### Phase 2 — Brake (1100 → 1700ms)

| Property | Value |
|---|---|
| Plane X | `targetX + 80px` → `targetX` via `1 - easeOutExpo(1-p)` (fast-in slow-out) |
| Plane rotation | `0deg` → `+5deg` linear (nose-up on brake) |
| Afterburner | fade out over full phase |
| Streaks | fade out |
| Shockwaves | fire 3 rings at phase start (see below) |
| Camera shake | `±5px`, 150ms — fires once at phase start |

**Shockwave rings** — fire at first frame of phase 2, centered on plane nose (`x = targetX + 220, y = window.innerHeight / 2`):

```js
[
  { size: 80,  delay: 0   },
  { size: 120, delay: 80  },
  { size: 160, delay: 160 },
].forEach(({ size, delay }) => {
  setTimeout(() => {
    const ring = document.createElement('div');
    ring.className = 'intro-shockwave';
    ring.style.cssText = `width:${size}px;height:${size}px;
      left:${targetX + 220 - size/2}px;
      top:${window.innerHeight/2 - size/2}px;
      transition: transform 0.55s ease-out, opacity 0.55s ease-out;`;
    document.getElementById('intro-shockwaves').appendChild(ring);
    requestAnimationFrame(() => { ring.style.transform = 'scale(1)'; ring.style.opacity = '0'; });
  }, delay);
});
```

### Phase 3 — Settle (1700 → 2000ms)

| Property | Value |
|---|---|
| Plane X | `easeOutElastic` bounce — overshoots left slightly, snaps to `targetX` |
| Plane rotation | `+5deg` → `0deg` via `easeOutExpo` |

### Phase 4 — Logo reveal (2000 → 2500ms)

- Set `#intro-logo` CSS transition `opacity 0.5s ease` then opacity to 1
- Plane stays stationary

### Auto-complete

After phase 4, wait 800ms then call `skipIntro()`.

---

## Skip & cleanup

```js
function skipIntro() {
  const stage = document.getElementById('intro-stage');
  stage.style.transition = 'opacity 0.3s ease';
  stage.style.opacity = '0';
  setTimeout(() => { stage.remove(); onComplete(); }, 300);
}

document.getElementById('intro-skip')
  .addEventListener('click', skipIntro, { once: true });
```

---

## Camera shake helper

```js
function shake(el, magnitude, durationMs) {
  const t0 = performance.now();
  (function frame(now) {
    const p = (now - t0) / durationMs;
    if (p >= 1) { el.style.transform = ''; return; }
    const m = magnitude * (1 - p);
    el.style.transform = `translate(${(Math.random()-.5)*m*2}px,${(Math.random()-.5)*m*2}px)`;
    requestAnimationFrame(frame);
  })(performance.now());
}
```

---

## Speed streaks setup

```js
for (let i = 0; i < 18; i++) {
  const el = document.createElement('div');
  el.className = 'intro-streak';
  el.style.top   = (60 + Math.random() * (window.innerHeight - 120)) + 'px';
  el.style.width = (40 + Math.random() * 180) + 'px';
  el.style.left  = (Math.random() * window.innerWidth) + 'px';
  el._speed = 8 + Math.random() * 14;
  document.getElementById('intro-streaks').appendChild(el);
}
```

Each frame during phase 1, move each streak: `left = (left - speed + W) % W`.

---

## Validation checklist

1. Animation only plays on first load — not on menu revisits
2. Skip works at any point in all 4 phases
3. Plane starts fully off-screen left
4. Shockwave rings are centered on the plane nose
5. `#intro-stage` fully removed from DOM after completion
6. No dropped frames on mid-range mobile (60fps target)
7. `G.hasSeenIntro` persisted to localStorage
