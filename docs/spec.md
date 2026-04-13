# JexonGo — Pixel Art Visual Upgrade Spec

**Audience:** Kids, ages 6–12  
**Goal:** Replace all procedural canvas drawing (shapes) with pixel art sprites from the Legacy Collection.  
**Constraint:** The game logic, math engine, and progression system stay untouched. Only the rendering layer changes.

---

## Asset Root

All asset paths below are relative to this file (`docs/spec.md`).  
Base: `../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/`

---

## Biome → Art Style Mapping

| Biome | Levels | Style | Rationale |
|---|---|---|---|
| Ocean | 1–10 | Warped | Bright daytime ocean, approachable for young players |
| Desert | 11–20 | Misc colorful + Gothicvania lava | Colorful tileset for sky/ground; lava BG for desert boss |
| City | 21–30 | Warped Synth City | Cyberpunk neon city, exciting mid-game shift |
| Arctic | 31–40 | Gothicvania Mountain Dusk | Moody dusk mountains, dramatic difficulty ramp |
| Space | 41–50 | Warped Space | Pure sci-fi for the final stretch |

---

## Entity → Sprite Mapping

### Player Aircraft (10 ships → 8 shooter ship variants + 1 spaceship + 1 composite)

| Aircraft | Sprite |
|---|---|
| T-6 Texan II (starter) | [ship-01 yellow](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-shooter-ship/spritesheets/yellow/ship-01.png>) |
| PC-21 | [ship-02 yellow](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-shooter-ship/spritesheets/yellow/ship-02.png>) |
| C-130 | [ship-03 yellow](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-shooter-ship/spritesheets/yellow/ship-03.png>) |
| A-10 | [ship-04 yellow](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-shooter-ship/spritesheets/yellow/ship-04.png>) |
| F-16 | [ship-01 red](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-shooter-ship/spritesheets/red/ship-01.png>) |
| F/A-18 | [ship-02 red](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-shooter-ship/spritesheets/red/ship-02.png>) |
| F-22 | [ship-03 red](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-shooter-ship/spritesheets/red/ship-03.png>) |
| F-35 | [ship-04 red](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-shooter-ship/spritesheets/red/ship-04.png>) |
| B-2 Spirit | [spaceship-unit](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/spaceship-unit/Spritesheets/Spritesheet.png>) |
| SR-71 Blackbird | [spaceship-unit + thrust](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/spaceship-unit/Spritesheets/separated sprites/thrust.png>) |

Thrust animation (all ships): [ship thrust spritesheets](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-shooter-ship/spritesheets/thrust/>)

### Enemies

| Enemy Type | Sprite |
|---|---|
| basic | [enemy-01](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-shooter-enemies/spritesheets/enemy-01.png>) |
| fast | [enemy-02](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-shooter-enemies/spritesheets/enemy-02.png>) |
| tank | [enemy-03](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-shooter-enemies/spritesheets/enemy-03.png>) |
| boss | [boss body](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-boss/PNG/spritesheets/boss.png>) + [cannon-left](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-boss/PNG/spritesheets/cannon-left.png>) + [cannon-right](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-boss/PNG/spritesheets/cannon-right.png>) + [rays](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-boss/PNG/spritesheets/rays.png>) |

Enemy death animation (all types): [enemy-death frames](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-shooter-enemies/spritesheets/enemy-explosion.png>)

### Missiles & FX

| Effect | Sprite |
|---|---|
| Player missile | [Bolt spritesheet](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Explosions and Magic/Warped shooting fx/Bolt/spritesheet.png>) (4 frames) |
| Enemy missile | [Boss bolt](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Characters/top-down-boss/PNG/spritesheets/bolt.png>) |
| Hit spark (small) | [explosion-1-a](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Explosions and Magic/Explosions pack/explosion-1-a/spritesheet.png>) (8 frames) |
| Explosion (medium) | [explosion-1-c](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Explosions and Magic/Explosions pack/explosion-1-c/spritesheet.png>) |
| Explosion (large/boss) | [explosion-1-f](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Explosions and Magic/Explosions pack/explosion-1-f/spritesheet.png>) |
| Water splash (ocean) | [Water splash sprites](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Explosions and Magic/Water splash/Sprites/>) |

### Collectibles

| Item | Sprite |
|---|---|
| Chest reward gems | [gems-spritesheet](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Misc/gems/spritesheets/gems-spritesheet.png>) |

---

## Background Layers Per Biome

Each biome uses parallax layers scrolled at different speeds (back = slowest, front = fastest).

### Ocean (Levels 1–10) — Warped Ocean View
| Layer | File | Scroll Speed |
|---|---|---|
| Sky | [Back.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Environments/Ocean View Files/Layers/Day/Back.png>) | 0.1× |
| Clouds | [Clouds.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Environments/Ocean View Files/Layers/Day/Clouds.png>) | 0.3× |
| Horizon | [Middle.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Environments/Ocean View Files/Layers/Day/Middle.png>) | 0.5× |
| Water tile | [Tile.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Environments/Ocean View Files/Layers/Day/Tile.png>) | 0.8× |

### Desert (Levels 11–20) — Misc Colorful Tileset
| Layer | File | Scroll Speed |
|---|---|---|
| Sky | [background-sky.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Misc/colorful-tileset/PNG/layers/background-sky.png>) | 0.1× |
| Clouds | [cloud.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Misc/colorful-tileset/PNG/layers/cloud.png>) | 0.25× |
| Vegetation | [back-vegetation.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Misc/colorful-tileset/PNG/layers/back-vegetation.png>) | 0.5× |
| Ground tiles | [tile-set.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Misc/colorful-tileset/PNG/layers/tile-set.png>) | 0.8× |

Desert boss levels (10, 20) swap in the [lava background](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Gothicvania/Environments/lava-background/PNG/background.png>) + [lava tile](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Gothicvania/Environments/lava-background/PNG/lava-tile.png>).

### City (Levels 21–30) — Warped Synth City
| Layer | File | Scroll Speed |
|---|---|---|
| Sky | [back.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Environments/Synth City/Version 2/Layers/back.png>) | 0.1× |
| Far buildings | [far-buildings.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Environments/Synth City/Version 1/PNG/layers/far-buildings.png>) | 0.3× |
| Mid buildings | [middle.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Environments/Synth City/Version 2/Layers/middle.png>) | 0.5× |
| Foreground | [foreground.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Environments/Synth City/Version 2/Layers/foreground-empty.png>) | 0.8× |

### Arctic (Levels 31–40) — Gothicvania Mountain Dusk (Version A)
| Layer | File | Scroll Speed |
|---|---|---|
| Sky | [sky.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Gothicvania/Environments/Mountain Dusk/version A/Layers/sky.png>) | 0.0× |
| Far clouds | [far-clouds.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Gothicvania/Environments/Mountain Dusk/version A/Layers/far-clouds.png>) | 0.1× |
| Far mountains | [far-mountains.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Gothicvania/Environments/Mountain Dusk/version A/Layers/far-mountains.png>) | 0.2× |
| Near clouds | [near-clouds.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Gothicvania/Environments/Mountain Dusk/version A/Layers/near-clouds.png>) | 0.3× |
| Mountains | [mountains.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Gothicvania/Environments/Mountain Dusk/version A/Layers/mountains.png>) | 0.5× |
| Trees | [trees.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Gothicvania/Environments/Mountain Dusk/version A/Layers/trees.png>) | 0.8× |

### Space (Levels 41–50) — Warped Space Background Pack
| Layer | File | Scroll Speed |
|---|---|---|
| Deep space | [parallax-space-backgound.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Environments/space_background_pack/Old Version/layers/parallax-space-backgound.png>) | 0.0× |
| Stars | [parallax-space-stars.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Environments/space_background_pack/Old Version/layers/parallax-space-stars.png>) | 0.05× |
| Far planets | [parallax-space-far-planets.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Environments/space_background_pack/Old Version/layers/parallax-space-far-planets.png>) | 0.15× |
| Ring planet | [parallax-space-ring-planet.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Environments/space_background_pack/Old Version/layers/parallax-space-ring-planet.png>) | 0.25× |
| Big planet | [parallax-space-big-planet.png](<../../JexonGo visuel/Legacy Collection/Legacy Collection/Assets/Warped/Environments/space_background_pack/Old Version/layers/parallax-space-big-planet.png>) | 0.4× |

---

## Technical Requirements

### R1 — Sprite Loader
- Load PNG files as `HTMLImageElement` objects at game startup
- Cache all images in a map keyed by asset ID
- Game must not start until all images for the current biome are loaded
- Show a loading bar while assets load

### R2 — Sprite Renderer
- Replace `drawAircraft()` in [src/game/aircraft-draw.js](../src/game/aircraft-draw.js) with sprite-based rendering
- Replace `drawEnemy()` in [src/game/aircraft-draw.js](../src/game/aircraft-draw.js) with sprite-based rendering
- Replace particle/explosion drawing in [src/game/particles.js](../src/game/particles.js) with spritesheet animation
- Replace missile drawing in [src/game/missiles.js](../src/game/missiles.js) with Bolt sprite

### R3 — Parallax Background
- New module `src/game/background.js` that owns parallax layer state
- Each layer stores: image, scroll speed multiplier, current Y offset
- Called once per frame in the game loop before entities are drawn
- Biome layers loaded from a config map keyed by biome name (matches `BIOME_META` in [src/data/levels.js](../src/data/levels.js))

### R4 — Animation System
- Spritesheets are assumed to be horizontal strips (N frames × 1 row)
- Each animated entity tracks: `frame`, `frameTimer`, `frameRate`
- `frameRate` configurable per entity type (enemies animate slower than explosions)
- Explosions play once then remove the particle; idle sprites loop

### R5 — Graceful Fallback
- If an image fails to load, fall back to the existing procedural canvas shape
- Log a warning to the console — no broken game states

---

## Milestone 1 — Pixel Core
**Scope:** Levels 1–10 (Ocean biome). Fully playable with pixel art.

### Deliverables
- [ ] **R1** Sprite loader with loading screen
- [ ] **R3** Parallax background: Ocean biome (Warped Ocean View, Day variant)
- [ ] **R2** Player sprite: T-6 (ship-01 yellow) with thrust animation
- [ ] **R2** Enemy sprites: basic (enemy-01), fast (enemy-02)
- [ ] **R2** Player missile: Bolt (4-frame loop)
- [ ] **R4** Hit spark on enemy damage: explosion-1-a (8 frames, play once)
- [ ] **R2** Enemy death: enemy-explosion spritesheet (play once, then remove)
- [ ] **R5** Fallback to canvas shapes if any image missing

### Definition of Done
All 10 ocean levels are playable start to finish. No canvas shapes visible for the player ship, enemies, missiles, or explosions during normal play.

---

## Milestone 2 — Biome Variety
**Scope:** Levels 1–30 (+ Desert and City biomes). Fully playable with pixel art.

### Deliverables
- [ ] **R3** Desert background: Misc colorful-tileset (4 parallax layers)
- [ ] **R3** Desert boss levels (10, 20): swap in lava-background layers
- [ ] **R3** City background: Synth City Version 2 (4 parallax layers)
- [ ] **R2** Tank enemy sprite: enemy-03
- [ ] **R2** Boss sprite: boss body + cannon-left + cannon-right + rays (multi-layer composite)
- [ ] **R2** Boss missile: boss bolt sprite
- [ ] **R2** Medium explosion: explosion-1-c for tank/boss hits
- [ ] **R1** Aircraft sprites for pc21, c130, a10 (ships 02–04 yellow)
- [ ] Gems spritesheet used on chest reward screen

### Definition of Done
Levels 1–30 are fully playable. Each biome has a distinct background. Boss fight at level 10, 20, 30 uses the boss sprite composite. Chest screen shows gem icons.

---

## Milestone 3 — Full Game
**Scope:** Levels 1–50 (all 5 biomes). Complete aircraft roster. Full FX polish.

### Deliverables
- [ ] **R3** Arctic background: Mountain Dusk Version A (6 parallax layers)
- [ ] **R3** Space background: Old Version pack (5 parallax layers)
- [ ] **R1** Aircraft sprites for f16, f18, f22, f35 (red variants), b2 + sr71 (spaceship-unit)
- [ ] **R2** All 10 aircraft render correctly in hangar and in-game
- [ ] **R2** Enemy missile for non-boss enemies (Bolt, recolored or scaled smaller)
- [ ] **R2** Large boss explosion: explosion-1-f (full-screen impact frame)
- [ ] **R2** Water splash particles on ocean-biome enemy deaths
- [ ] Explosion variants a–g assigned to entity sizes:
  - a = hit spark (fast enemy)
  - b = basic enemy death
  - c = tank enemy death
  - d = player ship hit flash
  - e = player ship death
  - f = boss death (large)
  - g = reserved for screen-clear special

### Definition of Done
All 50 levels are fully playable. All 10 aircraft display correct pixel art sprites in the hangar and in-game. All 5 biomes have parallax backgrounds. No procedural canvas shapes remain in normal gameplay.
