
# Development Plan

## Stack

| Layer | Technology | Why |
|---|---|---|
| Rendering | HTML5 Canvas API | Native, no deps, full control |
| Logic | Vanilla JS (ES Modules) | No framework needed for a game |
| UI Screens | HTML + CSS | Menus, buttons — DOM is better than canvas for UI |
| Sound | Web Audio API | Synthesized SFX, no audio files needed |
| Persistence | localStorage | Free, instant, no backend |
| Dev Server | Vite | Web build tool (not a game engine) — HMR, bundles for production |
| Hosting | Netlify / GitHub Pages | Free static hosting, deploy from `dist/` folder |

---

## Project Structure

```
jexongo/
├── index.html
├── package.json
├── vite.config.js
├── style.css
├── public/                    ← static assets (fonts, any sprites)
└── src/
    ├── main.js                ← entry point, screen manager
    ├── state.js               ← global G object (lives, xp, level, etc.)
    ├── data/
    │   ├── aircraft.js        ← all 10 aircraft configs & XP costs
    │   ├── levels.js          ← 50 level definitions (biome, ops, difficulty)
    │   └── enemies.js         ← enemy type configs
    ├── screens/
    │   ├── menu.js
    │   ├── levelmap.js        ← vertical zig-zag progression map
    │   ├── game.js            ← game screen coordinator
    │   ├── hangar.js
    │   ├── result.js
    │   ├── chest.js
    │   └── gameover.js
    ├── game/
    │   ├── loop.js            ← requestAnimationFrame game loop
    │   ├── renderer.js        ← all canvas draw calls
    │   ├── math-engine.js     ← question generator, distractor answers
    │   ├── enemies.js         ← enemy instances, movement, hit detection
    │   ├── missiles.js        ← projectile system
    │   ├── particles.js       ← explosions, sparks, effects
    │   ├── powerups.js        ← power-up spawn & activation
    │   └── aircraft-draw.js   ← procedural plane silhouettes per type
    ├── systems/
    │   ├── xp.js              ← XP & star calculation
    │   ├── progression.js     ← level unlock & node state logic
    │   ├── chest.js           ← chest reward RNG (Standard→Legendary)
    │   └── streak.js          ← streak counter & bonus triggers
    ├── audio/
    │   └── sound.js           ← Web Audio API: missile, explosion, UI, streak
    └── utils/
        ├── storage.js         ← localStorage read/write wrapper
        └── dom.js             ← screen show/hide, button helpers
```

---

## Build Phases

### Phase 1 — Foundation & Core Loop
*Deliverable: One playable level, end to end*

- [ ] Vite project setup, file structure, `index.html` shell
- [ ] Screen manager (`showScreen(id)`) + global state object `G`
- [ ] Canvas setup + `requestAnimationFrame` game loop
- [ ] Player aircraft drawn on canvas (procedural silhouette)
- [ ] Basic enemy spawns and moves toward player
- [ ] Math engine — question generator for addition, 4 answer buttons (DOM)
- [ ] Answer logic — correct fires missile + destroys enemy; wrong loses a life
- [ ] Timer countdown bar (10 seconds per question)
- [ ] Lives HUD (3 hearts)
- [ ] Win/lose trigger — 10 questions done → result screen; 0 lives → game over

---

### Phase 2 — Progression & Persistence
*Deliverable: Players can advance through levels and earn rewards*

- [ ] Result screen — star display, XP earned, Continue button
- [ ] XP & star calculation (`xp.js`, `streak.js`)
- [ ] Level map screen — 50 nodes, vertical zig-zag, Locked / Available / Completed states
- [ ] localStorage save/load — XP, stars per level, unlocked aircraft
- [ ] Level unlock logic after completion
- [ ] Chest screen — triggered every 10 levels; RNG roll for Standard/Rare/Epic/Legendary

---

### Phase 3 — Hangar & Aircraft
*Deliverable: Meaningful unlock loop with visual variety*

- [ ] Hangar screen — grid of aircraft, lock/unlock state, XP cost
- [ ] Aircraft data for all 10 planes with XP thresholds
- [ ] Procedural canvas silhouettes — 6 shape types (stealth, fighter, bomber, trainer, transport, recon)
- [ ] Unlock aircraft by spending XP; set active plane
- [ ] Aircraft abilities in-game (F-22: fast missiles, B-2: multi-shot, C-17: +1 life)
- [ ] Chest aircraft parts system — collect parts to fully unlock a plane

---

### Phase 4 — Enemy Variety & Difficulty
*Deliverable: Game stays challenging across all 50 levels*

- [ ] Tank enemy — requires 2 correct answers to destroy
- [ ] Fast enemy — reduces decision time
- [ ] Boss enemy — appears every 10 levels, multi-phase
- [ ] Difficulty bands wired to levels: Easy (1–10), Medium (11–25), Hard (26–50), Expert (50+)
- [ ] Math operations per band: addition → +subtraction → ×multiplication → mixed
- [ ] Separate progression paths per difficulty tier

---

### Phase 5 — Biomes, Power-ups & Juice
*Deliverable: Visual variety, depth, and satisfying feel*

- [ ] Biome backgrounds — Ocean, Desert, City, Arctic, Space (change per 10-level band)
- [ ] Power-ups — Slow Time, Shield, Double Damage, Auto Answer, Multi-shot
- [ ] Power-up drops from enemies + chest rewards
- [ ] Practice Mode — no timer, unlimited lives, unlocked from menu
- [ ] Sound design — synthesized SFX via Web Audio API (missile, explosion, correct, wrong, streak, chest)
- [ ] Visual feedback — camera shake, screen flash, particle explosions, green/red answer highlight

---

### Phase 6 — Hosting & Launch
*Deliverable: Live URL, playable by anyone*

- [ ] Mobile responsiveness — touch-friendly buttons, canvas scaling
- [ ] `npm run build` → `dist/` output via Vite
- [ ] Deploy to Netlify (drag-and-drop `dist/`) or GitHub Pages via CI
- [ ] Performance audit — 60fps on mid-range devices
- [ ] First-run tutorial overlay for Level 1

---

## Hosting Path (Shortest Route to Live URL)

```
npm run build
      ↓
 dist/ folder
      ↓
 Drag onto netlify.com/drop
      ↓
 https://jexongo.netlify.app  ← live in ~30 seconds
```

---

## Progress Tracker

| Phase | Status |
|---|---|
| Phase 1 — Foundation & Core Loop | Not started |
| Phase 2 — Progression & Persistence | Not started |
| Phase 3 — Hangar & Aircraft | Not started |
| Phase 4 — Enemy Variety & Difficulty | Not started |
| Phase 5 — Biomes, Power-ups & Juice | Not started |
| Phase 6 — Hosting & Launch | Not started |

