# Codex Prompt — Onboarding Flow "Ta quel âge?"

## Overview

When a player opens JexonGo for the first time, before anything else, show a 6-step onboarding flow. A fighter jet mascot with a speech bubble asks questions one at a time. The player's answers configure their difficulty, starting level, and daily goal. After the last step, launch the game directly at the right level.

Only plays once. Gated by `G.hasSeenOnboarding` saved to localStorage.

---

## Trigger in `src/main.js`

```js
import { showOnboarding } from './screens/onboarding.js';

if (!G.hasSeenOnboarding) {
  showOnboarding(() => {
    G.hasSeenOnboarding = true;
    storage.set('hasSeenOnboarding', 'true');
    showScreen('menu');
  });
} else {
  showScreen('menu');
}
```

---

## Visual style — match the screenshots exactly

- Full screen background: `#00BCD4` (cyan/teal)
- Buttons: `#F57C00` (orange) with a dark shadow offset `4px` bottom-right, border-radius `6px`
- Button text: black, font `retropix` monospace, font-size `20px`
- Jet mascot: top-left corner, existing plane sprite or inline SVG, width `180px`
- Speech bubble: white circle/oval with black border `3px`, top-right of mascot, font `retropix` `18px` black, max 4 lines
- "Continuer" button: bottom-right corner, same orange style but smaller (`14px`)
- No header, no back button, no progress bar — keep it clean

---

## New file: `src/screens/onboarding.js`

```js
import { G } from '../state.js';
import { storage } from '../utils/storage.js';

export function showOnboarding(onComplete) {
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  document.body.appendChild(overlay);

  let step = 0;
  const answers = {};

  const STEPS = [
    {
      question: 'Est-ce t\'aime\nles math?',
      choices: ['OUI!!!', 'NON!!!'],
      key: 'likesMath',
      multi: false,
    },
    {
      question: 'Ta quel\nâge',
      choices: ['6-9 ans', '9-12 ans', '12 ans +'],
      key: 'ageGroup',
      multi: false,
    },
    {
      question: 'Qu\'est qui est\ndifficile pour\ntoi?',
      choices: ['+ Les Additions +', '- Les Soustractions -', 'X Les multiplications X', '÷ Les Divisions ÷'],
      key: 'hardTopic',
      multi: false,
    },
    {
      question: 'Tu veux\ncommencer où?',
      choices: [
        { label: 'Les bases', sub: 'Commencer avec des leçon facile' },
        { label: 'Voir ton niveau', sub: 'Laisse Jexongo analyser\npour bien commencer' },
      ],
      key: 'startMode',
      multi: false,
    },
    {
      question: 'Combient de\ntemps par\njour veux-tu\njouer',
      choices: ['1 minute par jour', '5 minutes par jour', '+10 mins par jour'],
      key: 'dailyGoal',
      multi: false,
    },
  ];

  function render() {
    overlay.innerHTML = '';

    // Mascot + bubble
    const top = document.createElement('div');
    top.className = 'ob-top';
    top.innerHTML = `
      <img class="ob-jet" src="assets/planes/f15.png" onerror="this.style.display='none'" />
      <div class="ob-bubble">
        <p>${STEPS[step].question.replace(/\n/g, '<br>')}</p>
      </div>
    `;
    overlay.appendChild(top);

    // Choices
    const choices = document.createElement('div');
    choices.className = 'ob-choices';

    STEPS[step].choices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.className = 'ob-btn';
      const label = typeof choice === 'object' ? choice.label : choice;
      const sub   = typeof choice === 'object' ? choice.sub   : null;
      btn.innerHTML = `<span class="ob-btn-label">${label}</span>${sub ? `<span class="ob-btn-sub">${sub.replace(/\n/g,'<br>')}</span>` : ''}`;

      // Highlight selected
      if (answers[STEPS[step].key] === i) btn.classList.add('ob-btn-selected');

      btn.addEventListener('click', () => {
        answers[STEPS[step].key] = i;
        answers[`${STEPS[step].key}_value`] = label;
        // Re-render to show selection
        render();
      });
      choices.appendChild(btn);
    });
    overlay.appendChild(choices);

    // Continuer button
    const continuer = document.createElement('button');
    continuer.className = 'ob-continuer';
    continuer.textContent = 'Continuer';
    continuer.addEventListener('click', () => {
      if (answers[STEPS[step].key] === undefined) return; // must pick something
      step++;
      if (step >= STEPS.length) {
        applyOnboardingAnswers(answers);
        overlay.remove();
        onComplete();
      } else {
        render();
      }
    });
    overlay.appendChild(continuer);
  }

  render();
}
```

---

## `applyOnboardingAnswers(answers)` — wire answers to game config

```js
function applyOnboardingAnswers(answers) {
  // Age group → starting difficulty
  const ageMap = { 0: 1, 1: 11, 2: 26 }; // 6-9→Easy, 9-12→Medium, 12+→Hard
  G.currentLevel = ageMap[answers.ageGroup] ?? 1;

  // Hard topic → bias first levels toward that operation
  const topicMap = { 0: '+', 1: '-', 2: '*', 3: '/' };
  G.focusOperation = topicMap[answers.hardTopic] ?? null;

  // Start mode → skip placement or run 3 placement questions
  if (answers.startMode === 1) {
    G.pendingPlacement = true; // run 3 diagnostic questions before level 1
  }

  // Daily goal → set streak reminder target
  const goalMap = { 0: 1, 1: 5, 2: 10 };
  G.dailyGoalMinutes = goalMap[answers.dailyGoal] ?? 5;

  // Persist
  storage.set('currentLevel',      G.currentLevel);
  storage.set('focusOperation',     G.focusOperation ?? '');
  storage.set('dailyGoalMinutes',   G.dailyGoalMinutes);
}
```

---

## CSS (add to `style.css`)

```css
/* ── ONBOARDING ── */
#onboarding-overlay {
  position: fixed; inset: 0; z-index: 9000;
  background: #00BCD4;
  display: flex; flex-direction: column;
  align-items: center;
  padding: 0 24px;
  overflow: hidden;
}

.ob-top {
  display: flex; align-items: flex-start;
  width: 100%; margin-top: 48px; gap: 0;
  position: relative; min-height: 220px;
}

.ob-jet {
  width: 180px; flex-shrink: 0;
  filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.3));
}

.ob-bubble {
  background: white;
  border: 3px solid #111;
  border-radius: 50%;
  width: 200px; height: 180px;
  display: flex; align-items: center; justify-content: center;
  text-align: center;
  margin-left: -10px; margin-top: 10px;
  position: relative;
  flex-shrink: 0;
}

/* Tail of speech bubble pointing left toward jet */
.ob-bubble::before {
  content: '';
  position: absolute;
  left: -22px; top: 50%; transform: translateY(-50%);
  border: 11px solid transparent;
  border-right-color: #111;
}
.ob-bubble::after {
  content: '';
  position: absolute;
  left: -16px; top: 50%; transform: translateY(-50%);
  border: 9px solid transparent;
  border-right-color: white;
}

.ob-bubble p {
  font-family: 'retropix', monospace;
  font-size: 16px; line-height: 1.5;
  color: #111; margin: 0;
}

.ob-choices {
  display: flex; flex-direction: column;
  gap: 14px; width: 100%;
  margin-top: 32px;
}

.ob-btn {
  background: #F57C00;
  border: none;
  border-radius: 6px;
  box-shadow: 4px 4px 0 rgba(0,0,0,0.35);
  padding: 18px 16px;
  text-align: center; cursor: pointer;
  display: flex; flex-direction: column; gap: 4px;
  transition: transform 0.08s, box-shadow 0.08s;
}
.ob-btn:active {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 rgba(0,0,0,0.35);
}
.ob-btn.ob-btn-selected {
  background: #E65100;
  box-shadow: 4px 4px 0 rgba(0,0,0,0.5);
}

.ob-btn-label {
  font-family: 'retropix', monospace;
  font-size: 20px; color: #111; font-weight: 700;
}
.ob-btn-sub {
  font-family: monospace; font-size: 13px; color: #333; line-height: 1.4;
}

.ob-continuer {
  position: fixed; bottom: 24px; right: 24px;
  background: #F57C00;
  border: none; border-radius: 6px;
  box-shadow: 4px 4px 0 rgba(0,0,0,0.35);
  padding: 12px 24px;
  font-family: 'retropix', monospace; font-size: 16px;
  color: #111; cursor: pointer;
}
.ob-continuer:disabled { opacity: 0.4; cursor: default; }
```

---

## Welcome screen (écran 1 — before the questions)

Show a simple welcome screen before step 0:

```js
function showWelcome(onNext) {
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.innerHTML = `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;">
      <p style="font-family:monospace;font-size:18px;color:white;letter-spacing:2px;">Bienvenue dans</p>
      <div style="font-family:'retropix',monospace;font-size:52px;color:#F57C00;
                  text-shadow:4px 4px 0 #B35000;letter-spacing:4px;">JEXONGO</div>
      <button class="ob-btn" style="width:80%;margin-top:40px;" id="ob-start">
        <span class="ob-btn-label">Cliquer commencer!</span>
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('ob-start').addEventListener('click', () => {
    overlay.remove();
    onNext();
  });
}
```

Call `showWelcome` first, then `showOnboarding` in its callback.

---

## Validation checklist

1. Welcome screen shows on first ever launch, never again after
2. Each step waits for a selection before Continuer works
3. Selected button highlights darker orange
4. `applyOnboardingAnswers` sets `G.currentLevel` correctly per age group
5. 6-9 ans → level 1, 9-12 ans → level 11, 12 ans+ → level 26
6. `G.dailyGoalMinutes` is saved to localStorage
7. After last step, `G.hasSeenOnboarding = true` is saved and menu shows
8. Speech bubble tail points toward the jet on all screen sizes
