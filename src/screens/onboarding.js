import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { getLang, setLang } from '../i18n.js';

function legacyShowOnboarding(onComplete) {
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  document.body.appendChild(overlay);

  let step = -1; // -1 = welcome
  const answers = {};

  const STEPS = [
    {
      question: "Est-ce t'aime\nles math?",
      choices: ['OUI!!!', 'NON!!!'],
      key: 'likesMath',
    },
    {
      question: "Ta quel\nâge",
      choices: ['6-9 ans', '9-12 ans', '12 ans +'],
      key: 'ageGroup',
    },
    {
      question: "Qu'est qui est\ndifficile pour\ntoi?",
      choices: ['+ Les Additions +', '- Les Soustractions -', 'X Les multiplications X', '÷ Les Divisions ÷'],
      key: 'hardTopic',
    },
    {
      question: 'Tu veux\ncommencer où?',
      choices: [
        { label: 'Les bases', sub: 'Commencer avec des leçon facile' },
        { label: 'Voir ton niveau', sub: 'Laisse Jexongo analyser\npour bien commencer' },
      ],
      key: 'startMode',
    },
    {
      question: 'Combient de\ntemps par\njour veux-tu\njouer',
      choices: ['1 minute par jour', '5 minutes par jour', '+10 mins par jour'],
      key: 'dailyGoal',
    },
  ];

  function showWelcome(next) {
    overlay.innerHTML = '';
    const inner = document.createElement('div');
    inner.style.flex = '1';
    inner.style.display = 'flex';
    inner.style.flexDirection = 'column';
    inner.style.alignItems = 'center';
    inner.style.justifyContent = 'center';
    inner.style.gap = '40px';
    inner.innerHTML = `
      <p style="font-family:monospace;font-size:18px;color:white;letter-spacing:2px;">Bienvenue dans</p>
      <div style="font-family:'retropix',monospace;font-size:52px;color:#F57C00; text-shadow:4px 4px 0 #B35000;letter-spacing:4px;">JEXONGO</div>
    `;
    const startBtn = document.createElement('button');
    startBtn.className = 'ob-btn';
    startBtn.style.width = '80%';
    startBtn.style.marginTop = '40px';
    startBtn.id = 'ob-start';
    startBtn.innerHTML = `<span class="ob-btn-label">Cliquer commencer!</span>`;
    startBtn.addEventListener('click', () => {
      step = 0;
      render();
    });
    inner.appendChild(startBtn);
    overlay.appendChild(inner);
  }

  function applyOnboardingAnswers(ans) {
    // likesMath
    G.likesMath = ans.likesMath === 0;
    save('likesMath', G.likesMath);

    // Age group → starting difficulty / onboardingAgeGroup
    const ageMap = { 0: 1, 1: 11, 2: 26 };
    const ageIdx = ans.ageGroup ?? 0;
    G.onboardingAgeGroup = ageIdx;
    G.currentLevel = ageMap[ageIdx] ?? 1;
    save('onboardingAgeGroup', G.onboardingAgeGroup);
    save('currentLevel', G.currentLevel);

    // Hard topic → focusOperation
    const topicMap = { 0: '+', 1: '-', 2: '*', 3: '/' };
    const topicIdx = ans.hardTopic;
    G.focusOperation = topicMap[topicIdx] ?? null;
    if (G.focusOperation) save('focusOperation', G.focusOperation);

    // Start mode → pendingPlacement
    const startModeIdx = ans.startMode;
    if (startModeIdx === 1) {
      G.pendingPlacement = true;
      save('pendingPlacement', true);
      G.onboardingStartMode = 'placement';
    } else {
      G.pendingPlacement = false;
      save('pendingPlacement', false);
      G.onboardingStartMode = 'bases';
    }
    save('onboardingStartMode', G.onboardingStartMode);

    // Daily goal
    const goalMap = { 0: 1, 1: 5, 2: 10 };
    const goalIdx = ans.dailyGoal ?? 1;
    G.dailyGoalMinutes = goalMap[goalIdx] ?? 5;
    save('dailyGoalMinutes', G.dailyGoalMinutes);
  }

  function render() {
    overlay.innerHTML = '';

    // If still on welcome
    if (step === -1) { showWelcome(); return; }

    const current = STEPS[step];

    // Mascot + bubble
    const top = document.createElement('div');
    top.className = 'ob-top';
    top.innerHTML = `
      <img class="ob-jet" src="assets/planes/f15.png" onerror="this.style.display='none'" />
      <div class="ob-bubble">
        <p>${current.question.replace(/\n/g, '<br>')}</p>
      </div>
    `;
    overlay.appendChild(top);

    // Choices
    const choices = document.createElement('div');
    choices.className = 'ob-choices';
    current.choices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.className = 'ob-btn';
      const label = typeof choice === 'object' ? choice.label : choice;
      const sub = typeof choice === 'object' ? choice.sub : null;
      btn.innerHTML = `<span class="ob-btn-label">${label}</span>${sub ? `<span class="ob-btn-sub">${sub.replace(/\n/g,'<br>')}</span>` : ''}`;
      if (answers[current.key] === i) btn.classList.add('ob-btn-selected');
      btn.addEventListener('click', () => {
        answers[current.key] = i;
        answers[`${current.key}_value`] = label;
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
      if (answers[current.key] === undefined) return;
      step += 1;
      if (step >= STEPS.length) {
        applyOnboardingAnswers(answers);
        G.hasSeenOnboarding = true;
        save('hasSeenOnboarding', true);
        overlay.remove();
        onComplete?.();
        return;
      }
      render();
    });
    overlay.appendChild(continuer);
  }

  // Start on welcome
  render();
}

function introLang() {
  return getLang();
}

const INTRO_COPY = {
  en: {
    welcome: 'Welcome to',
    start: 'Click to start!',
    continue: 'Continue',
    captain: 'CAPTAIN JEXONGO',
    hudReady: 'READY',
    pilotSetup: 'PILOT SETUP',
    multiHint: 'Choose one or more',
    selectedLabel: 'selected',
    steps: [
      {
        question: 'Choose your\nlanguage',
        choices: ['Francais', 'English'],
        key: 'language',
        impact: ['Langue du jeu : francais', 'Game language: English'],
      },
      {
        question: 'Do you like\nmath?',
        choices: ['YES!!!', 'NO!!!'],
        key: 'likesMath',
        impact: ['Normal timer, confidence XP bonus', 'More time to answer'],
      },
      {
        question: 'What grade\nare you in?',
        choices: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
        key: 'ageGroup',
        impact: ['Start level 1', 'Start level 6', 'Start level 11', 'Start level 16', 'Start level 21', 'Start level 26'],
      },
      {
        question: 'What is hard\nfor you?',
        choices: [
          { label: 'Addition', symbol: '+' },
          { label: 'Subtraction', symbol: '-' },
          { label: 'Multiplication', symbol: '×' },
          { label: 'Division', symbol: '÷' },
        ],
        key: 'hardTopic',
        multi: true,
        impact: ['More addition', 'More subtraction', 'More multiplication', 'More division'],
      },
      {
        question: 'Where do you\nwant to start?',
        choices: [
          { label: 'The basics', sub: 'Start with easy lessons' },
          { label: 'See my level', sub: 'Let Jexongo analyze\nwhere to start' },
        ],
        key: 'startMode',
        impact: ['Normal progression', 'Placement mode with timer help'],
      },
      {
        question: 'How much time\nper day do you\nwant to play?',
        choices: ['1 minute per day', '5 minutes per day', '+10 mins per day'],
        key: 'dailyGoal',
        impact: ['Shorter levels', 'Normal levels', 'Longer levels'],
      },
    ],
  },
  fr: {
    welcome: 'Bienvenue dans',
    start: 'Cliquer commencer!',
    continue: 'Continuer',
    captain: 'CAPITAINE JEXONGO',
    hudReady: 'PRET',
    pilotSetup: 'CONFIG PILOTE',
    multiHint: 'Choisis une ou plusieurs options',
    selectedLabel: 'selection',
    steps: [
      {
        question: 'Choisis ta\nlangue',
        choices: ['Francais', 'English'],
        key: 'language',
        impact: ['Langue du jeu : francais', 'Game language: English'],
      },
      {
        question: "Est-ce t'aime\nles math?",
        choices: ['OUI!!!', 'NON!!!'],
        key: 'likesMath',
        impact: ['Timer normal, bonus XP de confiance', 'Plus de temps pour repondre'],
      },
      {
        question: 'Tu es en\nquelle annee?',
        choices: ['1re annee', '2e annee', '3e annee', '4e annee', '5e annee', '6e annee'],
        key: 'ageGroup',
        impact: ['Depart niveau 1', 'Depart niveau 6', 'Depart niveau 11', 'Depart niveau 16', 'Depart niveau 21', 'Depart niveau 26'],
      },
      {
        question: "Qu'est qui est\ndifficile pour\ntoi?",
        choices: [
          { label: 'Les additions', symbol: '+' },
          { label: 'Les soustractions', symbol: '-' },
          { label: 'Les multiplications', symbol: '×' },
          { label: 'Les divisions', symbol: '÷' },
        ],
        key: 'hardTopic',
        multi: true,
        impact: ['Plus de additions', 'Plus de soustractions', 'Plus de multiplications', 'Plus de divisions'],
      },
      {
        question: 'Tu veux\ncommencer ou?',
        choices: [
          { label: 'Les bases', sub: 'Commencer avec des lecons faciles' },
          { label: 'Voir ton niveau', sub: 'Laisse Jexongo analyser\npour bien commencer' },
        ],
        key: 'startMode',
        impact: ['Progression normale', 'Mode placement avec aide timer'],
      },
      {
        question: 'Combien de\ntemps par\njour veux-tu\njouer?',
        choices: ['1 minute par jour', '5 minutes par jour', '+10 mins par jour'],
        key: 'dailyGoal',
        impact: ['Niveaux plus courts', 'Niveaux normaux', 'Niveaux plus longs'],
      },
    ],
  },
};

function introCopy() {
  return INTRO_COPY[introLang()];
}

export function showOnboarding(onComplete) {
  showWelcome(() => showQuestionSteps(onComplete));
}

export function showEquationConfig(onComplete) {
  showQuestionSteps(onComplete, {
    keys: ['hardTopic', 'startMode'],
    initialAnswers: currentEquationConfigAnswers(),
    apply: applyEquationConfigAnswers,
  });
}

function showWelcome(onNext) {
  const copy = introCopy();
  const overlay = createOverlay();
  overlay.innerHTML = `
    <div class="ob-welcome ob-step">
      <div class="ob-panel ob-welcome-panel">
        <div class="ob-hud">
          <span>${copy.pilotSetup}</span>
          <span>${copy.hudReady}</span>
        </div>
        <img class="ob-welcome-jet" src="/assets/ships/player/f18.png" alt="">
        <p>${copy.welcome}</p>
        <div class="ob-logo">JEXONGO</div>
        <button class="ob-btn ob-start" id="ob-start" type="button">
          <span class="ob-btn-label">${copy.start}</span>
        </button>
      </div>
    </div>
  `;
  requestAnimationFrame(() => overlay.querySelector('.ob-step')?.classList.add('ob-step-visible'));
  document.getElementById('ob-start')?.addEventListener('click', () => {
    exitCurrentStep(overlay, () => {
      overlay.remove();
      onNext();
    });
  });
}

function showQuestionSteps(onComplete, options = {}) {
  let copy = introCopy();
  let steps = options.keys?.length
    ? copy.steps.filter(s => options.keys.includes(s.key))
    : copy.steps;
  const overlay = createOverlay();
  let step = 0;
  const answers = { ...(options.initialAnswers || {}) };

  function render() {
    const current = steps[step];
    overlay.innerHTML = '';

    const stepWrap = document.createElement('div');
    stepWrap.className = 'ob-step';

    const panel = document.createElement('div');
    panel.className = current.key === 'ageGroup'
      ? 'ob-panel ob-panel-compact ob-panel-grades'
      : current.choices.length > 3 ? 'ob-panel ob-panel-compact' : 'ob-panel';
    panel.innerHTML = `
      <div class="ob-hud">
        <span>${copy.pilotSetup}</span>
        <span>${step + 1}/${steps.length}</span>
      </div>
      <div class="ob-progress" aria-hidden="true">
        ${steps.map((_, i) => `<span class="${i <= step ? 'ob-progress-dot ob-progress-on' : 'ob-progress-dot'}"></span>`).join('')}
      </div>
    `;

    const top = document.createElement('div');
    top.className = 'ob-top';
    top.innerHTML = `
      <img class="ob-jet" src="/assets/ships/player/f18.png" alt="">
      <div class="ob-bubble">
        <span class="ob-captain">${copy.captain}</span>
        <p>${current.question.replace(/\n/g, '<br>')}</p>
      </div>
    `;
    panel.appendChild(top);

    let multiStatus = null;
    if (current.multi) {
      multiStatus = document.createElement('div');
      multiStatus.className = 'ob-multi-hint';
      multiStatus.textContent = `${copy.multiHint} - ${answers[current.key]?.length || 0} ${copy.selectedLabel}`;
      panel.appendChild(multiStatus);
    }

    const choices = document.createElement('div');
    choices.className = 'ob-choices';
    const continuer = document.createElement('button');
    continuer.className = 'ob-continuer';
    continuer.textContent = copy.continue;
    continuer.disabled = current.multi
      ? !(answers[current.key]?.length)
      : answers[current.key] === undefined;

    current.choices.forEach((choice, index) => {
      const btn = document.createElement('button');
      const label = typeof choice === 'object' ? choice.label : choice;
      const sub = typeof choice === 'object' ? choice.sub : null;
      const symbol = typeof choice === 'object' ? choice.symbol : null;
      btn.className = 'ob-btn';
      const isSelected = current.multi
        ? answers[current.key]?.includes(index)
        : answers[current.key] === index;
      if (isSelected) btn.classList.add('ob-btn-selected');
      btn.innerHTML = `${symbol ? `<span class="ob-choice-symbol">${symbol}</span>` : ''}<span class="ob-btn-label">${label}</span>${sub ? `<span class="ob-btn-sub">${sub.replace(/\n/g, '<br>')}</span>` : ''}`;
      btn.addEventListener('click', () => {
        if (current.multi) {
          const selected = new Set(answers[current.key] || []);
          if (selected.has(index)) selected.delete(index);
          else selected.add(index);
          answers[current.key] = [...selected].sort((a, b) => a - b);
          answers[`${current.key}_value`] = answers[current.key].map(i => {
            const item = current.choices[i];
            return typeof item === 'object' ? item.label : item;
          });
          btn.classList.toggle('ob-btn-selected', selected.has(index));
          if (multiStatus) {
            multiStatus.textContent = `${copy.multiHint} - ${answers[current.key].length} ${copy.selectedLabel}`;
          }
        } else {
          answers[current.key] = index;
          answers[`${current.key}_value`] = label;
        if (current.key === 'language') {
          setLang(index === 0 ? 'fr' : 'en');
          copy = introCopy();
          steps = options.keys?.length
            ? copy.steps.filter(s => options.keys.includes(s.key))
            : copy.steps;
        }
          choices.querySelectorAll('.ob-btn').forEach(b => b.classList.remove('ob-btn-selected'));
          btn.classList.add('ob-btn-selected');
        }
        btn.classList.add('ob-answer-pop');
        setTimeout(() => btn.classList.remove('ob-answer-pop'), 420);
        const impactText = current.multi
          ? (answers[current.key] || []).map(i => current.impact?.[i]).filter(Boolean).join(' + ')
          : current.impact?.[index] || '';
        showImpact(overlay, impactText);
        continuer.disabled = current.multi ? !(answers[current.key]?.length) : false;
      });
      choices.appendChild(btn);
    });
    panel.appendChild(choices);

    continuer.addEventListener('click', () => {
      if (answers[current.key] === undefined) return;
      step++;
      if (step >= steps.length) {
        (options.apply || applyOnboardingAnswers)(answers);
        exitCurrentStep(overlay, () => {
          overlay.remove();
          onComplete?.();
        });
      } else {
        exitCurrentStep(overlay, render);
      }
    });
    panel.appendChild(continuer);
    stepWrap.appendChild(panel);
    overlay.appendChild(stepWrap);

    requestAnimationFrame(() => stepWrap.classList.add('ob-step-visible'));
  }

  render();
}

function currentEquationConfigAnswers() {
  const topicIndex = { '+': 0, '-': 1, '*': 2, '/': 3 };
  const selected = Array.isArray(G.focusOperations) && G.focusOperations.length
    ? G.focusOperations
    : G.focusOperation ? [G.focusOperation] : [];
  return {
    hardTopic: selected.map(op => topicIndex[op]).filter(i => i !== undefined),
    startMode: G.onboardingStartMode === 'placement' || G.pendingPlacement ? 1 : 0,
  };
}

function createOverlay() {
  document.getElementById('onboarding-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  document.body.appendChild(overlay);
  return overlay;
}

function showImpact(root, text) {
  let impact = root.querySelector('.ob-impact');
  if (!impact) {
    impact = document.createElement('div');
    impact.className = 'ob-impact';
    root.appendChild(impact);
  }
  impact.textContent = text;
  impact.classList.remove('ob-impact-show');
  requestAnimationFrame(() => impact.classList.add('ob-impact-show'));
}

function exitCurrentStep(root, done) {
  const current = root.querySelector('.ob-step');
  if (!current) {
    done();
    return;
  }
  current.classList.remove('ob-step-visible');
  current.classList.add('ob-step-leave');
  setTimeout(done, 260);
}

function applyOnboardingAnswers(answers) {
  if (answers.language !== undefined) {
    setLang(answers.language === 0 ? 'fr' : 'en');
    save('onboardingLanguage', answers.language === 0 ? 'fr' : 'en');
  }
  const grade = Math.min(6, Math.max(1, (answers.ageGroup ?? 0) + 1));
  const placementMap = { 1: 1, 2: 4, 3: 7, 4: 10, 5: 13, 6: 16 };
  const wantsPlacement = answers.startMode === 1;
  G.onboardingAgeGroup = grade <= 2 ? 0 : grade <= 4 ? 1 : 2;
  G.onboardingGrade = grade;
  G.currentLevel = wantsPlacement ? (placementMap[grade] ?? 1) : 1;
  G.playerGrade = grade;

  const topicMap = { 0: '+', 1: '-', 2: '*', 3: '/' };
  const hardTopics = Array.isArray(answers.hardTopic) ? answers.hardTopic : [answers.hardTopic];
  G.focusOperations = hardTopics.map(i => topicMap[i]).filter(Boolean);
  G.focusOperation = G.focusOperations[0] ?? null;

  G.likesMath = answers.likesMath === 0;
  G.practiceTimeLimit = G.likesMath ? 10 : 14;
  G.pendingPlacement = wantsPlacement;
  G.tutorialMode = true;
  G.tutorialCompleted = false;
  G.onboardingStartMode = G.pendingPlacement ? 'placement' : 'bases';
  G.tutorialProgress = {
    active: true,
    round: 1,
    questionsAnswered: 0,
    correctAnswers: 0,
    stats: { total: 0, correct: 0, timeouts: 0, ops: {} },
    currentLevel: G.currentLevel,
  };

  const goalMap = { 0: 1, 1: 5, 2: 10 };
  const lengthMap = { 0: 'short', 1: 'normal', 2: 'long' };
  G.dailyGoalMinutes = goalMap[answers.dailyGoal] ?? 5;
  G.onboardingLevelLength = lengthMap[answers.dailyGoal] ?? 'normal';
  G.hasSeenOnboarding = true;

  save('currentLevel', G.currentLevel);
  save('playerGrade', G.playerGrade);
  save('likesMath', !!G.likesMath);
  save('onboardingAgeGroup', G.onboardingAgeGroup);
  save('onboardingGrade', G.onboardingGrade);
  save('practiceTimeLimit', G.practiceTimeLimit);
  save('focusOperation', G.focusOperation ?? '');
  save('focusOperations', G.focusOperations ?? []);
  save('pendingPlacement', !!G.pendingPlacement);
  save('tutorialMode', !!G.tutorialMode);
  save('tutorialCompleted', false);
  save('tutorialProgress', G.tutorialProgress);
  save('onboardingStartMode', G.onboardingStartMode);
  save('dailyGoalMinutes', G.dailyGoalMinutes);
  save('onboardingLevelLength', G.onboardingLevelLength);
  save('hasSeenOnboarding', true);
  if (G.playerRegistered) {
    import('../systems/cloud-save.js').then(m => m.pushCloudSave()).catch(() => {});
  }
}

function applyEquationConfigAnswers(answers) {
  const grade = Math.min(6, Math.max(1, G.onboardingGrade || G.playerGrade || 1));
  const placementMap = { 1: 1, 2: 4, 3: 7, 4: 10, 5: 13, 6: 16 };
  const topicMap = { 0: '+', 1: '-', 2: '*', 3: '/' };
  const hardTopics = Array.isArray(answers.hardTopic) ? answers.hardTopic : [answers.hardTopic];
  const focusOperations = hardTopics.map(i => topicMap[i]).filter(Boolean);

  G.focusOperations = focusOperations.length ? focusOperations : ['+'];
  G.focusOperation = G.focusOperations[0] ?? null;
  G.pendingPlacement = answers.startMode === 1;
  G.onboardingStartMode = G.pendingPlacement ? 'placement' : 'bases';
  G.currentLevel = G.pendingPlacement ? (placementMap[grade] ?? 1) : 1;
  G.tutorialMode = G.pendingPlacement;
  G.tutorialCompleted = !G.pendingPlacement;
  G.tutorialProgress = G.pendingPlacement ? {
    active: true,
    round: 1,
    questionsAnswered: 0,
    correctAnswers: 0,
    stats: { total: 0, correct: 0, timeouts: 0, ops: {} },
    currentLevel: G.currentLevel,
  } : null;

  save('focusOperation', G.focusOperation ?? '');
  save('focusOperations', G.focusOperations ?? []);
  save('pendingPlacement', !!G.pendingPlacement);
  save('onboardingStartMode', G.onboardingStartMode);
  save('currentLevel', G.currentLevel);
  save('tutorialMode', !!G.tutorialMode);
  save('tutorialCompleted', !!G.tutorialCompleted);
  save('tutorialProgress', G.tutorialProgress);

  if (G.playerRegistered) {
    import('../systems/cloud-save.js').then(m => m.pushCloudSave()).catch(() => {});
  }
}
