# JEXONGO – Game Design Document

## Overview
JEXONGO is an educational aerial combat game designed for primary school students. It combines fast-paced action with math problem solving. Players control an aircraft and must answer math questions correctly to attack enemies and progress through levels.

---

## Core Gameplay Loop

1. Start mission
2. Enemy appears
3. Math question is displayed (4 choices)
4. Player selects an answer:
   - Correct → missile fires → enemy destroyed
   - Incorrect → player loses life
5. Repeat for ~10 questions
6. End of level:
   - Stars awarded
   - XP earned
7. Return to progression map

---

## Player Systems

### Lives
- Player starts with 3 lives
- Each wrong answer removes 1 life
- 0 lives = game over

### Timer
- 10 seconds per question
- Timer adds pressure and pacing

---

## Win / Lose Conditions

### Win
- Complete all questions in the level
- Rewards:
  - XP
  - Stars
  - Chest every 10 levels

### Lose
- All lives lost
- Time runs out
- Player can retry the level

---

## XP and Star System

### XP Rewards per Level
- 1–5 correct: 50 XP
- 6–9 correct: 120 XP
- 10 correct: 200 XP

### Stars
- 1–5 correct: 1 star
- 6–9 correct: 2 stars
- 10 correct: 3 stars

---

## Progression System

- 50+ levels
- Vertical map (Duolingo-style)
- Zig-zag path

### Node States
- Locked
- Available
- Completed

---

## Chest Rewards (Every 10 Levels)

### Rewards:
- Standard: 100 XP
- Rare: 250 XP
- Epic: 500 XP
- Legendary: 1000 XP
- 10% chance to unlock an aircraft

---

## Aircraft System

Aircraft are unlocked using XP.

### Example Pricing
- F/A-18: 300 XP
- F-22: 600 XP
- U-2: 1000 XP
- C-130: 1500 XP
- F-35: 2200 XP
- F-16: 3000 XP
- C-17: 4500 XP
- C-5: 7000 XP
- SR-71: 9000 XP
- B-2: 12000 XP

### Aircraft Abilities
- F-22: fast missiles
- F-16: balanced
- B-2: multi-shot
- C-17: extra life

---

## Power-Ups

### Types
- Slow Time: slows timer
- Shield: protects from one mistake
- Double Damage: stronger attacks
- Auto Answer: removes wrong choices
- Multi-shot: hits multiple enemies

### Acquisition
- Random drops
- Chest rewards
- Streak bonuses

---

## Enemy System

### Types
- Basic: 1 hit
- Tank: 2 hits
- Fast: reduces decision time
- Boss: appears every 10 levels

---

## Difficulty Scaling

### Easy (Levels 1–10)
- Addition only
- Slower enemies

### Medium (11–25)
- Addition + subtraction

### Hard (26–50)
- Multiplication
- Faster gameplay

### Expert (50+)
- Mixed operations
- Less time

---

## Additional Design Recommendations

### Difficulty Paths
- Each difficulty level has its own progression path
- Players advance separately through Easy, Medium, Hard, etc.

### Star System Expansion
- Each star has its own criteria (accuracy, speed, streaks)
- Additional stars or merits can be added for special achievements (perfect run, no damage, streaks)

### Aircraft Variety
- Add more aircraft, including older models (e.g., 1970s era aircraft)
- This increases variety and educational value

### Chest System Improvement
- Chests should not directly grant full aircraft
- Instead, they give aircraft parts
- Players must collect multiple parts to unlock a full aircraft

---

## Biomes

- Ocean
- Desert
- City
- Arctic
- Space

Each biome changes visuals and difficulty slightly.

---

## Streak System

- 3 correct answers → XP bonus
- 5 correct answers → larger bonus
- Visual and audio feedback

---

## UI Principles

- Clean and readable
- Large buttons
- Minimal background distraction
- Focus on math clarity

---

## Feedback System

- Correct answer: green highlight + sound
- Wrong answer: red highlight + vibration
- Missile animation and explosion

---

## Additional Features

### Practice Mode
- No timer
- Unlimited attempts

### Sound Design
- Missile sounds
- Explosion sounds
- UI feedback sounds

---

## Design Philosophy

- Learning must remain clear and readable
- Gameplay must feel rewarding and dynamic
- Progression must be motivating and fair

---

## Summary

JEXONGO combines education and action by turning math into an interactive combat experience. With structured progression, rewarding systems, and engaging gameplay, it aims to make learning both effective and enjoyable.